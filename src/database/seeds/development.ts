import { db } from '../connection';
import { WalletQueries, CartQueries, MessageQueries, NotificationQueries } from '../queries';

/**
 * Development database seeding
 * Creates sample data for testing and development
 */
export class DevelopmentSeeder {
  
  /**
   * Run all development seeds
   */
  static async run(): Promise<void> {
    console.log('Starting development database seeding...');
    
    try {
      await this.seedUsers();
      await this.seedWallets();
      await this.seedSampleData();
      
      console.log('Development seeding completed successfully');
    } catch (error) {
      console.error('Development seeding failed:', error);
      throw error;
    }
  }

  /**
   * Create sample users (assumes auth.users table exists)
   */
  private static async seedUsers(): Promise<void> {
    console.log('Seeding sample users...');
    
    // Note: In a real application, users would be created through Supabase Auth
    // This is just for development testing
    const sampleUsers = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'client1@example.com',
        username: 'client_user',
        role: 'client'
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'vendor1@example.com',
        username: 'vendor_user',
        role: 'vendor'
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'client2@example.com',
        username: 'another_client',
        role: 'client'
      }
    ];

    for (const user of sampleUsers) {
      try {
        // Check if user already exists
        const existing = await db.query(
          'SELECT id FROM auth.users WHERE id = $1',
          [user.id]
        );

        if (existing.length === 0) {
          // Insert user (this would normally be handled by Supabase Auth)
          await db.query(
            `INSERT INTO auth.users (id, email, created_at, updated_at) 
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (id) DO NOTHING`,
            [user.id, user.email]
          );
          
          console.log(`Created sample user: ${user.email}`);
        }
      } catch (error) {
        console.warn(`Could not create user ${user.email}:`, error);
        // Continue with other users
      }
    }
  }

  /**
   * Create sample wallets
   */
  private static async seedWallets(): Promise<void> {
    console.log('Seeding sample wallets...');
    
    const walletData = [
      { userId: '11111111-1111-1111-1111-111111111111', userType: 'client' as const },
      { userId: '22222222-2222-2222-2222-222222222222', userType: 'vendor' as const },
      { userId: '33333333-3333-3333-3333-333333333333', userType: 'client' as const }
    ];

    for (const data of walletData) {
      try {
        // Check if wallet already exists
        const existing = await WalletQueries.findByUserId(data.userId);
        
        if (!existing) {
          const wallet = await WalletQueries.create(data.userId, data.userType);
          
          // Add sample payment methods
          await WalletQueries.addPaymentMethod(wallet.id, '1234', 'visa', true);
          
          console.log(`Created wallet for user ${data.userId}`);
        }
      } catch (error) {
        console.warn(`Could not create wallet for user ${data.userId}:`, error);
      }
    }
  }

  /**
   * Create sample cart items, messages, and notifications
   */
  private static async seedSampleData(): Promise<void> {
    console.log('Seeding sample application data...');
    
    try {
      // Sample service and vendor IDs (these would exist in the main application)
      const sampleServiceId = '44444444-4444-4444-4444-444444444444';
      const sampleVendorId = '22222222-2222-2222-2222-222222222222';
      const clientUserId = '11111111-1111-1111-1111-111111111111';
      
      // Add sample cart item
      try {
        await CartQueries.addToCart(clientUserId, sampleServiceId, sampleVendorId);
        console.log('Created sample cart item');
      } catch (error) {
        console.warn('Could not create sample cart item:', error);
      }

      // Add sample wishlist item
      try {
        await CartQueries.addToWishlist(clientUserId, sampleServiceId, sampleVendorId);
        console.log('Created sample wishlist item');
      } catch (error) {
        console.warn('Could not create sample wishlist item:', error);
      }

      // Create sample message
      try {
        await MessageQueries.create(
          clientUserId,
          sampleVendorId,
          'Hello, I am interested in your service!',
          'client_user'
        );
        console.log('Created sample message');
      } catch (error) {
        console.warn('Could not create sample message:', error);
      }

      // Create sample notification
      try {
        await NotificationQueries.create(
          sampleVendorId,
          'cart_add',
          'New Cart Addition',
          'A client added your service to their cart',
          { serviceId: sampleServiceId, clientId: clientUserId }
        );
        console.log('Created sample notification');
      } catch (error) {
        console.warn('Could not create sample notification:', error);
      }

      // Set sample auto-response
      try {
        await MessageQueries.setAutoResponse(
          sampleVendorId,
          'Thank you for your message! I will get back to you within 24 hours.'
        );
        console.log('Created sample auto-response');
      } catch (error) {
        console.warn('Could not create sample auto-response:', error);
      }

    } catch (error) {
      console.warn('Some sample data creation failed:', error);
    }
  }

  /**
   * Clean all seeded data (for testing)
   */
  static async clean(): Promise<void> {
    console.log('Cleaning development seed data...');
    
    const tables = [
      'notifications',
      'vendor_auto_responses',
      'user_online_status',
      'messages',
      'wishlist_items',
      'cart_items',
      'commission_transactions',
      'escrow_transactions',
      'payment_methods',
      'wallets'
    ];

    for (const table of tables) {
      try {
        await db.query(`DELETE FROM ${table} WHERE true`);
        console.log(`Cleaned table: ${table}`);
      } catch (error) {
        console.warn(`Could not clean table ${table}:`, error);
      }
    }
    
    console.log('Development data cleanup completed');
  }
}

// Export for CLI usage
export default DevelopmentSeeder;