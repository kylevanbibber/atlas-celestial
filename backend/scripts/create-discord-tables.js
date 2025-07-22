const { createDiscordTables } = require('../migrations/007_create_discord_tables');
const db = require('../db');

async function runMigration() {
  try {
    console.log('Creating Discord tables...');
    await createDiscordTables();
    console.log('Discord tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating Discord tables:', error);
    process.exit(1);
  }
}

runMigration(); 