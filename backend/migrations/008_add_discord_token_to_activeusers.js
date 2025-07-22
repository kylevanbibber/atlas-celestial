const db = require('../db');

async function addDiscordTokenColumn() {
  try {
    await db.query(
      `ALTER TABLE activeusers 
         ADD COLUMN IF NOT EXISTS discord_token VARCHAR(512) NULL`
    );
    console.log('Added discord_token column to activeusers');
  } catch (error) {
    console.error('Error adding discord_token column:', error);
    throw error;
  }
}

module.exports = { addDiscordTokenColumn }; 