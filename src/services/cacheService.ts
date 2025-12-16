import { redisClient } from '../config/redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
}

class CacheService {
  private readonly DEFAULT_TTL = 60 * 60; // 1 hour in seconds
  private readonly STATS_KEY = 'cache:stats';

  /**
   * Set a value in cache
   */
  public async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    const client = redisClient.getClient();
    const ttl = options.ttl || this.DEFAULT_TTL;
    const prefix = options.prefix || 'cache:';
    const fullKey = `${prefix}${key}`;

    const serializedValue = JSON.stringify(value);
    await client.setEx(fullKey, ttl, serializedValue);
  }

  /**
   * Get a value from cache
   */
  public async get<T = any>(
    key: string,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';
    const fullKey = `${prefix}${key}`;

    try {
      const value = await client.get(fullKey);
      
      if (value === null) {
        await this.incrementStat('misses');
        return null;
      }

      await this.incrementStat('hits');
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      await this.incrementStat('misses');
      return null;
    }
  }

  /**
   * Delete a value from cache
   */
  public async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';
    const fullKey = `${prefix}${key}`;

    const result = await client.del(fullKey);
    return result > 0;
  }

  /**
   * Check if a key exists in cache
   */
  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';
    const fullKey = `${prefix}${key}`;

    const result = await client.exists(fullKey);
    return result > 0;
  }

  /**
   * Get or set pattern - retrieve from cache or compute and cache
   */
  public async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cachedValue = await this.get<T>(key, options);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // Compute the value
    const computedValue = await computeFn();
    
    // Cache the computed value
    await this.set(key, computedValue, options);
    
    return computedValue;
  }

  /**
   * Set multiple values at once
   */
  public async setMultiple(
    keyValuePairs: Array<{ key: string; value: any; ttl?: number }>,
    options: CacheOptions = {}
  ): Promise<void> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';

    const pipeline = client.multi();

    for (const { key, value, ttl } of keyValuePairs) {
      const fullKey = `${prefix}${key}`;
      const serializedValue = JSON.stringify(value);
      const finalTtl = ttl || options.ttl || this.DEFAULT_TTL;
      
      pipeline.setEx(fullKey, finalTtl, serializedValue);
    }

    await pipeline.exec();
  }

  /**
   * Get multiple values at once
   */
  public async getMultiple<T = any>(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<Record<string, T | null>> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';
    const fullKeys = keys.map(key => `${prefix}${key}`);

    const values = await client.mGet(fullKeys);
    const result: Record<string, T | null> = {};

    keys.forEach((key, index) => {
      const value = values[index];
      if (value !== null && value !== undefined) {
        try {
          result[key] = JSON.parse(value) as T;
          this.incrementStat('hits');
        } catch (error) {
          console.error(`Cache parse error for key ${key}:`, error);
          result[key] = null;
          this.incrementStat('misses');
        }
      } else {
        result[key] = null;
        this.incrementStat('misses');
      }
    });

    return result;
  }

  /**
   * Clear all cache entries with a specific prefix
   */
  public async clearPrefix(prefix: string = 'cache:'): Promise<number> {
    const client = redisClient.getClient();
    const keys = await client.keys(`${prefix}*`);
    
    if (keys.length === 0) {
      return 0;
    }

    return await client.del(keys);
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    const client = redisClient.getClient();
    
    const [hits, misses] = await Promise.all([
      client.hGet(this.STATS_KEY, 'hits').then(val => parseInt(val || '0', 10)),
      client.hGet(this.STATS_KEY, 'misses').then(val => parseInt(val || '0', 10)),
    ]);

    // Count cache keys
    const cacheKeys = await client.keys('cache:*');
    const keys = cacheKeys.length;

    return { hits, misses, keys };
  }

  /**
   * Reset cache statistics
   */
  public async resetStats(): Promise<void> {
    const client = redisClient.getClient();
    await client.del(this.STATS_KEY);
  }

  /**
   * Increment a statistic counter
   */
  private async incrementStat(stat: 'hits' | 'misses'): Promise<void> {
    const client = redisClient.getClient();
    await client.hIncrBy(this.STATS_KEY, stat, 1);
  }

  /**
   * Set cache with tags for group invalidation
   */
  public async setWithTags(
    key: string,
    value: any,
    tags: string[],
    options: CacheOptions = {}
  ): Promise<void> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';
    const fullKey = `${prefix}${key}`;
    const ttl = options.ttl || this.DEFAULT_TTL;

    // Set the main cache entry
    await this.set(key, value, options);

    // Add key to each tag set
    const pipeline = client.multi();
    for (const tag of tags) {
      const tagKey = `${prefix}tag:${tag}`;
      pipeline.sAdd(tagKey, fullKey);
      pipeline.expire(tagKey, ttl);
    }
    await pipeline.exec();
  }

  /**
   * Invalidate all cache entries with specific tags
   */
  public async invalidateByTags(
    tags: string[],
    options: CacheOptions = {}
  ): Promise<number> {
    const client = redisClient.getClient();
    const prefix = options.prefix || 'cache:';
    
    let totalDeleted = 0;

    for (const tag of tags) {
      const tagKey = `${prefix}tag:${tag}`;
      const keys = await client.sMembers(tagKey);
      
      if (keys.length > 0) {
        const deleted = await client.del([...keys, tagKey]);
        totalDeleted += deleted;
      }
    }

    return totalDeleted;
  }
}

export { CacheService, CacheOptions, CacheStats };