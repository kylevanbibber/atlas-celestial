const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({ host:'107.180.115.113', user:'kvanbibber', password:'Atlas2024!', database:'atlas' });
  const [rows] = await conn.query("SELECT state, instructions FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course' ORDER BY state");
  const missing = rows.filter(r => {
    const instr = r.instructions || '';
    return !instr.includes('XCEL') && !instr.includes('Enroll');
  });
  console.log(missing.length + ' states still missing XCEL/Enroll reference:');
  missing.slice(0, 10).forEach(r => {
    console.log('\n' + r.state + ':');
    console.log(r.instructions);
  });
  if (missing.length > 10) console.log('\n... and ' + (missing.length - 10) + ' more');
  await conn.end();
})();
