import { 
  Wallet, 
  PaymentMethod, 
  EscrowTransaction, 
  CartItem, 
  PaymentResult 
} from '../types';
import { WalletQueries, EscrowQueries } from '../database/queries';

/**
 * Wallet service for managing wallets, payment methods, and escrow transactions
 */
export class WalletService {
  private static readonly COMMISSION_RATE = 0.10; // 10% commission

  /**
   * Create a new wallet for a user
   */
  async createWallet(userId: string, userType: 'client' | 'vendor'): Promise<Wallet> {
    // Check if wallet already exists
    const existingWallet = await WalletQueries.findByUserId(userId);
    if (existingWallet) {
      throw new Error('Wallet already exists for this user');
    }

    return await WalletQueries.create(userId, userType);
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId: string): Promise<Wallet | null> {
    return await WalletQueries.findByUserId(userId);
  }

  /**
   * Get wallet by ID
   */
  async getWalletById(walletId: string): Promise<Wallet | null> {
    return await WalletQueries.findById(walletId);
  }

  /**
   * Link a payment method to a wallet
   */
  async linkPaymentMethod(
    walletId: string, 
    paymentData: { card_last_four: string; card_type: string; is_default?: boolean }
  ): Promise<PaymentMethod> {
    // Verify wallet exists
    const wallet = await WalletQueries.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return await WalletQueries.addPaymentMethod(
      walletId, 
      paymentData.card_last_four, 
      paymentData.card_type, 
      paymentData.is_default || false
    );
  }

  /**
   * Get all payment methods for a wallet
   */
  async getPaymentMethods(walletId: string): Promise<PaymentMethod[]> {
    return await WalletQueries.getPaymentMethods(walletId);
  }

  /**
   * Create an escrow payment transaction
   */
  async createEscrowPayment(
    clientWalletId: string, 
    amount: number, 
    vendorWalletId: string, 
    orderItems: CartItem[]
  ): Promise<EscrowTransaction> {
    // Validate wallets exist
    const clientWallet = await WalletQueries.findById(clientWalletId);
    const vendorWallet = await WalletQueries.findById(vendorWalletId);

    if (!clientWallet) {
      throw new Error('Client wallet not found');
    }
    if (!vendorWallet) {
      throw new Error('Vendor wallet not found');
    }

    // Validate wallet types
    if (clientWallet.user_type !== 'client') {
      throw new Error('Source wallet must be a client wallet');
    }
    if (vendorWallet.user_type !== 'vendor') {
      throw new Error('Destination wallet must be a vendor wallet');
    }

    // Calculate commission
    const commissionAmount = this.calculateCommission(amount);

    // Create escrow transaction
    return await EscrowQueries.create(
      clientWalletId,
      vendorWalletId,
      amount,
      commissionAmount,
      orderItems
    );
  }



  /**
   * Cancel escrow payment
   */
  async cancelEscrowPayment(transactionId: string): Promise<EscrowTransaction> {
    const transaction = await EscrowQueries.findById(transactionId);
    if (!transaction) {
      throw new Error('Escrow transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new Error('Transaction is not in pending status');
    }

    return await EscrowQueries.cancel(transactionId);
  }

  /**
   * Process multi-vendor cart payment
   */
  async processCartPayment(
    clientWalletId: string, 
    cartItems: CartItem[]
  ): Promise<PaymentResult> {
    if (!cartItems.length) {
      throw new Error('Cart is empty');
    }

    // Group items by vendor
    const itemsByVendor = this.groupItemsByVendor(cartItems);
    const vendorPayments: PaymentResult['vendor_payments'] = [];
    let totalAmount = 0;

    // Create escrow transactions for each vendor
    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      // Calculate total for this vendor (assuming items have price info)
      const vendorTotal = items.reduce((sum, item) => {
        // In a real implementation, you'd fetch the service price
        // For now, we'll assume a default price or that it's included in the item
        return sum + (item.service?.price || 0);
      }, 0);

      if (vendorTotal > 0) {
        // Get vendor wallet
        const vendorWallet = await WalletQueries.findByUserId(vendorId);
        if (!vendorWallet) {
          throw new Error(`Vendor wallet not found for vendor ${vendorId}`);
        }

        // Create escrow transaction
        await this.createEscrowPayment(
          clientWalletId,
          vendorTotal,
          vendorWallet.id,
          items
        );

        const commission = this.calculateCommission(vendorTotal);
        vendorPayments.push({
          vendor_id: vendorId,
          amount: vendorTotal - commission,
          commission: commission
        });

        totalAmount += vendorTotal;
      }
    }

    return {
      transaction_id: `multi-${Date.now()}`, // In real implementation, this would be a proper transaction ID
      total_amount: totalAmount,
      vendor_payments: vendorPayments
    };
  }

  /**
   * Get escrow transactions for a wallet
   */
  async getEscrowTransactions(walletId: string, status?: string): Promise<EscrowTransaction[]> {
    return await EscrowQueries.findByWallet(walletId, status);
  }

  /**
   * Calculate commission amount (10% of total)
   */
  private calculateCommission(amount: number): number {
    return Math.round(amount * WalletService.COMMISSION_RATE * 100) / 100;
  }

  /**
   * Process commission distribution to vendor and Engreene
   */
  private async processCommissionDistribution(
    vendorWalletId: string,
    totalAmount: number,
    commissionAmount: number
  ): Promise<void> {
    const vendorAmount = totalAmount - commissionAmount;

    // Get current vendor wallet
    const vendorWallet = await WalletQueries.findById(vendorWalletId);
    if (!vendorWallet) {
      throw new Error('Vendor wallet not found');
    }

    // Update vendor wallet balance (90% of payment)
    const newVendorBalance = vendorWallet.balance + vendorAmount;
    await WalletQueries.updateBalance(vendorWalletId, newVendorBalance);

    // In a real implementation, you would also update Engreene's wallet with the commission
    // For now, we'll just log it or handle it separately
    console.log(`Commission of ${commissionAmount} processed for transaction`);
  }

  /**
   * Group cart items by vendor ID
   */
  private groupItemsByVendor(cartItems: CartItem[]): Record<string, CartItem[]> {
    return cartItems.reduce((groups, item) => {
      const vendorId = item.vendor_id;
      if (!groups[vendorId]) {
        groups[vendorId] = [];
      }
      groups[vendorId].push(item);
      return groups;
    }, {} as Record<string, CartItem[]>);
  }

  /**
   * Update wallet balance
   */
  async updateWalletBalance(walletId: string, newBalance: number): Promise<Wallet> {
    if (newBalance < 0) {
      throw new Error('Wallet balance cannot be negative');
    }

    return await WalletQueries.updateBalance(walletId, newBalance);
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactionHistory(walletId: string): Promise<EscrowTransaction[]> {
    return await EscrowQueries.findByWallet(walletId);
  }

  /**
   * Get transaction history with pagination and filtering
   */
  async getTransactionHistory(
    walletId: string, 
    options: { limit: number; offset: number; status?: string }
  ): Promise<EscrowTransaction[]> {
    return await EscrowQueries.findByWallet(walletId, options.status);
  }

  /**
   * Release escrow payment with user authorization
   */
  async releaseEscrowPayment(transactionId: string, userId: string): Promise<EscrowTransaction> {
    // Get transaction details
    const transaction = await EscrowQueries.findById(transactionId);
    if (!transaction) {
      throw new Error('Escrow transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new Error('Transaction is not in pending status');
    }

    // Verify user has permission to release (either client or vendor)
    const clientWallet = await WalletQueries.findById(transaction.client_wallet_id);
    const vendorWallet = await WalletQueries.findById(transaction.vendor_wallet_id);

    if (!clientWallet || !vendorWallet) {
      throw new Error('Associated wallets not found');
    }

    if (clientWallet.user_id !== userId && vendorWallet.user_id !== userId) {
      throw new Error('Not authorized to release this escrow payment');
    }

    // Release the escrow transaction
    const releasedTransaction = await EscrowQueries.release(transactionId);

    // Update wallet balances
    await this.processCommissionDistribution(
      releasedTransaction.vendor_wallet_id,
      releasedTransaction.amount,
      releasedTransaction.commission_amount
    );

    return releasedTransaction;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId: string): Promise<number> {
    const wallet = await WalletQueries.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    return wallet.balance;
  }
}

// Export singleton instance
export const walletService = new WalletService();