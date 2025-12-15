# Frontend Integration Examples

## Overview
This document provides practical examples of how to integrate the new backend features with your existing Next.js frontend. All examples are designed to work alongside your current code without breaking changes.

---

## 🔧 Setup & Configuration

### 1. Environment Variables
Add to your `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 2. API Client Setup
Create `lib/api.ts`:

```typescript
// lib/api.ts
import { useAuth } from '@/context/AuthContext';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(token?: string) {
    this.baseUrl = `${API_BASE}/api`;
    this.token = token;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth methods
  async validateToken() {
    return this.request('/auth/validate', { method: 'POST' });
  }

  async updateRole(role: 'client' | 'vendor') {
    return this.request('/auth/role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  // Wallet methods
  async createWallet() {
    return this.request('/wallets', { method: 'POST' });
  }

  async getWallet() {
    return this.request('/wallets');
  }

  async linkPaymentMethod(walletId: string, paymentData: any) {
    return this.request(`/wallets/${walletId}/payment-methods`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  // Cart methods
  async getCart() {
    return this.request('/cart');
  }

  async addToCart(serviceId: string, vendorId: string) {
    return this.request('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ service_id: serviceId, vendor_id: vendorId }),
    });
  }

  async removeFromCart(itemId: string) {
    return this.request(`/cart/items/${itemId}`, { method: 'DELETE' });
  }

  async checkout() {
    return this.request('/cart/checkout', { method: 'POST' });
  }

  // Messaging methods
  async sendMessage(toUserId: string, content: string) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({ toUserId, content }),
    });
  }

  async getConversation(vendorId: string, limit = 50, offset = 0) {
    return this.request(`/messages/${vendorId}?limit=${limit}&offset=${offset}`);
  }

  async setAutoResponse(vendorId: string, message: string) {
    return this.request(`/messages/vendors/${vendorId}/auto-response`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
}

// Hook for authenticated API calls
export function useApi() {
  const { session } = useAuth();
  return new ApiClient(session?.access_token);
}

// Hook for anonymous API calls (messaging)
export function useAnonymousApi() {
  return new ApiClient();
}
```

---

## Wallet Integration

### Wallet Component
```typescript
// components/WalletComponent.tsx
import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Wallet {
  id: string;
  balance: number;
  user_type: 'client' | 'vendor';
}

export function WalletComponent() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    loadWallet();
  }, [user]);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const response = await api.getWallet();
      setWallet(response.data);
    } catch (err) {
      // Wallet doesn't exist, that's okay
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    try {
      setLoading(true);
      const response = await api.createWallet();
      setWallet(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading wallet...</div>;

  if (!wallet) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Digital Wallet</h3>
        <p className="text-gray-600 mb-4">
          Create a wallet to manage payments and receive funds securely.
        </p>
        <button
          onClick={createWallet}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Create Wallet
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Digital Wallet</h3>
      <div className="space-y-2">
        <p><strong>Balance:</strong> ₦{wallet.balance.toLocaleString()}</p>
        <p><strong>Type:</strong> {wallet.user_type}</p>
        <button
          onClick={loadWallet}
          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
```

---

## Enhanced Cart Integration

### Enhanced Cart Hook
```typescript
// hooks/useEnhancedCart.ts
import { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface CartItem {
  id: string;
  service_id: string;
  vendor_id: string;
  service?: any;
  vendor?: any;
}

export function useEnhancedCart() {
  const [cart, setCart] = useState<Record<string, CartItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ itemCount: 0, vendorCount: 0, totalValue: 0 });
  const api = useApi();
  const { user } = useAuth();

  const loadCart = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const [cartResponse, statsResponse] = await Promise.all([
        api.getCart(),
        api.request('/cart/stats')
      ]);
      
      setCart(cartResponse.data);
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (serviceId: string, vendorId: string) => {
    try {
      await api.addToCart(serviceId, vendorId);
      await loadCart(); // Refresh cart
      return true;
    } catch (error) {
      console.error('Failed to add to cart:', error);
      return false;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      await api.removeFromCart(itemId);
      await loadCart(); // Refresh cart
      return true;
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      return false;
    }
  };

  const checkout = async () => {
    try {
      const response = await api.checkout();
      await loadCart(); // Refresh cart (should be empty now)
      return response.data;
    } catch (error) {
      console.error('Checkout failed:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadCart();
  }, [user]);

  return {
    cart,
    stats,
    loading,
    addToCart,
    removeFromCart,
    checkout,
    refresh: loadCart,
  };
}
```

### Enhanced Cart Component
```typescript
// components/EnhancedCart.tsx
import { useEnhancedCart } from '@/hooks/useEnhancedCart';

export function EnhancedCart() {
  const { cart, stats, loading, removeFromCart, checkout } = useEnhancedCart();

  const handleCheckout = async () => {
    try {
      const result = await checkout();
      alert(`Payment successful! Transaction ID: ${result.transaction_id}`);
    } catch (error) {
      alert('Payment failed. Please try again.');
    }
  };

  if (loading) return <div>Loading cart...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Shopping Cart</h2>
        <div className="text-sm text-gray-600">
          {stats.itemCount} items from {stats.vendorCount} vendors
        </div>
      </div>

      {Object.keys(cart).length === 0 ? (
        <p className="text-gray-500">Your cart is empty</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(cart).map(([vendorId, items]) => (
            <div key={vendorId} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                {items[0]?.vendor?.name || 'Vendor'}
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.service?.name}</p>
                      <p className="text-sm text-gray-600">
                        ₦{item.service?.price?.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">
                Total: ₦{stats.totalValue.toLocaleString()}
              </span>
              <button
                onClick={handleCheckout}
                className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Real-time Messaging

### Socket Hook
```typescript
// hooks/useSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    
    const newSocket = io(socketUrl, {
      auth: {
        token: session?.access_token
      }
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [session?.access_token]);

  return { socket, connected };
}
```

### Messaging Component
```typescript
// components/MessagingComponent.tsx
import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useApi, useAnonymousApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Message {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  from_user_id?: string;
}

interface MessagingComponentProps {
  vendorId: string;
  vendorName: string;
}

export function MessagingComponent({ vendorId, vendorName }: MessagingComponentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { socket } = useSocket();
  const { user } = useAuth();
  const api = useApi();
  const anonymousApi = useAnonymousApi();

  // Choose API based on authentication
  const currentApi = user ? api : anonymousApi;

  useEffect(() => {
    loadMessages();
  }, [vendorId]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('message:receive', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for typing indicators
    socket.on('typing:start', ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === vendorId) {
        setTyping(true);
      }
    });

    socket.on('typing:stop', ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId === vendorId) {
        setTyping(false);
      }
    });

    return () => {
      socket.off('message:receive');
      socket.off('typing:start');
      socket.off('typing:stop');
    };
  }, [socket, vendorId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return; // Can't load conversation without auth
    
    try {
      setLoading(true);
      const response = await api.getConversation(vendorId);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await currentApi.sendMessage(vendorId, newMessage);
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleTyping = () => {
    if (socket && user) {
      socket.emit('typing:start', { toUserId: vendorId });
      
      // Stop typing after 3 seconds
      setTimeout(() => {
        socket.emit('typing:stop', { toUserId: vendorId });
      }, 3000);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-96 border rounded-lg">
      {/* Header */}
      <div className="p-3 border-b bg-gray-50">
        <h3 className="font-semibold">Chat with {vendorName}</h3>
        {!user && (
          <p className="text-xs text-gray-600">
            Chatting as anonymous user. Login for better experience.
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div>Loading messages...</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.from_user_id === user?.id ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  message.from_user_id === user?.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-75 mt-1">
                  {message.sender_name} • {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        
        {typing && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg">
              <p className="text-sm italic">{vendorName} is typing...</p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Notifications Integration

### Notifications Hook
```typescript
// hooks/useNotifications.ts
import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';
import { useApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();
  const api = useApi();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    socket.on('notification:new', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off('notification:new');
    };
  }, [socket]);

  const loadNotifications = async () => {
    try {
      const response = await api.request('/notifications');
      setNotifications(response.data);
      setUnreadCount(response.data.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.request(`/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    refresh: loadNotifications,
  };
}
```

---

## Integration with Existing Components

### Enhance Existing Vendor Card
```typescript
// Update your existing vendor card component
import { useEnhancedCart } from '@/hooks/useEnhancedCart';
import { MessagingComponent } from '@/components/MessagingComponent';

export function VendorCard({ vendor }: { vendor: any }) {
  const { addToCart } = useEnhancedCart();
  const [showMessaging, setShowMessaging] = useState(false);

  const handleAddToCart = async (serviceId: string) => {
    const success = await addToCart(serviceId, vendor.id);
    if (success) {
      alert('Added to cart! Vendor has been notified.');
    }
  };

  return (
    <div className="border rounded-lg p-4">
      {/* Your existing vendor card content */}
      
      {/* Enhanced buttons */}
      <div className="mt-4 space-x-2">
        <button
          onClick={() => handleAddToCart(vendor.services[0]?.id)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add to Cart
        </button>
        
        <button
          onClick={() => setShowMessaging(!showMessaging)}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Message Vendor
        </button>
      </div>

      {/* Messaging component */}
      {showMessaging && (
        <div className="mt-4">
          <MessagingComponent 
            vendorId={vendor.id} 
            vendorName={vendor.name} 
          />
        </div>
      )}
    </div>
  );
}
```

### Update Your Layout with Notifications
```typescript
// Update your layout component
import { useNotifications } from '@/hooks/useNotifications';

export function Layout({ children }: { children: React.ReactNode }) {
  const { unreadCount } = useNotifications();

  return (
    <div>
      {/* Your existing navbar */}
      <nav className="flex items-center justify-between p-4">
        {/* Existing nav items */}
        
        {/* Add notification indicator */}
        <div className="relative">
          <button className="p-2">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </nav>
      
      {children}
    </div>
  );
}
```

---

## Getting Started Checklist

### Phase 1: Basic Integration
- [ ] Add environment variables
- [ ] Create API client (`lib/api.ts`)
- [ ] Test authentication with existing Supabase tokens
- [ ] Add wallet component to user dashboard

### Phase 2: Enhanced Cart
- [ ] Replace existing cart logic with enhanced cart hook
- [ ] Update vendor cards to use new cart API
- [ ] Test multi-vendor checkout flow

### Phase 3: Real-time Features
- [ ] Add Socket.IO client
- [ ] Implement messaging component
- [ ] Add online status indicators
- [ ] Set up notifications

### Phase 4: Polish
- [ ] Add loading states and error handling
- [ ] Implement proper TypeScript types
- [ ] Add animations and transitions
- [ ] Test all features end-to-end

The backend is designed to work incrementally - you can implement one feature at a time without breaking existing functionality!
---

## Author

**Adeyemi Samuel Akitoye**