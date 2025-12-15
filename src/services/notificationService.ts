import { NotificationRepository, CreateNotificationData } from '../database/repositories/NotificationRepository';
import { Notification } from '../types';

// Import socket service dynamically to avoid circular dependency
let socketService: any = null;
const getSocketService = () => {
  if (!socketService) {
    try {
      const { socketService: ss } = require('../index');
      socketService = ss;
    } catch (error) {
      // Socket service not available (e.g., during testing)
      console.warn('Socket service not available for real-time notifications');
    }
  }
  return socketService;
};

export interface NotificationService {
  notifyVendorCartAdd(vendorId: string, clientId: string, serviceId: string): Promise<void>;
  notifyVendorWishlistAdd(vendorId: string, clientId: string, serviceId: string): Promise<void>;
  sendResponseReminder(vendorId: string, clientId: string, hoursElapsed: number): Promise<void>;
  recommendAlternativeVendors(clientId: string, originalVendorId: string): Promise<void>;
  getUserNotifications(userId: string, options?: { limit?: number; offset?: number; unreadOnly?: boolean }): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<Notification | null>;
  markAllNotificationsAsRead(userId: string): Promise<number>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

class NotificationServiceImpl implements NotificationService {
  private notificationRepository: NotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * Notify vendor when a client adds their service to cart
   * Validates: Requirements 6.1
   */
  async notifyVendorCartAdd(vendorId: string, clientId: string, serviceId: string): Promise<void> {
    if (!vendorId || !clientId || !serviceId) {
      throw new Error('Missing required parameters for cart notification');
    }

    const notificationData: CreateNotificationData = {
      user_id: vendorId,
      type: 'cart_add',
      title: 'Service Added to Cart',
      message: 'A client has added your service to their cart',
      metadata: {
        client_id: clientId,
        service_id: serviceId,
        action: 'cart_add',
        timestamp: new Date().toISOString()
      }
    };

    const notification = await this.notificationRepository.create(notificationData);
    
    // Send real-time notification if socket service is available
    const ss = getSocketService();
    if (ss && notification) {
      await ss.sendNotificationToUser(vendorId, {
        type: 'cart_add',
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata
      });
    }
  }

  /**
   * Notify vendor when a client adds their service to wishlist
   * Validates: Requirements 6.2
   */
  async notifyVendorWishlistAdd(vendorId: string, clientId: string, serviceId: string): Promise<void> {
    if (!vendorId || !clientId || !serviceId) {
      throw new Error('Missing required parameters for wishlist notification');
    }

    const notificationData: CreateNotificationData = {
      user_id: vendorId,
      type: 'wishlist_add',
      title: 'Service Added to Wishlist',
      message: 'A client has added your service to their wishlist',
      metadata: {
        client_id: clientId,
        service_id: serviceId,
        action: 'wishlist_add',
        timestamp: new Date().toISOString()
      }
    };

    const notification = await this.notificationRepository.create(notificationData);
    
    // Send real-time notification if socket service is available
    const ss = getSocketService();
    if (ss && notification) {
      await ss.sendNotificationToUser(vendorId, {
        type: 'wishlist_add',
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata
      });
    }
  }

  /**
   * Send response reminder to vendor
   * Validates: Requirements 8.2, 8.3, 8.4
   */
  async sendResponseReminder(vendorId: string, clientId: string, hoursElapsed: number): Promise<void> {
    if (!vendorId || !clientId || hoursElapsed <= 0) {
      throw new Error('Invalid parameters for response reminder');
    }

    let title: string;
    let message: string;

    if (hoursElapsed >= 168) { // 1 week = 168 hours
      title = 'Final Response Reminder';
      message = 'You have not responded to a client message for over 1 week. Alternative vendors may be recommended.';
    } else if (hoursElapsed >= 48) { // 2 days = 48 hours
      title = 'Response Reminder - Day 2';
      message = 'You have not responded to a client message for 2 days. Please respond soon.';
    } else if (hoursElapsed >= 24) { // 1 day = 24 hours
      title = 'Response Reminder - Day 1';
      message = 'You have not responded to a client message for 24 hours. Please check your messages.';
    } else if (hoursElapsed >= 8) {
      title = 'Response Reminder';
      message = 'You have not responded to a client message for 8 hours. Please check your messages.';
    } else {
      return; // Don't send reminders for less than 8 hours
    }

    const notificationData: CreateNotificationData = {
      user_id: vendorId,
      type: 'reminder',
      title,
      message,
      metadata: {
        client_id: clientId,
        hours_elapsed: hoursElapsed,
        reminder_type: 'response_time',
        timestamp: new Date().toISOString()
      }
    };

    const notification = await this.notificationRepository.create(notificationData);
    
    // Send real-time notification if socket service is available
    const ss = getSocketService();
    if (ss && notification) {
      await ss.sendNotificationToUser(vendorId, {
        type: 'reminder',
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata
      });
    }
  }

  /**
   * Recommend alternative vendors to client
   * Validates: Requirements 8.5
   */
  async recommendAlternativeVendors(clientId: string, originalVendorId: string): Promise<void> {
    if (!clientId || !originalVendorId) {
      throw new Error('Missing required parameters for alternative vendor recommendation');
    }

    const notificationData: CreateNotificationData = {
      user_id: clientId,
      type: 'system',
      title: 'Alternative Vendors Available',
      message: 'The vendor you contacted has not responded in over a week. We recommend exploring alternative vendors for your needs.',
      metadata: {
        original_vendor_id: originalVendorId,
        recommendation_type: 'alternative_vendors',
        reason: 'vendor_unresponsive',
        timestamp: new Date().toISOString()
      }
    };

    const notification = await this.notificationRepository.create(notificationData);
    
    // Send real-time notification if socket service is available
    const ss = getSocketService();
    if (ss && notification) {
      await ss.sendNotificationToUser(clientId, {
        type: 'system',
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata
      });
    }
  }

  /**
   * Get user notifications with optional filtering
   */
  async getUserNotifications(
    userId: string, 
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<Notification[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const filters = {
      limit: options.limit || 50,
      offset: options.offset || 0,
      is_read: options.unreadOnly ? false : undefined
    };

    const cleanFilters = {
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      ...(filters.is_read !== undefined && { is_read: filters.is_read })
    };
    return await this.notificationRepository.findByUserId(userId, cleanFilters);
  }

  /**
   * Mark a specific notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    if (!notificationId || !userId) {
      throw new Error('Notification ID and User ID are required');
    }

    return await this.notificationRepository.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<number> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.notificationRepository.markAllAsRead(userId);
  }

  /**
   * Get count of unread notifications for a user
   */
  async getUnreadNotificationCount(userId: string): Promise<number> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    return await this.notificationRepository.getUnreadCount(userId);
  }

  /**
   * Validate notification content before creation
   */
  validateNotificationContent(title: string, message: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Notification title is required');
    }
    
    if (title.length > 200) {
      throw new Error('Notification title must be 200 characters or less');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Notification message is required');
    }

    if (message.length > 1000) {
      throw new Error('Notification message must be 1000 characters or less');
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationServiceImpl();