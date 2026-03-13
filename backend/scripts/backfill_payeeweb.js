/**
 * Backfill script: Download PayeeWeb weekly reports for the last N weeks.
 * Authenticates once, then loops through each week's report URL.
 *
 * Usage: NODE_ENV=development node scripts/backfill_payeeweb.js
 */
process.env.NODE_ENV = 'development';
process.env.PAYEEWEB_USERNAME = 'kylevanbib@gmail.com';
process.env.PAYEEWEB_PASSWORD = 'Atlas2025!';

const { launchBrowser } = require('../utils/browserLauncher');
const { query } = require('../db');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://peaceful-badlands-42414-7b2e5f9acb76.herokuapp.com';
const REWATCH_TOKEN = process.env.REWATCH_TOKEN;

const REPORT_ID_CURRENT = 46;
const REPORT_ID_ARCHIVE = 189;
const CURRENT_USER = 'DIR_00112_KV';
const AGENT_PARAM = 'ARIAS SIMON A (SGA-RGA) (70806)';
const SGA_PARAM = 'ARIAS-DIULUS-ADAMS';

// Map section header text to queue types
const SECTION_MAP = {
  'Released from Hold Queue': 'released',
  'Business in Hold Queue': 'hold',
  'Immediate Release': 'immediate'
};

const YEAR = 2026;
const START_WEEK = 1;
const END_WEEK = 8;
const CURRENT_WEEK = 11; // latest week for archive URL reference

function buildReportUrl(year, weekNum) {
  const weekLabel = `${year}, WEEK ${weekNum}`;
  const params = [
    `ReportID=${REPORT_ID_CURRENT}`,
    `Pa%20CurrentUser=${encodeURIComponent(CURRENT_USER)}`,
    `Pa%20Selected%20Week=${encodeURIComponent(weekLabel)}`,
    `Pa%20Period=${encodeURIComponent(weekLabel)}`,
    `Pa%20Agent=${encodeURIComponent(AGENT_PARAM)}`,
    `Pa%20Selected%20SGA=${encodeURIComponent(SGA_PARAM)}`
  ];
  return `https://payeeweb.ailicm.globelifeinc.com/payeewebv2/ReportView?${params.join('&')}`;
}

const ARCHIVE_BASE_URL = 'https://payeeweb.ailicm.globelifeinc.com/payeewebv2/ReportView?ReportID=189';

/**
 * Navigate to archive page and select week/SGA/agent from dropdowns, then click View.
 */
async function loadArchiveReport(page, year, weekNum) {
  await page.goto(ARCHIVE_BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  // Ensure we're on the archive page with selects loaded
  const hasSelects = await page.evaluate(() => !!document.querySelector('select[name="Pa Period"]'));
  if (!hasSelects) {
    console.log(`  Archive page missing selects, URL: ${page.url()}`);
    // May need to re-auth if redirected to SSO
    if (page.url().includes('SecureAuth') || page.url().includes('sso.globelifeinc.com')) {
      console.log('  Re-authenticating for archive...');
      await authenticateSSO(page, ARCHIVE_BASE_URL);
      await page.goto(ARCHIVE_BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
    }
    const retry = await page.evaluate(() => !!document.querySelector('select[name="Pa Period"]'));
    if (!retry) {
      console.log('  Still no selects on archive page');
      return false;
    }
  }

  // Select week using Puppeteer's native select (triggers proper change events)
  const weekValue = `${year}, WEEK ${String(weekNum).padStart(2, '0')}`;
  await page.select('select[name="Pa Period"]', weekValue);
  console.log(`  Selected week: ${weekValue}`);
  await new Promise(r => setTimeout(r, 3000));

  // Select SGA
  await page.select('select[name="Pa Selected SGA"]', SGA_PARAM);
  console.log(`  Selected SGA: ${SGA_PARAM}`);

  // Wait for Agent dropdown to populate (cascading AJAX)
  console.log('  Waiting for Agent dropdown to populate...');
  let agentFound = false;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const agentOptions = await page.evaluate(() => {
      const sel = document.querySelector('select[name="Pa Agent"]');
      if (!sel) return [];
      return [...sel.options].filter(o => o.value).map(o => ({ value: o.value, text: o.text.trim() }));
    });
    if (agentOptions.length > 0) {
      console.log(`  Agent dropdown loaded: ${agentOptions.length} options`);
      // Select the right agent
      const match = agentOptions.find(o => o.value.includes('70806') || o.text.includes('ARIAS SIMON'));
      if (match) {
        await page.select('select[name="Pa Agent"]', match.value);
        console.log(`  Selected agent: ${match.text}`);
        agentFound = true;
      } else {
        // Just select the first non-empty option
        await page.select('select[name="Pa Agent"]', agentOptions[0].value);
        console.log(`  Selected first agent: ${agentOptions[0].text}`);
        agentFound = true;
      }
      break;
    }
    console.log(`  Agent poll ${i + 1}/15 — still loading...`);
  }

  if (!agentFound) {
    console.log('  Agent dropdown never populated — trying View without agent');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Click the View button
  const viewClicked = await page.evaluate(() => {
    // Try input[type=button] or button with "View" text
    const btn = document.querySelector('input[type="button"][value="View"]') ||
                document.querySelector('input[type="submit"][value="View"]') ||
                [...document.querySelectorAll('button, input[type="button"], input[type="submit"]')]
                  .find(b => (b.value || b.textContent || '').trim() === 'View');
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log(`  View button clicked: ${viewClicked}`);

  if (!viewClicked) return false;

  // Wait for report to load
  console.log('  Waiting for archive report to load...');
  try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }); } catch (e) {}
  await new Promise(r => setTimeout(r, 15000));

  return true;
}

function getMondayOfWeek(year, weekNum) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
  return monday.toISOString().split('T')[0];
}

async function drainStaleMfaCodes() {
  for (let i = 0; i < 10; i++) {
    try {
      const r = await axios.get(`${PROCESSOR_URL}/mfa/secureauth-code`, {
        headers: { 'X-Auth-Token': REWATCH_TOKEN }, timeout: 10000
      });
      if (r.data.success) { console.log('  Drained:', r.data.code); } else break;
    } catch (e) { break; }
  }
}

async function pollForMfaCode() {
  for (let i = 1; i <= 12; i++) {
    await new Promise(r => setTimeout(r, 10000));
    console.log(`  MFA poll ${i}/12`);
    try {
      const r = await axios.get(`${PROCESSOR_URL}/mfa/secureauth-code`, {
        headers: { 'X-Auth-Token': REWATCH_TOKEN }, timeout: 10000
      });
      if (r.data.success && r.data.code) return r.data.code;
    } catch (e) {}
  }
  throw new Error('MFA code not received');
}

async function authenticateSSO(page, reportUrl) {
  const url = page.url();
  if (!url.includes('SecureAuth') && !url.includes('sso.globelifeinc.com')) return;

  console.log('  SSO login...');
  await page.waitForSelector('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', { timeout: 10000 });
  await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', process.env.PAYEEWEB_USERNAME);
  await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_tbxPassword_UiInput', process.env.PAYEEWEB_PASSWORD);
  await page.evaluate(() => {
    const b = document.querySelector('a.btn.btn-primary.btn--login');
    if (b) b.click();
  });
  try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch (e) {}
  await new Promise(r => setTimeout(r, 3000));

  const content = await page.content();
  if (content.includes('delivery method')) {
    console.log('  MFA required...');
    await drainStaleMfaCodes();
    await page.click('#ContentPlaceHolder1_MFALoginControl1_RegistrationMethodView_rbEmail1_UiInput');
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const b = document.querySelector('a.btn.btn-primary.btn--login[title="Submit"]');
      if (b) b.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const code = await pollForMfaCode();
    console.log('  Got MFA code:', code);
    const ci = await page.$('input[type="text"][placeholder*="code"]') ||
               await page.$('input[type="text"][placeholder*="Code"]') ||
               await page.$('input.form-control[type="text"]');
    await ci.type(code);
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const b = document.querySelector('a.btn.btn-primary.btn--login[ng-click*="RegCodeButton"]');
      if (b) b.click();
    });
    try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));

    const postMfa = await page.content();
    if (postMfa.includes('Passcode does not match')) throw new Error('MFA rejected');

    if (!page.url().includes('payeeweb')) {
      await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log('  Authenticated');
}

/**
 * Dynamically discover export dropdown IDs by finding section headers
 * and tracing to the nearest Paginated DataGrid's export dropdown.
 * Returns array of { dropdownId, queueType, label }.
 */
async function discoverTableExports(page) {
  return await page.evaluate((sectionMap) => {
    const results = [];
    const sectionNames = Object.keys(sectionMap);

    // Find all Paginated DataGrid containers — these hold the main data tables
    const paginatedGrids = document.querySelectorAll('div.DataGridDiv.Paginated');

    for (const grid of paginatedGrids) {
      // Find the export dropdown inside this grid
      const dropdown = grid.querySelector('div.showHideColDD[id$="-dropdown-box"]');
      if (!dropdown) continue;

      // Walk backwards from this grid to find the section header
      let el = grid;
      let sectionTitle = null;
      for (let i = 0; i < 20; i++) {
        el = el.previousElementSibling;
        if (!el) {
          el = grid.parentElement;
          continue;
        }
        const text = el.textContent.trim();
        for (const name of sectionNames) {
          if (text.includes(name)) {
            sectionTitle = name;
            break;
          }
        }
        if (sectionTitle) break;
      }

      if (sectionTitle) {
        results.push({
          dropdownId: dropdown.id,
          queueType: sectionMap[sectionTitle],
          label: sectionTitle
        });
      }
    }

    // Fallback: if we didn't match all sections, try a different approach
    // Look at the full page ordering: find section header TDs and map to next Paginated grid
    if (results.length < sectionNames.length) {
      const allElements = document.querySelectorAll('*');
      let currentSection = null;
      const found = new Set(results.map(r => r.queueType));

      for (const elem of allElements) {
        // Check if this element is a section header
        if (elem.tagName === 'TD') {
          const text = elem.textContent.trim();
          for (const name of sectionNames) {
            if (text === name && !found.has(sectionMap[name])) {
              currentSection = name;
              break;
            }
          }
        }

        // Check if this is a Paginated grid with an export dropdown
        if (currentSection && elem.classList.contains('DataGridDiv') && elem.classList.contains('Paginated')) {
          const dropdown = elem.querySelector('div.showHideColDD[id$="-dropdown-box"]');
          if (dropdown && !found.has(sectionMap[currentSection])) {
            results.push({
              dropdownId: dropdown.id,
              queueType: sectionMap[currentSection],
              label: currentSection
            });
            found.add(sectionMap[currentSection]);
            currentSection = null;
          }
        }
      }
    }

    return results;
  }, SECTION_MAP);
}

/**
 * Click an Excel export icon by dropdown ID and wait for the file.
 */
async function downloadTableExcel(page, dropdownId, downloadPath) {
  const beforeFiles = new Set(fs.readdirSync(downloadPath));

  const clicked = await page.evaluate((ddId) => {
    const dropdown = document.getElementById(ddId);
    if (!dropdown) return false;
    const icon = dropdown.querySelector('img[src*="icon_excel.png"]') ||
                 dropdown.querySelector('img.exportDatagridToXLSX') ||
                 dropdown.querySelector('img[src*="icon_excel2003.png"]');
    if (icon) { icon.click(); return true; }
    return false;
  }, dropdownId);

  if (!clicked) throw new Error(`No export icon in #${dropdownId}`);

  for (let wait = 0; wait < 30; wait++) {
    await new Promise(r => setTimeout(r, 1000));
    const newFiles = fs.readdirSync(downloadPath)
      .filter(f => !beforeFiles.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
    if (newFiles.length > 0) return path.join(downloadPath, newFiles[0]);
  }
  throw new Error(`Download timed out for #${dropdownId}`);
}

async function storeRows(rows, queueType, reportDate) {
  let inserted = 0;
  for (const row of rows) {
    const policyNumber = row['Policy Number'] || row['PolicyNumber'] || '';
    if (!policyNumber) continue;

    const agentName = row['Agent Name'] || row['AgentName'] || '';
    const agentId = row['AgentID'] || row['WAgentID'] || row['Agent ID'] || '';
    const appType = row['App Type'] || row['AppType'] || '';
    const insuredName = row['Insured Name'] || row['InsuredName'] || '';
    const submitDate = row['Submit Date'] || row['SubmitDate'] || '';
    const productionDate = row['Production Date'] || row['ProductionDate'] || '';
    const lineOfBusiness = row['Line of Business'] || row['LineOfBusiness'] || '';
    const annualizedPremium = parseFloat(row['Annualized Premium'] || row['AnnualizedPremium'] || 0) || 0;
    const notifyTrailer = row['Notify Trailer'] || row['NotifyTrailer'] || '';

    try {
      await query(
        `INSERT INTO payeeweb_business
         (policy_number, queue_type, agent_name, agent_id, app_type, insured_name,
          submit_date, production_date, line_of_business, annualized_premium,
          notify_trailer, raw_row, report_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           agent_name = VALUES(agent_name), agent_id = VALUES(agent_id),
           app_type = VALUES(app_type), insured_name = VALUES(insured_name),
           submit_date = VALUES(submit_date), production_date = VALUES(production_date),
           line_of_business = VALUES(line_of_business), annualized_premium = VALUES(annualized_premium),
           notify_trailer = VALUES(notify_trailer), raw_row = VALUES(raw_row),
           report_date = VALUES(report_date)`,
        [policyNumber, queueType, agentName, agentId, appType, insuredName,
         submitDate, productionDate, lineOfBusiness, annualizedPremium,
         notifyTrailer, JSON.stringify(row), reportDate]
      );
      inserted++;
    } catch (e) {
      console.error(`    Error storing policy ${policyNumber}:`, e.message);
    }
  }
  return inserted;
}

(async () => {
  const downloadPath = path.join(__dirname, '../downloads/payeeweb');
  if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

  console.log(`\n=== PayeeWeb Backfill: ${YEAR} Weeks ${START_WEEK}-${END_WEEK} ===\n`);

  const browser = await launchBrowser({ defaultViewport: { width: 1280, height: 1024 } });
  const page = await browser.newPage();

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  let authenticated = false;
  let grandTotal = 0;
  const results = [];

  try {
    for (let week = START_WEEK; week <= END_WEEK; week++) {
      const reportUrl = buildReportUrl(YEAR, week);
      const reportDate = getMondayOfWeek(YEAR, week);

      console.log(`\n--- Week ${week} (report_date: ${reportDate}) ---`);

      // Check existing data (will upsert, not skip)
      const existing = await query(
        'SELECT COUNT(*) as cnt FROM payeeweb_business WHERE report_date = ?',
        [reportDate]
      );
      if (existing[0]?.cnt > 0) {
        console.log(`  Already have ${existing[0].cnt} rows, will upsert`);
      }

      // Navigate
      console.log(`  Navigating to report...`);
      await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000));

      // Authenticate on first visit
      if (!authenticated) {
        await authenticateSSO(page, reportUrl);
        authenticated = true;
        if (!page.url().includes(`WEEK+${week}`) && !page.url().includes(`WEEK%20${week}`)) {
          await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      // Wait for content
      console.log('  Waiting for content to load...');
      await new Promise(r => setTimeout(r, 15000));

      if (!page.url().includes('payeeweb')) {
        console.log(`  ERROR: Not on PayeeWeb, skipping`);
        results.push({ week, status: 'error', rows: 0 });
        continue;
      }

      // Dynamically discover export dropdowns for this week's page
      let tableExports = await discoverTableExports(page);
      console.log(`  Found ${tableExports.length} export table(s): ${tableExports.map(t => `${t.label} (#${t.dropdownId})`).join(', ')}`);

      // If current report has no data, try the archive report
      if (tableExports.length === 0) {
        console.log('  No tables on current report — trying archive (ReportID=189)...');
        const archiveLoaded = await loadArchiveReport(page, YEAR, week);

        if (archiveLoaded && page.url().includes('payeeweb')) {
          // Debug screenshot
          const screenshotPath = path.join(downloadPath, `debug_week${week}_archive.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`  Archive screenshot: ${screenshotPath}`);

          tableExports = await discoverTableExports(page);
          console.log(`  Archive: Found ${tableExports.length} export table(s): ${tableExports.map(t => `${t.label} (#${t.dropdownId})`).join(', ')}`);
        }
      }

      if (tableExports.length === 0) {
        console.log('  No exportable tables found on either report');
        results.push({ week, status: 'empty', rows: 0 });
        continue;
      }

      // Download each table
      let weekTotal = 0;
      for (const tableInfo of tableExports) {
        try {
          const filePath = await downloadTableExcel(page, tableInfo.dropdownId, downloadPath);
          const workbook = XLSX.readFile(filePath);
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          const stored = await storeRows(rows, tableInfo.queueType, reportDate);
          console.log(`  ${tableInfo.label}: ${rows.length} parsed, ${stored} stored`);
          weekTotal += stored;
          try { fs.unlinkSync(filePath); } catch (e) {}
          await new Promise(r => setTimeout(r, 2000));
        } catch (tableErr) {
          console.error(`  ${tableInfo.label}: ERROR - ${tableErr.message}`);
        }
      }

      grandTotal += weekTotal;
      results.push({ week, status: 'success', rows: weekTotal });
      console.log(`  Week ${week} total: ${weekTotal} rows`);
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
  } finally {
    await browser.close();
  }

  console.log('\n\n=== BACKFILL COMPLETE ===');
  console.log(`Grand total: ${grandTotal} rows\n`);
  results.forEach(r => {
    console.log(`  Week ${r.week}: ${r.status} (${r.rows} rows)`);
  });
  console.log('');
  process.exit(0);
})();
