// Migration to update discord_leaderboards table for flexible leaderboard system
const db = require('../db');

async function updateDiscordLeaderboards() {
  try {
    // Check if columns already exist
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'discord_leaderboards' 
      AND COLUMN_NAME = 'guild_name'
    `);
    
    if (columns.length === 0) {
      console.log('Updating discord_leaderboards table...');
      
      // Add new columns for flexible leaderboards
      await db.query(`
        ALTER TABLE discord_leaderboards 
        ADD COLUMN guild_name VARCHAR(255) AFTER guild_id,
        ADD COLUMN channel_name VARCHAR(255) AFTER channel_id,
        ADD COLUMN metrics JSON AFTER cron_expr,
        ADD COLUMN data_period ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily' AFTER metrics,
        ADD COLUMN scope ENUM('mga_team', 'family_tree', 'agency_tree', 'full_agency') DEFAULT 'mga_team' AFTER data_period
      `);
      
      console.log('Added new columns to discord_leaderboards table');
      
      // Update metric_type to allow more values
      await db.query(`
        ALTER TABLE discord_leaderboards 
        MODIFY COLUMN metric_type VARCHAR(100) DEFAULT 'activity_leaderboard'
      `);
      
      console.log('Updated metric_type column to be more flexible');
      
      // Update existing records by joining with guild_configs
      await db.query(`
        UPDATE discord_leaderboards l
        JOIN guild_configs g ON l.guild_id = g.guild_id AND l.channel_id = g.channel_id
        SET l.guild_name = g.guild_name, l.channel_name = g.channel_name
        WHERE l.guild_name IS NULL OR l.channel_name IS NULL
      `);
      
      console.log('Updated existing leaderboards with guild and channel names');
      
      // Set default values for existing records
      await db.query(`
        UPDATE discord_leaderboards 
        SET metrics = JSON_ARRAY('sales'),
            data_period = 'daily',
            scope = 'mga_team',
            metric_type = 'activity_leaderboard'
        WHERE metrics IS NULL
      `);
      
      console.log('Set default values for existing leaderboard records');
    } else {
      console.log('discord_leaderboards table already updated');
    }
  } catch (error) {
    console.error('Error updating discord_leaderboards table:', error);
    throw error;
  }
}

module.exports = { updateDiscordLeaderboards }; 