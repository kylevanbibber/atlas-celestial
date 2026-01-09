-- Migration: Add Stripe billing fields and tables
-- Purpose: Support SMS credit billing via Stripe, linked to activeusers.id
-- Date: 2025-11-18

-- 1) Add Stripe identifiers to activeusers for quick lookups
ALTER TABLE activeusers
ADD COLUMN stripe_customer_id VARCHAR(255) NULL COMMENT 'Stripe customer ID for this user',
ADD COLUMN stripe_default_payment_method_id VARCHAR(255) NULL COMMENT 'Stripe payment_method ID marked as default for charges';

-- 2) Store basic metadata for saved Stripe payment methods
CREATE TABLE IF NOT EXISTS stripe_payment_methods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  stripe_payment_method_id VARCHAR(255) NOT NULL,
  brand VARCHAR(50) NULL,
  last4 VARCHAR(4) NULL,
  exp_month INT NULL,
  exp_year INT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_stripe_payment_method (stripe_payment_method_id),
  KEY idx_spm_user (user_id),
  CONSTRAINT fk_spm_user
    FOREIGN KEY (user_id) REFERENCES activeusers(id)
    ON DELETE CASCADE
);


