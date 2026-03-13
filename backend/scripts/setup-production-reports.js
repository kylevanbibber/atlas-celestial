const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function setupProductionReports() {
  try {
    console.log('Setting up production reports database tables...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/production_reports.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL content by semicolons to get individual statements
    const statements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await pool.query(statement);
      }
    }
    
    console.log('✅ Production reports database tables set up successfully!');
    
    // Verify tables were created
    const tables = await pool.query("SHOW TABLES LIKE '%file_categories%' OR SHOW TABLES LIKE '%onedrive_reports%'");
    console.log('Created tables:', tables);
    
  } catch (error) {
    console.error('❌ Error setting up production reports tables:', error);
  } finally {
    process.exit(0);
  }
}

setupProductionReports(); 