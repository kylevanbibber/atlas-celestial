const db = require('../db');

async function createCareersCustomVideosTable() {
  try {
    console.log('Creating careers_custom_videos table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS careers_custom_videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        manager_id INT NOT NULL COMMENT 'activeusers.id of the manager who set the video',
        manager_lagnname VARCHAR(255) NOT NULL COMMENT 'lagnname of manager',
        manager_clname VARCHAR(50) NOT NULL COMMENT 'clname of manager (RGA, MGA, GA)',
        target_mga VARCHAR(255) NULL COMMENT 'If set, video applies only to this MGA team. NULL = all teams',
        video_url TEXT NOT NULL COMMENT 'YouTube or Vimeo video URL',
        video_type ENUM('youtube', 'vimeo') NOT NULL DEFAULT 'youtube',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_manager_id (manager_id),
        INDEX idx_manager_lagnname (manager_lagnname),
        INDEX idx_target_mga (target_mga),
        INDEX idx_active (is_active),
        UNIQUE KEY unique_manager_target (manager_id, target_mga)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Successfully created careers_custom_videos table');
  } catch (error) {
    console.error('Error creating careers_custom_videos table:', error);
    throw error;
  }
}

module.exports = { createCareersCustomVideosTable };

