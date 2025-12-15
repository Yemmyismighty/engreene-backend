import { BaseRepository } from './BaseRepository';
import { Wallet, PaymentMethod } from '../../types';
import { WalletQueries } from '../queries';

/**
 * Wallet repository with specialized wallet operations
 */
export class WalletRepository extends BaseRepository<Wallet> {
  constructor() {
    super('wallets');
  }

  /**
   * Find wallet by user ID
   */
  async findByUserId(userId: string): Promise<Wallet | null> {
    return WalletQueries.findByUserId(userId);
  }

  /**
   * Create wallet for user
   */
  async createForUser(userId: string, userType: 'client' | 'vendor'): Promise<Wallet> {
    return WalletQueries.create(userId, userType);
  }

  /**
   * Update wallet balance
   */
  async updateBalance(walletId: string, newBalance: number): Promise<Wallet> {
    return WalletQueries.updateBalance(walletId, newBalance);
  }

  /**
   * Add payment method to wallet
   */
  async addPaymentMethod(
    walletId: string, 
    cardLastFour: string, 
    cardType: string, 
    isDefault: boolean = false
  ): Promise<PaymentMethod> {
    return WalletQueries.addPaymentMethod(walletId, cardLastFour, cardType, isDefault);
  }

  /**
   * Get all payment methods for wallet
   */
  async getPaymentMethods(walletId: string): Promise<PaymentMethod[]> {
    return WalletQueries.getPaymentMethods(walletId);
  }

  /**
   * Find wallets by type
   */
  async findByType(userType: 'client' | 'vendor'): Promise<Wallet[]> {
    return this.findAll({ user_type: userType });
  }

  /**
   * Get wallet with payment methods
   */
  async findByIdWithPaymentMethods(walletId: string): Promise<(Wallet & { payment_methods: PaymentMethod[] }) | null> {
    const wallet = await this.findById(walletId);
    if (!wallet) return null;

    const paymentMethods = await this.getPaymentMethods(walletId);
    return {
      ...wallet,
      payment_methods: paymentMethods
    };
  }
}