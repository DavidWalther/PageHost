const postgres = require('postgres');
const { PostgresActions } = require('../pgConnector.js');

/**
 * `PostgresActions` hält den Verbindungspool **prozessweit**.
 *
 * Das ist die Zusicherung, um die es hier vor allem geht: früher legte jede
 * Instanz einen eigenen Pool an und `closeConnection: true` riss ihn nach der
 * Abfrage wieder ab. Gemessen kostete das ~19 ms Handshake bei ~1 ms Abfrage.
 * Wer diese Tests rot macht, hat den Handshake zurückgeholt.
 */

let mockQueryResult = [
  { id: 1, name: 'test' },
  { id: 2, name: 'test2' },
];

jest.mock('postgres');
let mockUnsafe = jest.fn().mockResolvedValue(mockQueryResult);
let mockBegin = jest.fn();
let mockEnd = jest.fn().mockResolvedValue(undefined);
postgres.mockImplementation(() => {
  return {
    unsafe: mockUnsafe,
    begin: mockBegin,
    end: mockEnd,
  };
});

describe('PostgresActions', () => {
  let MOCK_ENVIRONMENT;

  beforeEach(async () => {
    // Der Pool ist statisch und überlebt sonst den einzelnen Test.
    await PostgresActions.closePool();

    MOCK_ENVIRONMENT = {
      PGHOST: 'localhost',
      PGDATABASE: 'test',
      PGUSER: 'test',
      PGPASSWORD: 'test',
      ENDPOINT_ID: 'test',
      PG_LOCAL_DB: 'true',
    };

    postgres.mockClear();
    mockUnsafe.mockClear();
    mockBegin.mockClear();
    mockEnd.mockClear();
  });

  describe('Verbindung', () => {
    it('verlangt ein Environment-Objekt', () => {
      expect(() => new PostgresActions()).toThrow(
        'Environment object is required'
      );
    });

    it('legt den Pool mit den Angaben der Umgebung an', () => {
      new PostgresActions(MOCK_ENVIRONMENT);

      expect(postgres).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          database: 'test',
          username: 'test',
          password: 'test',
          port: 5432,
        })
      );
    });

    it('nimmt für eine entfernte Datenbank SSL und die Projekt-Option dazu', () => {
      new PostgresActions({ ...MOCK_ENVIRONMENT, PG_LOCAL_DB: 'false' });

      expect(postgres).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: 'require',
          connection: { options: 'project=test' },
        })
      );
    });
  });

  describe('Geteilter Pool', () => {
    it('legt den Pool nur einmal an, egal wie viele Instanzen es gibt', () => {
      // DER Regressionswächter: früher war das ein Pool je Instanz und damit
      // ein TCP-Handshake je Abfrage.
      const first = new PostgresActions(MOCK_ENVIRONMENT);
      const second = new PostgresActions(MOCK_ENVIRONMENT);
      const third = new PostgresActions(MOCK_ENVIRONMENT);

      expect(postgres).toHaveBeenCalledTimes(1);
      expect(second.sql).toBe(first.sql);
      expect(third.sql).toBe(first.sql);
    });

    it('beendet den Pool nach einer Abfrage nicht', async () => {
      const connector = new PostgresActions(MOCK_ENVIRONMENT);

      await connector.executeParameterizedSql('SELECT 1');

      expect(mockEnd).not.toHaveBeenCalled();
    });

    it('beendet den Pool auch nach einer gescheiterten Abfrage nicht', async () => {
      const connector = new PostgresActions(MOCK_ENVIRONMENT);
      mockUnsafe.mockRejectedValueOnce(new Error('syntax error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(connector.executeParameterizedSql('SELECT')).rejects.toThrow(
        'syntax error'
      );
      expect(mockEnd).not.toHaveBeenCalled();

      console.error.mockRestore();
    });

    it('gibt einer anderen Datenbank einen eigenen Pool', () => {
      new PostgresActions(MOCK_ENVIRONMENT);
      new PostgresActions({ ...MOCK_ENVIRONMENT, PGDATABASE: 'andere' });

      // Der alte Pool wird dabei geschlossen — er gehört zu einer Datenbank,
      // die niemand mehr anfragt.
      expect(postgres).toHaveBeenCalledTimes(2);
      expect(mockEnd).toHaveBeenCalledTimes(1);
    });

    it('closePool beendet den Pool und lässt den nächsten neu entstehen', async () => {
      new PostgresActions(MOCK_ENVIRONMENT);

      await PostgresActions.closePool();
      expect(mockEnd).toHaveBeenCalledTimes(1);

      new PostgresActions(MOCK_ENVIRONMENT);
      expect(postgres).toHaveBeenCalledTimes(2);
    });

    it('closePool ist ohne Pool wirkungslos', async () => {
      await expect(PostgresActions.closePool()).resolves.toBeUndefined();
      expect(mockEnd).not.toHaveBeenCalled();
    });
  });

  describe('Poolgröße aus der Umgebung', () => {
    it('nimmt die Standardwerte, wenn nichts gesetzt ist', () => {
      new PostgresActions(MOCK_ENVIRONMENT);

      expect(postgres).toHaveBeenCalledWith(
        expect.objectContaining({ max: 10, idle_timeout: 30 })
      );
    });

    it('nimmt PG_POOL_MAX_COUNT und PG_IDLE_TIMEOUT_SECONDS, wenn gesetzt', () => {
      new PostgresActions({
        ...MOCK_ENVIRONMENT,
        PG_POOL_MAX_COUNT: '4',
        PG_IDLE_TIMEOUT_SECONDS: '90',
      });

      expect(postgres).toHaveBeenCalledWith(
        expect.objectContaining({ max: 4, idle_timeout: 90 })
      );
    });

    it('fällt bei einem unbrauchbaren Wert auf den Standard zurück', () => {
      new PostgresActions({ ...MOCK_ENVIRONMENT, PG_POOL_MAX_COUNT: 'viele' });

      expect(postgres).toHaveBeenCalledWith(
        expect.objectContaining({ max: 10 })
      );
    });
  });

  describe('executeParameterizedSql', () => {
    it('bindet die Parameter, statt sie in den String zu setzen', async () => {
      const connector = new PostgresActions(MOCK_ENVIRONMENT);
      const TEST_SQL = 'SELECT * FROM app WHERE name = $1';

      const result = await connector.executeParameterizedSql(TEST_SQL, [
        'testApp',
      ]);

      expect(mockUnsafe).toHaveBeenCalledWith(TEST_SQL, ['testApp']);
      expect(result).toStrictEqual(mockQueryResult);
    });

    it('kommt ohne Parameter aus', async () => {
      const connector = new PostgresActions(MOCK_ENVIRONMENT);

      await connector.executeParameterizedSql('SELECT 1');

      expect(mockUnsafe).toHaveBeenCalledWith('SELECT 1', []);
    });
  });

  describe('transaction', () => {
    it('führt den Callback auf der Verbindung der Transaktion aus', async () => {
      const connector = new PostgresActions(MOCK_ENVIRONMENT);
      const transactionUnsafe = jest.fn().mockResolvedValue([{ id: 'x' }]);
      mockBegin.mockImplementation((callback) =>
        callback({ unsafe: transactionUnsafe })
      );

      const result = await connector.transaction(async (run) =>
        run('DELETE FROM node WHERE id = $1', ['n-1'])
      );

      expect(transactionUnsafe).toHaveBeenCalledWith(
        'DELETE FROM node WHERE id = $1',
        ['n-1']
      );
      expect(result).toEqual([{ id: 'x' }]);
    });

    it('beendet den Pool auch bei einem Fehler nicht', async () => {
      const connector = new PostgresActions(MOCK_ENVIRONMENT);
      mockBegin.mockRejectedValueOnce(new Error('rollback'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(connector.transaction(async () => {})).rejects.toThrow(
        'rollback'
      );
      expect(mockEnd).not.toHaveBeenCalled();

      console.error.mockRestore();
    });
  });
});
