/**
 * Scheduler for downloading the weekly PayeeWeb production report.
 * Runs every weekday morning at 6 AM ET.
 * Uses Puppeteer to authenticate through GlobeLife SSO with email-based MFA,
 * auto-retrieves the MFA code from Gmail via the Python processor service,
 * then downloads Excel exports from 3 tables:
 *   1. Released from Hold Queue
 *   2. Business in Hold Queue
 *   3. Immediate Release
 * and stores each row in the payeeweb_business table.
 */
const cron = require('node-cron');
const { query } = require('../db');
const { launchBrowser } = require('../utils/browserLauncher');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const axios = require('axios');

// 6:00 AM Eastern Time, weekdays only (11:00 UTC)
const CRON_SCHEDULE = '0 11 * * 1-5';

const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://peaceful-badlands-42414-7b2e5f9acb76.herokuapp.com';
const REWATCH_TOKEN = process.env.REWATCH_TOKEN;

// Static URL parameters
const REPORT_ID = 46;
const CURRENT_USER = 'DIR_00112_KV';
const AGENT_PARAM = 'ARIAS SIMON A (SGA-RGA) (70806)';
const SGA_PARAM = 'ARIAS-DIULUS-ADAMS';

// Map section header text to queue types (for dynamic dropdown discovery)
const SECTION_MAP = {
  'Released from Hold Queue': 'released',
  'Business in Hold Queue': 'hold',
  'Immediate Release': 'immediate'
};

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function buildReportUrl(year, weekNum) {
  const weekLabel = `${year}, WEEK ${weekNum}`;
  const params = [
    `ReportID=${REPORT_ID}`,
    `Pa%20CurrentUser=${encodeURIComponent(CURRENT_USER)}`,
    `Pa%20Selected%20Week=${encodeURIComponent(weekLabel)}`,
    `Pa%20Period=${encodeURIComponent(weekLabel)}`,
    `Pa%20Agent=${encodeURIComponent(AGENT_PARAM)}`,
    `Pa%20Selected%20SGA=${encodeURIComponent(SGA_PARAM)}`
  ];
  return `https://payeeweb.ailicm.globelifeinc.com/payeewebv2/ReportView?${params.join('&')}`;
}

async function logProcessStart(triggerType) {
  const result = await query(
    `INSERT INTO process_runs (process_name, processor, status, trigger_type, started_at)
     VALUES ('PayeeWeb Report', 'payeeWebReportScheduler', 'running', ?, NOW())`,
    [triggerType]
  );
  return result.insertId;
}

async function logProcessComplete(runId, status, recordsProcessed, errorMessage) {
  await query(
    `UPDATE process_runs SET status = ?, records_processed = ?, completed_at = NOW(), error_message = ? WHERE id = ?`,
    [status, recordsProcessed || 0, errorMessage || null, runId]
  );
}

/**
 * Drain stale MFA codes from Gmail before requesting a new one.
 */
async function drainStaleMfaCodes() {
  let drainCount = 0;
  for (let i = 0; i < 5; i++) {
    try {
      const resp = await axios.get(`${PROCESSOR_URL}/mfa/secureauth-code`, {
        headers: { 'X-Auth-Token': REWATCH_TOKEN },
        timeout: 10000
      });
      if (resp.data.success && resp.data.code) {
        drainCount++;
        console.log(`[PayeeWeb] Drained stale code: ${resp.data.code}`);
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }
  console.log(`[PayeeWeb] Drained ${drainCount} stale code(s)`);
}

/**
 * Poll the Python processor service for the SecureAuth MFA code.
 */
async function pollForMfaCode() {
  const maxAttempts = 12;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 10000));
    console.log(`[PayeeWeb] MFA code poll attempt ${attempt}/${maxAttempts}`);
    try {
      const response = await axios.get(`${PROCESSOR_URL}/mfa/secureauth-code`, {
        headers: { 'X-Auth-Token': REWATCH_TOKEN },
        timeout: 10000
      });
      if (response.data.success && response.data.code) {
        console.log('[PayeeWeb] MFA code retrieved successfully');
        return response.data.code;
      }
      console.log(`[PayeeWeb] No code yet: ${response.data.error || 'waiting...'}`);
    } catch (e) {
      console.log(`[PayeeWeb] Poll error: ${e.message}`);
    }
  }
  throw new Error('MFA code not received within 2 minutes');
}

/**
 * Authenticate through GlobeLife SSO with email-based MFA.
 */
async function authenticateSSO(page, reportUrl) {
  const currentUrl = page.url();
  if (!currentUrl.includes('SecureAuth') && !currentUrl.includes('sso.globelifeinc.com')) {
    console.log('[PayeeWeb] No SSO required, already authenticated');
    return;
  }

  console.log('[PayeeWeb] SSO login required');
  const username = process.env.PAYEEWEB_USERNAME;
  const password = process.env.PAYEEWEB_PASSWORD;
  if (!username || !password) {
    throw new Error('PAYEEWEB_USERNAME and PAYEEWEB_PASSWORD environment variables required');
  }

  // Enter credentials
  const usernameField = '#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput';
  const passwordField = '#ContentPlaceHolder1_MFALoginControl1_UserIDView_tbxPassword_UiInput';
  await page.waitForSelector(usernameField, { timeout: 10000 });
  await page.type(usernameField, username);
  await page.type(passwordField, password);
  console.log('[PayeeWeb] Credentials entered');

  // Submit
  await page.evaluate(() => {
    const btn = document.querySelector('a.btn.btn-primary.btn--login') ||
                document.querySelector('a.btn-primary[title="Submit"]') ||
                document.querySelector('input[type="submit"]');
    if (btn) btn.click();
  });
  try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch (e) {}
  await new Promise(r => setTimeout(r, 3000));

  // Handle MFA
  const pageContent = await page.content();
  if (pageContent.includes('delivery method')) {
    console.log('[PayeeWeb] MFA page detected');
    await drainStaleMfaCodes();

    // Select email delivery
    await page.waitForSelector('#ContentPlaceHolder1_MFALoginControl1_RegistrationMethodView_rbEmail1_UiInput', { timeout: 10000 });
    await page.click('#ContentPlaceHolder1_MFALoginControl1_RegistrationMethodView_rbEmail1_UiInput');
    await new Promise(r => setTimeout(r, 1000));

    // Submit to send code
    await page.evaluate(() => {
      const btn = document.querySelector('a.btn.btn-primary.btn--login[title="Submit"]');
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Poll for code
    console.log('[PayeeWeb] Polling for MFA code...');
    const mfaCode = await pollForMfaCode();

    // Enter code
    const codeInput = await page.$('input[type="text"][placeholder*="code"]') ||
                      await page.$('input[type="text"][placeholder*="Code"]') ||
                      await page.$('input.form-control[type="text"]');
    if (!codeInput) throw new Error('Could not find MFA code input field');
    await codeInput.type(mfaCode);
    await new Promise(r => setTimeout(r, 1000));

    // Submit code
    await page.evaluate(() => {
      const btn = document.querySelector('a.btn.btn-primary.btn--login[ng-click*="RegCodeButton"]');
      if (btn) btn.click();
    });
    try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));

    // Check rejection
    const postMfa = await page.content();
    if (postMfa.includes('Passcode does not match') || postMfa.includes('passcode does not match')) {
      throw new Error('MFA passcode was rejected');
    }

    // Navigate to report if redirected to SSO portal
    if (!page.url().includes('payeeweb')) {
      console.log('[PayeeWeb] Navigating to report page...');
      await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`[PayeeWeb] Authenticated, on: ${page.url()}`);
}

/**
 * Dynamically discover export dropdown IDs by finding section headers
 * and tracing to the nearest Paginated DataGrid's export dropdown.
 */
async function discoverTableExports(page) {
  return await page.evaluate((sectionMap) => {
    const results = [];
    const sectionNames = Object.keys(sectionMap);
    const found = new Set();

    // Walk through all elements in order to find section headers followed by Paginated grids
    const allElements = document.querySelectorAll('*');
    let currentSection = null;

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

    return results;
  }, SECTION_MAP);
}

/**
 * Click an Excel export icon and wait for the file to download.
 * Returns the path to the downloaded file.
 */
async function downloadTableExcel(page, dropdownId, downloadPath) {
  // Clear any existing files first to isolate this download
  const beforeFiles = new Set(fs.readdirSync(downloadPath));

  // Click the .xlsx export icon inside the dropdown
  const clicked = await page.evaluate((ddId) => {
    const dropdown = document.getElementById(ddId);
    if (!dropdown) return false;
    const xlsxIcon = dropdown.querySelector('img[src*="icon_excel.png"]') ||
                     dropdown.querySelector('img.exportDatagridToXLSX');
    if (xlsxIcon) {
      xlsxIcon.click();
      return true;
    }
    // Fallback: try .xls
    const xlsIcon = dropdown.querySelector('img[src*="icon_excel2003.png"]') ||
                    dropdown.querySelector('img.exportDatagridToXLS');
    if (xlsIcon) {
      xlsIcon.click();
      return true;
    }
    return false;
  }, dropdownId);

  if (!clicked) {
    throw new Error(`Could not find export icon in #${dropdownId}`);
  }

  // Wait for file to appear
  let downloadedFile = null;
  for (let wait = 0; wait < 30; wait++) {
    await new Promise(r => setTimeout(r, 1000));
    const currentFiles = fs.readdirSync(downloadPath);
    const newFiles = currentFiles.filter(f => !beforeFiles.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
    if (newFiles.length > 0) {
      downloadedFile = path.join(downloadPath, newFiles[0]);
      break;
    }
  }

  if (!downloadedFile) {
    throw new Error(`Download timed out for #${dropdownId}`);
  }

  return downloadedFile;
}

/**
 * Parse an Excel file and return the rows as JSON.
 */
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

/**
 * Store parsed rows in the payeeweb_business table.
 */
async function storeRows(rows, queueType, reportDate) {
  if (rows.length === 0) return 0;

  let inserted = 0;
  for (const row of rows) {
    // Normalize column names (PayeeWeb uses varying formats)
    const policyNumber = row['Policy Number'] || row['PolicyNumber'] || row['Policy_Number'] || '';
    const agentName = row['Agent Name'] || row['AgentName'] || row['Agent_Name'] || '';
    const agentId = row['AgentID'] || row['WAgentID'] || row['Agent ID'] || '';
    const appType = row['App Type'] || row['AppType'] || '';
    const insuredName = row['Insured Name'] || row['InsuredName'] || '';
    const submitDate = row['Submit Date'] || row['SubmitDate'] || '';
    const productionDate = row['Production Date'] || row['ProductionDate'] || '';
    const lineOfBusiness = row['Line of Business'] || row['LineOfBusiness'] || '';
    const annualizedPremium = parseFloat(row['Annualized Premium'] || row['AnnualizedPremium'] || 0) || 0;
    const notifyTrailer = row['Notify Trailer'] || row['NotifyTrailer'] || '';

    if (!policyNumber) continue; // Skip rows without policy numbers

    try {
      await query(
        `INSERT INTO payeeweb_business
         (policy_number, queue_type, agent_name, agent_id, app_type, insured_name,
          submit_date, production_date, line_of_business, annualized_premium,
          notify_trailer, raw_row, report_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           agent_name = VALUES(agent_name),
           agent_id = VALUES(agent_id),
           app_type = VALUES(app_type),
           insured_name = VALUES(insured_name),
           submit_date = VALUES(submit_date),
           production_date = VALUES(production_date),
           line_of_business = VALUES(line_of_business),
           annualized_premium = VALUES(annualized_premium),
           notify_trailer = VALUES(notify_trailer),
           raw_row = VALUES(raw_row),
           report_date = VALUES(report_date)`,
        [policyNumber, queueType, agentName, agentId, appType, insuredName,
         submitDate, productionDate, lineOfBusiness, annualizedPremium,
         notifyTrailer, JSON.stringify(row), reportDate]
      );
      inserted++;
    } catch (e) {
      console.error(`[PayeeWeb] Error storing row (policy ${policyNumber}):`, e.message);
    }
  }

  return inserted;
}

/**
 * Main function: fetch the PayeeWeb report.
 */
async function fetchPayeeWebReport(triggerType = 'cron') {
  const now = new Date();
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = etNow.getFullYear();
  const weekNum = getISOWeekNumber(etNow);
  const weekLabel = `${year}, WEEK ${weekNum}`;
  const reportDate = etNow.toISOString().split('T')[0];

  console.log(`[PayeeWeb] Starting report fetch for ${weekLabel} (trigger: ${triggerType})`);

  const runId = await logProcessStart(triggerType);
  let browser = null;

  try {
    // Build URL
    const reportUrl = buildReportUrl(year, weekNum);
    console.log(`[PayeeWeb] Report URL: ${reportUrl}`);

    // Launch browser
    console.log('[PayeeWeb] Launching browser...');
    browser = await launchBrowser({ defaultViewport: { width: 1280, height: 1024 } });
    const page = await browser.newPage();

    // Set up download directory
    const downloadPath = path.join(__dirname, '../downloads/payeeweb');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });

    // Navigate (will redirect to SSO)
    console.log('[PayeeWeb] Navigating to report URL...');
    await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Authenticate
    await authenticateSSO(page, reportUrl);

    // Wait for report content to fully load
    console.log('[PayeeWeb] Waiting for report content to load...');
    await new Promise(r => setTimeout(r, 15000));

    // Dynamically discover export dropdowns
    const tableExports = await discoverTableExports(page);
    console.log(`[PayeeWeb] Found ${tableExports.length} table(s): ${tableExports.map(t => `${t.label} (#${t.dropdownId})`).join(', ')}`);

    if (tableExports.length === 0) {
      throw new Error('No exportable tables found on report page');
    }

    // Download and process each table
    let totalRecords = 0;

    for (const tableInfo of tableExports) {
      console.log(`[PayeeWeb] Exporting: ${tableInfo.label} (#${tableInfo.dropdownId})`);

      try {
        const filePath = await downloadTableExcel(page, tableInfo.dropdownId, downloadPath);
        console.log(`[PayeeWeb] Downloaded: ${path.basename(filePath)}`);

        const rows = parseExcelFile(filePath);
        console.log(`[PayeeWeb] Parsed ${rows.length} rows from ${tableInfo.label}`);

        if (rows.length > 0) {
          console.log(`[PayeeWeb] Columns: ${Object.keys(rows[0]).join(', ')}`);
        }

        const stored = await storeRows(rows, tableInfo.queueType, reportDate);
        console.log(`[PayeeWeb] Stored ${stored} rows for ${tableInfo.label}`);
        totalRecords += stored;

        // Cleanup downloaded file
        try { fs.unlinkSync(filePath); } catch (e) {}

        // Small delay between downloads
        await new Promise(r => setTimeout(r, 2000));
      } catch (tableErr) {
        console.error(`[PayeeWeb] Error with ${tableInfo.label}: ${tableErr.message}`);
        // Continue with other tables
      }
    }

    await logProcessComplete(runId, 'success', totalRecords, null);
    console.log(`[PayeeWeb] Report fetch complete: ${totalRecords} total records for ${weekLabel}`);

  } catch (error) {
    console.error('[PayeeWeb] Error:', error.message);
    await logProcessComplete(runId, 'error', 0, error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('[PayeeWeb] Browser closed');
    }
  }
}

function initPayeeWebReportScheduler() {
  cron.schedule(CRON_SCHEDULE, () => {
    console.log('[PayeeWeb] Cron triggered');
    fetchPayeeWebReport('cron').catch(err => {
      console.error('[PayeeWeb] Scheduled run failed:', err.message);
    });
  }, {
    timezone: 'America/New_York'
  });
  console.log('[PayeeWeb] Scheduler registered: weekdays 6:00 AM ET');
}

module.exports = { initPayeeWebReportScheduler, fetchPayeeWebReport };
