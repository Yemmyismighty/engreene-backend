import { Router } from 'express';
import { messagingService } from '../services/messagingService';
import { optionalAuth } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

/**
 * GET /api/status/:userId - Get user online status
 */
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const status = await messagingService.getOnlineStatus(userId);

    return res.json({
      success: true,
      data: status || {
        user_id: userId,
        is_online: false,
        last_seen: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Get status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user status',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/status/batch - Get multiple users' online status
 */
router.post('/batch', optionalAuth, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'userIds must be an array',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    if (userIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request status for more than 100 users at once',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const statuses = await messagingService.getMultipleOnlineStatus(userIds);

    return res.json({
      success: true,
      data: statuses,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Get batch status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user statuses',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/status/online/users - Get all online users
 */
router.get('/online/users', optionalAuth, async (_req, res) => {
  try {
    const onlineUsers = await messagingService.getOnlineUsers();

    return res.json({
      success: true,
      data: onlineUsers,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Get online users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve online users',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

export default router;