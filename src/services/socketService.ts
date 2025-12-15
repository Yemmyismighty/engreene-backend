import { Server, Socket } from 'socket.io';
import { messagingService } from './messagingService';
import { authService } from './authService';
import { Message } from '../types';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string | undefined;
}

interface SocketUser {
  socketId: string;
  userId: string;
  username?: string | undefined;
  lastSeen: Date;
}

export class SocketService {
  private io: Server;
  private connectedUsers: Map<string, SocketUser> = new Map(); // socketId -> user info
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> set of socketIds
  private cleanupInterval?: NodeJS.Timeout;

  constructor(io: Server) {
    this.io = io;
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle user authentication
      socket.on('authenticate', async (data: { token: string }) => {
        await this.handleAuthentication(socket, data.token);
      });

      // Handle sending messages
      socket.on('message:send', async (data: { 
        toUserId: string; 
        content: string; 
      }) => {
        await this.handleSendMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing:start', (data: { toUserId: string }) => {
        this.handleTypingStart(socket, data.toUserId);
      });

      socket.on('typing:stop', (data: { toUserId: string }) => {
        this.handleTypingStop(socket, data.toUserId);
      });

      // Handle status updates
      socket.on('status:update', async (data: { isOnline: boolean }) => {
        await this.handleStatusUpdate(socket, data.isOnline);
      });

      // Handle joining conversation rooms
      socket.on('conversation:join', (data: { otherUserId: string }) => {
        this.handleJoinConversation(socket, data.otherUserId);
      });

      socket.on('conversation:leave', (data: { otherUserId: string }) => {
        this.handleLeaveConversation(socket, data.otherUserId);
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle user authentication
   */
  private async handleAuthentication(socket: AuthenticatedSocket, token: string): Promise<void> {
    try {
      const user = await authService.validateSupabaseToken(token);
      if (!user) {
        socket.emit('auth:error', { message: 'Invalid token' });
        return;
      }

      // Store user info in socket
      socket.userId = user.id;
      socket.username = user.username;

      // Track connected user
      const socketUser: SocketUser = {
        socketId: socket.id,
        userId: user.id,
        username: user.username,
        lastSeen: new Date()
      };

      this.connectedUsers.set(socket.id, socketUser);

      // Add socket to user's socket set
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      // Update online status in database
      await messagingService.updateOnlineStatus(user.id, true);

      // Notify other users about status change
      await this.broadcastStatusUpdate(user.id, true);

      // Confirm authentication
      socket.emit('auth:success', { 
        userId: user.id, 
        username: user.username 
      });

      console.log(`User authenticated: ${user.id} (${user.username || 'no username'})`);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth:error', { message: 'Authentication failed' });
    }
  }

  /**
   * Handle sending messages
   */
  private async handleSendMessage(
    socket: AuthenticatedSocket, 
    data: { toUserId: string; content: string }
  ): Promise<void> {
    try {
      const { toUserId, content } = data;

      // Validate message content
      const validation = messagingService.validateMessageContent(content);
      if (!validation.isValid) {
        socket.emit('message:error', { message: validation.error });
        return;
      }

      // Send message through messaging service
      const message = await messagingService.sendMessage(
        socket.userId || null,
        toUserId,
        content
      );

      // Emit message to sender
      socket.emit('message:sent', { message });

      // Emit message to recipient(s) if they're online
      await this.deliverMessageToUser(toUserId, message);

      console.log(`Message sent from ${socket.userId || 'anonymous'} to ${toUserId}`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message:error', { 
        message: error instanceof Error ? error.message : 'Failed to send message' 
      });
    }
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: AuthenticatedSocket, toUserId: string): void {
    if (!socket.userId) return;

    // Notify recipient that user is typing
    this.emitToUser(toUserId, 'typing:start', {
      fromUserId: socket.userId,
      fromUsername: socket.username
    });
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: AuthenticatedSocket, toUserId: string): void {
    if (!socket.userId) return;

    // Notify recipient that user stopped typing
    this.emitToUser(toUserId, 'typing:stop', {
      fromUserId: socket.userId,
      fromUsername: socket.username
    });
  }

  /**
   * Handle status update
   */
  private async handleStatusUpdate(socket: AuthenticatedSocket, isOnline: boolean): Promise<void> {
    if (!socket.userId) return;

    try {
      // Update status in database
      await messagingService.updateOnlineStatus(socket.userId, isOnline);

      // Update last seen time
      const socketUser = this.connectedUsers.get(socket.id);
      if (socketUser) {
        socketUser.lastSeen = new Date();
      }

      // Broadcast status update
      await this.broadcastStatusUpdate(socket.userId, isOnline);

      console.log(`Status updated for ${socket.userId}: ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error('Status update error:', error);
    }
  }

  /**
   * Handle joining conversation room
   */
  private handleJoinConversation(socket: AuthenticatedSocket, otherUserId: string): void {
    if (!socket.userId) return;

    const roomName = this.getConversationRoom(socket.userId, otherUserId);
    socket.join(roomName);
    console.log(`${socket.userId} joined conversation room: ${roomName}`);
  }

  /**
   * Handle leaving conversation room
   */
  private handleLeaveConversation(socket: AuthenticatedSocket, otherUserId: string): void {
    if (!socket.userId) return;

    const roomName = this.getConversationRoom(socket.userId, otherUserId);
    socket.leave(roomName);
    console.log(`${socket.userId} left conversation room: ${roomName}`);
  }

  /**
   * Handle disconnect
   */
  private async handleDisconnect(socket: AuthenticatedSocket): Promise<void> {
    console.log(`Socket disconnected: ${socket.id}`);

    const socketUser = this.connectedUsers.get(socket.id);
    if (socketUser) {
      const { userId } = socketUser;

      // Remove socket from tracking
      this.connectedUsers.delete(socket.id);

      // Remove socket from user's socket set
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        
        // If user has no more sockets, mark as offline
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
          
          try {
            // Update status in database
            await messagingService.updateOnlineStatus(userId, false);
            
            // Broadcast status update
            await this.broadcastStatusUpdate(userId, false);
            
            console.log(`User ${userId} marked as offline`);
          } catch (error) {
            console.error('Error updating offline status:', error);
          }
        }
      }
    }
  }

  /**
   * Deliver message to a specific user
   */
  private async deliverMessageToUser(userId: string, message: Message): Promise<void> {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds && userSocketIds.size > 0) {
      // User is online, deliver message immediately
      userSocketIds.forEach(socketId => {
        this.io.to(socketId).emit('message:receive', { message });
      });
    }
    // If user is offline, message is already stored in database
    // They'll receive it when they reconnect and fetch conversation history
  }

  /**
   * Emit event to all sockets of a specific user
   */
  private emitToUser(userId: string, event: string, data: any): void {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds && userSocketIds.size > 0) {
      userSocketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  /**
   * Broadcast status update to relevant users
   */
  private async broadcastStatusUpdate(userId: string, isOnline: boolean): Promise<void> {
    // For now, broadcast to all connected users
    // In a production system, you might want to only broadcast to users who have conversations with this user
    this.io.emit('status:update', {
      userId,
      isOnline,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get conversation room name for two users
   */
  private getConversationRoom(user1Id: string, user2Id: string): string {
    // Create consistent room name regardless of user order
    const sortedIds = [user1Id, user2Id].sort();
    return `conversation:${sortedIds[0]}:${sortedIds[1]}`;
  }

  /**
   * Get online users count
   */
  public getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get connected sockets count
   */
  public getConnectedSocketsCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get online users list
   */
  public getOnlineUsersList(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Send notification to user
   */
  public async sendNotificationToUser(userId: string, notification: {
    type: string;
    title: string;
    message: string;
    metadata?: any;
  }): Promise<void> {
    this.emitToUser(userId, 'notification:new', notification);
  }

  /**
   * Start cleanup interval for stale connections
   */
  private startCleanupInterval(): void {
    // Clean up stale statuses every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleanedCount = await messagingService.cleanupStaleStatuses(5);
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} stale online statuses`);
        }
      } catch (error) {
        console.error('Error during status cleanup:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Shutdown the socket service
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Mark all connected users as offline
    const userIds = Array.from(this.userSockets.keys());
    userIds.forEach(async (userId) => {
      try {
        await messagingService.updateOnlineStatus(userId, false);
      } catch (error) {
        console.error(`Error marking user ${userId} as offline during shutdown:`, error);
      }
    });

    this.connectedUsers.clear();
    this.userSockets.clear();
  }
}