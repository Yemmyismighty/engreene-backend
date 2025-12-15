import { Router, Request, Response } from 'express';
import { walletService } from '../services';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

/**
 * POST /api/wallets
 * Create a new wallet for the authenticated user
 */
router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userType = req.user!.role as 'client' | 'vendor';
    
    if (!userType || !['client', 'vendor'].includes(userType)) {
      const response: ApiResponse = {
        success: false,
        message: 'User must have a valid role (client or vendor) to create a wallet',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const wallet = await walletService.createWallet(userId, userType);
    
    const response: ApiResponse = {
      success: true,
      data: wallet,
      message: 'Wallet created successfully',
      timestamp: new Date().toISOString()
    };
    
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create wallet',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/wallets/:id
 * Get wallet details by ID
 */
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const wallet = await walletService.getWalletById(id);
    
    if (!wallet) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet not found',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    // Ensure user can only access their own wallet
    if (wallet.user_id !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Not authorized to access this wallet',
        timestamp: new Date().toISOString()
      };
      res.status(403).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get wallet',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/wallets
 * Get current user's wallet
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const wallet = await walletService.getWalletByUserId(userId);
    
    if (!wallet) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet not found for user',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      data: wallet,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get wallet',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/wallets/:id/payment-methods
 * Link a payment method to the wallet
 */
router.post('/:id/payment-methods', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const paymentData = req.body;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    // Verify wallet ownership
    const wallet = await walletService.getWalletById(id);
    if (!wallet || wallet.user_id !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet not found or not authorized',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    // Validate payment method data
    if (!paymentData.card_last_four || !paymentData.card_type) {
      const response: ApiResponse = {
        success: false,
        message: 'card_last_four and card_type are required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const paymentMethod = await walletService.linkPaymentMethod(id, paymentData);
    
    const response: ApiResponse = {
      success: true,
      data: paymentMethod,
      message: 'Payment method linked successfully',
      timestamp: new Date().toISOString()
    };
    
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to link payment method',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/wallets/:id/transactions
 * Get transaction history for a wallet
 */
router.get('/:id/transactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { limit = '50', offset = '0', status } = req.query;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    // Verify wallet ownership
    const wallet = await walletService.getWalletById(id);
    if (!wallet || wallet.user_id !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet not found or not authorized',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    const transactions = await walletService.getTransactionHistory(id, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      status: status as string
    });
    
    const response: ApiResponse = {
      success: true,
      data: transactions,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get transaction history',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/wallets/:id/escrow
 * Create an escrow payment
 */
router.post('/:id/escrow', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { amount, vendorWalletId, orderItems } = req.body;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    // Verify wallet ownership
    const wallet = await walletService.getWalletById(id);
    if (!wallet || wallet.user_id !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet not found or not authorized',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    // Validate required fields
    if (!amount || !vendorWalletId || !orderItems) {
      const response: ApiResponse = {
        success: false,
        message: 'amount, vendorWalletId, and orderItems are required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const escrowTransaction = await walletService.createEscrowPayment(
      id,
      amount,
      vendorWalletId,
      orderItems
    );
    
    const response: ApiResponse = {
      success: true,
      data: escrowTransaction,
      message: 'Escrow payment created successfully',
      timestamp: new Date().toISOString()
    };
    
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create escrow payment',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/wallets/escrow/:transactionId/release
 * Release an escrow payment
 */
router.post('/escrow/:transactionId/release', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const userId = req.user!.id;
    
    if (!transactionId) {
      const response: ApiResponse = {
        success: false,
        message: 'Transaction ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const result = await walletService.releaseEscrowPayment(transactionId, userId);
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Escrow payment released successfully',
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to release escrow payment',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/wallets/:id/balance
 * Get wallet balance
 */
router.get('/:id/balance', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    // Verify wallet ownership
    const wallet = await walletService.getWalletById(id);
    if (!wallet || wallet.user_id !== userId) {
      const response: ApiResponse = {
        success: false,
        message: 'Wallet not found or not authorized',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    const balance = await walletService.getWalletBalance(id);
    
    const response: ApiResponse = {
      success: true,
      data: { balance },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get wallet balance',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

export default router;