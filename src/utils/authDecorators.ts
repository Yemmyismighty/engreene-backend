import { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth, requireVendor, requireClient } from '../middleware/auth';

/**
 * Decorator factory for required authentication
 * Usage: @RequireAuth
 */
export function RequireAuth(
  _target: any,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;
  
  descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
    await requireAuth(req, res, () => {
      method.call(this, req, res, next);
    });
  };
}

/**
 * Decorator factory for optional authentication
 * Usage: @OptionalAuth
 */
export function OptionalAuth(
  _target: any,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;
  
  descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
    await optionalAuth(req, res, () => {
      method.call(this, req, res, next);
    });
  };
}

/**
 * Decorator factory for vendor-only operations
 * Usage: @RequireVendor (must be used with @RequireAuth)
 */
export function RequireVendor(
  _target: any,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;
  
  descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
    await requireVendor(req, res, () => {
      method.call(this, req, res, next);
    });
  };
}

/**
 * Decorator factory for client-only operations
 * Usage: @RequireClient (must be used with @RequireAuth)
 */
export function RequireClient(
  _target: any,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;
  
  descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
    await requireClient(req, res, () => {
      method.call(this, req, res, next);
    });
  };
}

/**
 * Utility function to combine multiple middleware functions
 */
export function combineMiddleware(...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    
    function runNext() {
      if (index >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[index++];
      if (middleware) {
        middleware(req, res, runNext);
      }
    }
    
    runNext();
  };
}

/**
 * Pre-built middleware combinations for common use cases
 */
export const authMiddleware = {
  // Required authentication only
  required: requireAuth,
  
  // Optional authentication
  optional: optionalAuth,
  
  // Required authentication + vendor role
  vendor: combineMiddleware(requireAuth, requireVendor),
  
  // Required authentication + client role
  client: combineMiddleware(requireAuth, requireClient),
};