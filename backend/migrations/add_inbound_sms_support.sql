-- Migration: Add support for inbound SMS messages
-- Purpose: Track incoming text messages from recruits
-- Date: 2025-11-19

-- Add columns to support inbound messages
ALTER TABLE sms_messages
ADD COLUMN from_number VARCHAR(32) NULL COMMENT 'Phone number message was sent from (for inbound messages)',
ADD COLUMN direction ENUM('outbound', 'inbound') NOT NULL DEFAULT 'outbound' COMMENT 'Message direction',
ADD INDEX idx_sms_messages_from_number (from_number),
ADD INDEX idx_sms_messages_direction (direction);

-- Make user_id nullable since inbound messages don't have a user_id
ALTER TABLE sms_messages
MODIFY COLUMN user_id INT NULL COMMENT 'Atlas user who initiated the text (null for inbound)';

-- Update existing foreign key constraint to allow NULL
ALTER TABLE sms_messages
DROP FOREIGN KEY IF EXISTS fk_sms_messages_user;

ALTER TABLE sms_messages
ADD CONSTRAINT fk_sms_messages_user
  FOREIGN KEY (user_id) REFERENCES activeusers(id)
  ON DELETE SET NULL;

