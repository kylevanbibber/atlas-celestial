// Script to test Discord sales update and Daily_Activity integration
const db = require('../db');

async function testDiscordSalesUpdate() {
  try {
    console.log('🧪 Testing Discord sales update and Daily_Activity integration...');

    // Get the test user (COLEMAN CHARLES)
    const testUserId = 21;
    const testDate = '2025-07-28'; // Date with existing test data

    console.log(`📋 Testing with user ID: ${testUserId}`);
    console.log(`📅 Testing with date: ${testDate}`);

    // Get current Discord sales for this user and date
    const currentSales = await db.query(`
      SELECT id, alp, refs, lead_type, ts
      FROM discord_sales 
      WHERE user_id = ? AND DATE(ts) = ?
      ORDER BY ts DESC
    `, [testUserId, testDate]);

    console.log(`📊 Current Discord sales for ${testDate}:`, currentSales.length);
    
    if (currentSales.length > 0) {
      const firstSale = currentSales[0];
      console.log(`🎯 First sale:`, {
        id: firstSale.id,
        alp: firstSale.alp,
        refs: firstSale.refs,
        lead_type: firstSale.lead_type
      });

      // Get current Daily_Activity totals before update
      const beforeActivity = await db.query(
        'SELECT sales, alp, refs FROM Daily_Activity WHERE agent = "COLEMAN CHARLES" AND reportDate = ?',
        [testDate]
      );

      console.log(`📈 Daily_Activity BEFORE update:`, beforeActivity[0] || 'No record');

      // Import and test the update function
      const { updateDailyActivityFromDiscordSales } = require('../routes/discord');
      
      // Test updating the first sale
      const newAlp = parseFloat(firstSale.alp) + 100; // Add $100
      const newRefs = parseInt(firstSale.refs) + 1;    // Add 1 ref

      console.log(`🔄 Simulating sale update: ALP ${firstSale.alp} → ${newAlp}, Refs ${firstSale.refs} → ${newRefs}`);

      // Update the sale in database
      await db.query(
        'UPDATE discord_sales SET alp = ?, refs = ? WHERE id = ?',
        [newAlp, newRefs, firstSale.id]
      );

      // Trigger Daily_Activity update
      await updateDailyActivityFromDiscordSales(testUserId, testDate);

      // Get Daily_Activity totals after update
      const afterActivity = await db.query(
        'SELECT sales, alp, refs FROM Daily_Activity WHERE agent = "COLEMAN CHARLES" AND reportDate = ?',
        [testDate]
      );

      console.log(`📈 Daily_Activity AFTER update:`, afterActivity[0] || 'No record');

      // Verify the change
      if (afterActivity[0]) {
        const alpDiff = parseFloat(afterActivity[0].alp) - (beforeActivity[0] ? parseFloat(beforeActivity[0].alp) : 0);
        const refsDiff = parseInt(afterActivity[0].refs) - (beforeActivity[0] ? parseInt(beforeActivity[0].refs) : 0);
        
        console.log(`✅ Changes detected: ALP +${alpDiff}, Refs +${refsDiff}`);
      }

      // Restore original values
      await db.query(
        'UPDATE discord_sales SET alp = ?, refs = ? WHERE id = ?',
        [firstSale.alp, firstSale.refs, firstSale.id]
      );
      console.log(`🔄 Restored original sale values`);

      // Update Daily_Activity back to original
      await updateDailyActivityFromDiscordSales(testUserId, testDate);
      console.log(`🔄 Restored Daily_Activity totals`);

    } else {
      console.log(`❌ No Discord sales found for testing`);
    }

    console.log(`✅ Test completed`);

  } catch (error) {
    console.error('❌ Error testing Discord sales update:', error);
  }
}

// Show current state
async function showCurrentState() {
  try {
    const testUserId = 21;
    const testDate = '2025-07-28';

    console.log('\n📊 Current State:');

    // Discord sales
    const sales = await db.query(`
      SELECT COUNT(*) as count, SUM(alp) as total_alp, SUM(refs) as total_refs
      FROM discord_sales 
      WHERE user_id = ? AND DATE(ts) = ?
    `, [testUserId, testDate]);

    console.log(`🎯 Discord Sales (${testDate}):`, sales[0]);

    // Daily_Activity
    const activity = await db.query(
      'SELECT sales, alp, refs FROM Daily_Activity WHERE agent = "COLEMAN CHARLES" AND reportDate = ?',
      [testDate]
    );

    console.log(`📈 Daily_Activity (${testDate}):`, activity[0] || 'No record');

  } catch (error) {
    console.error('Error showing current state:', error);
  }
}

// Run if called directly
if (require.main === module) {
  Promise.all([
    showCurrentState(),
    testDiscordSalesUpdate()
  ]).then(() => {
    console.log('\n🏁 Test complete');
    process.exit(0);
  });
}

module.exports = { testDiscordSalesUpdate }; 