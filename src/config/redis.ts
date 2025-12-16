import { createClient, RedisClientType } from 'redis';
import { config } from './environment';

class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    const clientOptions: any = {
      url: config.redis.url,
    };

    if (config.redis.password) {
      clientOptions.password = config.redis.password;
    }

    this.client = createClient(clientOptions);
    this.setupEventHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis client error:', err);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      console.log('🔌 Redis client disconnected');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  public async ping(): Promise<string> {
    return await this.client.ping();
  }
}

export { RedisConnection };
export const redisClient = RedisConnection.getInstance();