import { Router } from 'express';
import { notificationService } from '../services/notificationService';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

/**
 * GET /api/notifications - Get user notifications
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { 
      limit = '50', 
      offset = '0', 
      unreadOnly = 'false' 
    } = req.query;

    const notifications = await notificationService.getUserNotifications(userId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      unreadOnly: unreadOnly === 'true'
    });

    res.json({
      success: true,
      data: notifications,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/notifications/unread/count - Get unread notification count
 */
router.get('/unread/count', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadNotificationCount(userId);

    res.json({
      success: true,
      data: { count },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve unread notification count',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * PUT /api/notifications/:id/read - Mark notification as read
 */
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const notification = await notificationService.markNotificationAsRead(id, userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not authorized',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * PUT /api/notifications/read-all - Mark all notifications as read
 */
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.markAllNotificationsAsRead(userId);

    res.json({
      success: true,
      data: { markedCount: count },
      message: `${count} notifications marked as read`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

export default router;