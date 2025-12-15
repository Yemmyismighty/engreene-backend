# Frontend Integration Guide

## Overview
This backend provides a complete API for the Engreene marketplace platform. It integrates seamlessly with your existing Next.js frontend and Supabase setup **without requiring any changes to existing frontend code**.

## Quick Setup

### 1. Start the Backend Server
```bash
cd backend
npm install
npm run dev
```
The backend will run on `http://localhost:3001`

### 2. Update Frontend API Calls
Your existing frontend can immediately start using these new endpoints alongside the current Supabase calls.

## API Base URL
- **Development**: `http://localhost:3001/api`
- **Production**: Update this in your frontend environment variables

## Authentication Integration

### Current Frontend Auth (Keep As-Is)
Your existing Supabase authentication in `context/AuthContext.tsx` works perfectly. The backend validates the same Supabase tokens.

### How Backend Auth Works
```typescript
// Your existing frontend auth token
const { session } = useAuth();
const token = session?.access_token;

// Use this token in API calls to backend
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

## Key API Endpoints

### Authentication
```typescript
// Validate current user (optional - backend auto-creates users)
POST /api/auth/validate
GET /api/auth/profile
POST /api/auth/role  // Set user as 'client' or 'vendor'
```

### Wallets (New Feature)
```typescript
// Create wallet for current user
POST /api/wallets

// Get user's wallet
GET /api/wallets

// Link payment method
POST /api/wallets/:id/payment-methods
```

### Cart (Enhanced)
```typescript
// Get cart organized by vendor
GET /api/cart

// Add item to cart
POST /api/cart/items
Body: { service_id: string, vendor_id: string }

// Remove item
DELETE /api/cart/items/:id

// Process payment (with multi-vendor distribution)
POST /api/cart/checkout
```

### Messaging (New Feature)
```typescript
// Send message (works with or without auth)
POST /api/messages
Body: { toUserId: string, content: string }

// Get conversation with vendor
GET /api/messages/:vendorId

// Set auto-response (vendors only)
POST /api/messages/vendors/:vendorId/auto-response
```

### Real-time Features
```typescript
// Socket.IO connection for real-time messaging
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: { token: session?.access_token }
});

// Listen for new messages
socket.on('message:receive', (message) => {
  // Handle incoming message
});

// Send typing indicators
socket.emit('typing:start', { toUserId });
```

## Migration Strategy

### Phase 1: Add New Features (No Breaking Changes)
1. **Wallet System**: Add wallet creation and management
2. **Enhanced Cart**: Use new cart endpoints for multi-vendor support
3. **Messaging**: Implement real-time messaging features

### Phase 2: Enhanced User Experience
1. **Online Status**: Show vendor availability
2. **Notifications**: Real-time notifications for cart/wishlist actions
3. **Escrow Payments**: Secure payment processing

## Frontend Integration Examples

### 1. Enhanced Cart with Multi-Vendor Support
```typescript
// Replace your existing cart logic with:
const addToCart = async (serviceId: string, vendorId: string) => {
  const response = await fetch('/api/cart/items', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ service_id: serviceId, vendor_id: vendorId })
  });
  
  if (response.ok) {
    // Item added successfully
    // The backend automatically notifies the vendor
  }
};
```

### 2. Real-time Messaging Component
```typescript
const MessagingComponent = ({ vendorId }: { vendorId: string }) => {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    // Connect to real-time messaging
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);
    
    // Listen for messages
    newSocket.on('message:receive', (message) => {
      setMessages(prev => [...prev, message]);
    });
    
    return () => newSocket.close();
  }, []);
  
  const sendMessage = async (content: string) => {
    await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ toUserId: vendorId, content })
    });
  };
};
```

### 3. Wallet Integration
```typescript
const WalletComponent = () => {
  const [wallet, setWallet] = useState(null);
  
  const createWallet = async () => {
    const response = await fetch('/api/wallets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const newWallet = await response.json();
      setWallet(newWallet.data);
    }
  };
};
```

## Key Benefits for Frontend

### 1. **No Breaking Changes**
- Your existing code continues to work
- Supabase authentication remains unchanged
- Current cart store can be enhanced gradually

### 2. **Enhanced Features**
- **Multi-vendor cart**: Automatic payment distribution
- **Real-time messaging**: Instant communication with vendors
- **Escrow payments**: Secure transaction processing
- **Vendor notifications**: Automatic alerts for cart/wishlist actions

### 3. **Type Safety**
All API responses include TypeScript types. Import them from:
```typescript
import { ApiResponse, Wallet, CartItem, Message } from '../backend/src/types';
```

## Testing the Integration

### 1. Test Authentication
```bash
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

### 2. Test Cart Functionality
```bash
curl -X GET http://localhost:3001/api/cart \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

### 3. Test Messaging (Anonymous)
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{"toUserId": "vendor-id", "content": "Hello!"}'
```

## Important Notes

### Environment Variables
Add to your frontend `.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### CORS Configuration
The backend is already configured to accept requests from `http://localhost:3000` (your Next.js app).

### Database Schema
The backend extends your existing Supabase database with new tables. No existing data is affected.

## Need Help?

1. **API Documentation**: See `API_REFERENCE.md`
2. **Database Schema**: See `DATABASE_SCHEMA.md`
3. **Error Handling**: All endpoints return consistent error formats

The backend is designed to enhance your existing frontend without breaking anything. Start with one feature (like wallets or messaging) and gradually integrate others!

---

## Author

**Adeyemi Samuel Akitoye**