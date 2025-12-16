import { redisClient } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

interface SessionData {
  userId: string;
  userRole: 'client' | 'vendor';
  email: string;
  createdAt: string;
  lastActivity: string;
  metadata?: Record<string, any>;
}

interface SessionOptions {
  ttl?: number; // Time to live in seconds, default 24 hours
}

class SessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSION_PREFIX = 'user_sessions:';
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Create a new session for a user
   */
  public async createSession(
    userId: string,
    userRole: 'client' | 'vendor',
    email: string,
    options: SessionOptions = {}
  ): Promise<string> {
    const sessionId = uuidv4();
    const ttl = options.ttl || this.DEFAULT_TTL;
    const now = new Date().toISOString();

    const sessionData: SessionData = {
      userId,
      userRole,
      email,
      createdAt: now,
      lastActivity: now,
    };

    const client = redisClient.getClient();
    
    // Store session data
    await client.setEx(
      `${this.SESSION_PREFIX}${sessionId}`,
      ttl,
      JSON.stringify(sessionData)
    );

    // Track user sessions (for multi-device support)
    await client.sAdd(`${this.USER_SESSION_PREFIX}${userId}`, sessionId);
    await client.expire(`${this.USER_SESSION_PREFIX}${userId}`, ttl);

    return sessionId;
  }

  /**
   * Retrieve session data by session ID
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    const client = redisClient.getClient();
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    
    const sessionDataStr = await client.get(sessionKey);
    if (!sessionDataStr) {
      return null;
    }

    const sessionData: SessionData = JSON.parse(sessionDataStr);
    
    // Update last activity
    sessionData.lastActivity = new Date().toISOString();
    await client.setEx(sessionKey, this.DEFAULT_TTL, JSON.stringify(sessionData));

    return sessionData;
  }

  /**
   * Update session data
   */
  public async updateSession(
    sessionId: string,
    updates: Partial<SessionData>
  ): Promise<boolean> {
    const client = redisClient.getClient();
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    
    const existingData = await this.getSession(sessionId);
    if (!existingData) {
      return false;
    }

    const updatedData: SessionData = {
      ...existingData,
      ...updates,
      lastActivity: new Date().toISOString(),
    };

    await client.setEx(sessionKey, this.DEFAULT_TTL, JSON.stringify(updatedData));
    return true;
  }

  /**
   * Delete a specific session
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    const client = redisClient.getClient();
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    
    // Get session data to find user ID
    const sessionData = await this.getSession(sessionId);
    if (sessionData) {
      // Remove from user sessions set
      await client.sRem(`${this.USER_SESSION_PREFIX}${sessionData.userId}`, sessionId);
    }

    const result = await client.del(sessionKey);
    return result > 0;
  }

  /**
   * Delete all sessions for a user
   */
  public async deleteUserSessions(userId: string): Promise<number> {
    const client = redisClient.getClient();
    const userSessionsKey = `${this.USER_SESSION_PREFIX}${userId}`;
    
    // Get all session IDs for the user
    const sessionIds = await client.sMembers(userSessionsKey);
    
    if (sessionIds.length === 0) {
      return 0;
    }

    // Delete all session data
    const sessionKeys = sessionIds.map(id => `${this.SESSION_PREFIX}${id}`);
    const deletedCount = await client.del([...sessionKeys, userSessionsKey]);
    
    return deletedCount;
  }

  /**
   * Get all active sessions for a user
   */
  public async getUserSessions(userId: string): Promise<SessionData[]> {
    const client = redisClient.getClient();
    const userSessionsKey = `${this.USER_SESSION_PREFIX}${userId}`;
    
    const sessionIds = await client.sMembers(userSessionsKey);
    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const sessionData = await this.getSession(sessionId);
      if (sessionData) {
        sessions.push(sessionData);
      }
    }

    return sessions;
  }

  /**
   * Check if a session exists and is valid
   */
  public async isValidSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.getSession(sessionId);
    return sessionData !== null;
  }

  /**
   * Extend session TTL
   */
  public async extendSession(sessionId: string, additionalSeconds: number = this.DEFAULT_TTL): Promise<boolean> {
    const client = redisClient.getClient();
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    
    const exists = await client.exists(sessionKey);
    if (!exists) {
      return false;
    }

    await client.expire(sessionKey, additionalSeconds);
    return true;
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
  }> {
    const client = redisClient.getClient();
    
    // Count all session keys
    const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
    const totalSessions = sessionKeys.length;

    // For simplicity, we'll consider all sessions as active
    // In a more sophisticated implementation, you might track last activity
    const activeSessions = totalSessions;

    return {
      totalSessions,
      activeSessions,
    };
  }
}

export { SessionService, SessionData, SessionOptions };