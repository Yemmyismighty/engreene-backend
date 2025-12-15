import request from 'supertest';
import { app } from '../index';
import { authService } from '../services/authService';

// Mock the auth service
jest.mock('../services/authService');

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/validate', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should return user data when valid token is provided', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'client',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        supabase_user: {},
      };

      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/validate')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-id');
      expect(response.body.data.email).toBe('test@example.com');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should return user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'client',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        supabase_user: {},
      };

      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
    });
  });

  describe('POST /api/auth/role', () => {
    it('should return 400 for invalid role', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'client',
        supabase_user: {},
      };

      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/role')
        .set('Authorization', 'Bearer valid-token')
        .send({ role: 'invalid' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_ROLE');
    });

    it('should update user role successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'client',
        supabase_user: {},
      };

      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);
      (authService.updateUserRole as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/role')
        .set('Authorization', 'Bearer valid-token')
        .send({ role: 'vendor' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('vendor');
    });
  });

  describe('GET /api/auth/status', () => {
    it('should return unauthenticated status when no token', async () => {
      const response = await request(app)
        .get('/api/auth/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authenticated).toBe(false);
      expect(response.body.data.user).toBe(null);
    });

    it('should return authenticated status when valid token', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'client',
        supabase_user: {},
      };

      (authService.validateSupabaseToken as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/status')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authenticated).toBe(true);
      expect(response.body.data.user.id).toBe('user-id');
    });
  });
});