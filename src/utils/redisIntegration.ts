import { redisService } from '../services/redisService';

/**
 * Example utility functions showing how to integrate Redis services
 * into existing application services
 */

/**
 * Cache user profile data with Redis
 */
export async function getCachedUserProfile(userId: string): Promise<any> {
  const cacheKey = `user_profile:${userId}`;
  
  return await redisService.cache.getOrSet(
    cacheKey,
    async () => {
      // This would normally fetch from database
      console.log(`Fetching user profile from database for user: ${userId}`);
      return {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'client',
        lastLogin: new Date().toISOString(),
      };
    },
    { ttl: 300 } // Cache for 5 minutes
  );
}

/**
 * Cache vendor services with Redis
 */
export async function getCachedVendorServices(vendorId: string): Promise<any[]> {
  const cacheKey = `vendor_services:${vendorId}`;
  
  return await redisService.cache.getOrSet(
    cacheKey,
    async () => {
      // This would normally fetch from database
      console.log(`Fetching vendor services from database for vendor: ${vendorId}`);
      return [
        {
          id: 'service-1',
          vendorId,
          title: 'Web Development',
          price: 500,
          description: 'Professional web development services',
        },
        {
          id: 'service-2',
          vendorId,
          title: 'Mobile App Development',
          price: 800,
          description: 'Native mobile app development',
        },
      ];
    },
    { ttl: 600 } // Cache for 10 minutes
  );
}

/**
 * Invalidate user-related cache when user data changes
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await redisService.cache.invalidateByTags([`user:${userId}`]);
  console.log(`Invalidated cache for user: ${userId}`);
}

/**
 * Example of using Redis sessions for user authentication
 */
export async function createUserSession(userId: string, userRole: 'client' | 'vendor', email: string): Promise<string> {
  const sessionId = await redisService.session.createSession(userId, userRole, email);
  console.log(`Created session ${sessionId} for user ${userId}`);
  return sessionId;
}

/**
 * Validate user session
 */
export async function validateUserSession(sessionId: string): Promise<any> {
  const sessionData = await redisService.session.getSession(sessionId);
  if (!sessionData) {
    throw new Error('Invalid or expired session');
  }
  return sessionData;
}

/**
 * Example of scheduling background jobs with Redis
 */
export async function scheduleVendorNotificationJob(
  vendorId: string,
  clientId: string,
  serviceId: string,
  action: 'cart_add' | 'wishlist_add'
): Promise<string> {
  const jobId = await redisService.scheduleVendorNotification(
    action,
    vendorId,
    clientId,
    serviceId
  );
  
  console.log(`Scheduled ${action} notification job ${jobId} for vendor ${vendorId}`);
  return jobId;
}

/**
 * Schedule response reminder for vendor
 */
export async function scheduleVendorResponseReminder(
  vendorId: string,
  clientId: string,
  conversationId: string,
  hoursDelay: number
): Promise<string> {
  const delayMs = hoursDelay * 60 * 60 * 1000; // Convert hours to milliseconds
  
  const jobId = await redisService.scheduleResponseReminder(
    vendorId,
    clientId,
    conversationId,
    hoursDelay,
    delayMs
  );
  
  console.log(`Scheduled response reminder for vendor ${vendorId} in ${hoursDelay} hours`);
  return jobId;
}

/**
 * Get Redis service health status
 */
export async function getRedisHealthStatus(): Promise<any> {
  const health = await redisService.healthCheck();
  const stats = await redisService.getStats();
  
  return {
    health,
    stats,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Example of using Redis for rate limiting
 */
export async function checkRateLimit(userId: string, action: string, maxRequests: number = 10, windowMs: number = 60000): Promise<boolean> {
  const key = `rate_limit:${userId}:${action}`;
  const window = Math.floor(Date.now() / windowMs);
  const windowKey = `${key}:${window}`;
  
  // Get current count
  const currentCount = await redisService.cache.get<number>(windowKey) || 0;
  
  if (currentCount >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  // Increment counter
  await redisService.cache.set(windowKey, currentCount + 1, { ttl: Math.ceil(windowMs / 1000) });
  
  return true; // Request allowed
}

/**
 * Example of using Redis for distributed locking
 */
export async function acquireDistributedLock(resource: string, ttlSeconds: number = 30): Promise<string | null> {
  const lockKey = `lock:${resource}`;
  const lockValue = `${Date.now()}-${Math.random()}`;
  
  // Try to acquire lock
  const client = redisService.cache;
  const acquired = await client.getOrSet(
    lockKey,
    async () => lockValue,
    { ttl: ttlSeconds }
  );
  
  // Check if we got the lock
  if (acquired === lockValue) {
    console.log(`Acquired lock for resource: ${resource}`);
    return lockValue;
  }
  
  console.log(`Failed to acquire lock for resource: ${resource}`);
  return null;
}

/**
 * Release distributed lock
 */
export async function releaseDistributedLock(resource: string, lockValue: string): Promise<boolean> {
  const lockKey = `lock:${resource}`;
  
  // Get current lock value
  const currentValue = await redisService.cache.get<string>(lockKey);
  
  if (currentValue === lockValue) {
    await redisService.cache.delete(lockKey);
    console.log(`Released lock for resource: ${resource}`);
    return true;
  }
  
  console.log(`Failed to release lock for resource: ${resource} - lock value mismatch`);
  return false;
}