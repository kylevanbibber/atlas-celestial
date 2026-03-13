// Script to insert test Discord sales data for testing the integration
const db = require('../db');

async function insertTestDiscordSalesData() {
  try {
    console.log('🧪 Inserting test Discord sales data...');

    // Get the first active user to use as test user
    const users = await db.query('SELECT id, lagnname FROM activeusers WHERE Active = "y" LIMIT 1');
    
    if (!users || users.length === 0) {
      console.error('❌ No active users found in database');
      return;
    }

    const testUser = users[0];
    console.log(`📋 Using test user: ${testUser.lagnname} (ID: ${testUser.id})`);

    // Create test data for the last 7 days
    const testData = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Create 1-3 sales per day
      const salesCount = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < salesCount; j++) {
        const timestamp = new Date(date);
        timestamp.setHours(9 + j * 2, Math.floor(Math.random() * 60), 0, 0);
        
        testData.push({
          discord_user: `test_discord_user_${testUser.id}`,
          guild_id: 'test_guild_123',
          alp: Math.floor(Math.random() * 2000) + 500, // $500-$2500
          refs: Math.floor(Math.random() * 5) + 1, // 1-5 refs
          lead_type: ['union', 'credit_union', 'association', 'pos', 'ref'][Math.floor(Math.random() * 5)],
          ts: timestamp.toISOString().slice(0, 19).replace('T', ' '), // MySQL DATETIME format
          user_id: testUser.id,
          image_url: Math.random() > 0.5 ? 'https://i.imgur.com/test123.jpg' : null
        });
      }
    }

    console.log(`📊 Generated ${testData.length} test sales records`);

    // Insert the test data
    for (const sale of testData) {
      await db.query(
        `INSERT INTO discord_sales (discord_user, guild_id, alp, refs, lead_type, ts, user_id, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sale.discord_user, sale.guild_id, sale.alp, sale.refs, sale.lead_type, sale.ts, sale.user_id, sale.image_url]
      );
    }

    console.log('✅ Test Discord sales data inserted successfully');

    // Show summary
    const summary = await db.query(
      `SELECT DATE(ts) as sale_date, COUNT(*) as sales_count, SUM(alp) as total_alp, SUM(refs) as total_refs
       FROM discord_sales 
       WHERE user_id = ?
       GROUP BY DATE(ts)
       ORDER BY sale_date DESC`,
      [testUser.id]
    );

    console.log('📈 Test data summary by date:');
    summary.forEach(row => {
      console.log(`  ${row.sale_date}: ${row.sales_count} sales, $${row.total_alp} ALP, ${row.total_refs} refs`);
    });

  } catch (error) {
    console.error('❌ Error inserting test data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  insertTestDiscordSalesData().then(() => {
    console.log('🏁 Test data insertion complete');
    process.exit(0);
  });
}

module.exports = { insertTestDiscordSalesData }; 