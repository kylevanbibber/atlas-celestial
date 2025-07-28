// Migration to add bot_added and is_primary columns to guild_configs table
// And update discord_reminders.is_active to BOOLEAN
const db = require('../db');

async function addBotAddedToGuildConfigs() {
  try {
    // Check if columns already exist
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'guild_configs' 
      AND COLUMN_NAME = 'bot_added'
    `);
    
    if (columns.length === 0) {
      // Add bot_added column
      await db.query(`
        ALTER TABLE guild_configs 
        ADD COLUMN bot_added BOOLEAN DEFAULT FALSE,
        ADD COLUMN is_primary BOOLEAN DEFAULT FALSE
      `);
      
      console.log('Added bot_added and is_primary columns to guild_configs table');
    } else {
      console.log('bot_added column already exists in guild_configs table');
    }

    // Check discord_reminders.is_active column type
    const [reminderColumns] = await db.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'discord_reminders' 
      AND COLUMN_NAME = 'is_active'
    `);
    
    if (reminderColumns.length > 0 && reminderColumns[0].DATA_TYPE.toLowerCase() !== 'tinyint') {
      // Update is_active column to BOOLEAN
      await db.query(`
        ALTER TABLE discord_reminders 
        MODIFY COLUMN is_active BOOLEAN DEFAULT TRUE
      `);
      
      console.log('Updated discord_reminders.is_active column to BOOLEAN type');
    }
  } catch (error) {
    console.error('Error updating database schema:', error);
    throw error;
  }
}

module.exports = { addBotAddedToGuildConfigs }; 