const { addDiscordTokenColumn } = require('../migrations/008_add_discord_token_to_activeusers');

async function run() {
  try {
    console.log('Adding discord_token column...');
    await addDiscordTokenColumn();
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

run(); 