-- Migration to allow multiple push subscriptions per user (multi-device support)
-- This removes the UNIQUE constraint on user_id and adds a unique constraint on endpoint

-- First, drop the existing unique constraint on user_id
ALTER TABLE push_subscriptions DROP INDEX user_id;

-- Add a new constraint to prevent duplicate endpoints (but allow multiple devices per user)
-- We'll use a hash of the endpoint since endpoints can be very long
ALTER TABLE push_subscriptions ADD COLUMN endpoint_hash VARCHAR(64) GENERATED ALWAYS AS (SHA2(JSON_EXTRACT(subscription, '$.endpoint'), 256)) STORED;

-- Create unique index on endpoint_hash to prevent duplicate endpoints
ALTER TABLE push_subscriptions ADD UNIQUE KEY unique_endpoint (endpoint_hash);

-- Add regular index on user_id for performance (non-unique)
ALTER TABLE push_subscriptions ADD INDEX idx_user_id (user_id); 