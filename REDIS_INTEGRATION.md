# Redis Integration Guide

This document describes the Redis integration implemented for the Engreene Backend, providing session management, caching, and background job processing capabilities.

## Overview

The Redis integration consists of several key components:

- **Session Management**: Secure user session storage and retrieval
- **Caching Service**: High-performance data caching with TTL support
- **Job Queue System**: Background job processing with retry logic
- **Unified Redis Service**: Central service coordinating all Redis functionality

## Components

### 1. Redis Connection (`src/config/redis.ts`)

Manages the Redis client connection with automatic reconnection and error handling.

```typescript
import { redisClient } from '../config/redis';

// Connect to Redis
await redisClient.connect();

// Check connection status
const isReady = redisClient.isReady();
```

### 2. Session Service (`src/services/sessionService.ts`)

Provides secure session management with support for:
- Session creation and validation
- Multi-device session tracking
- Automatic session expiration
- Session metadata storage

```typescript
import { redisService } from '../services/redisService';

// Create a new session
const sessionId = await redisService.session.createSession(
  'user-123',
  'client',
  'user@example.com'
);

// Validate session
const sessionData = await redisService.session.getSession(sessionId);
```

### 3. Cache Service (`src/services/cacheService.ts`)

High-performance caching with features:
- TTL-based expiration
- Tag-based invalidation
- Get-or-set pattern
- Batch operations
- Cache statistics

```typescript
import { redisService } from '../services/redisService';

// Cache data with TTL
await redisService.cache.set('user:123', userData, { ttl: 300 });

// Get or compute and cache
const data = await redisService.cache.getOrSet(
  'expensive-computation',
  async () => await computeExpensiveData(),
  { ttl: 600 }
);
```

### 4. Job Queue Service (`src/services/jobQueueService.ts`)

Background job processing with:
- Priority-based job scheduling
- Automatic retry with exponential backoff
- Delayed job execution
- Job status tracking
- Queue statistics

```typescript
import { redisService } from '../services/redisService';

// Schedule a job
const jobId = await redisService.jobQueue.addJob(
  'send-email',
  { to: 'user@example.com', subject: 'Welcome!' },
  { priority: 5, delay: 1000 }
);

// Register job handler
redisService.jobQueue.registerHandler('send-email', async (job) => {
  // Process the job
  console.log('Sending email:', job.data);
});
```

### 5. Unified Redis Service (`src/services/redisService.ts`)

Central service that coordinates all Redis functionality and provides:
- Service initialization and shutdown
- Health monitoring
- Pre-configured job handlers
- Notification scheduling
- Comprehensive statistics

## Configuration

Redis configuration is managed through environment variables:

```bash
# Redis Connection
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password_if_needed

# Business Logic
COMMISSION_RATE=0.10
RESPONSE_REMINDER_HOURS=8,24,48,168
```

## Usage Examples

### Session Management

```typescript
// Create user session after login
const sessionId = await redisService.session.createSession(
  userId,
  userRole,
  userEmail
);

// Validate session in middleware
const sessionData = await redisService.session.getSession(sessionId);
if (!sessionData) {
  throw new Error('Invalid session');
}
```

### Data Caching

```typescript
// Cache frequently accessed data
const userProfile = await redisService.cache.getOrSet(
  `profile:${userId}`,
  async () => await fetchUserFromDatabase(userId),
  { ttl: 300 } // 5 minutes
);

// Invalidate cache when data changes
await redisService.cache.invalidateByTags([`user:${userId}`]);
```

### Background Jobs

```typescript
// Schedule vendor notification
await redisService.scheduleVendorNotification(
  'cart_add',
  vendorId,
  clientId,
  serviceId
);

// Schedule response reminder
await redisService.scheduleResponseReminder(
  vendorId,
  clientId,
  conversationId,
  8, // hours
  8 * 60 * 60 * 1000 // delay in ms
);
```

### Rate Limiting

```typescript
// Check rate limit before processing request
const allowed = await checkRateLimit(userId, 'api_call', 100, 60000);
if (!allowed) {
  throw new Error('Rate limit exceeded');
}
```

## Job Types

The system includes pre-configured job handlers for:

### Notification Jobs
- `vendor_cart_add`: Notify vendor when item added to cart
- `vendor_wishlist_add`: Notify vendor when item added to wishlist

### Reminder Jobs
- `response_reminder`: Send response reminders to vendors
- `alternative_vendor_recommendation`: Recommend alternative vendors

### System Jobs
- `cleanup_expired_sessions`: Clean up expired sessions
- `cache_warmup`: Warm up frequently accessed cache entries

## Health Monitoring

```typescript
// Check Redis service health
const health = await redisService.healthCheck();
console.log('Redis Health:', health);

// Get comprehensive statistics
const stats = await redisService.getStats();
console.log('Redis Stats:', stats);
```

## Integration with Existing Services

The Redis integration is designed to enhance existing services:

### Authentication Middleware
- Session validation using Redis sessions
- Rate limiting for login attempts

### Notification Service
- Background job scheduling for notifications
- Caching of notification templates

### Messaging Service
- Caching of conversation data
- Background processing of response reminders

### Wallet Service
- Caching of wallet balances
- Background processing of commission calculations

## Testing

The Redis integration includes comprehensive tests:

```bash
# Run Redis service tests
npm test -- src/services/redisService.test.ts

# Run integration utility tests
npm test -- src/utils/redisIntegration.test.ts
```

## Performance Considerations

### Caching Strategy
- Use appropriate TTL values based on data volatility
- Implement cache warming for critical data
- Use tag-based invalidation for related data

### Job Queue Optimization
- Set appropriate priorities for different job types
- Monitor queue lengths and processing times
- Implement circuit breakers for external service calls

### Session Management
- Regular cleanup of expired sessions
- Monitor session creation rates
- Implement session limits per user if needed

## Monitoring and Alerting

Key metrics to monitor:
- Redis connection status
- Cache hit/miss ratios
- Job queue lengths and processing times
- Session creation and validation rates
- Memory usage and key counts

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check Redis server status
   - Verify connection string and credentials
   - Check network connectivity

2. **High Memory Usage**
   - Monitor key expiration
   - Implement cache size limits
   - Regular cleanup of old data

3. **Job Processing Delays**
   - Check job handler performance
   - Monitor queue lengths
   - Verify worker process health

### Debug Commands

```typescript
// Check Redis connection
await redisClient.ping(); // Should return 'PONG'

// Get service statistics
const stats = await redisService.getStats();

// Check specific cache keys
const keys = await redisClient.getClient().keys('cache:*');
```

## Future Enhancements

Potential improvements:
- Redis Cluster support for high availability
- Advanced job scheduling with cron-like syntax
- Real-time analytics dashboard
- Automatic cache warming strategies
- Enhanced monitoring and alerting

## Requirements Validation

This Redis integration addresses the following requirements:

- **9.1, 9.2**: Real-time online/offline status tracking
- **8.2, 8.3, 8.4, 8.5**: Automated response and reminder system
- **Session Management**: Secure user session handling
- **Performance**: Caching for frequently accessed data
- **Scalability**: Background job processing for heavy operations