import { Router, Request, Response } from 'express';
import { cartService } from '../services';
import { requireAuth } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

/**
 * GET /api/wishlist
 * Get user's wishlist
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wishlist = await cartService.getWishlistByUser(userId);
    
    const response: ApiResponse = {
      success: true,
      data: wishlist,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get wishlist',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/wishlist/items
 * Add item to wishlist
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
    
    const wishlistItem = await cartService.addToWishlist(userId, service_id, vendor_id);
    
    const response: ApiResponse = {
      success: true,
      data: wishlistItem,
      message: 'Item added to wishlist',
      timestamp: new Date().toISOString()
    };
    
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add item to wishlist',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/wishlist/items/:id
 * Remove item from wishlist
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
    
    const removed = await cartService.removeFromWishlist(userId, id);
    
    if (!removed) {
      const response: ApiResponse = {
        success: false,
        message: 'Wishlist item not found',
        timestamp: new Date().toISOString()
      };
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Item removed from wishlist',
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove item from wishlist',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * POST /api/wishlist/items/:id/move-to-cart
 * Move item from wishlist to cart
 */
router.post('/items/:id/move-to-cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    
    const cartItem = await cartService.moveWishlistToCart(userId, id);
    
    const response: ApiResponse = {
      success: true,
      data: cartItem,
      message: 'Item moved to cart',
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to move item to cart',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

/**
 * GET /api/wishlist/check/:serviceId
 * Check if item exists in cart or wishlist
 */
router.get('/check/:serviceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { serviceId } = req.params;
    
    if (!serviceId) {
      const response: ApiResponse = {
        success: false,
        message: 'Service ID is required',
        timestamp: new Date().toISOString()
      };
      res.status(400).json(response);
      return;
    }
    
    const status = await cartService.checkItemStatus(userId, serviceId);
    
    const response: ApiResponse = {
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check item status',
      timestamp: new Date().toISOString()
    };
    
    res.status(500).json(response);
  }
});

export default router;