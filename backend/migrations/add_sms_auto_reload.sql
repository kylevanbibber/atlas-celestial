-- Migration: Add SMS auto-reload functionality
-- Purpose: Allow users to automatically purchase SMS credits when balance is low
-- Date: 2025-11-19

-- Table to store user auto-reload preferences
CREATE TABLE IF NOT EXISTS sms_auto_reload_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether auto-reload is enabled',
  threshold INT NOT NULL DEFAULT 100 COMMENT 'Balance threshold to trigger reload',
  reload_amount INT NOT NULL DEFAULT 500 COMMENT 'Number of credits to purchase on reload',
  stripe_price_id VARCHAR(255) NULL COMMENT 'Stripe price ID for the reload package',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_auto_reload (user_id),
  CONSTRAINT fk_auto_reload_user
    FOREIGN KEY (user_id) REFERENCES activeusers(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for quick lookups
CREATE INDEX idx_auto_reload_enabled ON sms_auto_reload_settings(user_id, enabled);

