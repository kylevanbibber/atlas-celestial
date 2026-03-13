const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({ host:'107.180.115.113', user:'kvanbibber', password:'Atlas2024!', database:'atlas' });

  const [rows] = await conn.query(
    "SELECT id, state, instructions FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course'"
  );

  let updated = 0;
  for (const row of rows) {
    let instr = row.instructions || '';

    // Replace provider references with XCEL + Enroll button mention
    instr = instr.replace(
      /Popular providers include ExamFX, Kaplan, and AD Banker\./gi,
      'Use the Enroll button above to register through XCEL Solutions with your team\'s partner code.'
    );

    // Also catch variations
    instr = instr.replace(
      /Study materials and exam prep courses are available from providers like ExamFX, Kaplan, and AD Banker\./gi,
      'Study materials and exam prep courses are available through XCEL Solutions. Use the Enroll button above to register with your team\'s partner code.'
    );

    // Replace any remaining "ExamFX, Kaplan, and AD Banker" references
    instr = instr.replace(
      /ExamFX, Kaplan, and AD Banker/gi,
      'XCEL Solutions'
    );

    if (instr !== row.instructions) {
      await conn.query('UPDATE pipeline_state_requirements SET instructions = ? WHERE id = ?', [instr, row.id]);
      updated++;
    }
  }

  console.log('Updated', updated, 'of', rows.length, 'Pre-Licensing instructions');

  // Verify a few
  const [sample] = await conn.query(
    "SELECT state, instructions FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course' AND state IN ('AL','AZ','FL','NY','TX') ORDER BY state"
  );
  sample.forEach(r => {
    console.log('\n' + r.state + ':');
    console.log(r.instructions);
  });

  await conn.end();
})();
