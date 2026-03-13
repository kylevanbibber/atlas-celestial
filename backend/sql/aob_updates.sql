-- AOBUpdates table for tracking Application Processing Status from AIL Portal
-- This table stores historical snapshots of agent appointment processing status
-- Each export creates new rows to track changes over time

CREATE TABLE IF NOT EXISTS AOBUpdates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ImportDate VARCHAR(50),
  STPROV VARCHAR(10),
  Agent VARCHAR(255),
  AgentNumber VARCHAR(50),
  SGAName VARCHAR(255),
  ApplicantPhoneNumber VARCHAR(50),
  EmailAddress VARCHAR(255),
  MGA VARCHAR(255),
  Company VARCHAR(100),
  WFStatus VARCHAR(50),
  WFStep VARCHAR(50),
  StepStatus VARCHAR(50),
  LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
  rowcolor VARCHAR(50) DEFAULT NULL,
  INDEX idx_agent_number (AgentNumber),
  INDEX idx_last_updated (LastUpdated),
  INDEX idx_wf_status (WFStatus),
  INDEX idx_step_status (StepStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


