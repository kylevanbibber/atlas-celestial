CREATE TABLE IF NOT EXISTS allotment_issued (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  drop_date_id INT NOT NULL,
  lead_type ENUM('POS', 'HC', 'VN', 'Dcard') NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  UNIQUE KEY unique_agent_drop_type (agent_id, drop_date_id, lead_type),
  KEY idx_drop_date (drop_date_id),
  KEY idx_agent (agent_id)
);
