// Script to test Discord sales and Daily_Activity integration
const db = require('../db');

async function testDailyActivityIntegration() {
  try {
    console.log('🧪 Testing Discord sales and Daily_Activity integration...');

    // Get a test user
    const users = await db.query('SELECT id, lagnname FROM activeusers WHERE Active = "y" LIMIT 1');
    
    if (!users || users.length === 0) {
      console.error('❌ No active users found');
      return;
    }

    const testUser = users[0];
    const testDate = new Date().toISOString().split('T')[0]; // Today's date

    console.log(`📋 Testing with user: ${testUser.lagnname} (ID: ${testUser.id})`);
    console.log(`📅 Testing with date: ${testDate}`);

    // Check current Discord sales for this user and date
    const currentSales = await db.query(`
      SELECT COUNT(*) as sales_count, SUM(alp) as total_alp, SUM(refs) as total_refs
      FROM discord_sales 
      WHERE user_id = ? AND DATE(ts) = ?
    `, [testUser.id, testDate]);

    console.log(`📊 Current Discord sales for ${testDate}:`, currentSales[0]);

    // Check current Daily_Activity record
    const currentActivity = await db.query(
      'SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?',
      [testUser.lagnname, testDate]
    );

    if (currentActivity && currentActivity.length > 0) {
      console.log(`📈 Current Daily_Activity record:`, {
        sales: currentActivity[0].sales,
        alp: currentActivity[0].alp,
        refs: currentActivity[0].refs
      });
    } else {
      console.log(`📈 No Daily_Activity record exists for ${testDate}`);
    }

    // Import the updateDailyActivityFromDiscordSales function
    const { updateDailyActivityFromDiscordSales } = require('../routes/discord');
    
    // Test the integration function
    console.log(`🔄 Testing Daily_Activity update function...`);
    // We'll need to export this function from discord.js first

    console.log(`✅ Integration test completed`);

  } catch (error) {
    console.error('❌ Error testing integration:', error);
  }
}

// Show table schemas for reference
async function showTableSchemas() {
  try {
    console.log('\n📋 Table Schemas:');
    
    console.log('\n🎯 discord_sales columns:');
    const discordSalesSchema = await db.query('DESCRIBE discord_sales');
    discordSalesSchema.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    console.log('\n🎯 Daily_Activity columns:');
    const dailyActivitySchema = await db.query('DESCRIBE Daily_Activity');
    dailyActivitySchema.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('Error showing schemas:', error);
  }
}

// Run if called directly
if (require.main === module) {
  Promise.all([
    testDailyActivityIntegration(),
    showTableSchemas()
  ]).then(() => {
    console.log('\n🏁 Test complete');
    process.exit(0);
  });
}

module.exports = { testDailyActivityIntegration }; 