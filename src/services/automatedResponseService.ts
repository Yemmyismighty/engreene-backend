import { vendorAutoResponseRepository, messageRepository } from '../database/repositories';
import { authService } from './authService';
// import { responseTimeService } from './responseTimeService';
import { VendorAutoResponse } from '../types';

export interface AutomatedResponseConfig {
  vendorId: string;
  message: string;
  isActive: boolean;
  triggerConditions?: {
    onlyWhenOffline?: boolean;
    businessHoursOnly?: boolean;
    delayMinutes?: number;
  };
}

export class AutomatedResponseService {
  /**
   * Set up automated response for a vendor
   * Validates: Requirements 8.1
   */
  async setupAutomatedResponse(config: AutomatedResponseConfig): Promise<VendorAutoResponse> {
    // Validate that user is a vendor
    const isVendor = await authService.isVendor(config.vendorId);
    if (!isVendor) {
      throw new Error('Only vendors can set up automated responses');
    }

    // Validate message content
    if (!config.message || config.message.trim().length === 0) {
      throw new Error('Automated response message cannot be empty');
    }

    if (config.message.length > 1000) {
      throw new Error('Automated response message cannot exceed 1000 characters');
    }

    // Set the automated response
    return await vendorAutoResponseRepository.setAutoResponse(config.vendorId, config.message.trim());
  }

  /**
   * Get automated response for a vendor
   */
  async getAutomatedResponse(vendorId: string): Promise<VendorAutoResponse | null> {
    return await vendorAutoResponseRepository.getActiveResponse(vendorId);
  }

  /**
   * Update automated response message
   */
  async updateAutomatedResponse(vendorId: string, newMessage: string): Promise<VendorAutoResponse> {
    // Validate that user is a vendor
    const isVendor = await authService.isVendor(vendorId);
    if (!isVendor) {
      throw new Error('Only vendors can update automated responses');
    }

    // Validate message content
    if (!newMessage || newMessage.trim().length === 0) {
      throw new Error('Automated response message cannot be empty');
    }

    if (newMessage.length > 1000) {
      throw new Error('Automated response message cannot exceed 1000 characters');
    }

    return await vendorAutoResponseRepository.setAutoResponse(vendorId, newMessage.trim());
  }

  /**
   * Deactivate automated response for a vendor
   */
  async deactivateAutomatedResponse(vendorId: string): Promise<void> {
    // Validate that user is a vendor
    const isVendor = await authService.isVendor(vendorId);
    if (!isVendor) {
      throw new Error('Only vendors can manage automated responses');
    }

    await vendorAutoResponseRepository.deactivateAutoResponse(vendorId);
  }

  /**
   * Get all automated responses for a vendor (including inactive)
   */
  async getVendorResponseHistory(vendorId: string): Promise<VendorAutoResponse[]> {
    // Validate that user is a vendor
    const isVendor = await authService.isVendor(vendorId);
    if (!isVendor) {
      throw new Error('Only vendors can view response history');
    }

    return await vendorAutoResponseRepository.getVendorResponses(vendorId);
  }

  /**
   * Check if automated response should be sent
   */
  async shouldSendAutomatedResponse(
    vendorId: string, 
    clientId: string | null,
    isVendorOnline: boolean
  ): Promise<{ shouldSend: boolean; response?: VendorAutoResponse }> {
    try {
      // Don't send auto-response if vendor is online
      if (isVendorOnline) {
        return { shouldSend: false };
      }

      // Get active auto-response
      const autoResponse = await vendorAutoResponseRepository.getActiveResponse(vendorId);
      if (!autoResponse) {
        return { shouldSend: false };
      }

      // Check if we've already sent an auto-response recently to this client
      if (clientId) {
        const recentAutoResponse = await this.hasRecentAutoResponse(vendorId, clientId);
        if (recentAutoResponse) {
          return { shouldSend: false };
        }
      }

      return { shouldSend: true, response: autoResponse };
    } catch (error) {
      console.error('Error checking automated response conditions:', error);
      return { shouldSend: false };
    }
  }

  /**
   * Send automated response if conditions are met
   */
  async sendAutomatedResponseIfNeeded(
    vendorId: string,
    clientId: string | null,
    isVendorOnline: boolean
  ): Promise<boolean> {
    const { shouldSend, response } = await this.shouldSendAutomatedResponse(
      vendorId, 
      clientId, 
      isVendorOnline
    );

    if (!shouldSend || !response) {
      return false;
    }

    try {
      // Send automated response
      await messageRepository.sendMessage(
        vendorId,
        clientId || vendorId, // If client is anonymous, send to vendor (for logging)
        response.message,
        'Automated Response',
        true
      );

      return true;
    } catch (error) {
      console.error('Error sending automated response:', error);
      return false;
    }
  }

  /**
   * Check if an automated response was sent recently to avoid spam
   */
  private async hasRecentAutoResponse(vendorId: string, clientId: string): Promise<boolean> {
    try {
      const recentMessages = await messageRepository.getConversation(vendorId, clientId, 5, 0);
      
      // Check if the last message from vendor was automated and sent within last hour
      const lastVendorMessage = recentMessages
        .filter(msg => msg.from_user_id === vendorId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastVendorMessage && lastVendorMessage.is_automated) {
        const messageTime = new Date(lastVendorMessage.created_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return messageTime > oneHourAgo;
      }

      return false;
    } catch (error) {
      console.error('Error checking recent auto-response:', error);
      return false; // Err on the side of sending the response
    }
  }

  /**
   * Get automated response statistics for a vendor
   */
  async getAutomatedResponseStats(vendorId: string): Promise<{
    totalAutoResponsesSent: number;
    activeResponseMessage?: string;
    lastResponseSent?: string;
    responseRate: number;
  }> {
    try {
      // Get total automated responses sent
      const totalAutoResponses = await messageRepository.findAll({
        from_user_id: vendorId,
        is_automated: true
      });

      // Get active response
      const activeResponse = await vendorAutoResponseRepository.getActiveResponse(vendorId);

      // Get last automated response sent
      const lastAutoResponse = totalAutoResponses
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      // Calculate response rate (automated + manual responses vs total messages received)
      const totalMessagesReceived = await messageRepository.findAll({
        to_user_id: vendorId
      });

      const totalResponsesSent = await messageRepository.findAll({
        from_user_id: vendorId
      });

      const responseRate = totalMessagesReceived.length > 0 
        ? (totalResponsesSent.length / totalMessagesReceived.length) * 100 
        : 0;

      const result: {
        totalAutoResponsesSent: number;
        activeResponseMessage?: string;
        lastResponseSent?: string;
        responseRate: number;
      } = {
        totalAutoResponsesSent: totalAutoResponses.length,
        responseRate: Math.round(responseRate * 100) / 100
      };

      if (activeResponse?.message) {
        result.activeResponseMessage = activeResponse.message;
      }

      if (lastAutoResponse?.created_at) {
        result.lastResponseSent = lastAutoResponse.created_at;
      }

      return result;
    } catch (error) {
      console.error('Error getting automated response stats:', error);
      return {
        totalAutoResponsesSent: 0,
        responseRate: 0
      };
    }
  }

  /**
   * Validate automated response message content
   */
  validateResponseMessage(message: string): { isValid: boolean; error?: string } {
    if (!message || typeof message !== 'string') {
      return { isValid: false, error: 'Message is required' };
    }

    const trimmed = message.trim();
    
    if (trimmed.length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (trimmed.length > 1000) {
      return { isValid: false, error: 'Message cannot exceed 1000 characters' };
    }

    // Check for potentially problematic content
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmed)) {
        return { isValid: false, error: 'Message contains potentially unsafe content' };
      }
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const automatedResponseService = new AutomatedResponseService();