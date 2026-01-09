-- Migration: Create agent_search_history table
-- Description: Tracks user search history for agent profiles
-- Author: System
-- Date: 2024

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS agent_search_history;

-- Create agent_search_history table
CREATE TABLE agent_search_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Who viewed the profile
  viewer_user_id INT NOT NULL,
  viewer_name VARCHAR(255),
  
  -- Which agent was viewed
  viewed_agent_id INT NOT NULL,
  viewed_agent_name VARCHAR(255),
  viewed_agent_clname VARCHAR(50),
  
  -- Search context
  search_query VARCHAR(255),
  search_source ENUM('global_search', 'direct_link', 'hierarchy', 'other') DEFAULT 'global_search',
  
  -- Timestamp
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_viewer_user (viewer_user_id, viewed_at DESC),
  INDEX idx_viewed_agent (viewed_agent_id, viewed_at DESC),
  INDEX idx_viewer_viewed (viewer_user_id, viewed_agent_id),
  INDEX idx_viewed_at (viewed_at DESC)
  
  -- Foreign key constraints (optional - uncomment if you want strict referential integrity)
  -- ,CONSTRAINT fk_viewer_user FOREIGN KEY (viewer_user_id) REFERENCES activeusers(id) ON DELETE CASCADE
  -- ,CONSTRAINT fk_viewed_agent FOREIGN KEY (viewed_agent_id) REFERENCES activeusers(id) ON DELETE CASCADE
  
  -- Track unique views per day (optional - uncomment to prevent duplicate entries in same day)
  -- ,UNIQUE KEY unique_daily_view (viewer_user_id, viewed_agent_id, DATE(viewed_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Create a summary view for frequently viewed agents by user
CREATE OR REPLACE VIEW agent_search_summary AS
SELECT 
  viewer_user_id,
  viewer_name,
  viewed_agent_id,
  viewed_agent_name,
  viewed_agent_clname,
  COUNT(*) as view_count,
  MAX(viewed_at) as last_viewed_at,
  MIN(viewed_at) as first_viewed_at
FROM agent_search_history
GROUP BY viewer_user_id, viewed_agent_id
ORDER BY view_count DESC;

-- Optional: Create a recent searches view
CREATE OR REPLACE VIEW recent_agent_searches AS
SELECT 
  ash.*
FROM agent_search_history ash
INNER JOIN (
  SELECT 
    viewer_user_id,
    viewed_agent_id,
    MAX(viewed_at) as max_viewed_at
  FROM agent_search_history
  GROUP BY viewer_user_id, viewed_agent_id
) latest ON ash.viewer_user_id = latest.viewer_user_id 
  AND ash.viewed_agent_id = latest.viewed_agent_id
  AND ash.viewed_at = latest.max_viewed_at
ORDER BY ash.viewed_at DESC;

-- Comments for documentation
ALTER TABLE agent_search_history 
  COMMENT = 'Tracks history of agent profile searches and views for recommendations and analytics';

