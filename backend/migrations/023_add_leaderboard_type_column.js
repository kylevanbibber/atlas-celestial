// Migration to add leaderboard_type column to discord_leaderboards table
const db = require('../db');

async function addLeaderboardTypeColumn() {
  try {
    console.log('Adding leaderboard_type column to discord_leaderboards table...');
    
    // Check if column already exists
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'discord_leaderboards' 
      AND COLUMN_NAME = 'leaderboard_type'
    `);
    
    if (columns.length === 0) {
      // Add leaderboard_type column
      await db.query(`
        ALTER TABLE discord_leaderboards 
        ADD COLUMN leaderboard_type ENUM('activity', 'production') DEFAULT 'activity' AFTER metric_type
      `);
      
      console.log('Added leaderboard_type column to discord_leaderboards table');
      
      // Set existing records to 'activity' type
      await db.query(`
        UPDATE discord_leaderboards 
        SET leaderboard_type = 'activity'
        WHERE leaderboard_type IS NULL
      `);
      
      console.log('Updated existing leaderboard records to activity type');
    } else {
      console.log('leaderboard_type column already exists');
    }
  } catch (error) {
    console.error('Error adding leaderboard_type column:', error);
    throw error;
  }
}

module.exports = { addLeaderboardTypeColumn }; 