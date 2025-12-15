import { MessagingService } from './messagingService';
import { messageRepository, vendorAutoResponseRepository, userOnlineStatusRepository } from '../database/repositories';
import { authService } from './authService';

// Mock repositories
jest.mock('../database/repositories', () => ({
  messageRepository: {
    sendMessage: jest.fn(),
    getConversation: jest.fn(),
    getRecentConversations: jest.fn(),
  },
  vendorAutoResponseRepository: {
    setAutoResponse: jest.fn(),
    deactivateAutoResponse: jest.fn(),
    getActiveResponse: jest.fn(),
  },
  userOnlineStatusRepository: {
    updateOnlineStatus: jest.fn(),
    getOnlineStatus: jest.fn(),
    getMultipleOnlineStatus: jest.fn(),
    getOnlineUsers: jest.fn(),
    cleanupStaleStatuses: jest.fn(),
  },
}));

// Mock auth service
jest.mock('./authService', () => ({
  authService: {
    isVendor: jest.fn(),
    getUserById: jest.fn(),
  },
}));

describe('MessagingService', () => {
  let messagingService: MessagingService;

  beforeEach(() => {
    messagingService = new MessagingService();
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message with authenticated user name', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'client' as const,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const mockMessage = {
        id: 'msg-1',
        from_user_id: 'user-1',
        to_user_id: 'user-2',
        content: 'Hello!',
        sender_name: 'testuser',
        is_automated: false,
        created_at: '2023-01-01',
      };

      (authService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (authService.isVendor as jest.Mock).mockResolvedValue(false);
      (messageRepository.sendMessage as jest.Mock).mockResolvedValue(mockMessage);

      const result = await messagingService.sendMessage('user-1', 'user-2', 'Hello!');

      expect(messageRepository.sendMessage).toHaveBeenCalledWith(
        'user-1',
        'user-2',
        'Hello!',
        'testuser',
        false
      );
      expect(result).toEqual(mockMessage);
    });

    it('should send message with anonymous user name when not authenticated', async () => {
      const mockMessage = {
        id: 'msg-1',
        from_user_id: null,
        to_user_id: 'user-2',
        content: 'Hello!',
        sender_name: 'Alien',
        is_automated: false,
        created_at: '2023-01-01',
      };

      (messageRepository.sendMessage as jest.Mock).mockResolvedValue(mockMessage);
      (authService.isVendor as jest.Mock).mockResolvedValue(false);

      const result = await messagingService.sendMessage(null, 'user-2', 'Hello!');

      expect(messageRepository.sendMessage).toHaveBeenCalledWith(
        null,
        'user-2',
        'Hello!',
        expect.stringMatching(/^(Alien|Unknown User)$/),
        false
      );
      expect(result).toEqual(mockMessage);
    });

    it('should reject empty message content', async () => {
      await expect(messagingService.sendMessage('user-1', 'user-2', '')).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('should sanitize message content', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'client' as const,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const mockMessage = {
        id: 'msg-1',
        from_user_id: 'user-1',
        to_user_id: 'user-2',
        content: 'Hello world!',
        sender_name: 'testuser',
        is_automated: false,
        created_at: '2023-01-01',
      };

      (authService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (authService.isVendor as jest.Mock).mockResolvedValue(false);
      (messageRepository.sendMessage as jest.Mock).mockResolvedValue(mockMessage);

      await messagingService.sendMessage('user-1', 'user-2', '  Hello world!  ');

      expect(messageRepository.sendMessage).toHaveBeenCalledWith(
        'user-1',
        'user-2',
        'Hello world!',
        'testuser',
        false
      );
    });
  });

  describe('setAutomatedResponse', () => {
    it('should set automated response for vendor', async () => {
      const mockResponse = {
        id: 'resp-1',
        vendor_id: 'vendor-1',
        message: 'Thanks for your message!',
        is_active: true,
        created_at: '2023-01-01',
      };

      (authService.isVendor as jest.Mock).mockResolvedValue(true);
      (vendorAutoResponseRepository.setAutoResponse as jest.Mock).mockResolvedValue(mockResponse);

      const result = await messagingService.setAutomatedResponse('vendor-1', 'Thanks for your message!');

      expect(vendorAutoResponseRepository.setAutoResponse).toHaveBeenCalledWith(
        'vendor-1',
        'Thanks for your message!'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should reject setting automated response for non-vendor', async () => {
      (authService.isVendor as jest.Mock).mockResolvedValue(false);

      await expect(
        messagingService.setAutomatedResponse('client-1', 'Thanks for your message!')
      ).rejects.toThrow('Only vendors can set automated responses');
    });

    it('should reject empty automated response message', async () => {
      (authService.isVendor as jest.Mock).mockResolvedValue(true);

      await expect(
        messagingService.setAutomatedResponse('vendor-1', '')
      ).rejects.toThrow('Auto-response message cannot be empty');
    });
  });

  describe('validateMessageContent', () => {
    it('should validate correct message content', () => {
      const result = messagingService.validateMessageContent('Hello world!');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty content', () => {
      const result = messagingService.validateMessageContent('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message content cannot be empty');
    });

    it('should reject whitespace-only content', () => {
      const result = messagingService.validateMessageContent('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message content cannot be empty');
    });

    it('should reject content that is too long', () => {
      const longContent = 'a'.repeat(5001);
      const result = messagingService.validateMessageContent(longContent);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Message content cannot exceed 5000 characters');
    });

    it('should reject null or undefined content', () => {
      const result1 = messagingService.validateMessageContent(null as any);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toBe('Message content is required');

      const result2 = messagingService.validateMessageContent(undefined as any);
      expect(result2.isValid).toBe(false);
      expect(result2.error).toBe('Message content is required');
    });
  });

  describe('updateOnlineStatus', () => {
    it('should update user online status', async () => {
      const mockStatus = {
        user_id: 'user-1',
        is_online: true,
        last_seen: '2023-01-01T12:00:00Z',
      };

      (userOnlineStatusRepository.updateOnlineStatus as jest.Mock).mockResolvedValue(mockStatus);

      const result = await messagingService.updateOnlineStatus('user-1', true);

      expect(userOnlineStatusRepository.updateOnlineStatus).toHaveBeenCalledWith('user-1', true);
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getConversation', () => {
    it('should get conversation with participant info', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          from_user_id: 'user-1',
          to_user_id: 'user-2',
          content: 'Hello!',
          sender_name: 'testuser',
          is_automated: false,
          created_at: '2023-01-01',
        },
      ];

      const mockUser = {
        id: 'user-2',
        username: 'otheruser',
        email: 'other@example.com',
        role: 'vendor' as const,
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const mockOnlineStatus = {
        user_id: 'user-2',
        is_online: true,
        last_seen: '2023-01-01T12:00:00Z',
      };

      (messageRepository.getConversation as jest.Mock).mockResolvedValue(mockMessages);
      (authService.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (userOnlineStatusRepository.getOnlineStatus as jest.Mock).mockResolvedValue(mockOnlineStatus);

      const result = await messagingService.getConversation('user-1', 'user-2');

      expect(result.messages).toEqual(mockMessages);
      expect(result.participant_info).toEqual({
        user_id: 'user-2',
        username: 'otheruser',
        is_online: true,
      });
    });
  });
});