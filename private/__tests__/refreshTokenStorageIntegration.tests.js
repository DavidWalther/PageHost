/**
 * Integrationstest des Schreib- und Lesewegs von `identity.refreshtoken`.
 *
 * Echt laufen `RefreshEndpoint`, `CodeExchangeEndpoint`, `DataFacade`,
 * `DataStorage`, `ActionUpdate` und `ActionGet` sowie die Token-Dienste.
 * Gemockt ist nur externe I/O: `pgConnector`, `DataCache2`, Logging und der
 * `OpenIdConnectClient`.
 *
 * **Warum dieser Test tiefer greift als die übrigen.** Der Refresh brach an
 * einer Stelle, die kein bestehender Test sehen konnte: unterhalb des
 * `pgConnector`, im Serializer des `postgres`-Treibers. Ein gebundener Wert
 * bekommt seinen Typ vom Server beschrieben; für eine `jsonb`-Spalte ist das
 * OID 3802, und für diesen Typ wendet der Treiber beim `Bind` `JSON.stringify`
 * an. Wer den Wert vorher selbst codiert, codiert ihn zweimal — in der Spalte
 * steht dann ein JSON-**String**, und `refreshtoken->>'token'` findet nichts
 * mehr.
 *
 * Die Postgres-Attrappe unten geht deshalb denselben Weg wie der Server: Sie
 * serialisiert den gebundenen Wert mit dem **echten** Serializer des
 * installierten Treibers und parst das Ergebnis als jsonb in die Zeile.
 */

const path = require('path');

jest.mock('../database2/DataStorage/pgConnector.js');
jest.mock('../database2/DataCache/DataCache.js');
jest.mock('../modules/logging');
jest.mock('../modules/oAuth2/OpenIdConnectClient.js');

const { PostgresActions } = require('../database2/DataStorage/pgConnector.js');
const { DataCache2 } = require('../database2/DataCache/DataCache.js');
const OpenIdConnectClient = require('../modules/oAuth2/OpenIdConnectClient.js');

const RefreshEndpoint = require('../endpoints/api/1.0/auth/RefreshEndpoint.js');
const CodeExchangeEndpoint = require('../endpoints/api/1.0/auth/oAuth2/CodeExchangeEndpoint.js');
const RefreshTokenService = require('../modules/oAuth2/RefreshTokenService.js');

// ─── Der echte Serializer des Treibers ─────────────────────────────────────
//
// Der Treiber gibt seine Serializer nicht über die Paket-Schnittstelle heraus
// (`exports` lässt nur den Einstiegspunkt zu); deshalb der Weg über die
// Nachbardatei. Bricht dieses `require`, hat der Treiber seinen Aufbau
// geändert — und dann soll dieser Test es melden, statt still eine Nachbildung
// zu prüfen, die mit dem Original nichts mehr zu tun hat.
const driverEntry = require.resolve('postgres');
const { serializers } = require(
  path.join(path.dirname(driverEntry), 'types.js')
);

const JSONB = 3802;

const SERVER_SECRET = 'integrations-geheimnis';
const APPLICATION_KEY = 'refreshApp';
const USER_KEY = 'user@test.com';

const ENVIRONMENT = Object.freeze({
  AUTH_SERVER_SECRET: SERVER_SECRET,
  AUTH_REFRESH_TOKEN_LIFETIME_DAYS: '7',
  AUTH_CLOCK_SKEW_SECONDS: '30',
  APPLICATION_APPLICATION_KEY: APPLICATION_KEY,
  APPLICATION_ACTIVE_ACTIONS: JSON.stringify(['login', 'edit']),
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  AUTH_OIDC_AUTH_URL: 'https://localhost',
  CACHE_KEY_PREFIX: 'TEST',
});

// ─── Postgres-Attrappe ─────────────────────────────────────────────────────

/** Nur `refreshtoken` ist eine JSON-Spalte; alles andere ist Text. */
const COLUMN_TYPE_OID = { refreshtoken: JSONB };

/** Eine Zeile der Tabelle `identity`, wie sie im Test lebt. */
let identityRow;

/**
 * Was der Server aus einem gebundenen Wert macht: Der Treiber serialisiert ihn
 * zu Text, der Server parst diesen Text in den Spaltentyp.
 */
function storeAsPostgresWould(column, boundValue) {
  if (boundValue === null || boundValue === undefined) {
    return null;
  }
  const oid = COLUMN_TYPE_OID[column];
  const wireText = serializers[oid]
    ? serializers[oid](boundValue)
    : '' + boundValue;
  return oid === JSONB ? JSON.parse(wireText) : wireText;
}

/**
 * Wert eines Ausdrucks aus der WHERE-Klausel.
 *
 * `->>` liefert nur bei einem JSON-**Objekt** ein Feld. Steht in der Spalte ein
 * String-Skalar, ist das Ergebnis `NULL` — und `NULL = $n` trifft nie. Genau
 * daran scheitert der Refresh in Wirklichkeit.
 */
function fieldValue(row, expression) {
  const jsonAccess = expression.match(/^(\w+)->>'(\w+)'$/);
  if (!jsonAccess) {
    return row[expression.toLowerCase()];
  }
  const stored = row[jsonAccess[1].toLowerCase()];
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return null;
  }
  const value = stored[jsonAccess[2]];
  return value === undefined ? null : value;
}

/** Alle Bedingungen der Form `<ausdruck> = $n` aus einem Statement. */
function boundComparisons(clause) {
  return [
    ...clause.matchAll(/([A-Za-z_]+(?:->>'[A-Za-z_]+')?) = \$(\d+)/g),
  ].map(([, expression, position]) => ({
    expression,
    position: Number(position),
  }));
}

function runStatement(sql, parameters) {
  if (sql.startsWith('UPDATE identity')) {
    const setClause = sql.slice(
      sql.indexOf(' SET ') + 5,
      sql.indexOf(' WHERE ')
    );
    boundComparisons(setClause).forEach(({ expression, position }) => {
      identityRow[expression.toLowerCase()] = storeAsPostgresWould(
        expression.toLowerCase(),
        parameters[position - 1]
      );
    });
    return [{ ...identityRow }];
  }

  if (sql.startsWith('SELECT')) {
    const matches = boundComparisons(sql.slice(sql.indexOf(' WHERE '))).every(
      ({ expression, position }) =>
        fieldValue(identityRow, expression) === parameters[position - 1]
    );
    return matches ? [{ ...identityRow }] : [];
  }

  return [];
}

// ─── Aufbau ────────────────────────────────────────────────────────────────

function responseSpy() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return response;
    },
  };
  return response;
}

/** Ein echter, signierter Refresh-Token samt seiner Nutzlast. */
function newRefreshToken() {
  const jwtString = RefreshTokenService.createRefreshToken(SERVER_SECRET, 7);
  return {
    jwtString,
    payload: RefreshTokenService.verifyRefreshToken(jwtString, SERVER_SECRET),
  };
}

async function refreshWith(refreshTokenJwt) {
  const response = responseSpy();
  await new RefreshEndpoint()
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({ body: { refresh_token: refreshTokenJwt } })
    .setResponseObject(response)
    .execute();
  return response;
}

function base64(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

async function loginWithCodeExchange() {
  OpenIdConnectClient.mockImplementation(() => {
    const client = {
      setRedirectUri: () => client,
      setClientId: () => client,
      setClientSecret: () => client,
      setWellKnownEndpoint: () => client,
      setCodeVerifier: () => client,
      setClockSkew: () => client,
      exchangeAuthorizationCode: async () => ({
        id_token: [
          base64({ alg: 'RS256' }),
          base64({
            email: USER_KEY,
            given_name: 'Test',
            family_name: 'Nutzer',
            name: 'Test Nutzer',
            picture: 'https://localhost/bild.png',
          }),
          base64({ signature: true }),
        ].join('.'),
      }),
    };
    return client;
  });

  const response = responseSpy();
  await new CodeExchangeEndpoint()
    .setEnvironment(ENVIRONMENT)
    .setRequestObject({
      protocol: 'https',
      secure: true,
      hostname: 'localhost',
      port: 443,
      path: '/api/1.0/oAuth2/codeexchange',
      query: {},
      get: () => 'localhost',
      body: {
        state: 'zustand-1',
        auth_code: 'code-1',
        code_verifier: 'verifier-1',
      },
    })
    .setResponseObject(response)
    .execute();
  return response;
}

beforeEach(() => {
  identityRow = {
    id: 'identity-001',
    recordnumber: 1,
    key: USER_KEY,
    active: true,
    createddate: '2026-01-01',
    applicationincluded: '*',
    applicationexcluded: null,
    refreshtoken: null,
  };

  PostgresActions.mockReset();
  PostgresActions.mockImplementation(() => ({
    executeParameterizedSql: jest.fn(async (sql, parameters = []) =>
      runStatement(sql, parameters)
    ),
    transaction: jest.fn(async (callback) =>
      callback(async (sql, parameters = []) => runStatement(sql, parameters))
    ),
  }));

  DataCache2.mockReset();
  DataCache2.mockImplementation(() => ({
    // Der Zustandsschlüssel gilt, der Auth-Code ist noch nicht benutzt.
    get: jest.fn(async (key) => key.includes('auth-state')),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
  }));

  OpenIdConnectClient.mockReset();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Refresh-Token in der Datenbank', () => {
  it('findet den Token, den der vorige Refresh geschrieben hat', async () => {
    const erster = newRefreshToken();
    identityRow.refreshtoken = erster.payload;

    const ersteAntwort = await refreshWith(erster.jwtString);
    expect(ersteAntwort.statusCode).toBe(200);

    const nachfolger =
      ersteAntwort.body.authenticationResult.refresh.refresh_token;

    // Der Kern: der eben ausgegebene Token muss beim nächsten Mal gefunden
    // werden. Wird er escaped abgelegt, trifft `refreshtoken->>'token'` ins
    // Leere und hier steht 401.
    const zweiteAntwort = await refreshWith(nachfolger);
    expect(zweiteAntwort.statusCode).toBe(200);
    expect(
      zweiteAntwort.body.authenticationResult.refresh.refresh_token
    ).toEqual(expect.any(String));
  });

  it('legt beim Refresh ein JSON-Objekt in der Spalte ab, keine Zeichenkette', async () => {
    const erster = newRefreshToken();
    identityRow.refreshtoken = erster.payload;

    await refreshWith(erster.jwtString);

    expect(typeof identityRow.refreshtoken).toBe('object');
    expect(identityRow.refreshtoken).toEqual({
      token: expect.any(String),
      issuedAt: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it('legt beim Login ein JSON-Objekt ab, das der Refresh danach findet', async () => {
    const antwort = await loginWithCodeExchange();
    expect(antwort.statusCode).toBe(200);

    expect(typeof identityRow.refreshtoken).toBe('object');
    expect(identityRow.refreshtoken).toEqual({
      token: expect.any(String),
      issuedAt: expect.any(String),
      expiresAt: expect.any(String),
    });

    const ausgegeben = antwort.body.authenticationResult.refresh.refresh_token;
    expect((await refreshWith(ausgegeben)).statusCode).toBe(200);
  });

  it('weist einen unbekannten Token weiterhin ab', async () => {
    identityRow.refreshtoken = newRefreshToken().payload;

    const fremder = newRefreshToken();
    const antwort = await refreshWith(fremder.jwtString);

    expect(antwort.statusCode).toBe(401);
    expect(antwort.body).toEqual({ error: 'Invalid refresh token' });
  });
});

describe('Serializer des postgres-Treibers (Kanarienvogel)', () => {
  /**
   * Diese Zusicherungen prüfen nicht unseren Code, sondern die Annahme, auf der
   * er steht. Ändert der Treiber sie, schlägt hier auf — statt still in der
   * Anmeldung.
   */
  it('macht aus einem Objekt ein JSON-Objekt', () => {
    expect(serializers[JSONB]).toEqual(expect.any(Function));
    expect(serializers[JSONB]({ token: 'abc' })).toBe('{"token":"abc"}');
  });

  it('codiert eine bereits codierte Zeichenkette ein zweites Mal', () => {
    const escaped = serializers[JSONB]('{"token":"abc"}');

    expect(escaped).toBe('"{\\"token\\":\\"abc\\"}"');
    // Was davon in der Spalte ankäme: ein String-Skalar, kein Objekt.
    expect(typeof JSON.parse(escaped)).toBe('string');
  });
});
