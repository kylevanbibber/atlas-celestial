const { pool } = require('../db');

async function migrateProductionReports() {
  try {
    console.log('🚀 Starting production reports migration...');
    
    // Check if frequency column already exists
    const tableInfo = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'onedrive_reports' 
      AND COLUMN_NAME = 'frequency'
    `);
    
    if (tableInfo.length === 0) {
      console.log('📝 Adding frequency column to onedrive_reports table...');
      
      // Add frequency column
      await pool.query(`
        ALTER TABLE onedrive_reports 
        ADD COLUMN frequency ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad-hoc') 
        DEFAULT 'ad-hoc' AFTER category_id
      `);
      
      // Add index for frequency
      await pool.query(`
        ALTER TABLE onedrive_reports 
        ADD INDEX idx_frequency (frequency)
      `);
      
      console.log('✅ Frequency column added successfully');
    } else {
      console.log('ℹ️  Frequency column already exists');
    }
    
    // Check if VIPs category exists
    const vipCategory = await pool.query(`
      SELECT id FROM file_categories WHERE name = 'VIPs'
    `);
    
    if (vipCategory.length === 0) {
      console.log('📝 Adding VIPs category...');
      
      await pool.query(`
        INSERT INTO file_categories (name, description, icon, color, sort_order) 
        VALUES ('VIPs', 'VIP client reports and analytics', 'FiUsers', '#dc2626', 0)
      `);
      
      console.log('✅ VIPs category added successfully');
    } else {
      console.log('ℹ️  VIPs category already exists');
    }
    
    // Update existing reports to have meaningful frequencies based on category names
    console.log('📝 Setting default frequencies for existing reports...');
    
    const updates = [
      { pattern: '%daily%', frequency: 'daily' },
      { pattern: '%weekly%', frequency: 'weekly' },
      { pattern: '%monthly%', frequency: 'monthly' },
      { pattern: '%quarterly%', frequency: 'quarterly' },
      { pattern: '%annual%', frequency: 'annual' }
    ];
    
    for (const update of updates) {
      const result = await pool.query(`
        UPDATE onedrive_reports r
        JOIN file_categories c ON r.category_id = c.id
        SET r.frequency = ?
        WHERE LOWER(c.name) LIKE LOWER(?) AND r.frequency = 'ad-hoc'
      `, [update.frequency, update.pattern]);
      
      if (result.affectedRows > 0) {
        console.log(`   Updated ${result.affectedRows} reports to ${update.frequency} frequency`);
      }
    }
    
    // Also update based on report names
    for (const update of updates) {
      const result = await pool.query(`
        UPDATE onedrive_reports 
        SET frequency = ?
        WHERE LOWER(report_name) LIKE LOWER(?) AND frequency = 'ad-hoc'
      `, [update.frequency, update.pattern]);
      
      if (result.affectedRows > 0) {
        console.log(`   Updated ${result.affectedRows} more reports to ${update.frequency} frequency based on report names`);
      }
    }
    
    // Verify the migration
    console.log('\n📊 Migration summary:');
    
    const categoryCounts = await pool.query(`
      SELECT c.name as category_name, r.frequency, COUNT(*) as count
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      GROUP BY c.name, r.frequency
      ORDER BY c.name, r.frequency
    `);
    
    console.table(categoryCounts);
    
    const totalReports = await pool.query(`
      SELECT COUNT(*) as total FROM onedrive_reports
    `);
    
    const frequencyBreakdown = await pool.query(`
      SELECT frequency, COUNT(*) as count
      FROM onedrive_reports
      GROUP BY frequency
      ORDER BY count DESC
    `);
    
    console.log(`\n📈 Total reports: ${totalReports[0].total}`);
    console.log('📈 Frequency breakdown:');
    console.table(frequencyBreakdown);
    
    console.log('\n✅ Production reports migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateProductionReports()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateProductionReports }; 