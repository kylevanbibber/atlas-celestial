-- Migration: Create SMS templates table
-- Purpose: Allow users to create and manage reusable text message templates
-- Date: 2025-11-19

CREATE TABLE IF NOT EXISTS sms_templates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'User who created the template',
  name VARCHAR(100) NOT NULL COMMENT 'Template name/title',
  message TEXT NOT NULL COMMENT 'Template message content',
  is_shared TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = shared with team, 0 = personal only',
  category VARCHAR(50) NULL COMMENT 'Optional category (e.g., onboarding, follow-up, reminder)',
  usage_count INT NOT NULL DEFAULT 0 COMMENT 'Track how many times template was used',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_sms_templates_user (user_id),
  KEY idx_sms_templates_shared (is_shared),
  KEY idx_sms_templates_category (category),
  
  CONSTRAINT fk_sms_templates_user
    FOREIGN KEY (user_id) REFERENCES activeusers(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Reusable SMS message templates';

