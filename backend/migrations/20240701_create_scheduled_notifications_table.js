/**
 * Migration script to create the scheduled_notifications table
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const db = require('../db');

// Define the sql file paths
const scheduledNotificationsSqlPath = path.join(__dirname, '..', 'sql', 'scheduled_notifications.sql');

// Define the main migration function
async function migrate() {
  console.log('Starting scheduled notifications migration...');
  
  try {
    // Read SQL from file
    const scheduledNotificationsSql = fs.readFileSync(scheduledNotificationsSqlPath, 'utf8');
    
    // Create the scheduled_notifications table
    console.log('Creating scheduled_notifications table...');
    await db.query(scheduledNotificationsSql);
    console.log('Scheduled notifications table created successfully.');
    
    // Add migration record to migrations table (if it exists)
    try {
      await db.query(
        `INSERT IGNORE INTO migrations (name, applied_at) 
         VALUES (?, NOW())`,
        ['20240701_create_scheduled_notifications_table']
      );
      console.log('Migration record added to migrations table.');
    } catch (err) {
      console.log('Note: migrations table not available. Skipping migration record.');
    }
    
    console.log('Scheduled notifications migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
    throw err;
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrate }; 