-- Migration: Add SMS credit tracking and message logging
-- Purpose: Track per-user SMS credit balances and individual outbound text messages
-- Date: 2025-11-18

-- 1) Per-user SMS credit balance on activeusers
ALTER TABLE activeusers
ADD COLUMN sms_credit_balance INT NOT NULL DEFAULT 0 COMMENT 'Remaining SMS credits for this user',
ADD COLUMN sms_credit_last_updated TIMESTAMP NULL DEFAULT NULL COMMENT 'Last time SMS credits were adjusted';

-- 2) Credit transactions ledger (purchases, manual adjustments, debits)
CREATE TABLE IF NOT EXISTS sms_credit_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount INT NOT NULL COMMENT 'Positive for purchases/credits, negative for debits/usage',
  type ENUM('purchase', 'debit', 'adjustment') NOT NULL DEFAULT 'purchase',
  description VARCHAR(255) NULL,
  related_id VARCHAR(255) NULL COMMENT 'Optional reference to an external entity (e.g., payment id, pipeline id)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_credit_tx_user (user_id),
  CONSTRAINT fk_sms_credit_tx_user
    FOREIGN KEY (user_id) REFERENCES activeusers(id)
    ON DELETE CASCADE
);

-- 3) Individual SMS message log
CREATE TABLE IF NOT EXISTS sms_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'Atlas user who initiated the text',
  pipeline_id INT NULL COMMENT 'Optional pipeline recruit id this text is associated with',
  to_number VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  provider VARCHAR(64) NULL COMMENT 'e.g., textmagic, twilio',
  provider_message_id VARCHAR(255) NULL,
  status ENUM('queued', 'sent', 'failed') NOT NULL DEFAULT 'sent',
  error_message VARCHAR(255) NULL,
  cost_credits INT NOT NULL DEFAULT 1 COMMENT 'How many credits this message consumed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_messages_user (user_id),
  KEY idx_sms_messages_pipeline (pipeline_id),
  KEY idx_sms_messages_created_at (created_at),
  CONSTRAINT fk_sms_messages_user
    FOREIGN KEY (user_id) REFERENCES activeusers(id)
    ON DELETE CASCADE
);


