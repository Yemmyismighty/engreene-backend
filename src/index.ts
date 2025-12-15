import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { config } from './config/environment';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { automationService } from './services/automationService';
import { SocketService } from './services/socketService';
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallets';
import cartRoutes from './routes/cart';
import wishlistRoutes from './routes/wishlist';
import messagesRoutes from './routes/messages';
import statusRoutes from './routes/status';
import notificationsRoutes from './routes/notifications';

// Load environment variables
dotenv.config({ path: `.env.${process.env['NODE_ENV'] || 'development'}` });

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.frontend.url,
    methods: ['GET', 'POST'],
  },
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
}));

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.environment,
  });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({
    message: 'Engreene Backend API',
    version: '1.0.0',
    environment: config.environment,
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Wallet management routes
app.use('/api/wallets', walletRoutes);

// Cart and wishlist routes
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Messaging and status routes
app.use('/api/messages', messagesRoutes);
app.use('/api/status', statusRoutes);

// Notifications routes
app.use('/api/notifications', notificationsRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO service
const socketService = new SocketService(io);

// Initialize automation services
async function initializeServices() {
  try {
    await automationService.initialize();
    console.log('✅ Automation services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize automation services:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  socketService.shutdown();
  await automationService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  socketService.shutdown();
  await automationService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server only if not in test environment
if (config.environment !== 'test') {
  const PORT = config.server.port;
  const HOST = config.server.host;

  server.listen(PORT, HOST, async () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Environment: ${config.environment}`);
    console.log(`Frontend URL: ${config.frontend.url}`);
    
    // Initialize services after server starts
    await initializeServices();
  });
}

export { app, server, io, socketService };