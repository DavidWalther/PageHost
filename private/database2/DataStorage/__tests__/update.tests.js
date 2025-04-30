const { PostgresActions } = require('../pgConnector.js');
const { Logging } = require('../../../modules/logging');
const ActionUpdate = require('../actions/update.js');
const { TableParagraph } = require('../../tables/paragraph.js');

//jest.mock('../../../modules/logging');
jest.mock('../pgConnector.js');

describe('ActionUpdate', () => {
  let mockPgConnector;

  beforeEach(() => {
    mockPgConnector = {
      executeSql: jest.fn(),
    };
  });

  it('should successfully update a record and return the updated id', async () => {
    let mockTable = new TableParagraph();
    const updateAction = new ActionUpdate()
      .setPgConnector(mockPgConnector)
      .setTable(mockTable)
      .setValues({ id: '123', name: 'Updated Name', age: 30 });

    mockPgConnector.executeSql.mockResolvedValue([{ id: '123' }]);

    const result = await updateAction.execute();

    expect(mockPgConnector.executeSql).toHaveBeenCalledWith(
      `UPDATE ${mockTable.getTableName()()} SET name = 'Updated Name', age = 30 WHERE id = '123' RETURNING id;`
    );
    expect(result).toEqual({ id: '123' });
  });

  it('should throw an error if no id is provided in the data object', async () => {
    let mockTable = new TableParagraph();
    const updateAction = new ActionUpdate()
      .setPgConnector(mockPgConnector)
      .setTable(mockTable)
      .setValues({ name: 'Updated Name', age: 30 });

    await expect(updateAction.execute()).rejects.toEqual(
      "Update operation requires an 'id' field in the data object."
    );

    expect(mockPgConnector.executeSql).not.toHaveBeenCalled();
  });

  it('should handle SQL execution errors', async () => {
    let mockTable = new TableParagraph();
    const updateAction = new ActionUpdate()
      .setPgConnector(mockPgConnector)
      .setTable(mockTable)
      .setValues({ id: '123', name: 'Updated Name', age: 30 });

    mockPgConnector.executeSql.mockRejectedValue(new Error('SQL execution failed'));

    await expect(updateAction.execute()).rejects.toThrow('SQL execution failed');

    expect(mockPgConnector.executeSql).toHaveBeenCalledWith(
      `UPDATE ${mockTable.getTableName()()} SET name = 'Updated Name', age = 30 WHERE id = '123' RETURNING id;`
    );
  });

  it('should throw an error for unsupported value types', async () => {
    let mockTable = new TableParagraph();
    const updateAction = new ActionUpdate()
      .setPgConnector(mockPgConnector)
      .setTable(mockTable)
      .setValues({ id: '123', name: { first: 'John', last: 'Doe' } });

    await expect(updateAction.execute()).rejects.toThrow('Unsupported value type');

    expect(mockPgConnector.executeSql).not.toHaveBeenCalled();
  });
});