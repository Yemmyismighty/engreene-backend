import { Router } from 'express';
import { messagingService } from '../services/messagingService';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { ApiResponse, ConversationResponse } from '../types';

const router = Router();

/**
 * GET /api/messages/:vendorId - Get conversation with a vendor
 */
router.get('/:vendorId', optionalAuth, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { limit = '50', offset = '0' } = req.query;
    const userId = req.user?.id;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view conversations',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const conversation = await messagingService.getConversation(
      userId,
      vendorId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    return res.json({
      success: true,
      data: conversation,
      timestamp: new Date().toISOString()
    } as ApiResponse<ConversationResponse>);
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/messages - Send a message
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    const fromUserId = req.user?.id || null;

    if (!toUserId || !content) {
      return res.status(400).json({
        success: false,
        message: 'toUserId and content are required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    // Validate message content
    const validation = messagingService.validateMessageContent(content);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const message = await messagingService.sendMessage(fromUserId, toUserId, content);

    return res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send message',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/messages - Get recent conversations for authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { limit = '10' } = req.query;

    const conversations = await messagingService.getRecentConversations(
      userId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: conversations,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/messages/vendors/:vendorId/auto-response - Set automated response
 */
router.post('/vendors/:vendorId/auto-response', requireAuth, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;

    // Verify user is the vendor or has permission
    if (userId !== vendorId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to set auto-response for this vendor',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Auto-response message is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const autoResponse = await messagingService.setAutomatedResponse(vendorId, message);

    return res.json({
      success: true,
      data: autoResponse,
      message: 'Auto-response set successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Set auto-response error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set auto-response',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * DELETE /api/messages/vendors/:vendorId/auto-response - Deactivate automated response
 */
router.delete('/vendors/:vendorId/auto-response', requireAuth, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user!.id;

    // Verify user is the vendor or has permission
    if (userId !== vendorId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify auto-response for this vendor',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    await messagingService.deactivateAutomatedResponse(vendorId);

    return res.json({
      success: true,
      message: 'Auto-response deactivated successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Deactivate auto-response error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate auto-response',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

export default router;