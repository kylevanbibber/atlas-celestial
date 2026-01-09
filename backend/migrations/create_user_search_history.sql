-- Migration: Create user_search_history table
-- Description: Tracks general search queries in GlobalSearch for personalized recommendations
-- This is different from agent_search_history which tracks agent profile views
-- Author: System
-- Date: 2024

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS user_search_history;

-- Create user_search_history table
CREATE TABLE user_search_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- User performing the search
  userId INT NOT NULL,
  
  -- Search query text
  query VARCHAR(255) NOT NULL,
  
  -- How many times this query was searched
  searchCount INT DEFAULT 1,
  
  -- When it was last searched
  lastSearched TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- When first searched
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_user_query (userId, query),
  INDEX idx_user_last_searched (userId, lastSearched DESC),
  
  -- Unique constraint: one row per user per query
  UNIQUE KEY unique_user_query (userId, query)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks search queries in GlobalSearch for search history and recommendations';

