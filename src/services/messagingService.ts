import { 
  messageRepository, 
  userOnlineStatusRepository 
} from '../database/repositories';
import { authService } from './authService';
import { responseTimeService } from './responseTimeService';
import { automatedResponseService } from './automatedResponseService';
import { Message, ConversationResponse, VendorAutoResponse, UserOnlineStatus } from '../types';

export class MessagingService {
  /**
   * Send a message between users
   */
  async sendMessage(
    fromUserId: string | null, 
    toUserId: string, 
    content: string
  ): Promise<Message> {
    // Validate and sanitize content
    const sanitizedContent = this.sanitizeMessageContent(content);
    if (!sanitizedContent) {
      throw new Error('Message content cannot be empty');
    }

    // Determine sender name based on authentication
    const senderName = await this.determineSenderName(fromUserId);

    // Send the message
    const message = await messageRepository.sendMessage(
      fromUserId,
      toUserId,
      sanitizedContent,
      senderName,
      false
    );

    // Check if recipient is a vendor and has auto-response enabled
    if (fromUserId !== toUserId) {
      await this.handleAutoResponse(toUserId, fromUserId);
    }

    // Reset response time tracking if vendor is responding to client
    if (fromUserId && toUserId) {
      const isVendorResponding = await authService.isVendor(fromUserId);
      if (isVendorResponding) {
        await responseTimeService.resetTracking(fromUserId, toUserId);
      }
    }

    return message;
  }

  /**
   * Get conversation between two users
   */
  async getConversation(
    user1Id: string, 
    user2Id: string, 
    limit = 50, 
    offset = 0
  ): Promise<ConversationResponse> {
    // Get messages
    const messages = await messageRepository.getConversation(user1Id, user2Id, limit, offset);

    // Get participant info
    const participantInfo = await this.getParticipantInfo(user2Id);

    return {
      messages,
      participant_info: participantInfo
    };
  }

  /**
   * Get recent conversations for a user
   */
  async getRecentConversations(userId: string, limit = 10) {
    return messageRepository.getRecentConversations(userId, limit);
  }

  /**
   * Set automated response for a vendor
   */
  async setAutomatedResponse(vendorId: string, message: string): Promise<VendorAutoResponse> {
    return await automatedResponseService.setupAutomatedResponse({
      vendorId,
      message,
      isActive: true
    });
  }

  /**
   * Deactivate automated response for a vendor
   */
  async deactivateAutomatedResponse(vendorId: string): Promise<void> {
    await automatedResponseService.deactivateAutomatedResponse(vendorId);
  }

  /**
   * Update user online status
   */
  async updateOnlineStatus(userId: string, isOnline: boolean): Promise<UserOnlineStatus> {
    return userOnlineStatusRepository.updateOnlineStatus(userId, isOnline);
  }

  /**
   * Get user online status
   */
  async getOnlineStatus(userId: string): Promise<UserOnlineStatus | null> {
    return userOnlineStatusRepository.getOnlineStatus(userId);
  }

  /**
   * Get multiple users' online status
   */
  async getMultipleOnlineStatus(userIds: string[]): Promise<UserOnlineStatus[]> {
    return userOnlineStatusRepository.getMultipleOnlineStatus(userIds);
  }

  /**
   * Get all currently online users
   */
  async getOnlineUsers(): Promise<UserOnlineStatus[]> {
    return userOnlineStatusRepository.getOnlineUsers();
  }

  /**
   * Clean up stale online statuses
   */
  async cleanupStaleStatuses(minutesThreshold = 5): Promise<number> {
    return userOnlineStatusRepository.cleanupStaleStatuses(minutesThreshold);
  }

  /**
   * Private: Determine sender name based on authentication status
   */
  private async determineSenderName(fromUserId: string | null): Promise<string> {
    if (!fromUserId) {
      // Anonymous user - use one of the specified names
      const anonymousNames = ['Alien', 'Unknown User'];
      const randomIndex = Math.floor(Math.random() * anonymousNames.length);
      return anonymousNames[randomIndex] || 'Unknown User';
    }

    // Authenticated user - get their username
    const user = await authService.getUserById(fromUserId);
    if (!user || !user.username) {
      // Fallback to email prefix or default name
      return user?.email?.split('@')[0] || 'User';
    }

    return user.username;
  }

  /**
   * Private: Handle automated response if applicable
   */
  private async handleAutoResponse(recipientId: string, senderId: string | null): Promise<void> {
    try {
      // Check if recipient is a vendor
      const isVendor = await authService.isVendor(recipientId);
      if (!isVendor) {
        return;
      }

      // Check if vendor is currently online
      const onlineStatus = await this.getOnlineStatus(recipientId);
      const isVendorOnline = onlineStatus?.is_online || false;

      // Use the automated response service to handle the logic
      await automatedResponseService.sendAutomatedResponseIfNeeded(
        recipientId,
        senderId,
        isVendorOnline
      );
    } catch (error) {
      // Log error but don't throw - auto-response failure shouldn't block message sending
      console.error('Error handling auto-response:', error);
    }
  }

  /**
   * Private: Get participant information for conversation
   */
  private async getParticipantInfo(userId: string): Promise<{
    user_id: string;
    username?: string;
    is_online: boolean;
  }> {
    const user = await authService.getUserById(userId);
    const onlineStatus = await this.getOnlineStatus(userId);

    const result: {
      user_id: string;
      username?: string;
      is_online: boolean;
    } = {
      user_id: userId,
      is_online: onlineStatus?.is_online || false
    };

    if (user?.username) {
      result.username = user.username;
    }

    return result;
  }

  /**
   * Private: Sanitize message content
   */
  private sanitizeMessageContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // Trim whitespace
    const trimmed = content.trim();
    
    // Check length constraints (from database schema)
    if (trimmed.length === 0 || trimmed.length > 5000) {
      return '';
    }

    // Basic HTML sanitization - remove script tags and other dangerous content
    const sanitized = trimmed
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    return sanitized;
  }

  /**
   * Validate message content
   */
  validateMessageContent(content: string): { isValid: boolean; error?: string } {
    if (content === null || content === undefined || typeof content !== 'string') {
      return { isValid: false, error: 'Message content is required' };
    }

    const trimmed = content.trim();
    
    if (trimmed.length === 0) {
      return { isValid: false, error: 'Message content cannot be empty' };
    }

    if (trimmed.length > 5000) {
      return { isValid: false, error: 'Message content cannot exceed 5000 characters' };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const messagingService = new MessagingService();