// Migration to add created_by column to discord_leaderboards table
const db = require('../db');

async function addCreatedByToLeaderboards() {
  try {
    // Check if column already exists
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'discord_leaderboards' 
      AND COLUMN_NAME = 'created_by'
    `);
    
    if (columns.length === 0) {
      console.log('Adding created_by column to discord_leaderboards table...');
      
      // Add created_by column
      await db.query(`
        ALTER TABLE discord_leaderboards 
        ADD COLUMN created_by INT NOT NULL AFTER manager_id,
        ADD FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE
      `);
      
      console.log('Added created_by column to discord_leaderboards table');
      
      // Update existing records to set created_by = manager_id
      await db.query(`
        UPDATE discord_leaderboards 
        SET created_by = manager_id 
        WHERE created_by IS NULL OR created_by = 0
      `);
      
      console.log('Updated existing leaderboard records with created_by values');
    } else {
      console.log('created_by column already exists in discord_leaderboards table');
    }
  } catch (error) {
    console.error('Error adding created_by column to discord_leaderboards table:', error);
    throw error;
  }
}

module.exports = { addCreatedByToLeaderboards }; 