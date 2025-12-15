import { BaseRepository } from './BaseRepository';
import { Notification } from '../../types';
import { db } from '../connection';

export interface CreateNotificationData {
  user_id: string;
  type: 'cart_add' | 'wishlist_add' | 'message' | 'payment' | 'reminder' | 'system';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface NotificationFilters {
  user_id?: string;
  type?: string;
  is_read?: boolean;
  limit?: number;
  offset?: number;
}

export class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super('notifications');
  }
  /**
   * Create a new notification
   */
  override async create(data: CreateNotificationData): Promise<Notification> {
    const query = `
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      data.user_id,
      data.type,
      data.title,
      data.message,
      JSON.stringify(data.metadata || {})
    ];

    const [result] = await db.query<Notification>(query, values);
    return result!;
  }

  /**
   * Get notifications by user ID with optional filters
   */
  async findByUserId(userId: string, filters: Omit<NotificationFilters, 'user_id'> = {}): Promise<Notification[]> {
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    const values: any[] = [userId];
    let paramCount = 1;

    // Add optional filters
    if (filters.type !== undefined) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      values.push(filters.type);
    }

    if (filters.is_read !== undefined) {
      paramCount++;
      query += ` AND is_read = $${paramCount}`;
      values.push(filters.is_read);
    }

    // Order by created_at descending (newest first)
    query += ` ORDER BY created_at DESC`;

    // Add pagination
    if (filters.limit !== undefined) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    if (filters.offset !== undefined) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      values.push(filters.offset);
    }

    const results = await db.query<Notification>(query, values);
    return results;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const [result] = await db.query<Notification>(query, [notificationId, userId]);
    return result || null;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `;
    
    const results = await db.query<{ id: string }>(query, [userId]);
    return results.length;
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM notifications 
      WHERE user_id = $1 AND is_read = false
    `;
    
    const [result] = await db.query<{ count: string }>(query, [userId]);
    return parseInt(result?.count || '0');
  }

  /**
   * Delete old notifications (cleanup)
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM notifications 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING id
    `;
    
    const results = await db.query<{ id: string }>(query);
    return results.length;
  }

  /**
   * Get notification by ID and user ID (for security)
   */
  async findByIdAndUserId(notificationId: string, userId: string): Promise<Notification | null> {
    const query = `
      SELECT * FROM notifications 
      WHERE id = $1 AND user_id = $2
    `;
    
    const [result] = await db.query<Notification>(query, [notificationId, userId]);
    return result || null;
  }
}