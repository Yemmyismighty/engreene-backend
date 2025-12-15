# Authentication System

This directory contains the core authentication middleware and services for the Engreene Backend.

## Components

### 1. Supabase Configuration (`config/supabase.ts`)
- Configures Supabase clients for backend operations
- Separate clients for service role and authentication operations
- Environment-based configuration

### 2. Authentication Service (`services/authService.ts`)
- `validateSupabaseToken()` - Validates JWT tokens from Supabase
- `getUserRole()` - Gets user role (client/vendor)
- `updateUserRole()` - Updates user role
- `isVendor()` / `isClient()` - Role checking utilities

### 3. Authentication Middleware (`middleware/auth.ts`)
- `requireAuth` - Blocks requests without valid authentication
- `optionalAuth` - Allows requests with or without authentication
- `requireVendor` - Requires vendor role (use after requireAuth)
- `requireClient` - Requires client role (use after requireAuth)

### 4. Authentication Decorators (`utils/authDecorators.ts`)
- TypeScript decorators for method-level authentication
- Pre-built middleware combinations for common patterns
- Utility functions for combining middleware

### 5. Authentication Routes (`routes/auth.ts`)
- `POST /api/auth/validate` - Validate token and return user info
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/role` - Update user role
- `GET /api/auth/status` - Check authentication status (optional auth)

## Usage Examples

### Basic Authentication
```typescript
import { requireAuth } from '../middleware/auth';

router.get('/protected', requireAuth, (req, res) => {
  // req.user is guaranteed to exist
  res.json({ user: req.user });
});
```

### Optional Authentication
```typescript
import { optionalAuth } from '../middleware/auth';

router.get('/public', optionalAuth, (req, res) => {
  // req.user may or may not exist
  const message = req.user ? `Hello ${req.user.username}` : 'Hello guest';
  res.json({ message });
});
```

### Role-Based Access
```typescript
import { requireAuth, requireVendor } from '../middleware/auth';

router.get('/vendor-only', requireAuth, requireVendor, (req, res) => {
  // Only vendors can access this endpoint
  res.json({ message: 'Vendor area' });
});
```

### Using Middleware Combinations
```typescript
import { authMiddleware } from '../utils/authDecorators';

// Vendor-only endpoint (combines requireAuth + requireVendor)
router.get('/vendor-dashboard', authMiddleware.vendor, (req, res) => {
  res.json({ dashboard: 'vendor' });
});
```

## Error Responses

All authentication errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  },
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Error Codes
- `AUTHENTICATION_REQUIRED` - No token provided
- `INVALID_TOKEN` - Token is invalid or expired
- `VENDOR_ACCESS_REQUIRED` - Vendor role required
- `CLIENT_ACCESS_REQUIRED` - Client role required
- `AUTHENTICATION_ERROR` - Internal authentication error

## Testing

The authentication system includes comprehensive tests:
- Unit tests for AuthService methods
- Middleware tests for all authentication scenarios
- Integration tests for API endpoints
- Property-based tests (when applicable)

Run tests with:
```bash
npm test
```