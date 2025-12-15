-- Migration: Create messaging system tables
-- Description: Add messaging functionality between clients and vendors

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for anonymous users
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 5000),
  sender_name TEXT NOT NULL CHECK (length(sender_name) > 0),
  is_automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor automated responses table
CREATE TABLE IF NOT EXISTS vendor_auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL, -- References vendors table (assumed to exist)
  message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 1000),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One active auto-response per vendor
  UNIQUE(vendor_id) DEFERRABLE INITIALLY DEFERRED
);

-- User online status table
CREATE TABLE IF NOT EXISTS user_online_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(from_user_id, to_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_auto_responses_vendor ON vendor_auto_responses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_auto_responses_active ON vendor_auto_responses(vendor_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_online_status_online ON user_online_status(is_online) WHERE is_online = true;