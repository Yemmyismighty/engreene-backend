import { BaseRepository } from './BaseRepository';
import { UserOnlineStatus } from '../../types';
import { db } from '../connection';

export class UserOnlineStatusRepository extends BaseRepository<UserOnlineStatus> {
  constructor() {
    super('user_online_status');
  }

  /**
   * Update user online status
   */
  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<UserOnlineStatus> {
    const [status] = await db.query<UserOnlineStatus>(
      `INSERT INTO user_online_status (user_id, is_online, last_seen)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         is_online = EXCLUDED.is_online,
         last_seen = EXCLUDED.last_seen
       RETURNING *`,
      [userId, isOnline]
    );
    return status!;
  }

  /**
   * Get user online status
   */
  async getOnlineStatus(userId: string): Promise<UserOnlineStatus | null> {
    const [status] = await db.query<UserOnlineStatus>(
      `SELECT * FROM user_online_status WHERE user_id = $1`,
      [userId]
    );
    return status || null;
  }

  /**
   * Get multiple users' online status
   */
  async getMultipleOnlineStatus(userIds: string[]): Promise<UserOnlineStatus[]> {
    if (userIds.length === 0) return [];
    
    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(', ');
    const statuses = await db.query<UserOnlineStatus>(
      `SELECT * FROM user_online_status WHERE user_id IN (${placeholders})`,
      userIds
    );
    return statuses;
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<UserOnlineStatus[]> {
    const statuses = await db.query<UserOnlineStatus>(
      `SELECT * FROM user_online_status WHERE is_online = true`
    );
    return statuses;
  }

  /**
   * Set user offline (typically called on disconnect)
   */
  async setUserOffline(userId: string): Promise<void> {
    await db.query(
      `UPDATE user_online_status 
       SET is_online = false, last_seen = NOW() 
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Clean up stale online statuses (users who haven't been seen recently)
   */
  async cleanupStaleStatuses(minutesThreshold = 5): Promise<number> {
    const result = await db.query<{ count: string }>(
      `UPDATE user_online_status 
       SET is_online = false 
       WHERE is_online = true 
         AND last_seen < NOW() - INTERVAL '${minutesThreshold} minutes'
       RETURNING COUNT(*) as count`
    );
    return parseInt(result[0]?.count || '0');
  }
}