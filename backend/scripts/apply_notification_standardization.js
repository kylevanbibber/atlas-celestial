const db = require('../db');

async function standardizeNotifications() {
  try {
    console.log('🚀 Starting notification standardization...');
    
    // Step 1: Check if columns still exist
    console.log('📋 Checking current table structure...');
    const tableInfo = await db.query("DESCRIBE notifications");
    const hasIsRead = tableInfo.some(col => col.Field === 'is_read');
    const hasIsDismissed = tableInfo.some(col => col.Field === 'is_dismissed');
    
    if (!hasIsRead && !hasIsDismissed) {
      console.log('✅ Notification table already standardized!');
      return;
    }
    
    console.log(`📊 Found columns: is_read: ${hasIsRead}, is_dismissed: ${hasIsDismissed}`);
    
    // Step 2: Migrate existing read/dismissed states to notification_reads table
    console.log('📤 Migrating existing read/dismissed states...');
    
    const migrateQuery = `
      INSERT IGNORE INTO notification_reads (notification_id, user_id, is_read, is_dismissed, created_at)
      SELECT 
          id as notification_id,
          user_id,
          COALESCE(is_read, 0) as is_read,
          COALESCE(is_dismissed, 0) as is_dismissed,
          NOW() as created_at
      FROM notifications 
      WHERE user_id IS NOT NULL 
      AND (is_read = 1 OR is_dismissed = 1)
    `;
    
    const migrateResult = await db.query(migrateQuery);
    console.log(`✅ Migrated ${migrateResult.affectedRows || 0} read/dismissed records`);
    
    // Step 3: Remove the columns
    if (hasIsRead) {
      console.log('🗑️ Removing is_read column...');
      await db.query('ALTER TABLE notifications DROP COLUMN is_read');
      console.log('✅ Removed is_read column');
    }
    
    if (hasIsDismissed) {
      console.log('🗑️ Removing is_dismissed column...');
      await db.query('ALTER TABLE notifications DROP COLUMN is_dismissed');
      console.log('✅ Removed is_dismissed column');
    }
    
    // Step 4: Add table comment
    console.log('📝 Adding table comment...');
    await db.query("ALTER TABLE notifications COMMENT = 'Core notification data - read/dismiss status tracked in notification_reads table'");
    
    console.log('🎉 Notification standardization completed successfully!');
    console.log('📋 Summary:');
    console.log('   - All read/dismissed states now tracked in notification_reads table');
    console.log('   - Notifications table simplified and standardized');
    console.log('   - Backend code updated to use consistent approach');
    
  } catch (error) {
    console.error('❌ Error during notification standardization:', error);
    throw error;
  }
}

// Auto-run if called directly
if (require.main === module) {
  standardizeNotifications()
    .then(() => {
      console.log('✅ Standardization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Standardization failed:', error);
      process.exit(1);
    });
}

module.exports = { standardizeNotifications }; 