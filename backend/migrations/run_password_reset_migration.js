// Migration runner for password reset codes table
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../db');

async function runPasswordResetMigration() {
  try {
    console.log('Starting password reset codes table migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create_password_reset_codes_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await query(sql);
    
    console.log('✅ Password reset codes table created successfully');
    
  } catch (error) {
    console.error('❌ Error running password reset migration:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runPasswordResetMigration()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runPasswordResetMigration };

