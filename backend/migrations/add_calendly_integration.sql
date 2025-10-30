-- Migration: Add Calendly Integration Fields
-- Adds fields to activeusers table for storing Calendly account information
-- Date: 2025-10-08

ALTER TABLE activeusers
ADD COLUMN calendly_username VARCHAR(255) NULL COMMENT 'Calendly username or email',
ADD COLUMN calendly_access_token TEXT NULL COMMENT 'Encrypted Calendly API access token',
ADD COLUMN calendly_api_key VARCHAR(500) NULL COMMENT 'Calendly API key (if using personal access token)',
ADD COLUMN calendly_linked_at TIMESTAMP NULL COMMENT 'When Calendly account was linked',
ADD COLUMN calendly_link_url VARCHAR(500) NULL COMMENT 'User''s Calendly scheduling link',
ADD COLUMN calendly_user_uri VARCHAR(500) NULL COMMENT 'Calendly user URI from API';

-- Add index for quick lookups
CREATE INDEX idx_calendly_username ON activeusers(calendly_username);
CREATE INDEX idx_calendly_linked_at ON activeusers(calendly_linked_at);

-- Migration complete

