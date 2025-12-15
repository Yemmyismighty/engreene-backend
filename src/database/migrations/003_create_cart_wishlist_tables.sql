-- Migration: Create cart and wishlist tables
-- Description: Add shopping cart and wishlist functionality for clients

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL, -- References services table (assumed to exist)
  vendor_id UUID NOT NULL, -- References vendors table (assumed to exist)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate items in cart
  UNIQUE(user_id, service_id)
);

-- Wishlist items table
CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL, -- References services table (assumed to exist)
  vendor_id UUID NOT NULL, -- References vendors table (assumed to exist)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate items in wishlist
  UNIQUE(user_id, service_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_vendor_id ON cart_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_service_id ON cart_items(service_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_vendor_id ON wishlist_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_service_id ON wishlist_items(service_id);