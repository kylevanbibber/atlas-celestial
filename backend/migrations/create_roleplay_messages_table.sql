-- Migration: Create roleplay messages table for chat-based roleplay training
-- This table stores individual messages in roleplay sessions

-- Create roleplay_messages table for chat-based conversation tracking
CREATE TABLE IF NOT EXISTS roleplay_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  role ENUM('user', 'ai', 'system') NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (session_id) REFERENCES roleplay_sessions(id) ON DELETE CASCADE
);

-- Add goal_text column to roleplay_scripts if it doesn't exist
ALTER TABLE roleplay_scripts 
ADD COLUMN IF NOT EXISTS goal_text TEXT AFTER script_text;

-- Add user_id to roleplay_scripts for user-owned scripts (nullable for global scripts)
ALTER TABLE roleplay_scripts 
ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL AFTER id;

-- Add outcome and score JSON columns to sessions if not present
ALTER TABLE roleplay_sessions 
ADD COLUMN IF NOT EXISTS outcome_json JSON DEFAULT NULL;

ALTER TABLE roleplay_sessions 
ADD COLUMN IF NOT EXISTS score_json JSON DEFAULT NULL;

-- Update sessions table status enum to include new values
ALTER TABLE roleplay_sessions 
MODIFY COLUMN status VARCHAR(50) DEFAULT 'active' COMMENT 'active, completed, ended, abandoned';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roleplay_scripts_user_id ON roleplay_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_roleplay_sessions_status ON roleplay_sessions(status);

