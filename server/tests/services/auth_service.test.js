const authService = require('../../src/services/auth_service');
const user_model = require('../../src/models/user_model');
const refresh_token_model = require('../../src/models/refresh_token_model');

jest.mock('../../src/models/user_model');
jest.mock('../../src/models/refresh_token_model');

// Optional: Mock bcrypt to avoid hashing lag during tests
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword'),
  compare: jest.fn().mockResolvedValue(true)
}));

describe('Auth Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register_user', () => {
    it('should successfully register a new user', async () => {
      user_model.find_by_email.mockResolvedValue(null);
      
      const mockCreatedUser = { id: 'user1', username: 'testuser', email: 'test@test.com' };
      user_model.create_user.mockResolvedValue(mockCreatedUser);

      const new_user = await authService.register_user('testuser', 'test@test.com', 'password123');

      expect(user_model.find_by_email).toHaveBeenCalledWith('test@test.com');
      expect(user_model.create_user).toHaveBeenCalled();
      
      expect(new_user).not.toHaveProperty('password');
      expect(new_user.username).toBe('testuser');
    });

    it('should throw an error if user with email already exists', async () => {
      user_model.find_by_email.mockResolvedValue({ id: 'exists' });

      await expect(authService.register_user('testuser', 'test@test.com', 'password123')).rejects.toThrow('An account with this email already exists.');
    });
  });
});
