import { redisClient } from '../config/redis';
import { SessionService } from './sessionService';
import { CacheService } from './cacheService';
import { JobQueueService } from './jobQueueService';

/**
 * Unified Redis service that provides access to all Redis-based functionality
 */
class RedisService {
  private static instance: RedisService;
  
  public readonly session: SessionService;
  public readonly cache: CacheService;
  public readonly jobQueue: JobQueueService;
  public readonly notificationQueue: JobQueueService;
  public readonly reminderQueue: JobQueueService;

  private constructor() {
    this.session = new SessionService();
    this.cache = new CacheService();
    this.jobQueue = new JobQueueService('default');
    this.notificationQueue = new JobQueueService('notifications');
    this.reminderQueue = new JobQueueService('reminders');
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initialize Redis connection and start job processing
   */
  public async initialize(): Promise<void> {
    try {
      // Connect to Redis
      await redisClient.connect();
      
      // Setup job handlers
      this.setupJobHandlers();
      
      // Start job queue processing
      await this.jobQueue.startProcessing(1000);
      await this.notificationQueue.startProcessing(500);
      await this.reminderQueue.startProcessing(5000);
      
      console.log('✅ Redis service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Redis service:', error);
      throw error;
    }
  }

  /**
   * Shutdown Redis service gracefully
   */
  public async shutdown(): Promise<void> {
    try {
      // Stop job processing
      await this.jobQueue.stopProcessing();
      await this.notificationQueue.stopProcessing();
      await this.reminderQueue.stopProcessing();
      
      // Disconnect from Redis
      await redisClient.disconnect();
      
      console.log('✅ Redis service shutdown completed');
    } catch (error) {
      console.error('❌ Error during Redis service shutdown:', error);
      throw error;
    }
  }

  /**
   * Setup job handlers for different job types
   */
  private setupJobHandlers(): void {
    // Notification job handlers
    this.notificationQueue.registerHandler('vendor_cart_add', async (job) => {
      const { vendorId, clientId, serviceId } = job.data;
      console.log(`📧 Processing vendor cart notification: vendor=${vendorId}, client=${clientId}, service=${serviceId}`);
      
      // Here you would integrate with your notification service
      // For now, we'll just log the notification
      await this.cache.set(
        `notification:${vendorId}:${Date.now()}`,
        {
          type: 'cart_add',
          vendorId,
          clientId,
          serviceId,
          timestamp: new Date().toISOString(),
        },
        { ttl: 7 * 24 * 60 * 60 } // 7 days
      );
    });

    this.notificationQueue.registerHandler('vendor_wishlist_add', async (job) => {
      const { vendorId, clientId, serviceId } = job.data;
      console.log(`📧 Processing vendor wishlist notification: vendor=${vendorId}, client=${clientId}, service=${serviceId}`);
      
      await this.cache.set(
        `notification:${vendorId}:${Date.now()}`,
        {
          type: 'wishlist_add',
          vendorId,
          clientId,
          serviceId,
          timestamp: new Date().toISOString(),
        },
        { ttl: 7 * 24 * 60 * 60 } // 7 days
      );
    });

    // Reminder job handlers
    this.reminderQueue.registerHandler('response_reminder', async (job) => {
      const { vendorId, clientId, conversationId, hoursElapsed } = job.data;
      console.log(`⏰ Processing response reminder: vendor=${vendorId}, client=${clientId}, hours=${hoursElapsed}`);
      
      // Store reminder notification
      await this.cache.set(
        `reminder:${vendorId}:${conversationId}:${hoursElapsed}h`,
        {
          type: 'response_reminder',
          vendorId,
          clientId,
          conversationId,
          hoursElapsed,
          timestamp: new Date().toISOString(),
        },
        { ttl: 24 * 60 * 60 } // 24 hours
      );
    });

    this.reminderQueue.registerHandler('alternative_vendor_recommendation', async (job) => {
      const { clientId, originalVendorId, conversationId } = job.data;
      console.log(`🔄 Processing alternative vendor recommendation: client=${clientId}, originalVendor=${originalVendorId}`);
      
      // Store recommendation notification
      await this.cache.set(
        `recommendation:${clientId}:${conversationId}`,
        {
          type: 'alternative_vendor_recommendation',
          clientId,
          originalVendorId,
          conversationId,
          timestamp: new Date().toISOString(),
        },
        { ttl: 7 * 24 * 60 * 60 } // 7 days
      );
    });

    // General job handlers
    this.jobQueue.registerHandler('cleanup_expired_sessions', async (_job) => {
      console.log('🧹 Processing session cleanup job');
      
      // This would integrate with your session cleanup logic
      const stats = await this.session.getSessionStats();
      console.log(`Session cleanup completed. Active sessions: ${stats.activeSessions}`);
    });

    this.jobQueue.registerHandler('cache_warmup', async (job) => {
      const { keys } = job.data;
      console.log(`🔥 Processing cache warmup job for ${keys.length} keys`);
      
      // This would integrate with your cache warmup logic
      for (const key of keys) {
        // Warmup logic would go here
        console.log(`Warming up cache for key: ${key}`);
      }
    });
  }

  /**
   * Health check for Redis service
   */
  public async healthCheck(): Promise<{
    redis: boolean;
    session: boolean;
    cache: boolean;
    queues: {
      default: boolean;
      notifications: boolean;
      reminders: boolean;
    };
  }> {
    try {
      // Test Redis connection
      const pingResult = await redisClient.ping();
      const redisHealthy = pingResult === 'PONG';

      // Test session service
      const sessionStats = await this.session.getSessionStats();
      const sessionHealthy = typeof sessionStats.totalSessions === 'number';

      // Test cache service
      const cacheStats = await this.cache.getStats();
      const cacheHealthy = typeof cacheStats.keys === 'number';

      // Test job queues
      const [defaultStats, notificationStats, reminderStats] = await Promise.all([
        this.jobQueue.getStats(),
        this.notificationQueue.getStats(),
        this.reminderQueue.getStats(),
      ]);

      return {
        redis: redisHealthy,
        session: sessionHealthy,
        cache: cacheHealthy,
        queues: {
          default: typeof defaultStats.waiting === 'number',
          notifications: typeof notificationStats.waiting === 'number',
          reminders: typeof reminderStats.waiting === 'number',
        },
      };
    } catch (error) {
      console.error('Redis health check failed:', error);
      return {
        redis: false,
        session: false,
        cache: false,
        queues: {
          default: false,
          notifications: false,
          reminders: false,
        },
      };
    }
  }

  /**
   * Get comprehensive statistics for all Redis services
   */
  public async getStats(): Promise<{
    session: any;
    cache: any;
    queues: {
      default: any;
      notifications: any;
      reminders: any;
    };
  }> {
    const [sessionStats, cacheStats, defaultQueueStats, notificationQueueStats, reminderQueueStats] = await Promise.all([
      this.session.getSessionStats(),
      this.cache.getStats(),
      this.jobQueue.getStats(),
      this.notificationQueue.getStats(),
      this.reminderQueue.getStats(),
    ]);

    return {
      session: sessionStats,
      cache: cacheStats,
      queues: {
        default: defaultQueueStats,
        notifications: notificationQueueStats,
        reminders: reminderQueueStats,
      },
    };
  }

  /**
   * Schedule a vendor notification job
   */
  public async scheduleVendorNotification(
    type: 'cart_add' | 'wishlist_add',
    vendorId: string,
    clientId: string,
    serviceId: string
  ): Promise<string> {
    return await this.notificationQueue.addJob(
      type === 'cart_add' ? 'vendor_cart_add' : 'vendor_wishlist_add',
      { vendorId, clientId, serviceId },
      { priority: 5 }
    );
  }

  /**
   * Schedule a response reminder job
   */
  public async scheduleResponseReminder(
    vendorId: string,
    clientId: string,
    conversationId: string,
    hoursElapsed: number,
    delayMs: number
  ): Promise<string> {
    return await this.reminderQueue.addJob(
      'response_reminder',
      { vendorId, clientId, conversationId, hoursElapsed },
      { delay: delayMs, priority: 3 }
    );
  }

  /**
   * Schedule alternative vendor recommendation
   */
  public async scheduleAlternativeVendorRecommendation(
    clientId: string,
    originalVendorId: string,
    conversationId: string,
    delayMs: number
  ): Promise<string> {
    return await this.reminderQueue.addJob(
      'alternative_vendor_recommendation',
      { clientId, originalVendorId, conversationId },
      { delay: delayMs, priority: 2 }
    );
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();
export { RedisService };