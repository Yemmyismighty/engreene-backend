import { supabase } from '../config/supabase';
import { 
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
 * Wallet-related database queries
 */
export class WalletQueries {
  static async create(userId: string, userType: 'client' | 'vendor'): Promise<Wallet> {
    const { data, error } = await supabase
      .from('wallets')
      .insert({ user_id: userId, user_type: userType })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create wallet: ${error.message}`);
    }

    return data;
  }

  static async findByUserId(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to find wallet: ${error.message}`);
    }

    return data || null;
  }

  static async findById(walletId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find wallet: ${error.message}`);
    }

    return data || null;
  }

  static async updateBalance(walletId: string, newBalance: number): Promise<Wallet> {
    const { data, error } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', walletId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update wallet balance: ${error.message}`);
    }

    return data;
  }

  static async addPaymentMethod(walletId: string, cardLastFour: string, cardType: string, isDefault: boolean = false): Promise<PaymentMethod> {
    // If this is set as default, unset other defaults first
    if (isDefault) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('wallet_id', walletId);
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({
        wallet_id: walletId,
        card_last_four: cardLastFour,
        card_type: cardType,
        is_default: isDefault
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add payment method: ${error.message}`);
    }

    return data;
  }

  static async getPaymentMethods(walletId: string): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('wallet_id', walletId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }

    return data || [];
  }
}

/**
 * Escrow transaction queries
 */
export class EscrowQueries {
  static async create(
    clientWalletId: string, 
    vendorWalletId: string, 
    amount: number, 
    commissionAmount: number, 
    orderItems: CartItem[]
  ): Promise<EscrowTransaction> {
    const { data, error } = await supabase
      .from('escrow_transactions')
      .insert({
        client_wallet_id: clientWalletId,
        vendor_wallet_id: vendorWalletId,
        amount,
        commission_amount: commissionAmount,
        order_items: orderItems
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create escrow transaction: ${error.message}`);
    }

    return data;
  }

  static async findById(transactionId: string): Promise<EscrowTransaction | null> {
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find escrow transaction: ${error.message}`);
    }

    return data || null;
  }

  static async release(transactionId: string): Promise<EscrowTransaction> {
    const { data, error } = await supabase
      .from('escrow_transactions')
      .update({ 
        status: 'released', 
        released_at: new Date().toISOString() 
      })
      .eq('id', transactionId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to release escrow transaction: ${error.message}`);
    }

    return data;
  }

  static async cancel(transactionId: string): Promise<EscrowTransaction> {
    const { data, error } = await supabase
      .from('escrow_transactions')
      .update({ status: 'cancelled' })
      .eq('id', transactionId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel escrow transaction: ${error.message}`);
    }

    return data;
  }

  static async findByWallet(walletId: string, status?: string): Promise<EscrowTransaction[]> {
    let query = supabase
      .from('escrow_transactions')
      .select('*')
      .or(`client_wallet_id.eq.${walletId},vendor_wallet_id.eq.${walletId}`)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find escrow transactions: ${error.message}`);
    }

    return data || [];
  }
}

/**
 * Cart and wishlist queries
 */
export class CartQueries {
  static async addToCart(userId: string, serviceId: string, vendorId: string): Promise<CartItem> {
    // First try to update if exists, otherwise insert
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .eq('service_id', serviceId)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('cart_items')
        .update({ created_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update cart item: ${error.message}`);
      }
      return data;
    }

    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        user_id: userId,
        service_id: serviceId,
        vendor_id: vendorId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add to cart: ${error.message}`);
    }

    return data;
  }

  static async removeFromCart(userId: string, itemId: string): Promise<boolean> {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    return !error;
  }

  static async getCartItems(userId: string): Promise<CartItem[]> {
    const { data, error } = await supabase
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get cart items: ${error.message}`);
    }

    return data || [];
  }

  static async clearCart(userId: string): Promise<void> {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to clear cart: ${error.message}`);
    }
  }

  static async addToWishlist(userId: string, serviceId: string, vendorId: string): Promise<WishlistItem> {
    // First try to update if exists, otherwise insert
    const { data: existing } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('user_id', userId)
      .eq('service_id', serviceId)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from('wishlist_items')
        .update({ created_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update wishlist item: ${error.message}`);
      }
      return data;
    }

    const { data, error } = await supabase
      .from('wishlist_items')
      .insert({
        user_id: userId,
        service_id: serviceId,
        vendor_id: vendorId
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add to wishlist: ${error.message}`);
    }

    return data;
  }

  static async removeFromWishlist(userId: string, itemId: string): Promise<boolean> {
    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    return !error;
  }

  static async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get wishlist items: ${error.message}`);
    }

    return data || [];
  }
}

/**
 * Messaging queries
 */
export class MessageQueries {
  static async create(
    fromUserId: string | null, 
    toUserId: string, 
    content: string, 
    senderName: string, 
    isAutomated: boolean = false
  ): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        content,
        sender_name: senderName,
        is_automated: isAutomated
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }

    return data;
  }

  static async getConversation(user1Id: string, user2Id: string, limit: number = 50): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${user1Id},to_user_id.eq.${user2Id}),and(from_user_id.eq.${user2Id},to_user_id.eq.${user1Id})`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return data || [];
  }

  static async setAutoResponse(vendorId: string, message: string): Promise<VendorAutoResponse> {
    // Deactivate existing auto-responses
    await supabase
      .from('vendor_auto_responses')
      .update({ is_active: false })
      .eq('vendor_id', vendorId);

    const { data, error } = await supabase
      .from('vendor_auto_responses')
      .insert({
        vendor_id: vendorId,
        message,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to set auto response: ${error.message}`);
    }

    return data;
  }

  static async getAutoResponse(vendorId: string): Promise<VendorAutoResponse | null> {
    const { data, error } = await supabase
      .from('vendor_auto_responses')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get auto response: ${error.message}`);
    }

    return data || null;
  }

  static async updateOnlineStatus(userId: string, isOnline: boolean): Promise<UserOnlineStatus> {
    const { data, error } = await supabase
      .from('user_online_status')
      .upsert({
        user_id: userId,
        is_online: isOnline,
        last_seen: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update online status: ${error.message}`);
    }

    return data;
  }

  static async getOnlineStatus(userId: string): Promise<UserOnlineStatus | null> {
    const { data, error } = await supabase
      .from('user_online_status')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get online status: ${error.message}`);
    }

    return data || null;
  }
}

/**
 * Notification queries
 */
export class NotificationQueries {
  static async create(
    userId: string, 
    type: string, 
    title: string, 
    message: string, 
    metadata: Record<string, any> = {}
  ): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data;
  }

  static async getUserNotifications(userId: string, limit: number = 20, offset: number = 0): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get notifications: ${error.message}`);
    }

    return data || [];
  }

  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    return !error;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }

    return count || 0;
  }
}