-- Text Campaign Follow-Up Messages
-- Adds support for automated follow-up texts to contacts who haven't responded or closed

-- New table: stores follow-up step definitions per campaign
CREATE TABLE IF NOT EXISTS text_campaign_follow_ups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  step_number INT NOT NULL,
  message TEXT NOT NULL,
  delay_value INT NOT NULL,
  delay_unit ENUM('hours', 'days') NOT NULL DEFAULT 'hours',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_step (campaign_id, step_number),
  KEY idx_campaign_id (campaign_id)
);

-- Track follow-up progress per contact
ALTER TABLE text_campaign_contacts
  ADD COLUMN follow_ups_sent INT NOT NULL DEFAULT 0,
  ADD COLUMN last_outbound_at DATETIME NULL;

-- Tag messages with which follow-up step sent them
ALTER TABLE text_campaign_messages
  ADD COLUMN follow_up_step INT NULL DEFAULT NULL;
