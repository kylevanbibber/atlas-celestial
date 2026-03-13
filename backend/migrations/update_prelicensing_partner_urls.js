const mysql = require('mysql2/promise');

const stateSlugMap = {
  'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas',
  'CA': 'california', 'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware',
  'DC': 'district-of-columbia', 'FL': 'florida', 'GA': 'georgia', 'HI': 'hawaii',
  'ID': 'idaho', 'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa',
  'KS': 'kansas', 'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine',
  'MD': 'maryland', 'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota',
  'MS': 'mississippi', 'MO': 'missouri', 'MT': 'montana', 'NE': 'nebraska',
  'NV': 'nevada', 'NH': 'new-hampshire', 'NJ': 'new-jersey', 'NM': 'new-mexico',
  'NY': 'new-york', 'NC': 'north-carolina', 'ND': 'north-dakota', 'OH': 'ohio',
  'OK': 'oklahoma', 'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode-island',
  'SC': 'south-carolina', 'SD': 'south-dakota', 'TN': 'tennessee', 'TX': 'texas',
  'UT': 'utah', 'VT': 'vermont', 'VA': 'virginia', 'WA': 'washington',
  'WV': 'west-virginia', 'WI': 'wisconsin', 'WY': 'wyoming'
};

(async () => {
  const conn = await mysql.createConnection({ host:'107.180.115.113', user:'kvanbibber', password:'Atlas2024!', database:'atlas' });

  const [rows] = await conn.query(
    "SELECT id, state FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course'"
  );

  let updated = 0;
  for (const row of rows) {
    const slug = stateSlugMap[row.state];
    if (!slug) { console.log('No slug for:', row.state); continue; }
    const newUrl = 'https://partners.xcelsolutions.com/' + slug + '/insurance-license/life-and-health';
    await conn.query('UPDATE pipeline_state_requirements SET url = ? WHERE id = ?', [newUrl, row.id]);
    updated++;
  }

  console.log('Updated', updated, 'URLs to partners.xcelsolutions.com');

  const [sample] = await conn.query(
    "SELECT state, url FROM pipeline_state_requirements WHERE active = 1 AND target_item_name = 'Pre-Licensing Course' AND state IN ('FL','TX','NY','OH') ORDER BY state"
  );
  sample.forEach(r => console.log(r.state + ': ' + r.url));

  await conn.end();
})();
