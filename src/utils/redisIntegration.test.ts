import {
  getCachedUserProfile,
  getCachedVendorServices,
  createUserSession,
  validateUserSession,
  checkRateLimit,
  getRedisHealthStatus,
} from './redisIntegration';

// Mock the Redis service
jest.mock('../services/redisService', () => ({
  redisService: {
    cache: {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidateByTags: jest.fn(),
    },
    session: {
      createSession: jest.fn(),
      getSession: jest.fn(),
    },
    scheduleVendorNotification: jest.fn(),
    scheduleResponseReminder: jest.fn(),
    healthCheck: jest.fn(),
    getStats: jest.fn(),
  },
}));

describe('Redis Integration Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Profile Caching', () => {
    it('should cache and retrieve user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'client',
      };

      const { redisService } = require('../services/redisService');
      redisService.cache.getOrSet.mockResolvedValue(mockProfile);

      const result = await getCachedUserProfile('user-123');
      
      expect(result).toEqual(mockProfile);
      expect(redisService.cache.getOrSet).toHaveBeenCalledWith(
        'user_profile:user-123',
        expect.any(Function),
        { ttl: 300 }
      );
    });
  });

  describe('Vendor Services Caching', () => {
    it('should cache and retrieve vendor services', async () => {
      const mockServices = [
        {
          id: 'service-1',
          vendorId: 'vendor-123',
          title: 'Web Development',
          price: 500,
        },
      ];

      const { redisService } = require('../services/redisService');
      redisService.cache.getOrSet.mockResolvedValue(mockServices);

      const result = await getCachedVendorServices('vendor-123');
      
      expect(result).toEqual(mockServices);
      expect(redisService.cache.getOrSet).toHaveBeenCalledWith(
        'vendor_services:vendor-123',
        expect.any(Function),
        { ttl: 600 }
      );
    });
  });

  describe('Session Management', () => {
    it('should create user session', async () => {
      const { redisService } = require('../services/redisService');
      redisService.session.createSession.mockResolvedValue('session-123');

      const sessionId = await createUserSession('user-123', 'client', 'user@example.com');
      
      expect(sessionId).toBe('session-123');
      expect(redisService.session.createSession).toHaveBeenCalledWith(
        'user-123',
        'client',
        'user@example.com'
      );
    });

    it('should validate user session', async () => {
      const mockSessionData = {
        userId: 'user-123',
        userRole: 'client',
        email: 'user@example.com',
      };

      const { redisService } = require('../services/redisService');
      redisService.session.getSession.mockResolvedValue(mockSessionData);

      const result = await validateUserSession('session-123');
      
      expect(result).toEqual(mockSessionData);
      expect(redisService.session.getSession).toHaveBeenCalledWith('session-123');
    });

    it('should throw error for invalid session', async () => {
      const { redisService } = require('../services/redisService');
      redisService.session.getSession.mockResolvedValue(null);

      await expect(validateUserSession('invalid-session')).rejects.toThrow('Invalid or expired session');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow request within rate limit', async () => {
      const { redisService } = require('../services/redisService');
      redisService.cache.get.mockResolvedValue(5); // Current count
      redisService.cache.set.mockResolvedValue(undefined);

      const allowed = await checkRateLimit('user-123', 'api_call', 10, 60000);
      
      expect(allowed).toBe(true);
      expect(redisService.cache.set).toHaveBeenCalled();
    });

    it('should deny request when rate limit exceeded', async () => {
      const { redisService } = require('../services/redisService');
      redisService.cache.get.mockResolvedValue(10); // At limit

      const allowed = await checkRateLimit('user-123', 'api_call', 10, 60000);
      
      expect(allowed).toBe(false);
      expect(redisService.cache.set).not.toHaveBeenCalled();
    });
  });

  describe('Health Status', () => {
    it('should get Redis health status', async () => {
      const mockHealth = { redis: true, session: true, cache: true };
      const mockStats = { session: {}, cache: {}, queues: {} };

      const { redisService } = require('../services/redisService');
      redisService.healthCheck.mockResolvedValue(mockHealth);
      redisService.getStats.mockResolvedValue(mockStats);

      const result = await getRedisHealthStatus();
      
      expect(result.health).toEqual(mockHealth);
      expect(result.stats).toEqual(mockStats);
      expect(result.timestamp).toBeDefined();
    });
  });
});