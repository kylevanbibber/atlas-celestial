/**
 * Migration script to create the recruits table
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const db = require('../db');

// Define the sql file path
const recruitsSqlPath = path.join(__dirname, '..', 'sql', 'recruits.sql');

// Define the main migration function
async function migrate() {
  console.log('Starting recruits migration...');
  
  try {
    // Read SQL from file
    const recruitsSql = fs.readFileSync(recruitsSqlPath, 'utf8');
    
    // Create the recruits table
    console.log('Creating recruits table...');
    await db.query(recruitsSql);
    console.log('Recruits table created or verified successfully.');
    
    // Add migration record to migrations table (if it exists)
    try {
      await db.query(
        `INSERT IGNORE INTO migrations (name, applied_at) 
         VALUES (?, NOW())`,
        ['20250130_create_recruits_table']
      );
      console.log('Migration record added to migrations table.');
    } catch (err) {
      console.log('Note: migrations table not available. Skipping migration record.');
    }
    
    console.log('Recruits table migration completed successfully!');
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