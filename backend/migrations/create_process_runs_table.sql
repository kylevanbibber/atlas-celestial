-- Create process_runs table for tracking Python web processor executions
CREATE TABLE IF NOT EXISTS process_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  process_name VARCHAR(100) NOT NULL,
  processor VARCHAR(100),
  status ENUM('success', 'error', 'running') DEFAULT 'running',
  records_processed INT DEFAULT 0,
  error_message TEXT,
  email_subject VARCHAR(255),
  file_name VARCHAR(255),
  trigger_type ENUM('auto', 'manual', 'upload', 'cron') DEFAULT 'auto',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  INDEX idx_process_name (process_name),
  INDEX idx_started_at (started_at)
);
