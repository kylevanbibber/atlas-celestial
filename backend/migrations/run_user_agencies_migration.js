const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Connected to database');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '20250122_add_user_agencies.sql');
    console.log(`📄 Reading migration file: ${sqlPath}`);
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🚀 Executing migration...');
    await connection.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Actions completed:');
    console.log('   - Added new SGA: SURACE-SMITH-PARTNERS');
    console.log('   - Created user_agencies table');
    console.log('   - Created user_selected_agency table');
    console.log('   - Gave user 92 access to both agencies');
    console.log('');
    console.log('👤 User 92 now has access to:');
    console.log('   1. ARIAS ORGANIZATION (primary)');
    console.log('   2. SURACE-SMITH-PARTNERS (secondary)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runMigration();

