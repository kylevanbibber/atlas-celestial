-- Add stripe_customer_id column to activeusers table
-- This column stores the Stripe customer ID for billing purposes
-- Run this migration if you haven't already

ALTER TABLE activeusers
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL COMMENT 'Stripe customer ID for billing';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stripe_customer_id ON activeusers(stripe_customer_id);


