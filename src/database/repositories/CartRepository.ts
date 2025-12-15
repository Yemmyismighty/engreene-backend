import { BaseRepository } from './BaseRepository';
import { CartItem } from '../../types';
import { db } from '../connection';

/**
 * Repository for cart operations
 */
export class CartRepository extends BaseRepository<CartItem> {
  constructor() {
    super('cart_items');
  }

  /**
   * Get all cart items for a user with service and vendor details
   */
  async getCartByUserId(userId: string): Promise<CartItem[]> {
    return db.query<CartItem>(
      `SELECT 
        ci.*,
        s.title as service_title,
        s.description as service_description,
        s.price as service_price,
        v.business_name as vendor_business_name
      FROM cart_items ci
      LEFT JOIN services s ON ci.service_id = s.id
      LEFT JOIN vendors v ON ci.vendor_id = v.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC`,
      [userId]
    );
  }

  /**
   * Get cart items organized by vendor
   */
  async getCartByVendor(userId: string): Promise<Record<string, CartItem[]>> {
    const items = await this.getCartByUserId(userId);
    
    return items.reduce((acc, item) => {
      const vendorId = item.vendor_id;
      if (!acc[vendorId]) {
        acc[vendorId] = [];
      }
      acc[vendorId].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);
  }

  /**
   * Add item to cart (prevent duplicates)
   */
  async addToCart(userId: string, serviceId: string, vendorId: string): Promise<CartItem> {
    // Check if item already exists in cart
    const existing = await db.query<CartItem>(
      `SELECT * FROM cart_items WHERE user_id = $1 AND service_id = $2`,
      [userId, serviceId]
    );

    if (existing.length > 0) {
      return existing[0]!;
    }

    return this.create({
      user_id: userId,
      service_id: serviceId,
      vendor_id: vendorId
    });
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId: string, itemId: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM cart_items WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );
    return result.length > 0;
  }

  /**
   * Clear entire cart for user
   */
  async clearCart(userId: string): Promise<boolean> {
    await db.query(
      `DELETE FROM cart_items WHERE user_id = $1`,
      [userId]
    );
    return true;
  }

  /**
   * Get cart item count for user
   */
  async getCartItemCount(userId: string): Promise<number> {
    const [result] = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM cart_items WHERE user_id = $1`,
      [userId]
    );
    return parseInt(result?.count || '0');
  }

  /**
   * Check if specific item exists in user's cart
   */
  async isItemInCart(userId: string, serviceId: string): Promise<boolean> {
    const [result] = await db.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM cart_items WHERE user_id = $1 AND service_id = $2) as exists`,
      [userId, serviceId]
    );
    return result?.exists || false;
  }
}