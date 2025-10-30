const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || '208.109.78.44',
  user: process.env.DB_USER || 'kvanbibber',
  password: process.env.DB_PASS || 'Atlas2024!',
  database: process.env.DB_NAME || 'AriasLifeUsers',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Database: ${dbConfig.database}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'create_email_campaigns_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('\n📄 Running migration: create_email_campaigns_tables.sql');
    
    // Execute the SQL
    await connection.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nTables created:');
    console.log('  - email_templates');
    console.log('  - email_campaigns');
    console.log('  - email_recipients');
    console.log('  - email_variables (with default variables seeded)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the migration
runMigration();

