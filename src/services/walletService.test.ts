import { WalletService } from './walletService';
import { WalletQueries, EscrowQueries } from '../database/queries';
import { Wallet, EscrowTransaction, CartItem } from '../types';

// Mock the database queries
jest.mock('../database/queries');

const mockWalletQueries = WalletQueries as jest.Mocked<typeof WalletQueries>;
const mockEscrowQueries = EscrowQueries as jest.Mocked<typeof EscrowQueries>;

describe('WalletService', () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = new WalletService();
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('should create a new wallet for a user', async () => {
      const userId = 'user-123';
      const userType = 'client';
      const mockWallet: Wallet = {
        id: 'wallet-123',
        user_id: userId,
        user_type: userType,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockWalletQueries.findByUserId.mockResolvedValue(null);
      mockWalletQueries.create.mockResolvedValue(mockWallet);

      const result = await walletService.createWallet(userId, userType);

      expect(mockWalletQueries.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockWalletQueries.create).toHaveBeenCalledWith(userId, userType);
      expect(result).toEqual(mockWallet);
    });

    it('should throw error if wallet already exists', async () => {
      const userId = 'user-123';
      const userType = 'client';
      const existingWallet: Wallet = {
        id: 'wallet-123',
        user_id: userId,
        user_type: userType,
        balance: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockWalletQueries.findByUserId.mockResolvedValue(existingWallet);

      await expect(walletService.createWallet(userId, userType)).rejects.toThrow('Wallet already exists for this user');
      expect(mockWalletQueries.create).not.toHaveBeenCalled();
    });
  });

  describe('createEscrowPayment', () => {
    it('should create escrow payment with correct commission calculation', async () => {
      const clientWalletId = 'client-wallet-123';
      const vendorWalletId = 'vendor-wallet-123';
      const amount = 100;
      const orderItems: CartItem[] = [{
        id: 'item-1',
        user_id: 'user-123',
        service_id: 'service-123',
        vendor_id: 'vendor-123',
        created_at: new Date().toISOString()
      }];

      const clientWallet: Wallet = {
        id: clientWalletId,
        user_id: 'client-123',
        user_type: 'client',
        balance: 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const vendorWallet: Wallet = {
        id: vendorWalletId,
        user_id: 'vendor-123',
        user_type: 'vendor',
        balance: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockTransaction: EscrowTransaction = {
        id: 'transaction-123',
        client_wallet_id: clientWalletId,
        vendor_wallet_id: vendorWalletId,
        amount,
        commission_amount: 10, // 10% of 100
        status: 'pending',
        order_items: orderItems,
        created_at: new Date().toISOString()
      };

      mockWalletQueries.findById.mockImplementation((id) => {
        if (id === clientWalletId) return Promise.resolve(clientWallet);
        if (id === vendorWalletId) return Promise.resolve(vendorWallet);
        return Promise.resolve(null);
      });

      mockEscrowQueries.create.mockResolvedValue(mockTransaction);

      const result = await walletService.createEscrowPayment(
        clientWalletId,
        vendorWalletId,
        amount,
        orderItems
      );

      expect(mockWalletQueries.findById).toHaveBeenCalledWith(clientWalletId);
      expect(mockWalletQueries.findById).toHaveBeenCalledWith(vendorWalletId);
      expect(mockEscrowQueries.create).toHaveBeenCalledWith(
        clientWalletId,
        vendorWalletId,
        amount,
        10, // Expected commission (10% of 100)
        orderItems
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should throw error if client wallet is not found', async () => {
      const clientWalletId = 'client-wallet-123';
      const vendorWalletId = 'vendor-wallet-123';
      const amount = 100;
      const orderItems: CartItem[] = [];

      mockWalletQueries.findById.mockResolvedValue(null);

      await expect(walletService.createEscrowPayment(
        clientWalletId,
        vendorWalletId,
        amount,
        orderItems
      )).rejects.toThrow('Client wallet not found');
    });

    it('should throw error if wallet types are incorrect', async () => {
      const clientWalletId = 'client-wallet-123';
      const vendorWalletId = 'vendor-wallet-123';
      const amount = 100;
      const orderItems: CartItem[] = [];

      const wrongTypeWallet: Wallet = {
        id: clientWalletId,
        user_id: 'user-123',
        user_type: 'vendor', // Wrong type for client wallet
        balance: 200,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockWalletQueries.findById.mockResolvedValue(wrongTypeWallet);

      await expect(walletService.createEscrowPayment(
        clientWalletId,
        vendorWalletId,
        amount,
        orderItems
      )).rejects.toThrow('Source wallet must be a client wallet');
    });
  });

  describe('releaseEscrowPayment', () => {
    it('should release escrow payment and update balances', async () => {
      const transactionId = 'transaction-123';
      const vendorWalletId = 'vendor-wallet-123';
      const amount = 100;
      const commissionAmount = 10;

      const pendingTransaction: EscrowTransaction = {
        id: transactionId,
        client_wallet_id: 'client-wallet-123',
        vendor_wallet_id: vendorWalletId,
        amount,
        commission_amount: commissionAmount,
        status: 'pending',
        order_items: [],
        created_at: new Date().toISOString()
      };

      const releasedTransaction: EscrowTransaction = {
        ...pendingTransaction,
        status: 'released',
        released_at: new Date().toISOString()
      };

      const vendorWallet: Wallet = {
        id: vendorWalletId,
        user_id: 'vendor-123',
        user_type: 'vendor',
        balance: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const updatedVendorWallet: Wallet = {
        ...vendorWallet,
        balance: 140 // 50 + 90 (amount - commission)
      };

      mockEscrowQueries.findById.mockResolvedValue(pendingTransaction);
      mockEscrowQueries.release.mockResolvedValue(releasedTransaction);
      mockWalletQueries.findById.mockResolvedValue(vendorWallet);
      mockWalletQueries.updateBalance.mockResolvedValue(updatedVendorWallet);

      const result = await walletService.releaseEscrowPayment(transactionId);

      expect(mockEscrowQueries.findById).toHaveBeenCalledWith(transactionId);
      expect(mockEscrowQueries.release).toHaveBeenCalledWith(transactionId);
      expect(mockWalletQueries.updateBalance).toHaveBeenCalledWith(vendorWalletId, 140);
      expect(result).toEqual(releasedTransaction);
    });

    it('should throw error if transaction is not in pending status', async () => {
      const transactionId = 'transaction-123';
      const releasedTransaction: EscrowTransaction = {
        id: transactionId,
        client_wallet_id: 'client-wallet-123',
        vendor_wallet_id: 'vendor-wallet-123',
        amount: 100,
        commission_amount: 10,
        status: 'released', // Already released
        order_items: [],
        created_at: new Date().toISOString(),
        released_at: new Date().toISOString()
      };

      mockEscrowQueries.findById.mockResolvedValue(releasedTransaction);

      await expect(walletService.releaseEscrowPayment(transactionId)).rejects.toThrow('Transaction is not in pending status');
      expect(mockEscrowQueries.release).not.toHaveBeenCalled();
    });
  });

  describe('commission calculation', () => {
    it('should calculate 10% commission correctly', async () => {
      // Test private method through public interface
      const clientWalletId = 'client-wallet-123';
      const vendorWalletId = 'vendor-wallet-123';
      const testAmounts = [100, 50.50, 33.33, 1000];
      const expectedCommissions = [10, 5.05, 3.33, 100];

      const clientWallet: Wallet = {
        id: clientWalletId,
        user_id: 'client-123',
        user_type: 'client',
        balance: 2000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const vendorWallet: Wallet = {
        id: vendorWalletId,
        user_id: 'vendor-123',
        user_type: 'vendor',
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockWalletQueries.findById.mockImplementation((id) => {
        if (id === clientWalletId) return Promise.resolve(clientWallet);
        if (id === vendorWalletId) return Promise.resolve(vendorWallet);
        return Promise.resolve(null);
      });

      for (let i = 0; i < testAmounts.length; i++) {
        const amount = testAmounts[i]!;
        const expectedCommission = expectedCommissions[i]!;

        const mockTransaction: EscrowTransaction = {
          id: `transaction-${i}`,
          client_wallet_id: clientWalletId,
          vendor_wallet_id: vendorWalletId,
          amount,
          commission_amount: expectedCommission,
          status: 'pending',
          order_items: [],
          created_at: new Date().toISOString()
        };

        mockEscrowQueries.create.mockResolvedValue(mockTransaction);

        await walletService.createEscrowPayment(clientWalletId, vendorWalletId, amount, []);

        expect(mockEscrowQueries.create).toHaveBeenCalledWith(
          clientWalletId,
          vendorWalletId,
          amount,
          expectedCommission,
          []
        );
      }
    });
  });
});