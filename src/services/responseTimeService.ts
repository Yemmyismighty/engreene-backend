import * as cron from 'node-cron';
import { notificationService } from './notificationService';
import { db } from '../database/connection';

export interface ResponseTimeTracker {
  vendorId: string;
  clientId: string;
  lastClientMessageTime: string;
  lastVendorResponseTime?: string | null;
  hoursWithoutResponse: number;
  remindersSent: number;
  alternativeVendorsRecommended: boolean;
}

export class ResponseTimeService {
  private isRunning = false;
  private cronJob?: cron.ScheduledTask | null;

  /**
   * Start the response time monitoring system
   */
  start(): void {
    if (this.isRunning) {
      console.log('Response time service is already running');
      return;
    }

    // Run every hour to check response times
    this.cronJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.checkResponseTimes();
      } catch (error) {
        console.error('Error in response time check:', error);
      }
    });

    this.isRunning = true;
    console.log('Response time monitoring service started');
  }

  /**
   * Stop the response time monitoring system
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('Response time monitoring service stopped');
  }

  /**
   * Check response times and send reminders
   * Validates: Requirements 8.2, 8.3, 8.4, 8.5
   */
  async checkResponseTimes(): Promise<void> {
    try {
      const unrespondedConversations = await this.getUnrespondedConversations();
      
      for (const conversation of unrespondedConversations) {
        const hoursElapsed = this.calculateHoursElapsed(conversation.lastClientMessageTime);
        
        // Send reminders based on elapsed time
        if (hoursElapsed >= 168 && !conversation.alternativeVendorsRecommended) {
          // 1 week - recommend alternative vendors
          await this.recommendAlternativeVendors(conversation.clientId, conversation.vendorId);
          await this.markAlternativeVendorsRecommended(conversation.vendorId, conversation.clientId);
        } else if (hoursElapsed >= 48 && conversation.remindersSent < 3) {
          // 2 days - send third reminder
          await notificationService.sendResponseReminder(conversation.vendorId, conversation.clientId, hoursElapsed);
          await this.updateReminderCount(conversation.vendorId, conversation.clientId, 3);
        } else if (hoursElapsed >= 24 && conversation.remindersSent < 2) {
          // 1 day - send second reminder
          await notificationService.sendResponseReminder(conversation.vendorId, conversation.clientId, hoursElapsed);
          await this.updateReminderCount(conversation.vendorId, conversation.clientId, 2);
        } else if (hoursElapsed >= 8 && conversation.remindersSent < 1) {
          // 8 hours - send first reminder
          await notificationService.sendResponseReminder(conversation.vendorId, conversation.clientId, hoursElapsed);
          await this.updateReminderCount(conversation.vendorId, conversation.clientId, 1);
        }
      }
    } catch (error) {
      console.error('Error checking response times:', error);
      throw error;
    }
  }

  /**
   * Get conversations where vendors haven't responded to client messages
   */
  private async getUnrespondedConversations(): Promise<ResponseTimeTracker[]> {
    const conversations = await db.query<{
      vendor_id: string;
      client_id: string;
      last_client_message_time: string;
      last_vendor_response_time: string | null;
      reminders_sent: string;
      alternative_vendors_recommended: boolean;
    }>(
      `WITH client_messages AS (
         SELECT 
           to_user_id as vendor_id,
           from_user_id as client_id,
           MAX(created_at) as last_client_message_time
         FROM messages 
         WHERE from_user_id IS NOT NULL 
           AND to_user_id IS NOT NULL
           AND is_automated = false
         GROUP BY to_user_id, from_user_id
       ),
       vendor_responses AS (
         SELECT 
           from_user_id as vendor_id,
           to_user_id as client_id,
           MAX(created_at) as last_vendor_response_time
         FROM messages 
         WHERE from_user_id IS NOT NULL 
           AND to_user_id IS NOT NULL
           AND is_automated = false
         GROUP BY from_user_id, to_user_id
       ),
       response_tracking AS (
         SELECT 
           vendor_id,
           client_id,
           COALESCE(reminders_sent, 0) as reminders_sent,
           COALESCE(alternative_vendors_recommended, false) as alternative_vendors_recommended
         FROM response_time_tracking
       )
       SELECT 
         cm.vendor_id,
         cm.client_id,
         cm.last_client_message_time,
         vr.last_vendor_response_time,
         COALESCE(rt.reminders_sent, 0) as reminders_sent,
         COALESCE(rt.alternative_vendors_recommended, false) as alternative_vendors_recommended
       FROM client_messages cm
       LEFT JOIN vendor_responses vr ON cm.vendor_id = vr.vendor_id AND cm.client_id = vr.client_id
       LEFT JOIN response_tracking rt ON cm.vendor_id = rt.vendor_id AND cm.client_id = rt.client_id
       WHERE vr.last_vendor_response_time IS NULL 
          OR cm.last_client_message_time > vr.last_vendor_response_time`,
      []
    );

    return conversations.map(conv => ({
      vendorId: conv.vendor_id,
      clientId: conv.client_id,
      lastClientMessageTime: conv.last_client_message_time,
      lastVendorResponseTime: conv.last_vendor_response_time,
      hoursWithoutResponse: this.calculateHoursElapsed(conv.last_client_message_time),
      remindersSent: parseInt(conv.reminders_sent),
      alternativeVendorsRecommended: conv.alternative_vendors_recommended
    }));
  }

  /**
   * Calculate hours elapsed since last client message
   */
  private calculateHoursElapsed(lastMessageTime: string): number {
    const now = new Date();
    const messageTime = new Date(lastMessageTime);
    const diffMs = now.getTime() - messageTime.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Recommend alternative vendors to client
   * Validates: Requirements 8.5
   */
  private async recommendAlternativeVendors(clientId: string, originalVendorId: string): Promise<void> {
    try {
      // Get alternative vendors (excluding the original vendor)
      const alternativeVendors = await this.getAlternativeVendors(originalVendorId);
      
      if (alternativeVendors.length > 0) {
        await notificationService.recommendAlternativeVendors(clientId, originalVendorId);
        
        // Optionally send a message with specific vendor recommendations
        const vendorNames = alternativeVendors.slice(0, 3).map(v => v.business_name).join(', ');
        const recommendationMessage = `We recommend checking out these alternative vendors: ${vendorNames}`;
        
        // Create a system notification with vendor recommendations
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            clientId,
            'vendor_recommendation',
            'Recommended Vendors',
            recommendationMessage,
            {
              original_vendor_id: originalVendorId,
              recommended_vendors: alternativeVendors.slice(0, 3),
              reason: 'vendor_unresponsive'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error recommending alternative vendors:', error);
      // Don't throw - this is a nice-to-have feature
    }
  }

  /**
   * Get alternative vendors (excluding the specified vendor)
   */
  private async getAlternativeVendors(excludeVendorId: string): Promise<Array<{ id: string; business_name: string; user_id: string }>> {
    try {
      const vendors = await db.query<{ id: string; business_name: string; user_id: string }>(
        `SELECT id, business_name, user_id 
         FROM vendors 
         WHERE id != $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [excludeVendorId]
      );
      return vendors;
    } catch (error) {
      console.error('Error getting alternative vendors:', error);
      return [];
    }
  }

  /**
   * Update reminder count for a vendor-client pair
   */
  private async updateReminderCount(vendorId: string, clientId: string, reminderCount: number): Promise<void> {
    await db.query(
      `INSERT INTO response_time_tracking (vendor_id, client_id, reminders_sent, last_reminder_sent)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (vendor_id, client_id)
       DO UPDATE SET 
         reminders_sent = $3,
         last_reminder_sent = NOW(),
         updated_at = NOW()`,
      [vendorId, clientId, reminderCount]
    );
  }

  /**
   * Mark that alternative vendors have been recommended
   */
  private async markAlternativeVendorsRecommended(vendorId: string, clientId: string): Promise<void> {
    await db.query(
      `INSERT INTO response_time_tracking (vendor_id, client_id, alternative_vendors_recommended, alternative_vendors_recommended_at)
       VALUES ($1, $2, true, NOW())
       ON CONFLICT (vendor_id, client_id)
       DO UPDATE SET 
         alternative_vendors_recommended = true,
         alternative_vendors_recommended_at = NOW(),
         updated_at = NOW()`,
      [vendorId, clientId]
    );
  }

  /**
   * Reset tracking for a vendor-client pair (when vendor responds)
   */
  async resetTracking(vendorId: string, clientId: string): Promise<void> {
    await db.query(
      `DELETE FROM response_time_tracking 
       WHERE vendor_id = $1 AND client_id = $2`,
      [vendorId, clientId]
    );
  }

  /**
   * Get response time statistics for a vendor
   */
  async getVendorResponseStats(vendorId: string): Promise<{
    averageResponseTimeHours: number;
    totalConversations: number;
    activeReminders: number;
  }> {
    const [stats] = await db.query<{
      avg_response_time_hours: string;
      total_conversations: string;
      active_reminders: string;
    }>(
      `WITH vendor_conversations AS (
         SELECT DISTINCT 
           from_user_id as client_id,
           to_user_id as vendor_id
         FROM messages 
         WHERE to_user_id = $1 AND from_user_id IS NOT NULL
       ),
       response_times AS (
         SELECT 
           cm.created_at as client_message_time,
           (
             SELECT MIN(vm.created_at)
             FROM messages vm
             WHERE vm.from_user_id = $1 
               AND vm.to_user_id = cm.from_user_id
               AND vm.created_at > cm.created_at
               AND vm.is_automated = false
           ) as vendor_response_time
         FROM messages cm
         WHERE cm.to_user_id = $1 
           AND cm.from_user_id IS NOT NULL
           AND cm.is_automated = false
       )
       SELECT 
         COALESCE(AVG(EXTRACT(EPOCH FROM (vendor_response_time - client_message_time)) / 3600), 0) as avg_response_time_hours,
         (SELECT COUNT(*) FROM vendor_conversations) as total_conversations,
         (SELECT COUNT(*) FROM response_time_tracking WHERE vendor_id = $1) as active_reminders`,
      [vendorId]
    );

    return {
      averageResponseTimeHours: parseFloat(stats?.avg_response_time_hours || '0'),
      totalConversations: parseInt(stats?.total_conversations || '0'),
      activeReminders: parseInt(stats?.active_reminders || '0')
    };
  }

  /**
   * Manual trigger for checking response times (for testing)
   */
  async manualCheck(): Promise<void> {
    await this.checkResponseTimes();
  }
}

// Export singleton instance
export const responseTimeService = new ResponseTimeService();