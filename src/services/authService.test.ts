import { AuthService } from './authService';

// Mock Supabase
jest.mock('../config/supabase', () => {
  const mockSingle = jest.fn();
  const mockEq = jest.fn(() => ({ single: mockSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));

  return {
    supabase: {
      from: mockFrom,
    },
    supabaseAuth: {
      auth: {
        getUser: jest.fn(),
      },
    },
  };
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockSingle: jest.Mock;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
    
    // Get the mock from the mocked module
    const { supabase } = require('../config/supabase');
    mockSingle = supabase.from().select().eq().single;
  });

  describe('getUserRole', () => {
    it('should return client as default role when user not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      });

      const role = await authService.getUserRole('test-user-id');
      expect(role).toBe('client');
    });

    it('should return user role when user exists', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'vendor' },
        error: null,
      });

      const role = await authService.getUserRole('test-user-id');
      expect(role).toBe('vendor');
    });
  });

  describe('isVendor', () => {
    it('should return true for vendor users', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'vendor' },
        error: null,
      });

      const isVendor = await authService.isVendor('test-user-id');
      expect(isVendor).toBe(true);
    });

    it('should return false for client users', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'client' },
        error: null,
      });

      const isVendor = await authService.isVendor('test-user-id');
      expect(isVendor).toBe(false);
    });
  });

  describe('isClient', () => {
    it('should return true for client users', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'client' },
        error: null,
      });

      const isClient = await authService.isClient('test-user-id');
      expect(isClient).toBe(true);
    });

    it('should return false for vendor users', async () => {
      mockSingle.mockResolvedValue({
        data: { role: 'vendor' },
        error: null,
      });

      const isClient = await authService.isClient('test-user-id');
      expect(isClient).toBe(false);
    });
  });
});