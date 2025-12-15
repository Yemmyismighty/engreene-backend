import { CartItem, WishlistItem, PaymentResult, EscrowTransaction } from '../types';
import { cartRepository, wishlistRepository, walletRepository, escrowRepository } from '../database/repositories';
import { db } from '../database/connection';

/**
 * Service for cart and wishlist management
 */
export class CartService {
  /**
   * Add item to cart
   */
  async addToCart(userId: string, serviceId: string, vendorId: string): Promise<CartItem> {
    // Validate that service exists and belongs to vendor
    const [service] = await db.query(
      `SELECT id, vendor_id FROM services WHERE id = $1 AND vendor_id = $2`,
      [serviceId, vendorId]
    );

    if (!service) {
      throw new Error('Service not found or does not belong to specified vendor');
    }

    return cartRepository.addToCart(userId, serviceId, vendorId);
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string, itemId: string): Promise<boolean> {
    return cartRepository.removeFromCart(userId, itemId);
  }

  /**
   * Get user's cart organized by vendor
   */
  async getCartByUser(userId: string): Promise<Record<string, CartItem[]>> {
    return cartRepository.getCartByVendor(userId);
  }

  /**
   * Get user's cart as flat list
   */
  async getCartItems(userId: string): Promise<CartItem[]> {
    return cartRepository.getCartByUserId(userId);
  }

  /**
   * Add item to wishlist
   */
  async addToWishlist(userId: string, serviceId: string, vendorId: string): Promise<WishlistItem> {
    // Validate that service exists and belongs to vendor
    const [service] = await db.query(
      `SELECT id, vendor_id FROM services WHERE id = $1 AND vendor_id = $2`,
      [serviceId, vendorId]
    );

    if (!service) {
      throw new Error('Service not found or does not belong to specified vendor');
    }

    return wishlistRepository.addToWishlist(userId, serviceId, vendorId);
  }

  /**
   * Remove item from wishlist
   */
  async removeFromWishlist(userId: string, itemId: string): Promise<boolean> {
    return wishlistRepository.removeFromWishlist(userId, itemId);
  }

  /**
   * Get user's wishlist
   */
  async getWishlistByUser(userId: string): Promise<WishlistItem[]> {
    return wishlistRepository.getWishlistByUserId(userId);
  }

  /**
   * Move item from wishlist to cart
   */
  async moveWishlistToCart(userId: string, wishlistItemId: string): Promise<CartItem> {
    const { wishlistItem, removed } = await wishlistRepository.moveToCart(userId, wishlistItemId);
    
    if (!wishlistItem || !removed) {
      throw new Error('Wishlist item not found or could not be removed');
    }

    return this.addToCart(userId, wishlistItem.service_id, wishlistItem.vendor_id);
  }

  /**
   * Process cart payment with multi-vendor distribution
   */
  async processCartPayment(userId: string, cartItems: CartItem[]): Promise<PaymentResult> {
    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Get user's wallet
    const userWallet = await walletRepository.findByUserId(userId);
    if (!userWallet) {
      throw new Error('User wallet not found');
    }

    // Calculate total amount and vendor payments
    const vendorPayments = new Map<string, { amount: number; items: CartItem[] }>();
    let totalAmount = 0;

    // Get service prices and organize by vendor
    for (const item of cartItems) {
      const [service] = await db.query(
        `SELECT price FROM services WHERE id = $1`,
        [item.service_id]
      );

      if (!service) {
        throw new Error(`Service ${item.service_id} not found`);
      }

      const price = parseFloat(service.price);
      totalAmount += price;

      if (!vendorPayments.has(item.vendor_id)) {
        vendorPayments.set(item.vendor_id, { amount: 0, items: [] });
      }

      const vendorPayment = vendorPayments.get(item.vendor_id)!;
      vendorPayment.amount += price;
      vendorPayment.items.push(item);
    }

    // Check if user has sufficient balance
    if (userWallet.balance < totalAmount) {
      throw new Error('Insufficient wallet balance');
    }

    // Create escrow transactions for each vendor
    const transactions: EscrowTransaction[] = [];
    const paymentResults: Array<{ vendor_id: string; amount: number; commission: number }> = [];

    for (const [vendorId, payment] of vendorPayments) {
      // Get vendor wallet
      const vendorWallet = await walletRepository.findByUserId(vendorId);
      if (!vendorWallet) {
        throw new Error(`Vendor wallet not found for vendor ${vendorId}`);
      }

      // Calculate commission (10%)
      const commissionAmount = payment.amount * 0.1;
      const vendorAmount = payment.amount * 0.9;

      // Create escrow transaction
      const escrowTransaction = await escrowRepository.create({
        client_wallet_id: userWallet.id,
        vendor_wallet_id: vendorWallet.id,
        amount: payment.amount,
        commission_amount: commissionAmount,
        status: 'pending',
        order_items: payment.items
      });

      transactions.push(escrowTransaction);
      paymentResults.push({
        vendor_id: vendorId,
        amount: vendorAmount,
        commission: commissionAmount
      });
    }

    // Deduct total amount from user's wallet
    await walletRepository.update(userWallet.id, {
      balance: userWallet.balance - totalAmount
    });

    // Clear the cart after successful payment
    await cartRepository.clearCart(userId);

    return {
      transaction_id: transactions[0]?.id || 'unknown', // Primary transaction ID
      total_amount: totalAmount,
      vendor_payments: paymentResults
    };
  }

  /**
   * Get cart statistics for user
   */
  async getCartStats(userId: string): Promise<{
    itemCount: number;
    vendorCount: number;
    totalValue: number;
  }> {
    const cartItems = await this.getCartItems(userId);
    const vendorIds = new Set(cartItems.map(item => item.vendor_id));
    
    // Calculate total value
    let totalValue = 0;
    for (const item of cartItems) {
      const [service] = await db.query(
        `SELECT price FROM services WHERE id = $1`,
        [item.service_id]
      );
      if (service) {
        totalValue += parseFloat(service.price);
      }
    }

    return {
      itemCount: cartItems.length,
      vendorCount: vendorIds.size,
      totalValue
    };
  }

  /**
   * Check if item exists in cart or wishlist
   */
  async checkItemStatus(userId: string, serviceId: string): Promise<{
    inCart: boolean;
    inWishlist: boolean;
  }> {
    const [inCart, inWishlist] = await Promise.all([
      cartRepository.isItemInCart(userId, serviceId),
      wishlistRepository.isItemInWishlist(userId, serviceId)
    ]);

    return { inCart, inWishlist };
  }
}

// Export service instance
export const cartService = new CartService();