const recordService = require('../../src/services/record_service');
const record_model = require('../../src/models/record_model');

jest.mock('../../src/models/record_model');

describe('Record Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create_record', () => {
    it('should successfully create a record', async () => {
      const mockRecordData = {
        id: 'rec-123',
        type: 'income',
        amount: 500,
        category_id: 'cat-1',
        date: '2026-06-08',
        operator: '+',
        notes: 'Bonus'
      };

      record_model.find_by_id_any.mockResolvedValue(null);
      record_model.create.mockResolvedValue({ ...mockRecordData, user_id: 'user1' });

      const result = await recordService.create_record('user1', mockRecordData);

      expect(record_model.find_by_id_any).toHaveBeenCalledWith('rec-123');
      expect(record_model.create).toHaveBeenCalled();
    });

    it('should throw an error if record ID already exists', async () => {
      record_model.find_by_id_any.mockResolvedValue({ id: 'rec-123' });

      await expect(recordService.create_record('user1', { id: 'rec-123' })).rejects.toThrow();
    });
  });

  describe('get_records', () => {
    it('should return paginated records', async () => {
      record_model.find_many.mockResolvedValue([[{ id: 'rec-1' }, { id: 'rec-2' }], 2]);
      
      const params = { page: 1, limit: 10 };
      const result = await recordService.get_records('user1', params);
      
      expect(record_model.find_many).toHaveBeenCalled();
      expect(result.data.length).toBe(2);
      expect(result.pagination.total_items).toBe(2);
    });
  });
});
