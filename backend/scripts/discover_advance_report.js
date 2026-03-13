/**
 * Discovery script: Navigate to PayeeWeb Weekly Advance Details report
 * (PresenterReport/150), discover table structure, and export sample data.
 *
 * Usage: NODE_ENV=development node scripts/discover_advance_report.js
 */
process.env.NODE_ENV = 'development';
process.env.PAYEEWEB_USERNAME = 'kylevanbib@gmail.com';
process.env.PAYEEWEB_PASSWORD = 'Atlas2025!';

const { launchBrowser } = require('../utils/browserLauncher');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://peaceful-badlands-42414-7b2e5f9acb76.herokuapp.com';
const REWATCH_TOKEN = process.env.REWATCH_TOKEN;

const SGA_PARAM = 'ARIAS-DIULUS-ADAMS';
const AGENT_PARAM = 'SIMON ARIAS (70806)';

function buildAdvanceReportUrl(year, weekNum) {
  const weekLabel = `${year}, WEEK ${String(weekNum).padStart(2, '0')}`;
  return `https://payeeweb.ailicm.globelifeinc.com/payeewebv2/PresenterReport/150?` +
    `Pa%20Selected%20Week=${encodeURIComponent(weekLabel)}` +
    `&Pa%20Selected%20SGA=${encodeURIComponent(SGA_PARAM)}` +
    `&Pa%20Selected%20Agent=${encodeURIComponent(AGENT_PARAM)}`;
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

(async () => {
  const downloadPath = path.join(__dirname, '../downloads/advance_details');
  if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath, { recursive: true });

  const week = 10;
  const year = 2026;
  const reportUrl = buildAdvanceReportUrl(year, week);

  console.log(`\n=== Weekly Advance Details Report Discovery ===`);
  console.log(`URL: ${reportUrl}\n`);

  const browser = await launchBrowser({ defaultViewport: { width: 1400, height: 1024 } });
  const page = await browser.newPage();

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  try {
    // Navigate
    console.log('Navigating to report...');
    await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Auth
    await authenticateSSO(page, reportUrl);

    // Navigate back if needed
    if (!page.url().includes('PresenterReport') && !page.url().includes('payeeweb')) {
      console.log('Redirected, navigating back...');
      await page.goto(reportUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // Wait for content to load
    console.log('Waiting for report to load...');
    await new Promise(r => setTimeout(r, 20000));

    // Screenshot
    const screenshotPath = path.join(downloadPath, 'advance_report_full.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Discover ALL section headers and tables
    const pageStructure = await page.evaluate(() => {
      const info = {
        title: document.title,
        url: window.location.href,
        sections: [],
        tables: [],
        exportDropdowns: []
      };

      // Find all bold/header text that might be section titles
      const allTDs = document.querySelectorAll('td');
      for (const td of allTDs) {
        const text = td.textContent.trim();
        const bold = td.querySelector('b, strong');
        if (bold && text.length > 3 && text.length < 100) {
          info.sections.push(text);
        }
      }

      // Find all DataGrid tables
      const grids = document.querySelectorAll('div.DataGridDiv');
      for (const grid of grids) {
        const isPaginated = grid.classList.contains('Paginated');
        const table = grid.querySelector('table');
        if (!table) continue;

        const headers = [];
        const headerCells = table.querySelectorAll('tr:first-child th, tr:first-child td');
        headerCells.forEach(th => {
          const text = th.textContent.trim();
          if (text) headers.push(text);
        });

        // Count rows (excluding header)
        const rows = table.querySelectorAll('tr');
        const rowCount = Math.max(0, rows.length - 1);

        // Get a sample row
        let sampleRow = {};
        if (rows.length > 1) {
          const cells = rows[1].querySelectorAll('td');
          cells.forEach((cell, i) => {
            if (headers[i]) sampleRow[headers[i]] = cell.textContent.trim();
          });
        }

        info.tables.push({
          paginated: isPaginated,
          headers,
          rowCount,
          sampleRow
        });
      }

      // Find all export dropdowns
      const dropdowns = document.querySelectorAll('div.showHideColDD[id$="-dropdown-box"]');
      for (const dd of dropdowns) {
        const hasExcel = !!dd.querySelector('img[src*="icon_excel"]');
        info.exportDropdowns.push({
          id: dd.id,
          hasExcel,
          parentText: dd.parentElement?.textContent?.trim()?.substring(0, 50) || ''
        });
      }

      return info;
    });

    console.log('\n=== Page Structure ===');
    console.log('Title:', pageStructure.title);
    console.log('URL:', pageStructure.url);

    console.log('\n--- Section Headers ---');
    pageStructure.sections.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

    console.log('\n--- Data Tables ---');
    pageStructure.tables.forEach((t, i) => {
      console.log(`\n  Table ${i + 1} (${t.paginated ? 'Paginated' : 'Non-paginated'}, ${t.rowCount} rows):`);
      console.log(`    Headers: ${t.headers.join(' | ')}`);
      if (Object.keys(t.sampleRow).length > 0) {
        console.log(`    Sample row:`, JSON.stringify(t.sampleRow, null, 2));
      }
    });

    console.log('\n--- Export Dropdowns ---');
    pageStructure.exportDropdowns.forEach((d, i) => {
      console.log(`  ${i + 1}. #${d.id} (hasExcel: ${d.hasExcel})`);
    });

    // Try to download each exportable table
    console.log('\n--- Downloading Excel exports ---');
    for (const dd of pageStructure.exportDropdowns) {
      if (!dd.hasExcel) continue;

      const beforeFiles = new Set(fs.readdirSync(downloadPath));
      const clicked = await page.evaluate((ddId) => {
        const dropdown = document.getElementById(ddId);
        if (!dropdown) return false;
        const icon = dropdown.querySelector('img[src*="icon_excel.png"]') ||
                     dropdown.querySelector('img.exportDatagridToXLSX') ||
                     dropdown.querySelector('img[src*="icon_excel2003.png"]');
        if (icon) { icon.click(); return true; }
        return false;
      }, dd.id);

      if (!clicked) {
        console.log(`  #${dd.id}: could not click export`);
        continue;
      }

      let filePath = null;
      for (let wait = 0; wait < 30; wait++) {
        await new Promise(r => setTimeout(r, 1000));
        const newFiles = fs.readdirSync(downloadPath)
          .filter(f => !beforeFiles.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
        if (newFiles.length > 0) {
          filePath = path.join(downloadPath, newFiles[0]);
          break;
        }
      }

      if (filePath) {
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        console.log(`\n  #${dd.id}: ${rows.length} rows, file: ${path.basename(filePath)}`);
        if (rows.length > 0) {
          console.log(`    Columns: ${Object.keys(rows[0]).join(' | ')}`);
          console.log(`    Sample:`, JSON.stringify(rows[0], null, 2));
          if (rows.length > 1) console.log(`    Row 2:`, JSON.stringify(rows[1], null, 2));
        }
        // Keep the file for inspection
        const safeName = `advance_table_${dd.id.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        const dest = path.join(downloadPath, safeName);
        try { fs.renameSync(filePath, dest); } catch (e) {}
        console.log(`    Saved as: ${safeName}`);
      } else {
        console.log(`  #${dd.id}: download timed out`);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

  } catch (err) {
    console.error('\nERROR:', err.message);
    // Save error screenshot
    try {
      await page.screenshot({ path: path.join(downloadPath, 'error.png'), fullPage: true });
    } catch (e) {}
  } finally {
    await browser.close();
  }

  console.log('\nDone.');
  process.exit(0);
})();
