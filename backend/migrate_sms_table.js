// Script to add missing columns to sms_messages table
const mysql = require('mysql');

// Get database config from environment
const dbConfig = {
  host: process.env.DB_HOST || '107.180.115.113',
  user: process.env.DB_USER || 'kvanbibber',
  password: process.env.DB_PASS || 'Atlas2024!',
  database: process.env.DB_NAME || 'atlas',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('❌ Error acquiring connection:', err.code);
        return reject(err);
      }
      
      connection.query(sql, params, (error, results) => {
        connection.release();
        
        if (error) {
          console.error('❌ Query error:', error.code);
          return reject(error);
        }
        
        resolve(results);
      });
    });
  });
}

async function migrate() {
  try {
    console.log('🔍 Checking sms_messages table structure...');
    
    // Check if from_number column exists
    const fromNumberCheck = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'sms_messages' 
      AND COLUMN_NAME = 'from_number'
    `, [dbConfig.database]);
    
    if (!fromNumberCheck || fromNumberCheck.length === 0) {
      console.log('➕ Adding from_number column...');
      await query(`
        ALTER TABLE sms_messages 
        ADD COLUMN from_number VARCHAR(20) DEFAULT NULL 
        AFTER to_number
      `);
      console.log('✅ Added from_number column');
    } else {
      console.log('✅ from_number column already exists');
    }
    
    // Check if direction column exists
    const directionCheck = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'sms_messages' 
      AND COLUMN_NAME = 'direction'
    `, [dbConfig.database]);
    
    if (!directionCheck || directionCheck.length === 0) {
      console.log('➕ Adding direction column...');
      await query(`
        ALTER TABLE sms_messages 
        ADD COLUMN direction VARCHAR(20) DEFAULT 'outbound' 
        AFTER status
      `);
      console.log('✅ Added direction column');
    } else {
      console.log('✅ direction column already exists');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    pool.end();
    process.exit(1);
  }
}

migrate();

