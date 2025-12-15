import { automatedResponseService } from './automatedResponseService';

describe('AutomatedResponseService', () => {
  describe('validateResponseMessage', () => {
    it('should validate correct message', () => {
      const result = automatedResponseService.validateResponseMessage('Hello, thank you for your message!');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty message', () => {
      const result = automatedResponseService.validateResponseMessage('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message is required');
    });

    it('should reject message that is too long', () => {
      const longMessage = 'a'.repeat(1001);
      const result = automatedResponseService.validateResponseMessage(longMessage);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message cannot exceed 1000 characters');
    });

    it('should reject message with script tags', () => {
      const result = automatedResponseService.validateResponseMessage('Hello <script>alert("xss")</script>');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message contains potentially unsafe content');
    });

    it('should reject message with javascript protocol', () => {
      const result = automatedResponseService.validateResponseMessage('Click here: javascript:alert("xss")');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message contains potentially unsafe content');
    });
  });

  describe('shouldSendAutomatedResponse', () => {
    it('should not send response when vendor is online', async () => {
      const result = await automatedResponseService.shouldSendAutomatedResponse(
        'vendor-id',
        'client-id',
        true // vendor is online
      );
      expect(result.shouldSend).toBe(false);
    });

    it('should not send response when vendor is offline but no auto-response is set', async () => {
      const result = await automatedResponseService.shouldSendAutomatedResponse(
        'nonexistent-vendor-id',
        'client-id',
        false // vendor is offline
      );
      expect(result.shouldSend).toBe(false);
    });
  });
});