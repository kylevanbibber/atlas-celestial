const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.HEROKU || process.env.RAILWAY_ENVIRONMENT;

/**
 * Launch browser with cloud-compatible settings.
 * Uses @sparticuz/chromium in production, local Chrome in development.
 */
async function launchBrowser(options = {}) {
  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    '--no-zygote'
  ];

  if (isProduction) {
    console.log('[Browser] Launching in production mode with @sparticuz/chromium');
    return await puppeteer.launch({
      args: [...chromium.args, ...defaultArgs, ...(options.args || [])],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: options.defaultViewport || { width: 1280, height: 720 }
    });
  } else {
    console.log('[Browser] Launching in development mode');
    const localChromePath = process.env.CHROME_PATH ||
      (process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome');

    return await puppeteer.launch({
      headless: true,
      executablePath: localChromePath,
      args: [...defaultArgs, ...(options.args || [])],
      defaultViewport: options.defaultViewport || { width: 1280, height: 720 }
    });
  }
}

module.exports = { launchBrowser, isProduction };
