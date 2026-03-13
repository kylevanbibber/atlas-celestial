-- Do Not Contact (DNC) list for text campaigns
-- Tracks phone numbers that have opted out via STOP or other opt-out keywords
CREATE TABLE IF NOT EXISTS text_campaign_dnc (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_normalized VARCHAR(20) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'inbound_stop',
  campaign_id INT NULL,
  contact_id INT NULL,
  opted_out_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phone (phone_normalized),
  KEY idx_opted_out_at (opted_out_at)
);
