-- Migration: Create user_navigation_history table
-- Description: Tracks user page visits and navigation for personalized recommendations
-- This table is used by the navigation.js routes for GlobalSearch recommendations
-- Author: System
-- Date: 2024

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS user_navigation_history;

-- Create user_navigation_history table
CREATE TABLE user_navigation_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- User visiting the page
  userId INT NOT NULL,
  
  -- Page path (e.g., /dashboard, /production?section=scorecard)
  path VARCHAR(500) NOT NULL,
  
  -- Friendly label for the page (e.g., "Dashboard", "Scorecard")
  label VARCHAR(255),
  
  -- How many times this page was visited
  visitCount INT DEFAULT 1,
  
  -- When it was last visited
  lastVisited TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- When first visited
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_user_path (userId, path(255)),
  INDEX idx_user_last_visited (userId, lastVisited DESC),
  INDEX idx_user_visit_count (userId, visitCount DESC),
  
  -- Unique constraint: one row per user per path
  UNIQUE KEY unique_user_path (userId, path(255))
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks user page visits for navigation history and personalized page recommendations';

