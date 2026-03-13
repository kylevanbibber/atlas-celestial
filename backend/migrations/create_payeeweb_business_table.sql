-- PayeeWeb business tracking table
-- Stores rows from 3 tables on the Weekly Submit Report:
--   released = Released from Hold Queue
--   hold     = Business in Hold Queue
--   immediate = Immediate Release
-- One row per policy per queue. Daily runs update existing rows.
-- report_date reflects the most recent report the policy appeared on.

CREATE TABLE IF NOT EXISTS payeeweb_business (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_number VARCHAR(50) NOT NULL,
  queue_type ENUM('hold', 'released', 'immediate') NOT NULL,
  agent_name VARCHAR(200),
  agent_id VARCHAR(50),
  app_type VARCHAR(50),
  insured_name VARCHAR(200),
  submit_date VARCHAR(50),
  production_date VARCHAR(50),
  line_of_business VARCHAR(100),
  annualized_premium DECIMAL(12,2) DEFAULT 0,
  notify_trailer VARCHAR(200),
  raw_row JSON,
  report_date DATE NOT NULL,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_policy_queue (policy_number, queue_type),
  INDEX idx_policy (policy_number),
  INDEX idx_queue_type (queue_type),
  INDEX idx_report_date (report_date)
);
