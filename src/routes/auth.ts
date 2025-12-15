import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = Router();

/**
 * POST /api/auth/validate
 * Validate authentication token and return user info
 */
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!; // Guaranteed to exist after requireAuth
    
    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      message: 'Token validated successfully',
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error validating token',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    const response: ApiResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      error: {
        code: 'PROFILE_ERROR',
        message: 'Error fetching user profile',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

/**
 * POST /api/auth/role
 * Update user role (client/vendor)
 */
router.post('/role', requireAuth, async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const user = req.user!;
    
    if (!role || !['client', 'vendor'].includes(role)) {
      res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: 'Role must be either "client" or "vendor"',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }
    
    const success = await authService.updateUserRole(user.id, role);
    
    if (!success) {
      res.status(500).json({
        error: {
          code: 'ROLE_UPDATE_ERROR',
          message: 'Failed to update user role',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      data: { role },
      message: 'User role updated successfully',
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({
      error: {
        code: 'ROLE_UPDATE_ERROR',
        message: 'Error updating user role',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

/**
 * GET /api/auth/status
 * Get authentication status (optional auth - works with or without token)
 */
router.get('/status', optionalAuth, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: {
        authenticated: !!req.user,
        user: req.user ? {
          id: req.user.id,
          email: req.user.email,
          username: req.user.username,
          role: req.user.role,
        } : null,
      },
      timestamp: new Date().toISOString(),
    };
    
    res.json(response);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: {
        code: 'STATUS_ERROR',
        message: 'Error checking authentication status',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
});

export default router;