import { BaseRepository } from './BaseRepository';
import { WishlistItem } from '../../types';
import { db } from '../connection';

/**
 * Repository for wishlist operations
 */
export class WishlistRepository extends BaseRepository<WishlistItem> {
  constructor() {
    super('wishlist_items');
  }

  /**
   * Get all wishlist items for a user with service and vendor details
   */
  async getWishlistByUserId(userId: string): Promise<WishlistItem[]> {
    return db.query<WishlistItem>(
      `SELECT 
        wi.*,
        s.title as service_title,
        s.description as service_description,
        s.price as service_price,
        v.business_name as vendor_business_name
      FROM wishlist_items wi
      LEFT JOIN services s ON wi.service_id = s.id
      LEFT JOIN vendors v ON wi.vendor_id = v.id
      WHERE wi.user_id = $1
      ORDER BY wi.created_at DESC`,
      [userId]
    );
  }

  /**
   * Add item to wishlist (prevent duplicates)
   */
  async addToWishlist(userId: string, serviceId: string, vendorId: string): Promise<WishlistItem> {
    // Check if item already exists in wishlist
    const existing = await db.query<WishlistItem>(
      `SELECT * FROM wishlist_items WHERE user_id = $1 AND service_id = $2`,
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
   * Remove item from wishlist
   */
  async removeFromWishlist(userId: string, itemId: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );
    return result.length > 0;
  }

  /**
   * Clear entire wishlist for user
   */
  async clearWishlist(userId: string): Promise<boolean> {
    await db.query(
      `DELETE FROM wishlist_items WHERE user_id = $1`,
      [userId]
    );
    return true;
  }

  /**
   * Get wishlist item count for user
   */
  async getWishlistItemCount(userId: string): Promise<number> {
    const [result] = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM wishlist_items WHERE user_id = $1`,
      [userId]
    );
    return parseInt(result?.count || '0');
  }

  /**
   * Check if specific item exists in user's wishlist
   */
  async isItemInWishlist(userId: string, serviceId: string): Promise<boolean> {
    const [result] = await db.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM wishlist_items WHERE user_id = $1 AND service_id = $2) as exists`,
      [userId, serviceId]
    );
    return result?.exists || false;
  }

  /**
   * Move item from wishlist to cart
   */
  async moveToCart(userId: string, itemId: string): Promise<{ wishlistItem: WishlistItem | null; removed: boolean }> {
    // Get the wishlist item first
    const wishlistItem = await db.query<WishlistItem>(
      `SELECT * FROM wishlist_items WHERE id = $1 AND user_id = $2`,
      [itemId, userId]
    );

    if (wishlistItem.length === 0) {
      return { wishlistItem: null, removed: false };
    }

    // Remove from wishlist
    const removed = await this.removeFromWishlist(userId, itemId);
    
    return { wishlistItem: wishlistItem[0]!, removed };
  }
}