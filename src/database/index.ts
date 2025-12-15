// Database module exports
export { DatabaseConnection, db } from './connection';
export { 
  WalletQueries, 
  EscrowQueries, 
  CartQueries, 
  MessageQueries, 
  NotificationQueries 
} from './queries';
export { DevelopmentSeeder } from './seeds/development';
export { BaseRepository, WalletRepository, walletRepository, EscrowRepository, escrowRepository } from './repositories';

// Re-export types for convenience
export type {
  Wallet,
  PaymentMethod,
  EscrowTransaction,
  CartItem,
  WishlistItem,
  Message,
  VendorAutoResponse,
  UserOnlineStatus,
  Notification
} from '../types';

/**
 * Initialize database (run migrations and optionally seed)
 */
export async function initializeDatabase(runSeeds: boolean = false): Promise<void> {
  console.log('Initializing database...');
  
  try {
    // Import db here to avoid circular dependency issues
    const { db } = await import('./connection');
    
    // Check database connection
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }
    
    // Run migrations
    await db.runMigrations();
    
    // Run seeds if requested (typically for development)
    if (runSeeds) {
      const { DevelopmentSeeder } = await import('./seeds/development');
      await DevelopmentSeeder.run();
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}