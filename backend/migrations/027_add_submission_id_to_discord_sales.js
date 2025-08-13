const db = require('../db');

exports.up = async function() {
  console.log('Adding submission_id column to discord_sales table...');
  
  try {
    // Add submission_id column
    await db.query(`
      ALTER TABLE discord_sales 
      ADD COLUMN submission_id VARCHAR(255) NULL UNIQUE AFTER user_id
    `);
    console.log('✅ Added submission_id column to discord_sales table');
    
    // Add index for performance
    await db.query(`
      CREATE INDEX idx_discord_sales_submission_id ON discord_sales (submission_id)
    `);
    console.log('✅ Added index for submission_id column');
    
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⏭️  submission_id column already exists, skipping...');
    } else {
      throw error;
    }
  }
  
  console.log('✅ submission_id column migration completed');
};

exports.down = async function() {
  console.log('Removing submission_id column from discord_sales table...');
  
  try {
    // Drop index first
    await db.query('DROP INDEX idx_discord_sales_submission_id ON discord_sales');
    console.log('✅ Dropped submission_id index');
    
    // Drop column
    await db.query('ALTER TABLE discord_sales DROP COLUMN submission_id');
    console.log('✅ Dropped submission_id column');
    
  } catch (error) {
    if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
      console.log('⏭️  submission_id column doesn\'t exist, skipping...');
    } else {
      throw error;
    }
  }
  
  console.log('✅ submission_id column rollback completed');
}; 