import { db, initializeDatabase, WalletQueries, DevelopmentSeeder } from './index';

describe('Database Setup', () => {
  beforeAll(async () => {
    // Initialize database for testing
    await initializeDatabase(false); // Don't run seeds in tests
  });

  afterAll(async () => {
    // Clean up test data
    await DevelopmentSeeder.clean();
  });

  describe('Database Connection', () => {
    it('should connect to database successfully', async () => {
      const isHealthy = await db.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should execute basic queries', async () => {
      const result = await db.query('SELECT 1 as test_value');
      expect(result).toHaveLength(1);
      expect(result[0].test_value).toBe(1);
    });
  });

  describe('Database Schema', () => {
    it('should have created wallets table', async () => {
      const tableInfo = await db.getTableInfo('wallets');
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map(col => col.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('user_type');
      expect(columns).toContain('balance');
    });

    it('should have created payment_methods table', async () => {
      const tableInfo = await db.getTableInfo('payment_methods');
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map(col => col.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('wallet_id');
      expect(columns).toContain('card_last_four');
      expect(columns).toContain('card_type');
    });

    it('should have created escrow_transactions table', async () => {
      const tableInfo = await db.getTableInfo('escrow_transactions');
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map(col => col.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('client_wallet_id');
      expect(columns).toContain('vendor_wallet_id');
      expect(columns).toContain('amount');
      expect(columns).toContain('status');
    });

    it('should have created cart_items table', async () => {
      const tableInfo = await db.getTableInfo('cart_items');
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map(col => col.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('service_id');
      expect(columns).toContain('vendor_id');
    });

    it('should have created messages table', async () => {
      const tableInfo = await db.getTableInfo('messages');
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map(col => col.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('from_user_id');
      expect(columns).toContain('to_user_id');
      expect(columns).toContain('content');
      expect(columns).toContain('sender_name');
    });

    it('should have created notifications table', async () => {
      const tableInfo = await db.getTableInfo('notifications');
      expect(tableInfo.length).toBeGreaterThan(0);
      
      const columns = tableInfo.map(col => col.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('type');
      expect(columns).toContain('title');
      expect(columns).toContain('message');
    });
  });

  describe('Basic Database Operations', () => {
    const testUserId = '99999999-9999-9999-9999-999999999999';

    it('should create and retrieve a wallet', async () => {
      // Create wallet
      const wallet = await WalletQueries.create(testUserId, 'client');
      expect(wallet).toBeDefined();
      expect(wallet.user_id).toBe(testUserId);
      expect(wallet.user_type).toBe('client');
      expect(wallet.balance).toBe(0);

      // Retrieve wallet
      const retrieved = await WalletQueries.findByUserId(testUserId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(wallet.id);
    });

    it('should add payment method to wallet', async () => {
      const wallet = await WalletQueries.findByUserId(testUserId);
      expect(wallet).toBeDefined();

      if (wallet) {
        const paymentMethod = await WalletQueries.addPaymentMethod(
          wallet.id, 
          '1234', 
          'visa', 
          true
        );
        
        expect(paymentMethod).toBeDefined();
        expect(paymentMethod.card_last_four).toBe('1234');
        expect(paymentMethod.card_type).toBe('visa');
        expect(paymentMethod.is_default).toBe(true);
      }
    });

    it('should update wallet balance', async () => {
      const wallet = await WalletQueries.findByUserId(testUserId);
      expect(wallet).toBeDefined();

      if (wallet) {
        const updated = await WalletQueries.updateBalance(wallet.id, 100.50);
        expect(updated.balance).toBe(100.50);
      }
    });
  });
});