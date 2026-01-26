const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkTables() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Connected to database\n');
    
    // Check if sgas table exists
    const [sgasCheck] = await connection.query("SHOW TABLES LIKE 'sgas'");
    console.log('📋 sgas table:', sgasCheck.length > 0 ? '✅ EXISTS' : '❌ DOES NOT EXIST');
    
    // Check if sga_alternative_names table exists
    const [altCheck] = await connection.query("SHOW TABLES LIKE 'sga_alternative_names'");
    console.log('📋 sga_alternative_names table:', altCheck.length > 0 ? '✅ EXISTS' : '❌ DOES NOT EXIST');
    
    // Check if user_agencies table exists
    const [userAgenciesCheck] = await connection.query("SHOW TABLES LIKE 'user_agencies'");
    console.log('📋 user_agencies table:', userAgenciesCheck.length > 0 ? '✅ EXISTS' : '❌ DOES NOT EXIST');
    
    // Check if user_selected_agency table exists
    const [selectedCheck] = await connection.query("SHOW TABLES LIKE 'user_selected_agency'");
    console.log('📋 user_selected_agency table:', selectedCheck.length > 0 ? '✅ EXISTS' : '❌ DOES NOT EXIST');
    
    console.log('\n');
    
    if (sgasCheck.length > 0) {
      // Check SGAs
      const [sgas] = await connection.query('SELECT * FROM sgas');
      console.log(`📊 SGAs in database: ${sgas.length}`);
      sgas.forEach(sga => {
        console.log(`   - ${sga.rept_name} (${sga.display_name}) [Default: ${sga.is_default ? 'Yes' : 'No'}]`);
      });
      console.log('');
    }
    
    if (userAgenciesCheck.length > 0) {
      // Check user 92's agencies
      const [user92] = await connection.query(`
        SELECT ua.*, s.rept_name, s.display_name 
        FROM user_agencies ua 
        JOIN sgas s ON ua.sga_id = s.id 
        WHERE ua.user_id = 92
      `);
      console.log(`👤 User 92 has access to ${user92.length} agencies:`);
      user92.forEach(agency => {
        console.log(`   - ${agency.rept_name} (${agency.display_name}) [Primary: ${agency.is_primary ? 'Yes' : 'No'}]`);
      });
    } else {
      console.log('⚠️  Cannot check user 92 agencies - table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n⚠️  Tables do not exist. Please run the migration SQL file.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

checkTables();

