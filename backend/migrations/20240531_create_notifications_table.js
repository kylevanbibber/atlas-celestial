/**
 * Migration script to create the notifications table
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const db = require('../db');

// Define the sql file paths
const notificationsSqlPath = path.join(__dirname, '..', 'sql', 'notifications.sql');
const userGroupsSqlPath = path.join(__dirname, '..', 'sql', 'user_groups.sql');

// Define the main migration function
async function migrate() {
  console.log('Starting notifications migration...');
  
  try {
    // Read SQL from files
    const notificationsSql = fs.readFileSync(notificationsSqlPath, 'utf8');
    const userGroupsSql = fs.readFileSync(userGroupsSqlPath, 'utf8');
    
    // First create the user_groups table (needed for notifications foreign keys)
    console.log('Creating user_groups table...');
    await db.query(userGroupsSql);
    console.log('User groups table created or verified successfully.');
    
    // Then create the notifications table
    console.log('Creating notifications table...');
    await db.query(notificationsSql);
    console.log('Notifications table created or verified successfully.');
    
    // Add migration record to migrations table (if it exists)
    try {
      await db.query(
        `INSERT IGNORE INTO migrations (name, applied_at) 
         VALUES (?, NOW())`,
        ['20240531_create_notifications_tables']
      );
      console.log('Migration record added to migrations table.');
    } catch (err) {
      console.log('Note: migrations table not available. Skipping migration record.');
    }
    
    console.log('Notification system migration completed successfully!');
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