-- Add message_type column to distinguish email vs sms
ALTER TABLE verify_messages
  ADD COLUMN message_type ENUM('sms', 'email') NOT NULL DEFAULT 'sms' AFTER direction,
  ADD COLUMN recipient_email VARCHAR(255) DEFAULT NULL AFTER phone_number,
  MODIFY COLUMN phone_number VARCHAR(20) DEFAULT NULL;

-- Index for filtering by type
CREATE INDEX idx_vm_type ON verify_messages (message_type);
