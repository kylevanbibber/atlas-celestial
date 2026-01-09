const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigration() {
  try {
    console.log('🚀 Running VIP Report Tiles Migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add_vip_report_tiles.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL content by semicolons to get individual statements
    const statements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => {
        // Filter out empty statements and comments
        return statement.length > 0 && 
               !statement.startsWith('--') && 
               !statement.startsWith('/*') &&
               statement !== '';
      });
    
    // Execute each statement
    console.log(`📝 Found ${statements.length} statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          console.log(`\n[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 80)}...`);
          const result = await pool.query(statement);
          
          // If this is a SELECT statement, log the results
          if (statement.toUpperCase().trim().startsWith('SELECT')) {
            console.log('   📊 Results:', Array.isArray(result[0]) ? result[0].length : 'N/A', 'rows');
            if (Array.isArray(result[0]) && result[0].length > 0) {
              console.log('   Sample:', JSON.stringify(result[0][0], null, 2));
            }
          } else {
            console.log('   ✅ Success');
          }
        } catch (error) {
          console.error(`   ❌ Error executing statement:`, error.message);
          // Continue with other statements even if one fails
        }
      }
    }
    
    console.log('\n✅ VIP Report Tiles Migration completed!');
    console.log('\n📋 Verifying inserted reports...');
    
    // Verify the reports were inserted
    const [reports] = await pool.query(`
      SELECT 
        id, 
        report_name, 
        component_name, 
        report_type, 
        is_active,
        sort_order
      FROM onedrive_reports 
      WHERE component_name IN (
        'PotentialVIPsReport', 
        'PendingUsersReport', 
        'CodesReport', 
        'SAGACodesReport', 
        'CodePotentialReport'
      )
      ORDER BY sort_order ASC
    `);
    
    console.log('\n📊 Inserted reports:');
    console.table(reports);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run the migration
runMigration();

