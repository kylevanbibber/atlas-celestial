/**
 * Migration script to create the verify and verify_client tables
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const db = require('../db');

// Define the sql file paths
const verifySqlPath = path.join(__dirname, '..', 'sql', 'verify.sql');
const verifyClientSqlPath = path.join(__dirname, '..', 'sql', 'verify_client.sql');

// Define the main migration function
async function migrate() {
  console.log('Starting verify tables migration...');
  
  try {
    // Read SQL from files
    const verifySql = fs.readFileSync(verifySqlPath, 'utf8');
    const verifyClientSql = fs.readFileSync(verifyClientSqlPath, 'utf8');
    
    // Create the verify table
    console.log('Creating verify table...');
    await db.query(verifySql);
    console.log('Verify table created or verified successfully.');
    
    // Create the verify_client table
    console.log('Creating verify_client table...');
    await db.query(verifyClientSql);
    console.log('Verify_client table created or verified successfully.');
    
    // Add migration record to migrations table (if it exists)
    try {
      await db.query(
        `INSERT IGNORE INTO migrations (name, applied_at) 
         VALUES (?, NOW())`,
        ['20250127_create_verify_tables']
      );
      console.log('Migration record added to migrations table.');
    } catch (err) {
      console.log('Note: migrations table not available. Skipping migration record.');
    }
    
    console.log('Verify tables migration completed successfully!');
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