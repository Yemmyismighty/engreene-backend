import { Request, Response, NextFunction } from 'express';
import { authService, AuthenticatedUser } from '../services/authService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and "token" formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * Required authentication middleware
 * Blocks request if no valid authentication is provided
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication token is required',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    const user = await authService.validateSupabaseToken(token);
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired authentication token',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Internal authentication error',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};
/**
 * Optional authentication middleware
 * Allows request to proceed with or without authentication
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      // No token provided, continue without user
      next();
      return;
    }

    const user = await authService.validateSupabaseToken(token);
    
    if (user) {
      req.user = user;
    }
    
    // Continue regardless of token validity
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    // Continue without user on error
    next();
  }
};

/**
 * Require vendor role middleware
 * Must be used after requireAuth
 */
export const requireVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for vendor operations',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  try {
    const isVendor = await authService.isVendor(req.user.id);
    
    if (!isVendor) {
      res.status(403).json({
        error: {
          code: 'VENDOR_ACCESS_REQUIRED',
          message: 'Vendor role required for this operation',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Vendor authorization error:', error);
    res.status(500).json({
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Internal authorization error',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};

/**
 * Require client role middleware
 * Must be used after requireAuth
 */
export const requireClient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for client operations',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  try {
    const isClient = await authService.isClient(req.user.id);
    
    if (!isClient) {
      res.status(403).json({
        error: {
          code: 'CLIENT_ACCESS_REQUIRED',
          message: 'Client role required for this operation',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Client authorization error:', error);
    res.status(500).json({
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Internal authorization error',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }
};