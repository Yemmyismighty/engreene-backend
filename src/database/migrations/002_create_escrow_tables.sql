-- Migration: Create escrow transaction tables
-- Description: Add escrow system for secure payments between clients and vendors

-- Escrow transactions table
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  vendor_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
  order_items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure commission is reasonable (0-50% of amount)
  CHECK (commission_amount <= amount * 0.5),
  -- Ensure released_at is set only when status is 'released'
  CHECK ((status = 'released' AND released_at IS NOT NULL) OR (status != 'released' AND released_at IS NULL))
);

-- Commission transactions table for tracking Engreene's earnings
CREATE TABLE IF NOT EXISTS commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_transaction_id UUID NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  engreene_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_escrow_client_wallet ON escrow_transactions(client_wallet_id);
CREATE INDEX IF NOT EXISTS idx_escrow_vendor_wallet ON escrow_transactions(vendor_wallet_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_created_at ON escrow_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_commission_escrow_id ON commission_transactions(escrow_transaction_id);
CREATE INDEX IF NOT EXISTS idx_commission_engreene_wallet ON commission_transactions(engreene_wallet_id);