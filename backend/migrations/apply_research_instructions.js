const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const conn = await mysql.createConnection({ host:'107.180.115.113', user:'kvanbibber', password:'Atlas2024!', database:'atlas' });
  const research = JSON.parse(fs.readFileSync(__dirname + '/../data/state_licensing_requirements.json', 'utf8'));

  const itemMap = {
    'Background Check': 'Background Check Completed',
    'Pre-Licensing': 'Pre-Licensing Course',
    'Schedule Test': 'Schedule Licensing Test'
  };

  const [existing] = await conn.query('SELECT id, state, target_item_name, action FROM pipeline_state_requirements WHERE active = 1');
  const existingMap = {};
  existing.forEach(r => { existingMap[r.state + '::' + r.target_item_name] = r; });

  let updated = 0, created = 0, skipped = 0;

  for (const entry of research) {
    const targetItem = itemMap[entry.item];
    if (!targetItem) { skipped++; continue; }

    const key = entry.state + '::' + targetItem;
    const existingRow = existingMap[key];

    if (existingRow) {
      await conn.query(
        'UPDATE pipeline_state_requirements SET instructions = ?, override_description = ?, url = ? WHERE id = ?',
        [entry.instructions, entry.override_description, entry.url || null, existingRow.id]
      );
      if (entry.override_required !== undefined && entry.override_required !== null) {
        await conn.query('UPDATE pipeline_state_requirements SET override_required = ? WHERE id = ?', [entry.override_required, existingRow.id]);
      }
      updated++;
    } else {
      let action = 'modify';
      if (entry.instructions && entry.instructions.includes('does NOT require fingerprint')) action = 'not_required';

      await conn.query(
        'INSERT INTO pipeline_state_requirements (state, stage_name, target_item_name, action, instructions, override_description, override_required, url, item_type, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [entry.state, 'Licensing', targetItem, action, entry.instructions, entry.override_description,
         entry.override_required !== undefined ? entry.override_required : null, entry.url || null, 'checkbox']
      );
      created++;
    }
  }

  const [final] = await conn.query('SELECT COUNT(*) as cnt FROM pipeline_state_requirements WHERE active = 1');
  console.log('Updated: ' + updated + ', Created: ' + created + ', Skipped: ' + skipped);
  console.log('Total active rows now: ' + final[0].cnt);

  await conn.end();
})();
