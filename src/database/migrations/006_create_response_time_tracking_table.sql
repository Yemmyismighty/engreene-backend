-- Response time tracking table for automated reminders
CREATE TABLE IF NOT EXISTS response_time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_sent TIMESTAMP WITH TIME ZONE,
  alternative_vendors_recommended BOOLEAN DEFAULT FALSE,
  alternative_vendors_recommended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique tracking per vendor-client pair
  UNIQUE(vendor_id, client_id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_response_time_tracking_vendor_client 
ON response_time_tracking(vendor_id, client_id);

CREATE INDEX IF NOT EXISTS idx_response_time_tracking_reminders 
ON response_time_tracking(reminders_sent, alternative_vendors_recommended);