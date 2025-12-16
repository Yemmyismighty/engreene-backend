import { redisService } from './redisService';
import { redisClient } from '../config/redis';

// Mock Redis client for testing
jest.mock('../config/redis', () => ({
  redisClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn().mockReturnValue({
      ping: jest.fn().mockResolvedValue('PONG'),
      setEx: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(0),
      sAdd: jest.fn().mockResolvedValue(1),
      sRem: jest.fn().mockResolvedValue(1),
      sMembers: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
      mGet: jest.fn().mockResolvedValue([]),
      hGet: jest.fn().mockResolvedValue('0'),
      hIncrBy: jest.fn().mockResolvedValue(1),
      zAdd: jest.fn().mockResolvedValue(1),
      zRem: jest.fn().mockResolvedValue(1),
      zRange: jest.fn().mockResolvedValue([]),
      zRangeByScore: jest.fn().mockResolvedValue([]),
      zCard: jest.fn().mockResolvedValue(0),
      multi: jest.fn().mockReturnValue({
        setEx: jest.fn().mockReturnThis(),
        sAdd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    }),
    isReady: jest.fn().mockReturnValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

describe('RedisService', () => {
  beforeAll(async () => {
    // Mock Redis initialization
    jest.spyOn(redisService, 'initialize').mockResolvedValue(undefined);
  });

  afterAll(async () => {
    // Mock cleanup
    jest.spyOn(redisService, 'shutdown').mockResolvedValue(undefined);
  });

  describe('Session Management', () => {
    it('should create a session', async () => {
      const sessionId = await redisService.session.createSession(
        'test-user-id',
        'client',
        'test@example.com'
      );

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should handle session validation', async () => {
      // Mock get to return null (session not found)
      const mockClient = redisClient.getClient();
      (mockClient.get as jest.Mock).mockResolvedValueOnce(null);

      const isValid = await redisService.session.isValidSession('non-existent-session');
      expect(isValid).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should set cache values', async () => {
      const testKey = 'test-cache-key';
      const testValue = { message: 'Hello, Redis!', timestamp: Date.now() };

      await redisService.cache.set(testKey, testValue);
      
      // Verify setEx was called
      const mockClient = redisClient.getClient();
      expect(mockClient.setEx).toHaveBeenCalled();
    });

    it('should handle cache misses', async () => {
      const nonExistentKey = 'non-existent-key';
      const value = await redisService.cache.get(nonExistentKey);
      expect(value).toBeNull();
    });

    it('should support getOrSet pattern', async () => {
      const testKey = 'get-or-set-key';
      const computedValue = { computed: true, value: 42 };

      // Mock cache miss first, then cache hit
      const mockClient = redisClient.getClient();
      (mockClient.get as jest.Mock)
        .mockResolvedValueOnce(null) // First call - cache miss
        .mockResolvedValueOnce(JSON.stringify(computedValue)); // Second call - cache hit

      const result = await redisService.cache.getOrSet(
        testKey,
        async () => computedValue,
        { ttl: 60 }
      );

      expect(result).toEqual(computedValue);
    });
  });

  describe('Job Queue Management', () => {
    it('should add jobs', async () => {
      const jobData = { message: 'Test job', timestamp: Date.now() };
      
      // Add a job
      const jobId = await redisService.jobQueue.addJob('test_job', jobData);
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should get queue statistics', async () => {
      const stats = await redisService.jobQueue.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.delayed).toBe('number');
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await redisService.healthCheck();
      expect(health).toBeDefined();
      expect(typeof health.redis).toBe('boolean');
      expect(typeof health.session).toBe('boolean');
      expect(typeof health.cache).toBe('boolean');
      expect(typeof health.queues.default).toBe('boolean');
      expect(typeof health.queues.notifications).toBe('boolean');
      expect(typeof health.queues.reminders).toBe('boolean');
    });
  });

  describe('Notification Scheduling', () => {
    it('should schedule vendor notifications', async () => {
      const jobId = await redisService.scheduleVendorNotification(
        'cart_add',
        'vendor-123',
        'client-456',
        'service-789'
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should schedule response reminders', async () => {
      const jobId = await redisService.scheduleResponseReminder(
        'vendor-123',
        'client-456',
        'conversation-789',
        8,
        1000 // 1 second delay for testing
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });
  });

  describe('Service Statistics', () => {
    it('should get comprehensive statistics', async () => {
      const stats = await redisService.getStats();
      expect(stats).toBeDefined();
      expect(stats.session).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.queues).toBeDefined();
      expect(stats.queues.default).toBeDefined();
      expect(stats.queues.notifications).toBeDefined();
      expect(stats.queues.reminders).toBeDefined();
    });
  });
});