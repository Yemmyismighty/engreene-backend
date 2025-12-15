import { BaseRepository } from './BaseRepository';
import { Message } from '../../types';
import { db } from '../connection';

export class MessageRepository extends BaseRepository<Message> {
  constructor() {
    super('messages');
  }

  /**
   * Get conversation between two users
   */
  async getConversation(user1Id: string, user2Id: string, limit = 50, offset = 0): Promise<Message[]> {
    const messages = await db.query<Message>(
      `SELECT * FROM messages 
       WHERE (from_user_id = $1 AND to_user_id = $2) 
          OR (from_user_id = $2 AND to_user_id = $1)
          OR (from_user_id IS NULL AND to_user_id = $1)
          OR (from_user_id IS NULL AND to_user_id = $2)
       ORDER BY created_at ASC
       LIMIT $3 OFFSET $4`,
      [user1Id, user2Id, limit, offset]
    );
    return messages;
  }

  /**
   * Send a message
   */
  async sendMessage(
    fromUserId: string | null, 
    toUserId: string, 
    content: string, 
    senderName: string,
    isAutomated = false
  ): Promise<Message> {
    const [message] = await db.query<Message>(
      `INSERT INTO messages (from_user_id, to_user_id, content, sender_name, is_automated)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fromUserId, toUserId, content, senderName, isAutomated]
    );
    return message!;
  }

  /**
   * Get messages for a specific user (inbox)
   */
  async getMessagesForUser(userId: string, limit = 50, offset = 0): Promise<Message[]> {
    const messages = await db.query<Message>(
      `SELECT * FROM messages 
       WHERE to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return messages;
  }

  /**
   * Get recent conversations for a user
   */
  async getRecentConversations(userId: string, limit = 10): Promise<Array<{
    other_user_id: string | null;
    last_message: Message;
    unread_count: number;
  }>> {
    const conversations = await db.query<{
      other_user_id: string | null;
      last_message_id: string;
      last_message_content: string;
      last_message_sender_name: string;
      last_message_created_at: string;
      last_message_is_automated: boolean;
      unread_count: string;
    }>(
      `WITH conversation_partners AS (
         SELECT DISTINCT 
           CASE 
             WHEN from_user_id = $1 THEN to_user_id
             WHEN to_user_id = $1 THEN from_user_id
             ELSE NULL
           END as other_user_id
         FROM messages 
         WHERE from_user_id = $1 OR to_user_id = $1
       ),
       latest_messages AS (
         SELECT DISTINCT ON (
           CASE 
             WHEN from_user_id = $1 THEN to_user_id
             WHEN to_user_id = $1 THEN from_user_id
             ELSE NULL
           END
         )
           CASE 
             WHEN from_user_id = $1 THEN to_user_id
             WHEN to_user_id = $1 THEN from_user_id
             ELSE NULL
           END as other_user_id,
           id, content, sender_name, created_at, is_automated
         FROM messages 
         WHERE from_user_id = $1 OR to_user_id = $1
         ORDER BY 
           CASE 
             WHEN from_user_id = $1 THEN to_user_id
             WHEN to_user_id = $1 THEN from_user_id
             ELSE NULL
           END,
           created_at DESC
       )
       SELECT 
         lm.other_user_id,
         lm.id as last_message_id,
         lm.content as last_message_content,
         lm.sender_name as last_message_sender_name,
         lm.created_at as last_message_created_at,
         lm.is_automated as last_message_is_automated,
         COALESCE(unread.count, 0) as unread_count
       FROM latest_messages lm
       LEFT JOIN (
         SELECT 
           CASE 
             WHEN from_user_id = $1 THEN to_user_id
             WHEN to_user_id = $1 THEN from_user_id
             ELSE NULL
           END as other_user_id,
           COUNT(*) as count
         FROM messages 
         WHERE to_user_id = $1 AND from_user_id != $1
         GROUP BY other_user_id
       ) unread ON lm.other_user_id = unread.other_user_id
       ORDER BY lm.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return conversations.map(conv => ({
      other_user_id: conv.other_user_id,
      last_message: {
        id: conv.last_message_id,
        from_user_id: conv.other_user_id || '',
        to_user_id: userId,
        content: conv.last_message_content,
        sender_name: conv.last_message_sender_name,
        is_automated: conv.last_message_is_automated,
        created_at: conv.last_message_created_at
      },
      unread_count: parseInt(conv.unread_count)
    }));
  }

  /**
   * Mark messages as read (for future implementation)
   */
  async markAsRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    
    const placeholders = messageIds.map((_, index) => `$${index + 1}`).join(', ');
    await db.query(
      `UPDATE messages SET is_read = true WHERE id IN (${placeholders})`,
      messageIds
    );
  }
}