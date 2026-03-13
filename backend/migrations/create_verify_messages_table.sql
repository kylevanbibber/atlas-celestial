CREATE TABLE IF NOT EXISTS verify_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  direction ENUM('outbound', 'inbound') NOT NULL,
  message TEXT NOT NULL,
  twilio_sid VARCHAR(64) DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  sent_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vm_app_id (application_id),
  INDEX idx_vm_phone (phone_number)
);
