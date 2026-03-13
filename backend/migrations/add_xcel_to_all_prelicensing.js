const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({ host:'107.180.115.113', user:'kvanbibber', password:'Atlas2024!', database:'atlas' });

  const [rows] = await conn.query(
    "SELECT id, state, instructions FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course'"
  );

  let updated = 0;
  for (const row of rows) {
    let instr = row.instructions || '';
    
    // Skip if already has XCEL/Enroll reference
    if (instr.includes('XCEL') || instr.includes('Enroll')) continue;

    // Remove hardcoded "URL: https://..." lines (the url field handles this now)
    instr = instr.replace(/\n\nURL: https?:\/\/[^\s]+/g, '');
    instr = instr.replace(/\nURL: https?:\/\/[^\s]+/g, '');

    // Add XCEL enrollment line at the end
    const isOptional = instr.toLowerCase().includes('does not require') || 
                       instr.toLowerCase().includes('not require') ||
                       instr.toLowerCase().includes('eliminated');

    if (isOptional) {
      instr += '\n\nWhile not required, pre-licensing courses help you prepare for the state exam. Use the Enroll button above to register through XCEL Solutions with your team\'s partner code.';
    } else {
      instr += '\n\nUse the Enroll button above to register through XCEL Solutions with your team\'s partner code.';
    }

    await conn.query('UPDATE pipeline_state_requirements SET instructions = ? WHERE id = ?', [instr, row.id]);
    updated++;
  }

  console.log('Updated', updated, 'Pre-Licensing instructions to include XCEL reference');

  // Verify none are missing now
  const [check] = await conn.query(
    "SELECT COUNT(*) as total, SUM(instructions LIKE '%XCEL%' OR instructions LIKE '%Enroll%') as with_xcel FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course'"
  );
  console.log('Total:', check[0].total, '| With XCEL/Enroll:', check[0].with_xcel);

  // Show a few samples
  for (const st of ['FL', 'TX', 'NY', 'CA', 'OH']) {
    const [r] = await conn.query(
      "SELECT instructions FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course' AND state = ?", [st]
    );
    if (r.length > 0) {
      console.log('\n' + st + ':');
      console.log(r[0].instructions);
    }
  }

  await conn.end();
})();
