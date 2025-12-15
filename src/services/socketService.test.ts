import { Server } from 'socket.io';
import { createServer } from 'http';
import { SocketService } from './socketService';

describe('SocketService', () => {
  let httpServer: any;
  let io: Server;
  let socketService: SocketService;

  beforeEach(() => {
    httpServer = createServer();
    io = new Server(httpServer);
    socketService = new SocketService(io);
  });

  afterEach(() => {
    socketService.shutdown();
    io.close();
    httpServer.close();
  });

  describe('initialization', () => {
    it('should initialize socket service correctly', () => {
      expect(socketService).toBeDefined();
      expect(socketService.getOnlineUsersCount()).toBe(0);
      expect(socketService.getConnectedSocketsCount()).toBe(0);
    });

    it('should track online users correctly', () => {
      const initialCount = socketService.getOnlineUsersCount();
      expect(initialCount).toBe(0);
    });

    it('should check if user is online', () => {
      const isOnline = socketService.isUserOnline('test-user-id');
      expect(isOnline).toBe(false);
    });

    it('should get online users list', () => {
      const onlineUsers = socketService.getOnlineUsersList();
      expect(Array.isArray(onlineUsers)).toBe(true);
      expect(onlineUsers.length).toBe(0);
    });
  });

  describe('notification sending', () => {
    it('should handle sending notifications to offline users gracefully', async () => {
      const notification = {
        type: 'test',
        title: 'Test Notification',
        message: 'This is a test notification',
        metadata: { test: true }
      };

      // Should not throw error even if user is not online
      await expect(
        socketService.sendNotificationToUser('offline-user', notification)
      ).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', () => {
      expect(() => socketService.shutdown()).not.toThrow();
    });
  });
});