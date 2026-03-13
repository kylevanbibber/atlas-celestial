-- Email Communications Log
-- Tracks all outbound emails sent from the system (reminders, reports, campaigns, verification)

-- Batches group emails from a single operation (e.g. one daily reminder run)
CREATE TABLE IF NOT EXISTS email_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  total_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  INDEX idx_eb_source (source),
  INDEX idx_eb_started (started_at)
);

-- Individual email send records
CREATE TABLE IF NOT EXISTS email_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT DEFAULT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255) DEFAULT NULL,
  subject VARCHAR(255) NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  status ENUM('sent', 'failed') DEFAULT 'sent',
  error_message TEXT DEFAULT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_el_batch (batch_id),
  INDEX idx_el_sent (sent_at),
  INDEX idx_el_source (source),
  FOREIGN KEY (batch_id) REFERENCES email_batches(id) ON DELETE SET NULL
);
