require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');

// Import JS migrations
const { createDiscordTables } = require('./007_create_discord_tables');
const { addDiscordTokenToActiveusers } = require('./008_add_discord_token_to_activeusers');
const { addPipelineIdColumn } = require('./009_add_pipeline_id_to_activeusers');
const { addDiscordAvatarToUsers } = require('./018_add_discord_avatar_to_users');
const { addBotAddedToGuildConfigs } = require('./019_add_bot_added_to_guild_configs');
const { addNamesToDiscordReminders } = require('./020_add_names_to_discord_reminders');
const { updateDiscordLeaderboards } = require('./021_update_discord_leaderboards');
const { addCreatedByToLeaderboards } = require('./022_add_created_by_to_leaderboards');
const { addLeaderboardTypeColumn } = require('./023_add_leaderboard_type_column');
const { createDiscordSalesTable } = require('./024_create_discord_closes_table');
const { addWeekStartDayColumn } = require('./029_add_week_start_day_to_leaderboards');
const { createCareersCustomVideosTable } = require('./030_create_careers_custom_videos_table');

// Create a connection to the database
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true // Important for running multiple SQL statements
});

// Connect to the database
connection.connect(async err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
  
  try {
    // Run JS migrations
    await createDiscordTables();
    await addDiscordTokenToActiveusers();
    await addPipelineIdColumn();
    await addDiscordAvatarToUsers();
    await addBotAddedToGuildConfigs();
    await addNamesToDiscordReminders();
    await updateDiscordLeaderboards();
    await addCreatedByToLeaderboards();
    await addLeaderboardTypeColumn();
    await createDiscordSalesTable();
    await addWeekStartDayColumn();
    await createCareersCustomVideosTable();
    
    console.log('All JS migrations completed successfully');
    
    // Run SQL migrations
    const sqlMigrations = [
      'create_licensed_states_table.sql',
      'create_leads_released_table.sql',
      'add_notification_reads_table.sql',
      'notification_preferences.sql',
      'standardize_notification_reads.sql'
    ];
    
    for (const sqlFile of sqlMigrations) {
      const migrationFile = path.join(__dirname, sqlFile);
      
      try {
        const data = fs.readFileSync(migrationFile, 'utf8');
        
        await new Promise((resolve, reject) => {
          connection.query(data, (err, results) => {
            if (err) {
              console.error(`Error executing SQL migration ${sqlFile}:`, err);
              reject(err);
            } else {
              console.log(`SQL migration ${sqlFile} completed successfully`);
              resolve(results);
            }
          });
        });
      } catch (fileErr) {
        console.error(`Error reading SQL migration file ${sqlFile}:`, fileErr);
      }
    }
  } catch (migrationErr) {
    console.error('Error running migrations:', migrationErr);
  } finally {
    // Close the connection
    connection.end();
    console.log('Database connection closed');
  }
}); 