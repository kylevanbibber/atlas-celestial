// Migration to create discord_motivation_calls table
const db = require('../db');

async function createDiscordMotivationCallsTable() {
  try {
    console.log('Creating discord_motivation_calls table...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS discord_motivation_calls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        manager_id INT NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        guild_name VARCHAR(255) NOT NULL,
        voice_channel_id VARCHAR(255) NOT NULL,
        voice_channel_name VARCHAR(255) NOT NULL,
        cron_expr VARCHAR(100) NOT NULL,
        youtube_playlist_url TEXT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        volume DECIMAL(3,2) DEFAULT 1.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES activeusers(id) ON DELETE CASCADE,
        INDEX idx_guild_id (guild_id),
        INDEX idx_manager_id (manager_id),
        INDEX idx_is_active (is_active)
      )
    `);

    console.log('discord_motivation_calls table created successfully');

  } catch (error) {
    console.error('Error creating discord_motivation_calls table:', error);
    throw error;
  }
}

module.exports = { createDiscordMotivationCallsTable };
