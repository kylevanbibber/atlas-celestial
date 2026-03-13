const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'107.180.115.113', user:'kvanbibber', password:'Atlas2024!', database:'atlas' });

  const [stats] = await conn.query(
    "SELECT COUNT(*) as total, SUM(instructions IS NOT NULL) as with_instructions, SUM(url IS NOT NULL) as with_url, COUNT(DISTINCT state) as states_covered FROM pipeline_state_requirements WHERE active = 1"
  );
  console.log('=== Final Summary ===');
  console.log('Total active rows:', stats[0].total);
  console.log('With instructions:', stats[0].with_instructions);
  console.log('With URL:', stats[0].with_url);
  console.log('States covered:', stats[0].states_covered);

  const [byItem] = await conn.query("SELECT target_item_name, COUNT(*) as cnt FROM pipeline_state_requirements WHERE active = 1 GROUP BY target_item_name ORDER BY cnt DESC");
  console.log('\nBy item:');
  byItem.forEach(r => console.log('  ' + r.target_item_name + ': ' + r.cnt + ' states'));

  for (const st of ['TX', 'FL', 'NY', 'CA', 'OH']) {
    const [rows] = await conn.query("SELECT target_item_name, action, LEFT(instructions, 100) as preview FROM pipeline_state_requirements WHERE active = 1 AND state = ? ORDER BY target_item_name", [st]);
    console.log('\n' + st + ':');
    rows.forEach(r => console.log('  ' + r.target_item_name + ' (' + r.action + '): ' + (r.preview || '').substring(0, 80) + '...'));
  }

  await conn.end();
})();
