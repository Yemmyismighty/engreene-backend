import { BaseRepository } from './BaseRepository';
import { EscrowTransaction, CartItem } from '../../types';
import { EscrowQueries } from '../queries';

/**
 * Escrow repository for managing escrow transactions
 */
export class EscrowRepository extends BaseRepository<EscrowTransaction> {
  constructor() {
    super('escrow_transactions');
  }

  /**
   * Create a new escrow transaction
   */
  async createTransaction(
    clientWalletId: string,
    vendorWalletId: string,
    amount: number,
    commissionAmount: number,
    orderItems: CartItem[]
  ): Promise<EscrowTransaction> {
    return await EscrowQueries.create(
      clientWalletId,
      vendorWalletId,
      amount,
      commissionAmount,
      orderItems
    );
  }

  /**
   * Release an escrow transaction
   */
  async releaseTransaction(transactionId: string): Promise<EscrowTransaction> {
    return await EscrowQueries.release(transactionId);
  }

  /**
   * Cancel an escrow transaction
   */
  async cancelTransaction(transactionId: string): Promise<EscrowTransaction> {
    return await EscrowQueries.cancel(transactionId);
  }

  /**
   * Find transactions by wallet ID
   */
  async findByWallet(walletId: string, status?: string): Promise<EscrowTransaction[]> {
    return await EscrowQueries.findByWallet(walletId, status);
  }

  /**
   * Find pending transactions for a client wallet
   */
  async findPendingByClientWallet(clientWalletId: string): Promise<EscrowTransaction[]> {
    return await EscrowQueries.findByWallet(clientWalletId, 'pending');
  }

  /**
   * Find pending transactions for a vendor wallet
   */
  async findPendingByVendorWallet(vendorWalletId: string): Promise<EscrowTransaction[]> {
    return await EscrowQueries.findByWallet(vendorWalletId, 'pending');
  }

  /**
   * Get transaction statistics for a wallet
   */
  async getTransactionStats(walletId: string): Promise<{
    total_transactions: number;
    pending_amount: number;
    released_amount: number;
    cancelled_amount: number;
  }> {
    const transactions = await this.findByWallet(walletId);
    
    const stats = transactions.reduce((acc, transaction) => {
      acc.total_transactions++;
      
      switch (transaction.status) {
        case 'pending':
          acc.pending_amount += transaction.amount;
          break;
        case 'released':
          acc.released_amount += transaction.amount;
          break;
        case 'cancelled':
          acc.cancelled_amount += transaction.amount;
          break;
      }
      
      return acc;
    }, {
      total_transactions: 0,
      pending_amount: 0,
      released_amount: 0,
      cancelled_amount: 0
    });

    return stats;
  }

  /**
   * Find transactions by status
   */
  async findByStatus(status: 'pending' | 'released' | 'cancelled'): Promise<EscrowTransaction[]> {
    return await this.findAll({ status });
  }

  /**
   * Find transactions within date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<EscrowTransaction[]> {
    // This would need to be implemented with proper date filtering in the base repository
    // For now, we'll get all and filter (not efficient for production)
    const allTransactions = await this.findAll();
    return allTransactions.filter(transaction => {
      const transactionDate = new Date(transaction.created_at);
      return transactionDate >= new Date(startDate) && transactionDate <= new Date(endDate);
    });
  }
}