// Core entity types
export interface User {
  id: string;
  email: string;
  username?: string;
  role: 'client' | 'vendor';
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  user_type: 'client' | 'vendor';
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  wallet_id: string;
  card_last_four: string;
  card_type: string;
  is_default: boolean;
  created_at: string;
}

export interface EscrowTransaction {
  id: string;
  client_wallet_id: string;
  vendor_wallet_id: string;
  amount: number;
  commission_amount: number;
  status: 'pending' | 'released' | 'cancelled';
  order_items: CartItem[];
  created_at: string;
  released_at?: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  service_id: string;
  vendor_id: string;
  service?: Service;
  vendor?: Vendor;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  service_id: string;
  vendor_id: string;
  service?: Service;
  vendor?: Vendor;
  created_at: string;
}

export interface Message {
  id: string;
  from_user_id?: string;
  to_user_id: string;
  content: string;
  sender_name: string;
  is_automated: boolean;
  created_at: string;
}

export interface VendorAutoResponse {
  id: string;
  vendor_id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export interface UserOnlineStatus {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

// External types (assumed to exist in frontend)
export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  vendor_id: string;
  created_at: string;
}

export interface Vendor {
  id: string;
  business_name: string;
  user_id: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request/Response specific types
export interface PaymentResult {
  transaction_id: string;
  total_amount: number;
  vendor_payments: Array<{
    vendor_id: string;
    amount: number;
    commission: number;
  }>;
}

export interface ConversationResponse {
  messages: Message[];
  participant_info: {
    user_id: string;
    username?: string;
    is_online: boolean;
  };
}