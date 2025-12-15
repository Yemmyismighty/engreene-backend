# API Reference

## Base URL
- **Development**: `http://localhost:3001/api`
- **Production**: `https://your-domain.com/api`

## Authentication
All protected endpoints require a Bearer token from Supabase:
```
Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN
```

## Response Format
All endpoints return a consistent response format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Authentication Endpoints

### Validate Token
**POST** `/api/auth/validate`

Validates the current Supabase token and returns user information.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "username",
    "role": "client|vendor",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Profile
**GET** `/api/auth/profile`

Get current user's profile information.

**Headers:**
```
Authorization: Bearer TOKEN
```

### Update Role
**POST** `/api/auth/role`

Set user role as client or vendor.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "role": "client" | "vendor"
}
```

---

## Wallet Endpoints

### Create Wallet
**POST** `/api/wallets`

Creates a wallet for the authenticated user.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "wallet-uuid",
    "user_id": "user-uuid",
    "user_type": "client|vendor",
    "balance": 0.00,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get User's Wallet
**GET** `/api/wallets`

Get the current user's wallet.

**Headers:**
```
Authorization: Bearer TOKEN
```

### Get Wallet by ID
**GET** `/api/wallets/:id`

Get specific wallet details (user must own the wallet).

**Headers:**
```
Authorization: Bearer TOKEN
```

### Link Payment Method
**POST** `/api/wallets/:id/payment-methods`

Link a payment method to the wallet.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "card_last_four": "1234",
  "card_type": "visa|mastercard|amex",
  "is_default": false
}
```

### Get Transaction History
**GET** `/api/wallets/:id/transactions`

Get wallet transaction history.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Query Parameters:**
- `limit` (optional): Number of transactions (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (pending|released|cancelled)

### Create Escrow Payment
**POST** `/api/wallets/:id/escrow`

Create an escrow payment transaction.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "amount": 100.00,
  "vendorWalletId": "vendor-wallet-uuid",
  "orderItems": [
    {
      "service_id": "service-uuid",
      "vendor_id": "vendor-uuid"
    }
  ]
}
```

### Release Escrow Payment
**POST** `/api/wallets/escrow/:transactionId/release`

Release an escrow payment (both client and vendor can authorize).

**Headers:**
```
Authorization: Bearer TOKEN
```

---

## Cart Endpoints

### Get Cart
**GET** `/api/cart`

Get user's cart organized by vendor.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vendor-uuid-1": [
      {
        "id": "cart-item-uuid",
        "service_id": "service-uuid",
        "vendor_id": "vendor-uuid",
        "service": { ... },
        "vendor": { ... }
      }
    ]
  }
}
```

### Get Cart Items (Flat List)
**GET** `/api/cart/items`

Get user's cart as a flat list.

**Headers:**
```
Authorization: Bearer TOKEN
```

### Add to Cart
**POST** `/api/cart/items`

Add an item to the cart.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "service_id": "service-uuid",
  "vendor_id": "vendor-uuid"
}
```

### Remove from Cart
**DELETE** `/api/cart/items/:id`

Remove an item from the cart.

**Headers:**
```
Authorization: Bearer TOKEN
```

### Checkout Cart
**POST** `/api/cart/checkout`

Process payment for all items in cart with multi-vendor distribution.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "transaction-uuid",
    "total_amount": 250.00,
    "vendor_payments": [
      {
        "vendor_id": "vendor-uuid",
        "amount": 90.00,
        "commission": 10.00
      }
    ]
  }
}
```

### Get Cart Stats
**GET** `/api/cart/stats`

Get cart statistics.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Response:**
```json
{
  "success": true,
  "data": {
    "itemCount": 3,
    "vendorCount": 2,
    "totalValue": 250.00
  }
}
```

---

## Wishlist Endpoints

### Get Wishlist
**GET** `/api/wishlist`

Get user's wishlist.

**Headers:**
```
Authorization: Bearer TOKEN
```

### Add to Wishlist
**POST** `/api/wishlist/items`

Add an item to the wishlist.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "service_id": "service-uuid",
  "vendor_id": "vendor-uuid"
}
```

### Remove from Wishlist
**DELETE** `/api/wishlist/items/:id`

Remove an item from the wishlist.

**Headers:**
```
Authorization: Bearer TOKEN
```

---

## Messaging Endpoints

### Send Message
**POST** `/api/messages`

Send a message (works with or without authentication).

**Headers (Optional):**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "toUserId": "recipient-uuid",
  "content": "Hello! I'm interested in your service."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "message-uuid",
    "from_user_id": "sender-uuid|null",
    "to_user_id": "recipient-uuid",
    "content": "Hello! I'm interested in your service.",
    "sender_name": "Username|Alien|Unknown User",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Get Conversation
**GET** `/api/messages/:vendorId`

Get conversation with a specific vendor.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Query Parameters:**
- `limit` (optional): Number of messages (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "message-uuid",
        "content": "Hello!",
        "sender_name": "Username",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "participant_info": {
      "user_id": "vendor-uuid",
      "username": "VendorName",
      "is_online": true
    }
  }
}
```

### Get Recent Conversations
**GET** `/api/messages`

Get recent conversations for the authenticated user.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Query Parameters:**
- `limit` (optional): Number of conversations (default: 10)

### Set Auto-Response (Vendors Only)
**POST** `/api/messages/vendors/:vendorId/auto-response`

Set an automated response message.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "message": "Thank you for your message! I'll get back to you soon."
}
```

### Deactivate Auto-Response
**DELETE** `/api/messages/vendors/:vendorId/auto-response`

Deactivate automated responses.

**Headers:**
```
Authorization: Bearer TOKEN
```

---

## Status Endpoints

### Update Online Status
**POST** `/api/status/online`

Update user's online status.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Body:**
```json
{
  "isOnline": true
}
```

### Get User Status
**GET** `/api/status/:userId`

Get a user's online status.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "is_online": true,
    "last_seen": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Notification Endpoints

### Get Notifications
**GET** `/api/notifications`

Get user's notifications.

**Headers:**
```
Authorization: Bearer TOKEN
```

**Query Parameters:**
- `limit` (optional): Number of notifications (default: 50)
- `unread_only` (optional): Only unread notifications (true|false)

### Mark as Read
**PUT** `/api/notifications/:id/read`

Mark a notification as read.

**Headers:**
```
Authorization: Bearer TOKEN
```

---

## Real-time Events (Socket.IO)

### Connection
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_SUPABASE_TOKEN' // Optional for authenticated features
  }
});
```

### Events to Listen For

#### Messages
```javascript
socket.on('message:receive', (message) => {
  // New message received
});

socket.on('typing:start', ({ fromUserId }) => {
  // User started typing
});

socket.on('typing:stop', ({ fromUserId }) => {
  // User stopped typing
});
```

#### Status Updates
```javascript
socket.on('status:online', ({ userId }) => {
  // User came online
});

socket.on('status:offline', ({ userId }) => {
  // User went offline
});
```

#### Notifications
```javascript
socket.on('notification:new', (notification) => {
  // New notification received
});

socket.on('notification:cart_add', ({ vendorId, clientId, serviceId }) => {
  // Item added to cart (vendors receive this)
});

socket.on('notification:wishlist_add', ({ vendorId, clientId, serviceId }) => {
  // Item added to wishlist (vendors receive this)
});
```

### Events to Emit

#### Messaging
```javascript
socket.emit('typing:start', { toUserId: 'recipient-uuid' });
socket.emit('typing:stop', { toUserId: 'recipient-uuid' });
```

#### Status
```javascript
socket.emit('status:update', { isOnline: true });
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Token validation failed |
| `INVALID_ROLE` | Invalid user role provided |
| `WALLET_EXISTS` | Wallet already exists for user |
| `WALLET_NOT_FOUND` | Wallet not found |
| `INSUFFICIENT_BALANCE` | Insufficient wallet balance |
| `CART_EMPTY` | Cart is empty |
| `SERVICE_NOT_FOUND` | Service not found |
| `UNAUTHORIZED` | Not authorized for this action |
| `MESSAGE_EMPTY` | Message content is empty |
| `ESCROW_NOT_FOUND` | Escrow transaction not found |

---

## Notes

1. **Anonymous Messaging**: Users can send messages without authentication. Their sender name will be "Alien" or "Unknown User".

2. **Commission**: All vendor payments automatically deduct 10% commission for Engreene.

3. **Escrow**: Payments are held in escrow until both client and vendor confirm completion.

4. **Real-time**: All messaging and status updates are real-time via Socket.IO.

5. **Notifications**: Vendors automatically receive notifications when clients add their services to cart or wishlist.

---

## Author

**Adeyemi Samuel Akitoye**