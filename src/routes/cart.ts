import { Router, Request, Response } from 'express';
import { cartService } from '../services';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

/**
 * GET /api/cart
 * Get user's cart organized by vendor
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const cart = await cartService.getCartByUser(userId);
    
    const response: ApiResponse = {
      success: true,
      data: cart,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cart',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/cart/items
 * Get user's cart as flat list
 */
router.get('/items', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await cartService.getCartItems(userId);
    
    const response: ApiResponse = {
      success: true,
      data: items,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cart items',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/cart/items
 * Add item to cart
 */
router.post('/items', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { service_id, vendor_id } = req.body;
    
    if (!service_id || !vendor_id) {
      const response: ApiResponse = {
        success: false,
        message: 'service_id and vendor_id are required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const cartItem = await cartService.addToCart(userId, service_id, vendor_id);
    
    const response: ApiResponse = {
      success: true,
      data: cartItem,
      message: 'Item added to cart',
      timestamp: new Date().toISOString()
    };
    
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add item to cart',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/cart/items/:id
 * Remove item from cart
 */
router.delete('/items/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    if (!id) {
      const response: ApiResponse = {
        success: false,
        message: 'Item ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const removed = await cartService.removeFromCart(userId, id);
    
    if (!removed) {
      const response: ApiResponse = {
        success: false,
        message: 'Cart item not found',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Item removed from cart',
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove item from cart',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/cart/checkout
 * Process cart payment
 */
router.post('/checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cartItems = await cartService.getCartItems(userId);
    
    if (cartItems.length === 0) {
      const response: ApiResponse = {
        success: false,
        message: 'Cart is empty',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const paymentResult = await cartService.processCartPayment(userId, cartItems);
    
    const response: ApiResponse = {
      success: true,
      data: paymentResult,
      message: 'Payment processed successfully',
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Payment processing failed',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/cart/stats
 * Get cart statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await cartService.getCartStats(userId);
    
    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get cart stats',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

export default router;