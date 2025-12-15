# Database Schema

## Overview
The backend extends your existing Supabase database with new tables for enhanced marketplace functionality. **No existing data or tables are modified.**

## Migration Status
The backend is designed to work with your existing Supabase setup. New tables will be created automatically when the backend starts.

---

## New Tables Added

### 1. `wallets`
Stores wallet information for clients and vendors.

```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT CHECK (user_type IN ('client', 'vendor')) NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE UNIQUE INDEX idx_wallets_user_unique ON wallets(user_id);
```

**Purpose**: Manages digital wallets for secure payments and escrow functionality.

### 2. `payment_methods`
Stores linked payment methods for wallets.

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  card_last_four TEXT NOT NULL,
  card_type TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_methods_wallet_id ON payment_methods(wallet_id);
```

**Purpose**: Securely stores payment method information (only last 4 digits for security).

### 3. `escrow_transactions`
Manages escrow payments between clients and vendors.

```sql
CREATE TABLE escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_wallet_id UUID REFERENCES wallets(id),
  vendor_wallet_id UUID REFERENCES wallets(id),
  amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'released', 'cancelled')) DEFAULT 'pending',
  order_items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_escrow_client_wallet ON escrow_transactions(client_wallet_id);
CREATE INDEX idx_escrow_vendor_wallet ON escrow_transactions(vendor_wallet_id);
CREATE INDEX idx_escrow_status ON escrow_transactions(status);
```

**Purpose**: Implements secure escrow system where payments are held until order completion.

### 4. `cart_items`
Stores items in users' shopping carts.

```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_vendor_id ON cart_items(vendor_id);
CREATE UNIQUE INDEX idx_cart_items_unique ON cart_items(user_id, service_id);
```

**Purpose**: Enhanced cart functionality with multi-vendor support.

### 5. `wishlist_items`
Stores items in users' wishlists.

```sql
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_items_vendor_id ON wishlist_items(vendor_id);
CREATE UNIQUE INDEX idx_wishlist_items_unique ON wishlist_items(user_id, service_id);
```

**Purpose**: Separate wishlist functionality from cart.

### 6. `messages`
Stores all messages between users.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  is_automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_conversation ON messages(from_user_id, to_user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

**Purpose**: Real-time messaging system with support for anonymous users.

### 7. `vendor_auto_responses`
Stores automated response messages for vendors.

```sql
CREATE TABLE vendor_auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vendor_auto_responses_vendor_id ON vendor_auto_responses(vendor_id);
CREATE INDEX idx_vendor_auto_responses_active ON vendor_auto_responses(vendor_id, is_active);
```

**Purpose**: Automated responses when vendors are unavailable.

### 8. `user_online_status`
Tracks online/offline status of users.

```sql
CREATE TABLE user_online_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_online_status_online ON user_online_status(is_online);
CREATE INDEX idx_user_online_status_last_seen ON user_online_status(last_seen);
```

**Purpose**: Real-time online/offline status tracking.

### 9. `notifications`
Stores notifications for users.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

**Purpose**: System notifications for cart additions, messages, etc.

### 10. `response_time_tracking`
Tracks vendor response times for automated reminders.

```sql
CREATE TABLE response_time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_client_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_vendor_response_at TIMESTAMP WITH TIME ZONE,
  reminder_8h_sent BOOLEAN DEFAULT FALSE,
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_2d_sent BOOLEAN DEFAULT FALSE,
  reminder_1w_sent BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_response_tracking_vendor ON response_time_tracking(vendor_id);
CREATE INDEX idx_response_tracking_active ON response_time_tracking(is_active);
CREATE UNIQUE INDEX idx_response_tracking_unique ON response_time_tracking(vendor_id, client_id);
```

**Purpose**: Automated reminder system for vendor response times.

---

## Existing Tables (Unchanged)

Your existing Supabase tables remain completely unchanged:

### `auth.users` (Supabase Auth)
- Used for authentication (no changes)
- Referenced by new tables via foreign keys

### `vendors` (Your existing table)
- All existing vendor data preserved
- Referenced by new cart and messaging tables

### `services` (Your existing table)
- All existing service data preserved
- Referenced by new cart and escrow tables

### Any other existing tables
- Completely unchanged and preserved

---

## Data Relationships

```
auth.users (Supabase)
├── wallets (1:1)
│   ├── payment_methods (1:many)
│   └── escrow_transactions (1:many as client or vendor)
├── cart_items (1:many)
├── wishlist_items (1:many)
├── messages (1:many as sender or recipient)
├── notifications (1:many)
└── user_online_status (1:1)

vendors (Your existing)
├── vendor_auto_responses (1:many)
├── cart_items (1:many)
├── wishlist_items (1:many)
└── response_time_tracking (1:many)

services (Your existing)
├── cart_items (1:many)
└── wishlist_items (1:many)
```

---

## Security & Permissions

### Row Level Security (RLS)
All new tables implement RLS policies:

```sql
-- Example: Users can only access their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Example: Users can only access their own cart
CREATE POLICY "Users can manage own cart" ON cart_items
  FOR ALL USING (auth.uid() = user_id);

-- Example: Users can view messages they sent or received
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    auth.uid() = from_user_id OR 
    auth.uid() = to_user_id
  );
```

### Data Privacy
- **Payment Methods**: Only store last 4 digits of cards
- **Messages**: Support for anonymous users with "Alien"/"Unknown User" names
- **Wallets**: Users can only access their own wallet data
- **Notifications**: Users only see their own notifications

---

## Sample Data Structure

### Wallet Example
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-uuid-from-supabase",
  "user_type": "client",
  "balance": 150.00,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Escrow Transaction Example
```json
{
  "id": "escrow-uuid",
  "client_wallet_id": "client-wallet-uuid",
  "vendor_wallet_id": "vendor-wallet-uuid",
  "amount": 100.00,
  "commission_amount": 10.00,
  "status": "pending",
  "order_items": [
    {
      "service_id": "service-uuid",
      "vendor_id": "vendor-uuid"
    }
  ],
  "created_at": "2024-01-15T10:30:00.000Z",
  "released_at": null
}
```

### Message Example
```json
{
  "id": "message-uuid",
  "from_user_id": null,
  "to_user_id": "vendor-uuid",
  "content": "Hello! I'm interested in your photography service.",
  "sender_name": "Alien",
  "is_automated": false,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

---

## Migration Commands

The backend handles migrations automatically, but you can also run them manually:

```bash
# Initialize database (creates tables if they don't exist)
npm run db:init

# Check database health
npm run db:health

# Get database info
npm run db:info
```

---

## Performance Considerations

### Indexes
All tables include appropriate indexes for:
- Primary keys (automatic)
- Foreign keys
- Frequently queried columns
- Unique constraints where needed

### Query Optimization
- Messages are indexed by conversation participants
- Cart items are indexed by user and vendor
- Notifications are indexed by user and read status
- Online status is indexed for quick lookups

### Cleanup Jobs
Automated cleanup for:
- Stale online status records
- Old notification records
- Completed escrow transactions (archived)

---

## Important Notes

1. **No Data Loss**: All existing data is preserved
2. **Backward Compatible**: Existing queries continue to work
3. **Incremental**: New features can be adopted gradually
4. **Secure**: All new tables use RLS and proper permissions
5. **Scalable**: Designed for growth with proper indexing

The database schema is designed to enhance your existing system without breaking anything!

---

## Author

**Adeyemi Samuel Akitoye**