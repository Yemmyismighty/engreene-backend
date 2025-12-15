import { CartService } from './cartService';
import { cartRepository, wishlistRepository, walletRepository, escrowRepository } from '../database/repositories';
import { db } from '../database/connection';

// Mock the repositories and database
jest.mock('../database/repositories');
jest.mock('../database/connection');

const mockCartRepository = cartRepository as jest.Mocked<typeof cartRepository>;
const mockWishlistRepository = wishlistRepository as jest.Mocked<typeof wishlistRepository>;
const mockWalletRepository = walletRepository as jest.Mocked<typeof walletRepository>;
const mockEscrowRepository = escrowRepository as jest.Mocked<typeof escrowRepository>;
const mockDb = db as jest.Mocked<typeof db>;

describe('CartService', () => {
  let cartService: CartService;

  beforeEach(() => {
    cartService = new CartService();
    jest.clearAllMocks();
  });

  describe('addToCart', () => {
    it('should add item to cart when service exists and belongs to vendor', async () => {
      const userId = 'user-123';
      const serviceId = 'service-456';
      const vendorId = 'vendor-789';

      // Mock service validation
      mockDb.query.mockResolvedValueOnce([{ id: serviceId, vendor_id: vendorId }]);
      
      // Mock cart repository
      const mockCartItem = {
        id: 'cart-item-123',
        user_id: userId,
        service_id: serviceId,
        vendor_id: vendorId,
        created_at: new Date().toISOString()
      };
      mockCartRepository.addToCart.mockResolvedValueOnce(mockCartItem);

      const result = await cartService.addToCart(userId, serviceId, vendorId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, vendor_id FROM services WHERE id = $1 AND vendor_id = $2',
        [serviceId, vendorId]
      );
      expect(mockCartRepository.addToCart).toHaveBeenCalledWith(userId, serviceId, vendorId);
      expect(result).toEqual(mockCartItem);
    });

    it('should throw error when service does not exist or belong to vendor', async () => {
      const userId = 'user-123';
      const serviceId = 'service-456';
      const vendorId = 'vendor-789';

      // Mock service validation failure
      mockDb.query.mockResolvedValueOnce([]);

      await expect(cartService.addToCart(userId, serviceId, vendorId))
        .rejects.toThrow('Service not found or does not belong to specified vendor');

      expect(mockCartRepository.addToCart).not.toHaveBeenCalled();
    });
  });

  describe('addToWishlist', () => {
    it('should add item to wishlist when service exists and belongs to vendor', async () => {
      const userId = 'user-123';
      const serviceId = 'service-456';
      const vendorId = 'vendor-789';

      // Mock service validation
      mockDb.query.mockResolvedValueOnce([{ id: serviceId, vendor_id: vendorId }]);
      
      // Mock wishlist repository
      const mockWishlistItem = {
        id: 'wishlist-item-123',
        user_id: userId,
        service_id: serviceId,
        vendor_id: vendorId,
        created_at: new Date().toISOString()
      };
      mockWishlistRepository.addToWishlist.mockResolvedValueOnce(mockWishlistItem);

      const result = await cartService.addToWishlist(userId, serviceId, vendorId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, vendor_id FROM services WHERE id = $1 AND vendor_id = $2',
        [serviceId, vendorId]
      );
      expect(mockWishlistRepository.addToWishlist).toHaveBeenCalledWith(userId, serviceId, vendorId);
      expect(result).toEqual(mockWishlistItem);
    });
  });

  describe('processCartPayment', () => {
    it('should process payment for multiple vendors correctly', async () => {
      const userId = 'user-123';
      const cartItems = [
        {
          id: 'item-1',
          user_id: userId,
          service_id: 'service-1',
          vendor_id: 'vendor-1',
          created_at: new Date().toISOString()
        },
        {
          id: 'item-2',
          user_id: userId,
          service_id: 'service-2',
          vendor_id: 'vendor-2',
          created_at: new Date().toISOString()
        }
      ];

      // Mock user wallet
      const userWallet = {
        id: 'wallet-user',
        user_id: userId,
        user_type: 'client' as const,
        balance: 1000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockWalletRepository.findByUserId.mockResolvedValueOnce(userWallet);

      // Mock service prices
      mockDb.query
        .mockResolvedValueOnce([{ price: '100.00' }]) // service-1 price
        .mockResolvedValueOnce([{ price: '200.00' }]); // service-2 price

      // Mock vendor wallets
      const vendor1Wallet = {
        id: 'wallet-vendor-1',
        user_id: 'vendor-1',
        user_type: 'vendor' as const,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const vendor2Wallet = {
        id: 'wallet-vendor-2',
        user_id: 'vendor-2',
        user_type: 'vendor' as const,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockWalletRepository.findByUserId
        .mockResolvedValueOnce(vendor1Wallet)
        .mockResolvedValueOnce(vendor2Wallet);

      // Mock escrow transactions
      const escrowTransaction1 = {
        id: 'escrow-1',
        client_wallet_id: userWallet.id,
        vendor_wallet_id: vendor1Wallet.id,
        amount: 100,
        commission_amount: 10,
        status: 'pending' as const,
        order_items: [cartItems[0]!],
        created_at: new Date().toISOString()
      };
      const escrowTransaction2 = {
        id: 'escrow-2',
        client_wallet_id: userWallet.id,
        vendor_wallet_id: vendor2Wallet.id,
        amount: 200,
        commission_amount: 20,
        status: 'pending' as const,
        order_items: [cartItems[1]!],
        created_at: new Date().toISOString()
      };
      mockEscrowRepository.create
        .mockResolvedValueOnce(escrowTransaction1)
        .mockResolvedValueOnce(escrowTransaction2);

      // Mock wallet update and cart clear
      mockWalletRepository.update.mockResolvedValueOnce(userWallet);
      mockCartRepository.clearCart.mockResolvedValueOnce(true);

      const result = await cartService.processCartPayment(userId, cartItems);

      expect(result.total_amount).toBe(300);
      expect(result.vendor_payments).toHaveLength(2);
      expect(result.vendor_payments[0]).toEqual({
        vendor_id: 'vendor-1',
        amount: 90, // 90% of 100
        commission: 10 // 10% of 100
      });
      expect(result.vendor_payments[1]).toEqual({
        vendor_id: 'vendor-2',
        amount: 180, // 90% of 200
        commission: 20 // 10% of 200
      });
    });

    it('should throw error when cart is empty', async () => {
      const userId = 'user-123';
      const cartItems: any[] = [];

      await expect(cartService.processCartPayment(userId, cartItems))
        .rejects.toThrow('Cart is empty');
    });

    it('should throw error when user has insufficient balance', async () => {
      const userId = 'user-123';
      const cartItems = [
        {
          id: 'item-1',
          user_id: userId,
          service_id: 'service-1',
          vendor_id: 'vendor-1',
          created_at: new Date().toISOString()
        }
      ];

      // Mock user wallet with insufficient balance
      const userWallet = {
        id: 'wallet-user',
        user_id: userId,
        user_type: 'client' as const,
        balance: 50, // Less than service price
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockWalletRepository.findByUserId.mockResolvedValueOnce(userWallet);

      // Mock service price
      mockDb.query.mockResolvedValueOnce([{ price: '100.00' }]);

      await expect(cartService.processCartPayment(userId, cartItems))
        .rejects.toThrow('Insufficient wallet balance');
    });
  });

  describe('checkItemStatus', () => {
    it('should return correct status for item in cart and wishlist', async () => {
      const userId = 'user-123';
      const serviceId = 'service-456';

      mockCartRepository.isItemInCart.mockResolvedValueOnce(true);
      mockWishlistRepository.isItemInWishlist.mockResolvedValueOnce(false);

      const result = await cartService.checkItemStatus(userId, serviceId);

      expect(result).toEqual({
        inCart: true,
        inWishlist: false
      });
      expect(mockCartRepository.isItemInCart).toHaveBeenCalledWith(userId, serviceId);
      expect(mockWishlistRepository.isItemInWishlist).toHaveBeenCalledWith(userId, serviceId);
    });
  });
});