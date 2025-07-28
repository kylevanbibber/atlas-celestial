// Migration to add guild_name and channel_name columns to discord_reminders
const db = require('../db');

async function addNamesToDiscordReminders() {
  try {
    // Check if columns already exist
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'discord_reminders' 
      AND COLUMN_NAME = 'guild_name'
    `);
    
    if (columns.length === 0) {
      // Add guild_name and channel_name columns to discord_reminders
      await db.query(`
        ALTER TABLE discord_reminders 
        ADD COLUMN guild_name VARCHAR(255) AFTER guild_id,
        ADD COLUMN channel_name VARCHAR(255) AFTER channel_id
      `);
      
      console.log('Added guild_name and channel_name columns to discord_reminders table');
      
      // Update existing records by joining with guild_configs
      await db.query(`
        UPDATE discord_reminders r
        JOIN guild_configs g ON r.guild_id = g.guild_id AND r.channel_id = g.channel_id
        SET r.guild_name = g.guild_name, r.channel_name = g.channel_name
        WHERE r.guild_name IS NULL OR r.channel_name IS NULL
      `);
      
      console.log('Updated existing reminders with guild and channel names');
    } else {
      console.log('guild_name column already exists in discord_reminders table');
    }
  } catch (error) {
    console.error('Error adding columns to discord_reminders:', error);
    throw error;
  }
}

module.exports = { addNamesToDiscordReminders }; 