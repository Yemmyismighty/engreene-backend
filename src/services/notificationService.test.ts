import { notificationService } from './notificationService';
import { notificationRepository } from '../database/repositories';

// Mock the repository
jest.mock('../database/repositories');

const mockNotificationRepository = notificationRepository as jest.Mocked<typeof notificationRepository>;

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notifyVendorCartAdd', () => {
    it('should create cart add notification for vendor', async () => {
      const vendorId = 'vendor-123';
      const clientId = 'client-456';
      const serviceId = 'service-789';

      const mockNotification = {
        id: 'notification-123',
        user_id: vendorId,
        type: 'cart_add' as const,
        title: 'Service Added to Cart',
        message: 'A client has added your service to their cart',
        is_read: false,
        metadata: {
          client_id: clientId,
          service_id: serviceId,
          action: 'cart_add',
          timestamp: expect.any(String)
        },
        created_at: new Date().toISOString()
      };

      mockNotificationRepository.create.mockResolvedValueOnce(mockNotification);

      await notificationService.notifyVendorCartAdd(vendorId, clientId, serviceId);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user_id: vendorId,
        type: 'cart_add',
        title: 'Service Added to Cart',
        message: 'A client has added your service to their cart',
        metadata: {
          client_id: clientId,
          service_id: serviceId,
          action: 'cart_add',
          timestamp: expect.any(String)
        }
      });
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(notificationService.notifyVendorCartAdd('', 'client-456', 'service-789'))
        .rejects.toThrow('Missing required parameters for cart notification');

      await expect(notificationService.notifyVendorCartAdd('vendor-123', '', 'service-789'))
        .rejects.toThrow('Missing required parameters for cart notification');

      await expect(notificationService.notifyVendorCartAdd('vendor-123', 'client-456', ''))
        .rejects.toThrow('Missing required parameters for cart notification');
    });
  });

  describe('notifyVendorWishlistAdd', () => {
    it('should create wishlist add notification for vendor', async () => {
      const vendorId = 'vendor-123';
      const clientId = 'client-456';
      const serviceId = 'service-789';

      const mockNotification = {
        id: 'notification-123',
        user_id: vendorId,
        type: 'wishlist_add' as const,
        title: 'Service Added to Wishlist',
        message: 'A client has added your service to their wishlist',
        is_read: false,
        metadata: {
          client_id: clientId,
          service_id: serviceId,
          action: 'wishlist_add',
          timestamp: expect.any(String)
        },
        created_at: new Date().toISOString()
      };

      mockNotificationRepository.create.mockResolvedValueOnce(mockNotification);

      await notificationService.notifyVendorWishlistAdd(vendorId, clientId, serviceId);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user_id: vendorId,
        type: 'wishlist_add',
        title: 'Service Added to Wishlist',
        message: 'A client has added your service to their wishlist',
        metadata: {
          client_id: clientId,
          service_id: serviceId,
          action: 'wishlist_add',
          timestamp: expect.any(String)
        }
      });
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(notificationService.notifyVendorWishlistAdd('', 'client-456', 'service-789'))
        .rejects.toThrow('Missing required parameters for wishlist notification');
    });
  });

  describe('sendResponseReminder', () => {
    it('should create 8-hour reminder notification', async () => {
      const vendorId = 'vendor-123';
      const clientId = 'client-456';
      const hoursElapsed = 8;

      const mockNotification = {
        id: 'notification-123',
        user_id: vendorId,
        type: 'reminder' as const,
        title: 'Response Reminder',
        message: 'You have not responded to a client message for 8 hours. Please check your messages.',
        is_read: false,
        metadata: {
          client_id: clientId,
          hours_elapsed: hoursElapsed,
          reminder_type: 'response_time',
          timestamp: expect.any(String)
        },
        created_at: new Date().toISOString()
      };

      mockNotificationRepository.create.mockResolvedValueOnce(mockNotification);

      await notificationService.sendResponseReminder(vendorId, clientId, hoursElapsed);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user_id: vendorId,
        type: 'reminder',
        title: 'Response Reminder',
        message: 'You have not responded to a client message for 8 hours. Please check your messages.',
        metadata: {
          client_id: clientId,
          hours_elapsed: hoursElapsed,
          reminder_type: 'response_time',
          timestamp: expect.any(String)
        }
      });
    });

    it('should create 24-hour reminder notification', async () => {
      const vendorId = 'vendor-123';
      const clientId = 'client-456';
      const hoursElapsed = 24;

      await notificationService.sendResponseReminder(vendorId, clientId, hoursElapsed);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user_id: vendorId,
        type: 'reminder',
        title: 'Response Reminder - Day 1',
        message: 'You have not responded to a client message for 24 hours. Please check your messages.',
        metadata: {
          client_id: clientId,
          hours_elapsed: hoursElapsed,
          reminder_type: 'response_time',
          timestamp: expect.any(String)
        }
      });
    });

    it('should create 1-week final reminder notification', async () => {
      const vendorId = 'vendor-123';
      const clientId = 'client-456';
      const hoursElapsed = 168; // 1 week

      await notificationService.sendResponseReminder(vendorId, clientId, hoursElapsed);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user_id: vendorId,
        type: 'reminder',
        title: 'Final Response Reminder',
        message: 'You have not responded to a client message for over 1 week. Alternative vendors may be recommended.',
        metadata: {
          client_id: clientId,
          hours_elapsed: hoursElapsed,
          reminder_type: 'response_time',
          timestamp: expect.any(String)
        }
      });
    });

    it('should not create reminder for less than 8 hours', async () => {
      const vendorId = 'vendor-123';
      const clientId = 'client-456';
      const hoursElapsed = 4;

      await notificationService.sendResponseReminder(vendorId, clientId, hoursElapsed);

      expect(mockNotificationRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid parameters', async () => {
      await expect(notificationService.sendResponseReminder('', 'client-456', 8))
        .rejects.toThrow('Invalid parameters for response reminder');

      await expect(notificationService.sendResponseReminder('vendor-123', '', 8))
        .rejects.toThrow('Invalid parameters for response reminder');

      await expect(notificationService.sendResponseReminder('vendor-123', 'client-456', 0))
        .rejects.toThrow('Invalid parameters for response reminder');
    });
  });

  describe('recommendAlternativeVendors', () => {
    it('should create alternative vendor recommendation notification', async () => {
      const clientId = 'client-456';
      const originalVendorId = 'vendor-123';

      const mockNotification = {
        id: 'notification-123',
        user_id: clientId,
        type: 'system' as const,
        title: 'Alternative Vendors Available',
        message: 'The vendor you contacted has not responded in over a week. We recommend exploring alternative vendors for your needs.',
        is_read: false,
        metadata: {
          original_vendor_id: originalVendorId,
          recommendation_type: 'alternative_vendors',
          reason: 'vendor_unresponsive',
          timestamp: expect.any(String)
        },
        created_at: new Date().toISOString()
      };

      mockNotificationRepository.create.mockResolvedValueOnce(mockNotification);

      await notificationService.recommendAlternativeVendors(clientId, originalVendorId);

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        user_id: clientId,
        type: 'system',
        title: 'Alternative Vendors Available',
        message: 'The vendor you contacted has not responded in over a week. We recommend exploring alternative vendors for your needs.',
        metadata: {
          original_vendor_id: originalVendorId,
          recommendation_type: 'alternative_vendors',
          reason: 'vendor_unresponsive',
          timestamp: expect.any(String)
        }
      });
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(notificationService.recommendAlternativeVendors('', 'vendor-123'))
        .rejects.toThrow('Missing required parameters for alternative vendor recommendation');

      await expect(notificationService.recommendAlternativeVendors('client-456', ''))
        .rejects.toThrow('Missing required parameters for alternative vendor recommendation');
    });
  });

  describe('getUserNotifications', () => {
    it('should get user notifications with default options', async () => {
      const userId = 'user-123';
      const mockNotifications = [
        {
          id: 'notification-1',
          user_id: userId,
          type: 'cart_add' as const,
          title: 'Service Added to Cart',
          message: 'A client has added your service to their cart',
          is_read: false,
          metadata: {},
          created_at: new Date().toISOString()
        }
      ];

      mockNotificationRepository.findByUserId.mockResolvedValueOnce(mockNotifications);

      const result = await notificationService.getUserNotifications(userId);

      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith(userId, {
        limit: 50,
        offset: 0,
        is_read: undefined
      });
      expect(result).toEqual(mockNotifications);
    });

    it('should get unread notifications only when specified', async () => {
      const userId = 'user-123';
      const options = { unreadOnly: true, limit: 10 };

      await notificationService.getUserNotifications(userId, options);

      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith(userId, {
        limit: 10,
        offset: 0,
        is_read: false
      });
    });

    it('should throw error when user ID is missing', async () => {
      await expect(notificationService.getUserNotifications(''))
        .rejects.toThrow('User ID is required');
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notification-123';
      const userId = 'user-456';
      const mockNotification = {
        id: notificationId,
        user_id: userId,
        type: 'cart_add' as const,
        title: 'Service Added to Cart',
        message: 'A client has added your service to their cart',
        is_read: true,
        metadata: {},
        created_at: new Date().toISOString()
      };

      mockNotificationRepository.markAsRead.mockResolvedValueOnce(mockNotification);

      const result = await notificationService.markNotificationAsRead(notificationId, userId);

      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith(notificationId, userId);
      expect(result).toEqual(mockNotification);
    });

    it('should throw error when parameters are missing', async () => {
      await expect(notificationService.markNotificationAsRead('', 'user-456'))
        .rejects.toThrow('Notification ID and User ID are required');

      await expect(notificationService.markNotificationAsRead('notification-123', ''))
        .rejects.toThrow('Notification ID and User ID are required');
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return unread notification count', async () => {
      const userId = 'user-123';
      const expectedCount = 5;

      mockNotificationRepository.getUnreadCount.mockResolvedValueOnce(expectedCount);

      const result = await notificationService.getUnreadNotificationCount(userId);

      expect(mockNotificationRepository.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(result).toBe(expectedCount);
    });

    it('should throw error when user ID is missing', async () => {
      await expect(notificationService.getUnreadNotificationCount(''))
        .rejects.toThrow('User ID is required');
    });
  });
});