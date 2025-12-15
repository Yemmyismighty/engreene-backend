import { Request, Response, NextFunction } from 'express';
import { requireAuth, optionalAuth, requireVendor } from './auth';
import { authService } from '../services/authService';

// Mock the auth service
jest.mock('../services/authService');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      path: '/test',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should return 401 when no token is provided', async () => {
      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTHENTICATION_REQUIRED',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(null);

      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_TOKEN',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when token is valid', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'client',
      };
      
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);

      await requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBe(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should call next when no token is provided', async () => {
      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should call next when token is invalid', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(null);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should set user and call next when token is valid', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'client',
      };
      
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBe(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('requireVendor', () => {
    it('should return 401 when no user is present', async () => {
      await requireVendor(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'AUTHENTICATION_REQUIRED',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not a vendor', async () => {
      mockRequest.user = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'client',
      } as any;
      
      (authService.isVendor as jest.Mock).mockResolvedValue(false);

      await requireVendor(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VENDOR_ACCESS_REQUIRED',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next when user is a vendor', async () => {
      mockRequest.user = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'vendor',
      } as any;
      
      (authService.isVendor as jest.Mock).mockResolvedValue(true);

      await requireVendor(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});