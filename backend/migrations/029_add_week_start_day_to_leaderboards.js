const db = require('../db');

async function addWeekStartDayColumn() {
  try {
    console.log('Adding week_start_day column to discord_leaderboards...');
    
    await db.query(`
      ALTER TABLE discord_leaderboards
      ADD COLUMN IF NOT EXISTS week_start_day VARCHAR(10) DEFAULT 'monday' AFTER data_period
    `);
    
    console.log('✅ Successfully added week_start_day column');
  } catch (error) {
    console.error('Error adding week_start_day column:', error);
    throw error;
  }
}

module.exports = { addWeekStartDayColumn };

