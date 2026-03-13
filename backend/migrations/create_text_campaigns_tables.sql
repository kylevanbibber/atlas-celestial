-- Text Campaigns Feature - Database Migration
-- Creates tables for SMS text campaign management

-- Campaign metadata
CREATE TABLE IF NOT EXISTS text_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  status ENUM('draft', 'sending', 'sent', 'failed') DEFAULT 'draft',
  total_contacts INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_by (created_by),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Imported contacts per campaign (columns match insurance CSV export)
CREATE TABLE IF NOT EXISTS text_campaign_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,

  -- CSV columns
  policy_number VARCHAR(50) DEFAULT NULL,
  policyholder_name VARCHAR(255) DEFAULT NULL,
  owner_name VARCHAR(255) DEFAULT NULL,
  primary_phone VARCHAR(30) DEFAULT NULL,
  phone_normalized VARCHAR(20) NOT NULL,
  secondary_phone VARCHAR(30) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  primary_agent VARCHAR(255) DEFAULT NULL,
  primary_agent_mga VARCHAR(255) DEFAULT NULL,
  policy_type VARCHAR(100) DEFAULT NULL,
  policy_status VARCHAR(100) DEFAULT NULL,
  import_date VARCHAR(50) DEFAULT NULL,
  inc_nto_date VARCHAR(50) DEFAULT NULL,
  bill_control_number VARCHAR(100) DEFAULT NULL,
  form_code VARCHAR(100) DEFAULT NULL,
  billing_mode VARCHAR(100) DEFAULT NULL,

  -- Campaign tracking
  campaign_status ENUM('pending', 'sent', 'failed', 'responded', 'closed') DEFAULT 'pending',
  last_message_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_campaign_id (campaign_id),
  INDEX idx_phone_normalized (phone_normalized),
  INDEX idx_campaign_status_filter (campaign_id, campaign_status),
  UNIQUE KEY uk_campaign_phone (campaign_id, phone_normalized),
  FOREIGN KEY (campaign_id) REFERENCES text_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Full conversation history (inbound + outbound messages)
CREATE TABLE IF NOT EXISTS text_campaign_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  contact_id INT NOT NULL,
  direction ENUM('outbound', 'inbound') NOT NULL,
  message TEXT NOT NULL,
  twilio_sid VARCHAR(64) DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  sent_by INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_id (contact_id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_contact_direction (contact_id, direction),
  FOREIGN KEY (campaign_id) REFERENCES text_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES text_campaign_contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
