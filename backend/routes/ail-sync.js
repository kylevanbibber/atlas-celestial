const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Check if running in production/cloud environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.HEROKU || process.env.RAILWAY_ENVIRONMENT;

/**
 * Launch browser with cloud-compatible settings
 * Uses @sparticuz/chromium in production, local Chrome in development
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
    // Production: use @sparticuz/chromium
    console.log('[AIL Sync] Launching browser in production mode with @sparticuz/chromium');
    return await puppeteer.launch({
      args: [...chromium.args, ...defaultArgs, ...(options.args || [])],
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: options.defaultViewport || { width: 1280, height: 720 }
    });
  } else {
    // Development: use local Chrome
    console.log('[AIL Sync] Launching browser in development mode');
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

// Store active sync sessions
const activeSessions = new Map();

/**
 * Start AIL appointments sync with live updates
 * POST /api/ail-sync/start
 */
router.post('/start', verifyToken, async (req, res) => {
  try {
    const { recruitId, recruitIds, credentials, isBatch } = req.body;
    const userId = req.user?.userId;
    const userClname = req.user?.clname;

    // Handle both single and batch requests
    const idsToSync = isBatch && recruitIds ? recruitIds : (recruitId ? [recruitId] : []);

    console.log('[AIL Sync] Start request:', {
      userId,
      userClname,
      recruitCount: idsToSync.length,
      isBatch,
      hasCredentials: !!credentials
    });

    // Verify user is MGA, RGA, or SGA
    if (!['MGA', 'RGA', 'SGA'].includes(userClname)) {
      console.log('[AIL Sync] Access denied for user:', userClname);
      return res.status(403).json({ 
        success: false, 
        message: `Only MGAs, RGAs, and SGAs can sync appointments. Your role: ${userClname || 'Unknown'}` 
      });
    }

    if (idsToSync.length === 0 || !credentials?.username || !credentials?.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: recruitIds and credentials are required' 
      });
    }

    // Get recruit data for all IDs
    const placeholders = idsToSync.map(() => '?').join(',');
    const recruits = await db.query(
      `SELECT 
        p.*,
        u.lagnname,
        nla.agtnum as nla_number,
        nla.lagnname as nla_name,
        nla.clname as nla_classification
      FROM pipeline p
      LEFT JOIN activeusers u ON p.recruiting_agent = u.id
      LEFT JOIN activeusers nla ON p.code_to = nla.id
      WHERE p.id IN (${placeholders})`,
      idsToSync
    );

    if (!recruits || recruits.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No recruits found with the provided IDs' 
      });
    }

    console.log(`[AIL Sync] Found ${recruits.length} recruits to sync`);

    // Generate session ID
    const sessionId = `sync-${userId}-${Date.now()}`;
    
    // Store session
    activeSessions.set(sessionId, {
      userId,
      recruitIds: idsToSync,
      isBatch: recruits.length > 1,
      status: 'starting',
      screenshots: [],
      batchProgress: {
        current: 0,
        total: recruits.length,
        completed: [],
        failed: []
      }
    });

    // Return session ID immediately
    res.json({ 
      success: true, 
      sessionId,
      message: `Sync started for ${recruits.length} recruit${recruits.length > 1 ? 's' : ''}` 
    });

    // Start sync process asynchronously (batch or single)
    if (recruits.length > 1) {
      performBatchSync(sessionId, recruits, credentials).catch(err => {
        console.error('[AIL Sync] Error in batch sync process:', err);
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = err.message;
        }
      });
    } else {
      performSync(sessionId, recruits[0], credentials).catch(err => {
        console.error('[AIL Sync] Error in sync process:', err);
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = err.message;
        }
      });
    }

  } catch (error) {
    console.error('[AIL Sync] Error starting sync:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to start sync' 
    });
  }
});

/**
 * Start AOB export with live updates
 * POST /api/ail-sync/aob-export-start
 */
router.post('/aob-export-start', verifyToken, async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = req.user?.userId;
    const userClname = req.user?.clname;

    console.log('[AIL AOB Export] Start request:', {
      userId,
      userClname,
      hasCredentials: !!username && !!password
    });

    // Verify user is MGA, RGA, or SGA
    if (!['MGA', 'RGA', 'SGA'].includes(userClname)) {
      console.log('[AIL AOB Export] Access denied for user:', userClname);
      return res.status(403).json({ 
        success: false, 
        message: `Only MGAs, RGAs, and SGAs can export AOB data. Your role: ${userClname || 'Unknown'}` 
      });
    }

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    // Generate session ID
    const sessionId = `aob-export-${userId}-${Date.now()}`;
    
    // Store session
    activeSessions.set(sessionId, {
      userId,
      status: 'starting',
      screenshots: [],
      currentStep: 'Initializing...'
    });

    // Return session ID immediately
    res.json({ 
      success: true, 
      sessionId,
      message: 'AOB export started' 
    });

    // Start export process asynchronously with error handling
    console.log('[AIL AOB Export] Starting performAOBExport for session:', sessionId);
    performAOBExport(sessionId, { username, password }).catch(err => {
      console.error('[AIL AOB Export] Fatal error in performAOBExport:', err);
      const session = activeSessions.get(sessionId);
      if (session) {
        session.status = 'error';
        session.error = err.message;
        session.currentStep = `Fatal error: ${err.message}`;
      }
    });

  } catch (error) {
    console.error('[AIL AOB Export] Error starting export:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to start AOB export' 
    });
  }
});

/**
 * Get sync session status and screenshots
 * GET /api/ail-sync/status/:sessionId
 */
router.get('/status/:sessionId', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ 
      success: false, 
      message: 'Session not found' 
    });
  }

  res.json({
    success: true,
    status: session.status,
    currentStep: session.currentStep,
    screenshot: session.screenshots[session.screenshots.length - 1],
    error: session.error,
    completedAt: session.completedAt,
    batchProgress: session.batchProgress,
    // AOB export specific fields
    inserted: session.inserted,
    skipped: session.skipped,
    linked: session.linked,
    recordsProcessed: session.recordsProcessed,
    errors: session.errors
  });
});

/**
 * Submit verification code for MFA
 * POST /api/ail-sync/verify-code
 */
router.post('/verify-code', verifyToken, async (req, res) => {
  try {
    const { sessionId, verificationCode } = req.body;
    
    console.log('[AIL Sync] Verification code received:', {
      sessionId,
      codeLength: verificationCode?.length
    });

    if (!sessionId || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and verification code are required'
      });
    }

    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    // Store the verification code in the session so the automation can use it
    session.verificationCode = verificationCode;
    console.log('[AIL Sync] Verification code stored in session');

    res.json({
      success: true,
      message: 'Verification code received'
    });

  } catch (error) {
    console.error('[AIL Sync] Error handling verification code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process verification code'
    });
  }
});

/**
 * Submit MFA code (alias for verify-code)
 * POST /api/ail-sync/submit-mfa/:sessionId
 */
router.post('/submit-mfa/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { code } = req.body;
    
    console.log('[AIL Sync] MFA code received:', {
      sessionId,
      codeLength: code?.length
    });

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required'
      });
    }

    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    // Store the verification code in the session so the automation can use it
    session.verificationCode = code;
    session.status = 'running'; // Resume automation
    console.log('[AIL Sync] MFA code stored in session, resuming automation');

    res.json({
      success: true,
      message: 'Verification code received'
    });

  } catch (error) {
    console.error('[AIL Sync] Error handling MFA code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process verification code'
    });
  }
});

/**
 * Perform the actual sync with Puppeteer
 */
async function performSync(sessionId, recruit, credentials) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  let browser;
  
  try {
    // Update status
    session.status = 'running';
    session.currentStep = 'Launching browser...';

    // Launch browser (headless so only modal shows progress)
    browser = await launchBrowser({
      args: ['--window-size=1280,720'],
      defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();

    // Helper to capture and store screenshot
    const captureStep = async (stepName, delay = 1000) => {
      session.currentStep = stepName;
      await new Promise(r => setTimeout(r, delay));
      const screenshot = await page.screenshot({ encoding: 'base64' });
      session.screenshots.push(`data:image/png;base64,${screenshot}`);
      console.log(`[AIL Sync] ${stepName}`);
    };

    // Navigate to AIL login page
    session.currentStep = 'Navigating to AIL portal...';
    await page.goto('https://agentappointments.ailife.com/Login.aspx?ReturnUrl=%2f', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await captureStep('Login page loaded');

    // Fill in username
    session.currentStep = 'Entering credentials...';
    await page.waitForSelector('input[name*="Username"]', { timeout: 10000 });
    await page.type('input[name*="Username"]', credentials.username);
    await captureStep('Username entered');

    // Fill in password
    await page.type('input[name*="Password"]', credentials.password);
    await captureStep('Password entered');

    // Click login button
    session.currentStep = 'Logging in...';
    await page.click('input[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await captureStep('Logged in successfully');

    // TODO: Navigate to appointment form
    // This is where you'd add the specific form navigation and filling
    session.currentStep = 'Looking for appointment form...';
    await captureStep('On main dashboard');

    // Example: Fill appointment form (adjust selectors based on actual form)
    /*
    await page.goto('/appointment-form-url');
    await captureStep('Appointment form loaded');
    
    await page.type('#agentName', `${recruit.recruit_first} ${recruit.recruit_last}`);
    await page.type('#agentEmail', recruit.email || '');
    await page.type('#agentPhone', recruit.phone || '');
    await page.type('#residentState', recruit.resident_state || '');
    await captureStep('Form fields filled');
    
    await page.click('#submitButton');
    await page.waitForNavigation();
    await captureStep('Form submitted successfully');
    */

    // Mark as complete
    session.status = 'success';
    session.currentStep = 'Sync completed successfully!';
    session.completedAt = new Date().toISOString();
    await captureStep('Process complete', 2000);

  } catch (error) {
    console.error('[AIL Sync] Sync error:', error);
    session.status = 'error';
    session.error = error.message;
    session.currentStep = `Error: ${error.message}`;
    
    // Try to capture error screenshot
    if (browser) {
      try {
        const page = (await browser.pages())[0];
        const screenshot = await page.screenshot({ encoding: 'base64' });
        session.screenshots.push(`data:image/png;base64,${screenshot}`);
      } catch (e) {
        console.error('[AIL Sync] Could not capture error screenshot:', e);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }

    // Clean up session after 5 minutes
    setTimeout(() => {
      activeSessions.delete(sessionId);
      console.log(`[AIL Sync] Session ${sessionId} cleaned up`);
    }, 5 * 60 * 1000);
  }
}

/**
 * Perform batch sync for multiple recruits
 */
async function performBatchSync(sessionId, recruits, credentials) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  let browser;
  
  try {
    session.status = 'running';
    session.currentStep = 'Launching browser for batch sync...';

    // Launch browser once for all recruits (headless so only modal shows progress)
    browser = await launchBrowser({
      args: ['--window-size=1280,720'],
      defaultViewport: { width: 1280, height: 720 }
    });

    const page = await browser.newPage();

    // Helper to capture screenshot
    const captureStep = async (stepName, delay = 1000) => {
      session.currentStep = stepName;
      await new Promise(r => setTimeout(r, delay));
      const screenshot = await page.screenshot({ encoding: 'base64' });
      session.screenshots.push(`data:image/png;base64,${screenshot}`);
      console.log(`[AIL Sync] ${stepName}`);
    };

    // Navigate to the SSO portal
    session.currentStep = 'Navigating to SSO portal...';
    await page.goto('https://sso.globelifeinc.com/AILPortal/SecurePortal.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await captureStep('SSO portal loaded');

    // Check if we need to login (redirected to SecureAuth)
    const ssoUrl = page.url();
    if (ssoUrl.includes('SecureAuth.aspx')) {
      session.currentStep = 'Login required, entering credentials...';
      
      // Wait for username field
      await page.waitForSelector('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', { timeout: 10000 });
      await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', credentials.username);
      await captureStep('Username entered');

      // Enter password
      await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_tbxPassword_UiInput', credentials.password);
      await captureStep('Password entered');

      // Click submit
      session.currentStep = 'Logging in...';
      await page.click('input[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      await captureStep('Logged in successfully');
    }

    // Now find and click the Agent Appointments link
    session.currentStep = 'Finding Agent Appointments portal...';
    
    // Try multiple selectors to find the link
    const appointmentsSelectors = [
      'a[href="https://agentappointments.ailife.com"]',
      'a[title="Agent Appointments AIL Login"]',
      'h5.portal__title:has-text("Agent Appointments AIL Login")'
    ];
    
    let foundSelector = null;
    for (const selector of appointmentsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        foundSelector = selector;
        console.log(`[AIL Sync] Found link with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`[AIL Sync] Selector ${selector} not found, trying next...`);
      }
    }
    
    if (!foundSelector) {
      throw new Error('Could not find Agent Appointments link on portal page');
    }
    
    await captureStep('Agent Appointments link found');
    
    // Since the link has target="_blank", it opens in a new tab
    // We need to get the href and navigate to it directly instead of clicking
    const appointmentsUrl = await page.$eval(foundSelector, el => el.href);
    console.log(`[AIL Sync] Navigating to: ${appointmentsUrl}`);
    
    session.currentStep = 'Opening Agent Appointments portal...';
    await page.goto(appointmentsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait a bit for any redirects to complete
    await new Promise(r => setTimeout(r, 2000));
    
    await captureStep('Agent Appointments portal loaded');

    // Check current URL - might be SAML redirect or login page
    const ailUrl = page.url();
    console.log(`[AIL Sync] Current URL after navigation: ${ailUrl}`);
    
    // If we're back at SSO portal (SAML redirect) or on a login page
    if (ailUrl.includes('sso.globelifeinc.com') || 
        ailUrl.includes('SAMLRequest') || 
        ailUrl.includes('Login.aspx') || 
        ailUrl.includes('login')) {
      
      console.log('[AIL Sync] SAML redirect or login page detected');
      session.currentStep = 'Handling SAML authentication...';
      
      // If it's a SAML redirect back to SSO, we need to login again
      if (ailUrl.includes('SAMLRequest') || ailUrl.includes('sso.globelifeinc.com')) {
        console.log('[AIL Sync] SAML authentication flow detected');
        await captureStep('Processing SAML authentication');
        
        // Wait for page to load
        await new Promise(r => setTimeout(r, 2000));
        
        // Check if we have the SecureAuth login fields
        const hasLoginFields = await page.$('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput');
        
        if (hasLoginFields) {
          console.log('[AIL Sync] SecureAuth login required for SAML');
          session.currentStep = 'Entering credentials for SAML...';
          
          // Wait for username field
          await page.waitForSelector('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', { timeout: 10000 });
          await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', credentials.username);
          await captureStep('SAML username entered');
          
          // Enter password
          await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_tbxPassword_UiInput', credentials.password);
          await captureStep('SAML password entered');
          
          // Click submit button (it's an <a> tag, not input)
          session.currentStep = 'Submitting SAML credentials...';
          
          // Try multiple selectors for submit button
          const submitSelectors = [
            'a.btn.btn-primary.btn--login',
            'a.btn-primary[title="Submit"]',
            'a:has-text("Submit")',
            'a.btn-primary',
            'input[type="submit"]'
          ];
          
          let submitButton = null;
          for (const selector of submitSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              submitButton = selector;
              console.log(`[AIL Sync] Found SAML submit button: ${selector}`);
              break;
            } catch (e) {
              // Try next selector
            }
          }
          
          if (submitButton) {
            await page.click(submitButton);
            console.log('[AIL Sync] Clicked SAML submit button');
          } else {
            console.warn('[AIL Sync] Could not find SAML submit button, trying Enter key');
            await page.keyboard.press('Enter');
          }
          
          // Wait for navigation after login (might be MFA page)
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 2000)); // Extra wait for page to settle
          
          const afterSamlUrl = page.url();
          console.log(`[AIL Sync] After SAML login: ${afterSamlUrl}`);
          await captureStep('SAML login submitted');
          
          // Check for MFA page (choose delivery method)
          const pageContent = await page.content();
          if (pageContent.includes('Please choose the delivery method for your Passcode') || 
              pageContent.includes('delivery method')) {
            console.log('[AIL Sync] MFA page detected');
            session.currentStep = 'Handling multi-factor authentication...';
            await captureStep('MFA page detected');
            
            // Select Phone/Mobile radio button using exact ID
            session.currentStep = 'Selecting Phone/Mobile delivery...';
            const phoneRadioId = '#ContentPlaceHolder1_MFALoginControl1_RegistrationMethodView_rbPhone1Full_UiInput';
            
            try {
              await page.waitForSelector(phoneRadioId, { timeout: 10000 });
              await page.click(phoneRadioId);
              console.log('[AIL Sync] ✅ Selected Phone/Mobile radio button');
              await new Promise(r => setTimeout(r, 1000)); // Wait for options to load
            } catch (e) {
              console.error('[AIL Sync] ❌ Could not find/click Phone/Mobile radio:', e.message);
              throw new Error('Could not select Phone/Mobile delivery option');
            }
            
            await captureStep('Phone/Mobile selected');
            
            // Select SMS/Text instead of Voice using exact ID
            session.currentStep = 'Selecting SMS/Text delivery...';
            const smsRadioId = '#rbVoiceSMSPhone1_SMS_label_UiInput';
            
            try {
              // Wait a bit for the SMS option to become enabled
              await new Promise(r => setTimeout(r, 1000));
              
              // Check if the SMS radio is now enabled
              await page.waitForSelector(smsRadioId, { timeout: 10000 });
              
              // Click it even if disabled attribute is present (Angular might handle it)
              await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element) {
                  element.click();
                }
              }, smsRadioId);
              
              console.log('[AIL Sync] ✅ Selected SMS/Text option');
              await new Promise(r => setTimeout(r, 500));
            } catch (e) {
              console.error('[AIL Sync] ❌ Could not find/click SMS/Text radio:', e.message);
              console.log('[AIL Sync] Continuing anyway, Voice might be acceptable...');
            }
            
            await captureStep('SMS/Text delivery selected');
            
            // Click Submit to send the code
            session.currentStep = 'Sending verification code...';
            const mfaSubmitSelector = 'a.btn.btn-primary.btn--login[title="Submit"]';
            
            try {
              await page.waitForSelector(mfaSubmitSelector, { timeout: 10000 });
              
              // Use evaluate to click since it's an Angular link
              await page.evaluate(() => {
                const submitBtn = document.querySelector('a.btn.btn-primary.btn--login[title="Submit"]');
                if (submitBtn) {
                  submitBtn.click();
                }
              });
              
              console.log('[AIL Sync] ✅ Clicked submit to send verification code');
            } catch (e) {
              console.error('[AIL Sync] ❌ Could not find MFA submit button:', e.message);
              throw new Error('Could not submit MFA delivery method');
            }
            
            // Wait for code entry page
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));
            await captureStep('Verification code sent - waiting for user input');
            
            // Now we need to wait for user to enter the verification code
            session.currentStep = '⏸️ PAUSED: Please enter the verification code you received via text';
            session.status = 'waiting_for_user';
            console.log('[AIL Sync] ⏸️ PAUSED: Waiting for user to enter verification code');
            
            // Take screenshot so user can see the code entry field
            await captureStep('Waiting for verification code entry', 1000);
            
            // Wait for the verification code to be provided by the user via API
            let codeEntered = false;
            let attempts = 0;
            const maxAttempts = 60; // Wait up to 5 minutes (check every 5 seconds)
            
            while (!codeEntered && attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 5000));
              
              // Check if user submitted code via API
              if (session.verificationCode) {
                console.log('[AIL Sync] ✅ Verification code received from user');
                session.currentStep = 'Entering verification code...';
                
                // Find the verification code input field
                const codeInputSelectors = [
                  'input[type="text"][placeholder*="code"]',
                  'input[type="text"][placeholder*="Code"]',
                  'input[id*="OTP"]',
                  'input[id*="passcode"]',
                  'input[id*="Passcode"]',
                  'input[name*="otp"]',
                  'input.form-control[type="text"]'
                ];
                
                let codeInput = null;
                for (const selector of codeInputSelectors) {
                  try {
                    codeInput = await page.$(selector);
                    if (codeInput) {
                      console.log(`[AIL Sync] Found verification code input: ${selector}`);
                      break;
                    }
                  } catch (e) {
                    // Try next
                  }
                }
                
                if (codeInput) {
                  await codeInput.type(session.verificationCode);
                  console.log('[AIL Sync] ✅ Typed verification code');
                  await new Promise(r => setTimeout(r, 1000)); // Wait for Angular validation
                  await captureStep('Verification code entered');
                  
                  // Click the verification code submit button (RegCodeButton)
                  session.currentStep = 'Submitting verification code...';
                  const verifySubmitSelector = 'a.btn.btn-primary.btn--login[ng-click*="RegCodeButton"]';
                  
                  try {
                    await page.waitForSelector(verifySubmitSelector, { timeout: 5000 });
                    
                    // Use evaluate to click the Angular-controlled link
                    await page.evaluate(() => {
                      const submitBtn = document.querySelector('a.btn.btn-primary.btn--login[ng-click*="RegCodeButton"]');
                      if (submitBtn) {
                        submitBtn.click();
                      }
                    });
                    
                    console.log('[AIL Sync] ✅ Clicked verification code submit button');
                  } catch (e) {
                    console.error('[AIL Sync] ❌ Could not find verification submit button:', e.message);
                    console.log('[AIL Sync] Trying fallback: pressing Enter');
                    await page.keyboard.press('Enter');
                  }
                  
                  // Wait for navigation
                  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                  await new Promise(r => setTimeout(r, 2000));
                  
                  codeEntered = true;
                  session.status = 'running';
                  session.currentStep = 'Verification successful, continuing...';
                  session.verificationCode = null; // Clear it
                  
                  const afterVerifyUrl = page.url();
                  console.log(`[AIL Sync] After verification: ${afterVerifyUrl}`);
                  await captureStep('Verification complete');
                  
                  // Check if we're back at the SSO portal (common after MFA)
                  if (afterVerifyUrl.includes('sso.globelifeinc.com/AILPortal')) {
                    console.log('[AIL Sync] Redirected back to SSO portal after MFA');
                    session.currentStep = 'Returning to Agent Appointments...';
                    await captureStep('Back at SSO portal');
                    
                    // Find and click Agent Appointments link again
                    const appointmentsSelectors = [
                      'a[href="https://agentappointments.ailife.com"]',
                      'a[title="Agent Appointments AIL Login"]'
                    ];
                    
                    let foundLink = null;
                    for (const selector of appointmentsSelectors) {
                      try {
                        await page.waitForSelector(selector, { timeout: 5000 });
                        foundLink = selector;
                        console.log(`[AIL Sync] Found Agent Appointments link again: ${selector}`);
                        break;
                      } catch (e) {
                        console.log(`[AIL Sync] Selector ${selector} not found`);
                      }
                    }
                    
                    if (!foundLink) {
                      throw new Error('Could not find Agent Appointments link after MFA');
                    }
                    
                    // Get the href and navigate (avoid target="_blank")
                    const appointmentsHref = await page.$eval(foundLink, el => el.href);
                    console.log(`[AIL Sync] Navigating to appointments: ${appointmentsHref}`);
                    
                    await page.goto(appointmentsHref, { waitUntil: 'networkidle2', timeout: 30000 });
                    await new Promise(r => setTimeout(r, 2000));
                    await captureStep('Agent Appointments portal loaded (post-MFA)');
                  }
                  
                } else {
                  throw new Error('Could not find verification code input field');
                }
              } else {
                // Update screenshot while waiting
                const screenshot = await page.screenshot({ encoding: 'base64' });
                session.screenshots[session.screenshots.length - 1] = `data:image/png;base64,${screenshot}`;
              }
              
              attempts++;
            }
            
            if (!codeEntered) {
              throw new Error('Verification code was not entered within the time limit (5 minutes)');
            }
          }
        } else {
          console.log('[AIL Sync] No login fields found, waiting for automatic redirect...');
          // Wait for the SAML to complete and redirect to appointments site
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 2000));
          
          const afterSamlUrl = page.url();
          console.log(`[AIL Sync] After SAML redirect: ${afterSamlUrl}`);
          await captureStep('SAML authentication completed');
        }
      }
      
      // Now check if we're on a login page (non-SAML)
      const finalUrl = page.url();
      if (finalUrl.includes('Login.aspx') || (finalUrl.includes('login') && !finalUrl.includes('sso.globelifeinc.com'))) {
        session.currentStep = 'Agent Appointments login required...';
        console.log('[AIL Sync] Login page detected, entering credentials...');
        
        // Wait for username field (try multiple selectors)
        const usernameSelectors = [
          'input[name*="Username"]',
          'input[id*="Username"]',
          'input[type="text"]',
          '#ContentPlaceHolder1_txtUsername',
          'input[name*="txtUsername"]'
        ];
        
        let usernameField = null;
        for (const selector of usernameSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            usernameField = selector;
            console.log(`[AIL Sync] Found username field: ${selector}`);
            break;
          } catch (e) {
            // Try next selector
          }
        }
        
        if (!usernameField) {
          throw new Error('Could not find username field on AIL login page');
        }
        
        await page.type(usernameField, credentials.username);
        await captureStep('AIL username entered');
        
        // Wait for password field
        const passwordSelectors = [
          'input[name*="Password"]',
          'input[id*="Password"]',
          'input[type="password"]',
          '#ContentPlaceHolder1_txtPassword',
          'input[name*="txtPassword"]'
        ];
        
        let passwordField = null;
        for (const selector of passwordSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            passwordField = selector;
            console.log(`[AIL Sync] Found password field: ${selector}`);
            break;
          } catch (e) {
            // Try next selector
          }
        }
        
        if (!passwordField) {
          throw new Error('Could not find password field on AIL login page');
        }
        
        await page.type(passwordField, credentials.password);
        await captureStep('AIL password entered');
        
        // Click login/submit button
        session.currentStep = 'Logging into AIL Appointments...';
        const loginButtonSelectors = [
          'input[type="submit"]',
          'button[type="submit"]',
          '#ContentPlaceHolder1_btnLogin',
          'input[value*="Login"]',
          'button:has-text("Login")'
        ];
        
        let loginButton = null;
        for (const selector of loginButtonSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            loginButton = selector;
            console.log(`[AIL Sync] Found login button: ${selector}`);
            break;
          } catch (e) {
            // Try next selector
          }
        }
        
        if (loginButton) {
          await page.click(loginButton);
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await captureStep('Logged into AIL Appointments');
        } else {
          console.warn('[AIL Sync] Login button not found, trying to continue anyway...');
        }
      }
    }

    // Check final URL after authentication
    const finalPageUrl = page.url();
    console.log(`[AIL Sync] Final URL after all authentication: ${finalPageUrl}`);
    await captureStep('Authentication complete, checking page');
    
    // Check if we're on the AgencyAdmin.aspx page (welcome/agreement page)
    if (finalPageUrl.includes('AgencyAdmin.aspx')) {
      console.log('[AIL Sync] On AgencyAdmin.aspx page, looking for Save & Continue button...');
      session.currentStep = 'Clicking Save & Continue...';
      
      // Click the Save & Continue button with exact selector
      const saveButtonSelector = '#cphMain_btnGo';
      
      try {
        await page.waitForSelector(saveButtonSelector, { timeout: 5000 });
        console.log('[AIL Sync] ✅ Found Save & Continue button');
        
        // Click and wait for navigation with Promise.race to handle both navigation and timeout
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
            page.click(saveButtonSelector)
          ]);
          console.log('[AIL Sync] ✅ Navigation completed');
        } catch (navError) {
          console.log('[AIL Sync] ⚠️ Navigation timeout, but page may have loaded. Checking...');
          // Wait a bit for any async operations
          await new Promise(r => setTimeout(r, 3000));
        }
        
        const mainPageUrl = page.url();
        console.log(`[AIL Sync] After Save & Continue: ${mainPageUrl}`);
        await captureStep('Save & Continue clicked, at main page');
      } catch (e) {
        console.error('[AIL Sync] ❌ Could not find Save & Continue button:', e.message);
        // Try fallback selectors
        const fallbackSelectors = [
          'input[id*="btnGo"]',
          'input[value*="Save"][value*="Continue"]',
          'input[type="submit"][value*="Continue"]'
        ];
        
        let foundFallback = false;
        for (const selector of fallbackSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
            
            // Click and wait for navigation (with timeout handling)
            try {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
                page.click(selector)
              ]);
            } catch (navError) {
              console.log('[AIL Sync] ⚠️ Fallback navigation timeout, continuing...');
              await new Promise(r => setTimeout(r, 3000));
            }
            
            console.log(`[AIL Sync] ✅ Used fallback selector: ${selector}`);
            foundFallback = true;
            break;
          } catch (e2) {
            // Try next
          }
        }
        
        if (!foundFallback) {
          console.warn('[AIL Sync] ⚠️ No Save & Continue button found, continuing anyway...');
        }
      }
    } else {
      console.log('[AIL Sync] Not on AgencyAdmin.aspx page, no Save & Continue needed');
      await captureStep('On appointments page');
    }

    // Process each recruit
    for (let i = 0; i < recruits.length; i++) {
      const recruit = recruits[i];
      
      try {
        session.currentStep = `Processing ${i + 1}/${recruits.length}: ${recruit.recruit_first} ${recruit.recruit_last}...`;
        session.batchProgress.current = i + 1;
        
        // Navigate to Invitations list page
        session.currentStep = `${i + 1}/${recruits.length}: Navigating to Invitations...`;
        console.log('[AIL Sync] Navigating to Invitations page...');
        
        try {
          await page.goto('https://agentappointments.ailife.com/Invitation/Invitations.aspx', { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
          });
          await new Promise(r => setTimeout(r, 2000));
          console.log('[AIL Sync] ✅ At Invitations page');
          await captureStep('At Invitations page');
        } catch (e) {
          console.error('[AIL Sync] ❌ Could not navigate to Invitations page:', e.message);
          throw new Error('Could not navigate to Invitations page');
        }
        
        // Click "Start a new Invitation" button
        session.currentStep = `${i + 1}/${recruits.length}: Starting new invitation...`;
        const startNewSelector = '#cphMain_btnNewApp';
        
        try {
          await page.waitForSelector(startNewSelector, { timeout: 10000 });
          console.log('[AIL Sync] Found Start button, clicking...');
          
          // Click and wait for navigation
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            page.evaluate(() => {
              const btn = document.querySelector('#cphMain_btnNewApp');
              if (btn) {
                btn.click();
              }
            })
          ]);
          
          await new Promise(r => setTimeout(r, 2000)); // Wait for form to initialize
          console.log('[AIL Sync] ✅ At invitation form');
          await captureStep('At invitation form');
        } catch (e) {
          console.error('[AIL Sync] ❌ Could not start new invitation:', e.message);
          throw new Error('Could not start new invitation');
        }
        
        // Fill in the form
        session.currentStep = `${i + 1}/${recruits.length}: Filling form for ${recruit.recruit_first} ${recruit.recruit_last}...`;
        
        // Wait for the Application Type dropdown to be available
        try {
          await page.waitForSelector('#cphMain_cmbApplicationType', { timeout: 10000 });
        } catch (e) {
          console.error('[AIL Sync] ❌ Application Type dropdown not found');
          throw new Error('Form did not load properly - Application Type field missing');
        }
        
        // 1. Application Type - Select "Invitation" (value="2")
        await page.select('#cphMain_cmbApplicationType', '2');
        console.log('[AIL Sync] ✅ Selected Application Type: Invitation');
        await new Promise(r => setTimeout(r, 1000)); // Wait for any dynamic form changes
        
        // 2. Company is already set to "AIL - US" by default
        
        // 3. Agent Type - should be "Career Agent" by default
        
        // 4. Next Level Agent # - from code_to's agtnum
        if (recruit.nla_number) {
          await page.type('#cphMain_txtNLA', recruit.nla_number);
          console.log(`[AIL Sync] Entered NLA: ${recruit.nla_number} (${recruit.nla_name})`);
          await new Promise(r => setTimeout(r, 500));
          
          // Click Submit button for NLA
          await page.click('#cphMain_btnNLA');
          console.log('[AIL Sync] Clicked NLA Submit button');
          await new Promise(r => setTimeout(r, 2000)); // Wait for validation
          
          // Check for error message
          const errorElement = await page.$('td.field.left[style*="color: red"]');
          const hasError = errorElement !== null;
          
          if (hasError) {
            console.log('[AIL Sync] ⚠️ NLA not obtainable, opening search...');
            
            // Click Search NLA link
            await page.click('#cphMain_SearchNLA');
            await new Promise(r => setTimeout(r, 2000)); // Wait for search dialog
            
            // Parse NLA name (format: "Last First Middle Suffix")
            const nameParts = recruit.nla_name.split(' ');
            const lastName = nameParts[0];
            const firstName = nameParts[1] || '';
            
            console.log(`[AIL Sync] Searching for NLA: ${firstName} ${lastName}`);
            
            // Select agent type based on classification
            let agentTypeValue = 'GA'; // Default to GA
            if (recruit.nla_classification) {
              if (recruit.nla_classification === 'MGA' || recruit.nla_classification === 'RGA') {
                agentTypeValue = 'MGA';
              } else if (recruit.nla_classification === 'SA') {
                agentTypeValue = 'SA';
              }
            }
            
            const agentTypeSelector = `input[name="ctl00$cphMain$RadWindowNLASearch$C$rblAgentType"][value="${agentTypeValue}"]`;
            try {
              await page.click(agentTypeSelector);
              console.log(`[AIL Sync] Selected Agent Type: ${agentTypeValue}`);
              await new Promise(r => setTimeout(r, 500));
            } catch (e) {
              console.warn(`[AIL Sync] Could not select agent type: ${agentTypeValue}`);
            }
            
            // Enter last name in search field
            const searchLastNameSelector = '#ctl00_cphMain_RadWindowNLASearch_C_txtLastName';
            try {
              await page.type(searchLastNameSelector, lastName);
              console.log(`[AIL Sync] Entered last name for search: ${lastName}`);
              
              // Click search button
              const searchButtonSelector = '#ctl00_cphMain_RadWindowNLASearch_C_btnSearch';
              await page.click(searchButtonSelector);
              await new Promise(r => setTimeout(r, 2000)); // Wait for results
              
              // Find matching row in results table
              const rows = await page.$$('#ctl00_cphMain_RadWindowNLASearch_C_grdNLASearch tr.WhiteChromeRowStyle, #ctl00_cphMain_RadWindowNLASearch_C_grdNLASearch tr.WhiteChromeAltRowStyle');
              
              let foundMatch = false;
              for (const row of rows) {
                const rowFirstName = await row.$eval('td:nth-child(2) a', el => el.textContent.trim()).catch(() => '');
                const rowLastName = await row.$eval('td:nth-child(3) a', el => el.textContent.trim()).catch(() => '');
                
                if (rowFirstName.toUpperCase() === firstName.toUpperCase() && 
                    rowLastName.toUpperCase() === lastName.toUpperCase()) {
                  // Click on the agent number link
                  await row.$eval('td:nth-child(1) a', el => el.click());
                  console.log(`[AIL Sync] ✅ Selected matching NLA: ${rowFirstName} ${rowLastName}`);
                  foundMatch = true;
                  await new Promise(r => setTimeout(r, 1000));
                  break;
                }
              }
              
              if (!foundMatch) {
                console.warn(`[AIL Sync] ⚠️ No matching NLA found for ${firstName} ${lastName}`);
              }
              
            } catch (e) {
              console.error('[AIL Sync] ❌ Error during NLA search:', e.message);
            }
          } else {
            console.log('[AIL Sync] ✅ NLA accepted');
          }
        }
        
        // 5. Applicant First Name
        if (recruit.recruit_first) {
          await page.type('#cphMain_txtFirstName', recruit.recruit_first);
          console.log(`[AIL Sync] Entered First Name: ${recruit.recruit_first}`);
          await new Promise(r => setTimeout(r, 300));
        }
        
        // 6. Middle Initial (correct field ID)
        if (recruit.recruit_middle) {
          await page.type('#cphMain_txtMiddleName', recruit.recruit_middle.charAt(0));
          console.log(`[AIL Sync] Entered Middle Initial: ${recruit.recruit_middle.charAt(0)}`);
          await new Promise(r => setTimeout(r, 300));
        }
        
        // 7. Applicant Last Name
        if (recruit.recruit_last) {
          await page.type('#cphMain_txtLastName', recruit.recruit_last);
          console.log(`[AIL Sync] Entered Last Name: ${recruit.recruit_last}`);
          await new Promise(r => setTimeout(r, 300));
        }
        
        // 8. Applicant Email Address (use 'email' field from pipeline table)
        if (recruit.email) {
          await page.type('#cphMain_txtEmail', recruit.email);
          console.log(`[AIL Sync] Entered Email: ${recruit.email}`);
          await new Promise(r => setTimeout(r, 500));
        }
        
        // 9. State/Province - from recruit data (use resident_state from pipeline table)
        if (recruit.resident_state) {
          const stateSelector = '#cphMain_cmbState';
          try {
            // Wait for the state dropdown to be available
            await page.waitForSelector(stateSelector, { timeout: 5000 });
            
            // Get available options for debugging
            const availableStates = await page.evaluate((selector) => {
              const select = document.querySelector(selector);
              return Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }));
            }, stateSelector);
            console.log('[AIL Sync] Available states:', availableStates.length);
            console.log(`[AIL Sync] Trying to select state: "${recruit.resident_state}"`);
            
            // Select the state
            await page.select(stateSelector, recruit.resident_state);
            console.log(`[AIL Sync] ✅ Selected State: ${recruit.resident_state}`);
            
            // Wait for postback to complete
            await new Promise(r => setTimeout(r, 2000));
            await captureStep(`State selected: ${recruit.resident_state}`);
          } catch (e) {
            console.error(`[AIL Sync] ❌ Could not select state: ${recruit.resident_state}`, e.message);
            console.error('[AIL Sync] Error details:', e);
            await captureStep(`State selection failed: ${recruit.resident_state}`);
          }
        } else {
          console.warn('[AIL Sync] ⚠️ No resident_state value found for recruit');
        }
        
        // 10. Commission Schedule - Select 50%
        try {
          const commissionSelector = '#cphMain_cmbCommissionLevel';
          
          // Wait for commission dropdown to be available (may appear after state selection)
          await page.waitForSelector(commissionSelector, { timeout: 5000 });
          
          // Get available options for debugging
          const availableCommissions = await page.evaluate((selector) => {
            const select = document.querySelector(selector);
            if (!select) return null;
            return Array.from(select.options).map(opt => ({ value: opt.value, text: opt.text }));
          }, commissionSelector);
          console.log('[AIL Sync] Available commission levels:', availableCommissions);
          
          // Select 50%
          await page.select(commissionSelector, '50.00');
          console.log('[AIL Sync] ✅ Selected Commission Level: 50%');
          await new Promise(r => setTimeout(r, 500));
          await captureStep('Commission level: 50%');
        } catch (e) {
          console.error('[AIL Sync] ❌ Could not select commission level:', e.message);
          console.error('[AIL Sync] Error details:', e);
          await captureStep('Commission selection failed');
        }
        
        // 11. Spanish Market - default to No for now
        // TODO: Add field to recruit table if needed
        
        // 12. EFT APPROVED - default values
        // TODO: Add fields to recruit table if needed
        
        // 13. Is personal Recruit - select Yes (value="1")
        try {
          await page.click('#cphMain_rblPersonalRecruit_0');
          console.log('[AIL Sync] ✅ Selected Personal Recruit: Yes');
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.warn('[AIL Sync] ⚠️ Could not click Personal Recruit radio');
        }
        
        await captureStep(`Form filled for ${recruit.recruit_first} ${recruit.recruit_last}`);
        
        // Click "Save & Continue" button
        session.currentStep = `${i + 1}/${recruits.length}: Saving invitation...`;
        try {
          await page.waitForSelector('#cphMain_btnContinue', { timeout: 5000 });
          console.log('[AIL Sync] Clicking Save & Continue...');
          
          // Click and wait for navigation
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {
              console.log('[AIL Sync] Navigation timeout, but may have succeeded');
            }),
            page.click('#cphMain_btnContinue')
          ]);
          
          await new Promise(r => setTimeout(r, 2000));
          
          const afterSaveUrl = page.url();
          console.log(`[AIL Sync] ✅ After Save & Continue: ${afterSaveUrl}`);
          await captureStep(`Invitation saved for ${recruit.recruit_first} ${recruit.recruit_last}`);
          
          // Check if we're on the verification page
          if (afterSaveUrl.includes('InvitationVerification.aspx')) {
            console.log('[AIL Sync] On verification page, acknowledging hierarchy...');
            session.currentStep = `${i + 1}/${recruits.length}: Acknowledging hierarchy...`;
            
            // Check the acknowledgement checkbox
            try {
              await page.waitForSelector('#cphMain_cbHierarchyAcknowledgement', { timeout: 5000 });
              await page.click('#cphMain_cbHierarchyAcknowledgement');
              console.log('[AIL Sync] ✅ Checked hierarchy acknowledgement');
              await new Promise(r => setTimeout(r, 500));
              await captureStep('Hierarchy acknowledged');
            } catch (e) {
              console.error('[AIL Sync] ❌ Could not check acknowledgement:', e.message);
              throw new Error('Could not check hierarchy acknowledgement');
            }
            
            // Click "Send Invitation" button
            session.currentStep = `${i + 1}/${recruits.length}: Sending invitation...`;
            try {
              await page.waitForSelector('#cphMain_btnSubmit', { timeout: 5000 });
              console.log('[AIL Sync] Clicking Send Invitation...');
              
              // Click and wait for navigation/confirmation
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {
                  console.log('[AIL Sync] Navigation timeout after send');
                }),
                page.click('#cphMain_btnSubmit')
              ]);
              
              await new Promise(r => setTimeout(r, 2000));
              
              const finalUrl = page.url();
              console.log(`[AIL Sync] ✅ After Send Invitation: ${finalUrl}`);
              console.log(`[AIL Sync] ✅ Invitation sent for ${recruit.recruit_first} ${recruit.recruit_last}`);
              await captureStep(`Invitation sent successfully for ${recruit.recruit_first} ${recruit.recruit_last}`);
              
              // Add row to AOBUpdates table after successful invitation
              try {
                const agentName = [
                  recruit.recruit_last,
                  [recruit.recruit_first, recruit.recruit_middle, recruit.recruit_suffix].filter(Boolean).join(' ')
                ].filter(Boolean).join(', ');
                
                const today = new Date();
                const importDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
                
                const aobResult = await db.query(
                  `INSERT INTO AOBUpdates 
                    (ImportDate, STPROV, Agent, SGAName, ApplicantPhoneNumber, EmailAddress, Company, WFStatus, WFStep, StepStatus, LastUpdated)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                  [
                    importDate,
                    recruit.resident_state || null,
                    agentName,
                    'ARIAS-DIULUS-ADAMS',
                    recruit.phone || null,
                    recruit.email || null,
                    'AIL-US',
                    'Invitation sent',
                    'IS',
                    'In progress'
                  ]
                );
                
                const aobId = aobResult.insertId;
                console.log(`[AIL Sync] ✅ Added AOBUpdates row for ${agentName} with ID: ${aobId}`);
                
                // Update pipeline.aob with the new AOBUpdates.id
                await db.query(
                  `UPDATE pipeline SET aob = ? WHERE id = ?`,
                  [aobId, recruit.id]
                );
                console.log(`[AIL Sync] ✅ Updated pipeline.aob for recruit ${recruit.id} with AOBUpdates ID: ${aobId}`);
                
              } catch (aobError) {
                console.error('[AIL Sync] ⚠️ Could not add AOBUpdates row:', aobError.message);
                // Don't throw - this is a secondary action, invitation was still successful
              }
              
            } catch (e) {
              console.error('[AIL Sync] ❌ Could not send invitation:', e.message);
              throw new Error('Could not send invitation');
            }
          } else {
            console.log('[AIL Sync] ⚠️ Not on verification page, skipping acknowledgement step');
          }
          
        } catch (e) {
          console.error('[AIL Sync] ❌ Could not complete invitation process:', e.message);
          throw new Error('Could not complete invitation process');
        }
        
        session.batchProgress.completed.push(recruit.id);
        await captureStep(`Completed ${recruit.recruit_first} ${recruit.recruit_last}`);
        
      } catch (recruitError) {
        console.error(`[AIL Sync] Error processing recruit ${recruit.id}:`, recruitError);
        session.batchProgress.failed.push({
          id: recruit.id,
          name: `${recruit.recruit_first} ${recruit.recruit_last}`,
          error: recruitError.message
        });
        // Continue with next recruit
      }
    }

    // Mark as complete
    const successCount = session.batchProgress.completed.length;
    const failedCount = session.batchProgress.failed.length;
    session.status = failedCount > 0 ? 'error' : 'success';
    session.currentStep = `Batch sync completed: ${successCount} succeeded, ${failedCount} failed`;
    session.completedAt = new Date().toISOString();
    await captureStep('Batch process complete', 2000);

  } catch (error) {
    console.error('[AIL Sync] Batch sync error:', error);
    session.status = 'error';
    session.error = error.message;
    session.currentStep = `Error: ${error.message}`;
    
    // Try to capture error screenshot
    if (browser) {
      try {
        const page = (await browser.pages())[0];
        const screenshot = await page.screenshot({ encoding: 'base64' });
        session.screenshots.push(`data:image/png;base64,${screenshot}`);
      } catch (e) {
        console.error('[AIL Sync] Could not capture error screenshot:', e);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }

    // Clean up session after 5 minutes
    setTimeout(() => {
      activeSessions.delete(sessionId);
      console.log(`[AIL Sync] Session ${sessionId} cleaned up`);
    }, 5 * 60 * 1000);
  }
}

/**
 * Export AOB Updates from AIL Portal
 * POST /api/ail-sync/export-aob
 */
router.post('/export-aob', verifyToken, async (req, res) => {
  try {
    const { credentials } = req.body;
    const userId = req.user?.userId;
    const userClname = req.user?.clname;

    console.log('[AIL AOB Export] Start request:', { userId, userClname, hasCredentials: !!credentials });

    // Verify user is MGA, RGA, or SGA
    if (!['MGA', 'RGA', 'SGA'].includes(userClname)) {
      return res.status(403).json({ 
        success: false, 
        message: `Only MGAs, RGAs, and SGAs can export AOB updates. Your role: ${userClname || 'Unknown'}` 
      });
    }

    if (!credentials?.username || !credentials?.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required credentials' 
      });
    }

    // Generate session ID
    const sessionId = `export-aob-${userId}-${Date.now()}`;
    
    // Store session
    activeSessions.set(sessionId, {
      userId,
      type: 'export-aob',
      status: 'starting',
      currentStep: 'Initializing export...',
      screenshots: [],
      startedAt: new Date().toISOString(),
      recordsProcessed: 0
    });

    // Return immediately, process in background
    res.json({ 
      success: true, 
      sessionId,
      message: 'AOB export started' 
    });

    // Start background process
    performAOBExport(sessionId, credentials).catch(err => {
      console.error('[AIL AOB Export] Background error:', err);
    });

  } catch (error) {
    console.error('[AIL AOB Export] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * Background process for AOB export
 */
async function performAOBExport(sessionId, credentials) {
  console.log('[AIL AOB Export] 🚀 Function started, sessionId:', sessionId);
  
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error('[AIL AOB Export] ❌ Session not found!');
    return;
  }

  let browser = null;
  let page = null;
  
  // Helper to capture screenshots
  const captureStep = async (stepName, delay = 500) => {
    try {
      if (!page) {
        console.warn('[AIL AOB Export] ⚠️ No page available for screenshot');
        return;
      }
      await new Promise(r => setTimeout(r, delay));
      const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
      session.screenshots.push(`data:image/png;base64,${screenshot}`);
      console.log(`[AIL AOB Export] 📸 ${stepName}`);
    } catch (e) {
      console.error('[AIL AOB Export] Screenshot error:', e.message);
    }
  };

  try {
    console.log('[AIL AOB Export] Setting status to running...');
    session.status = 'running';
    session.currentStep = 'Launching browser...';
    
    // Launch browser
    console.log('[AIL AOB Export] Launching Puppeteer...');
    browser = await launchBrowser({
      defaultViewport: { width: 1280, height: 1024 }
    });
    console.log('[AIL AOB Export] ✅ Browser launched successfully');

    page = await browser.newPage();
    console.log('[AIL AOB Export] ✅ New page created');
    
    await page.setViewport({ width: 1280, height: 1024 });
    console.log('[AIL AOB Export] ✅ Viewport set');

    // Set download path
    const downloadPath = path.join(__dirname, '../downloads');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
      console.log('[AIL AOB Export] ✅ Download directory created');
    }

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadPath
    });
    console.log('[AIL AOB Export] ✅ Download behavior configured');

    // ===== AUTHENTICATION FLOW (SAME AS performBatchSync) =====
    
    // Navigate to the SSO portal
    session.currentStep = 'Navigating to SSO portal...';
    await page.goto('https://sso.globelifeinc.com/AILPortal/SecurePortal.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await captureStep('SSO portal loaded');

    // Check if we need to login (redirected to SecureAuth)
    const ssoUrl = page.url();
    if (ssoUrl.includes('SecureAuth.aspx')) {
      session.currentStep = 'Login required, entering credentials...';
      
      // Wait for username field
      await page.waitForSelector('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', { timeout: 10000 });
      await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', credentials.username);
      await captureStep('Username entered');

      // Enter password
      await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_tbxPassword_UiInput', credentials.password);
      await captureStep('Password entered');

      // Click submit
      session.currentStep = 'Logging in...';
      await page.click('input[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      await captureStep('Logged in successfully');
    }

    // Now find and click the Agent Appointments link
    session.currentStep = 'Finding Agent Appointments portal...';
    
    const appointmentsSelectors = [
      'a[href="https://agentappointments.ailife.com"]',
      'a[title="Agent Appointments AIL Login"]'
    ];
    
    let foundSelector = null;
    for (const selector of appointmentsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        foundSelector = selector;
        console.log(`[AIL AOB Export] Found link with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`[AIL AOB Export] Selector ${selector} not found, trying next...`);
      }
    }
    
    if (!foundSelector) {
      throw new Error('Could not find Agent Appointments link on portal page');
    }
    
    await captureStep('Agent Appointments link found');
    
    // Get the href and navigate to it directly (avoid target="_blank")
    const appointmentsUrl = await page.$eval(foundSelector, el => el.href);
    console.log(`[AIL AOB Export] Navigating to: ${appointmentsUrl}`);
    
    session.currentStep = 'Opening Agent Appointments portal...';
    await page.goto(appointmentsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await captureStep('Agent Appointments portal loaded');

    // Check current URL - might be SAML redirect
    const ailUrl = page.url();
    console.log(`[AIL AOB Export] Current URL after navigation: ${ailUrl}`);
    
    // If SAML redirect or login page, handle it (same as batch sync)
    if (ailUrl.includes('sso.globelifeinc.com') || ailUrl.includes('SAMLRequest') || ailUrl.includes('Login.aspx')) {
      console.log('[AIL AOB Export] SAML redirect or login page detected');
      session.currentStep = 'Handling SAML authentication...';
      
      if (ailUrl.includes('SAMLRequest') || ailUrl.includes('sso.globelifeinc.com')) {
        console.log('[AIL AOB Export] SAML authentication flow detected');
        await captureStep('Processing SAML authentication');
        await new Promise(r => setTimeout(r, 2000));
        
        const hasLoginFields = await page.$('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput');
        
        if (hasLoginFields) {
          console.log('[AIL AOB Export] SecureAuth login required for SAML');
          session.currentStep = 'Entering credentials for SAML...';
          
          await page.waitForSelector('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', { timeout: 10000 });
          await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_txtUserid_UiInput', credentials.username);
          await captureStep('SAML username entered');
          
          await page.type('#ContentPlaceHolder1_MFALoginControl1_UserIDView_tbxPassword_UiInput', credentials.password);
          await captureStep('SAML password entered');
          
          session.currentStep = 'Submitting SAML credentials...';
          
          const submitSelectors = [
            'a.btn.btn-primary.btn--login',
            'a.btn-primary[title="Submit"]',
            'input[type="submit"]'
          ];
          
          let submitButton = null;
          for (const selector of submitSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              submitButton = selector;
              console.log(`[AIL AOB Export] Found SAML submit button: ${selector}`);
              break;
            } catch (e) {
              // Try next
            }
          }
          
          if (submitButton) {
            await page.click(submitButton);
            console.log('[AIL AOB Export] Clicked SAML submit button');
          } else {
            console.warn('[AIL AOB Export] Could not find SAML submit button, trying Enter key');
            await page.keyboard.press('Enter');
          }
          
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 2000));
          
          const afterSamlUrl = page.url();
          console.log(`[AIL AOB Export] After SAML login: ${afterSamlUrl}`);
          await captureStep('SAML login submitted');
          
          // Check for MFA page (choose delivery method)
          const pageContent = await page.content();
          if (pageContent.includes('Please choose the delivery method for your Passcode') || 
              pageContent.includes('delivery method')) {
            console.log('[AIL AOB Export] MFA page detected');
            session.currentStep = 'Handling multi-factor authentication...';
            await captureStep('MFA page detected');
            
            // Select Phone/Mobile radio button using exact ID
            session.currentStep = 'Selecting Phone/Mobile delivery...';
            const phoneRadioId = '#ContentPlaceHolder1_MFALoginControl1_RegistrationMethodView_rbPhone1Full_UiInput';
            
            try {
              await page.waitForSelector(phoneRadioId, { timeout: 10000 });
              await page.click(phoneRadioId);
              console.log('[AIL AOB Export] ✅ Selected Phone/Mobile radio button');
              await new Promise(r => setTimeout(r, 1000)); // Wait for options to load
            } catch (e) {
              console.error('[AIL AOB Export] ❌ Could not find/click Phone/Mobile radio:', e.message);
              throw new Error('Could not select Phone/Mobile delivery option');
            }
            
            await captureStep('Phone/Mobile selected');
            
            // Select SMS/Text instead of Voice using exact ID
            session.currentStep = 'Selecting SMS/Text delivery...';
            const smsRadioId = '#rbVoiceSMSPhone1_SMS_label_UiInput';
            
            try {
              // Wait a bit for the SMS option to become enabled
              await new Promise(r => setTimeout(r, 1000));
              
              // Check if the SMS radio is now enabled
              await page.waitForSelector(smsRadioId, { timeout: 10000 });
              
              // Click it even if disabled attribute is present (Angular might handle it)
              await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                if (element) {
                  element.click();
                }
              }, smsRadioId);
              
              console.log('[AIL AOB Export] ✅ Selected SMS/Text option');
              await new Promise(r => setTimeout(r, 500));
            } catch (e) {
              console.error('[AIL AOB Export] ❌ Could not find/click SMS/Text radio:', e.message);
              console.log('[AIL AOB Export] Continuing anyway, Voice might be acceptable...');
            }
            
            await captureStep('SMS/Text delivery selected');
            
            // Click Submit to send the code
            session.currentStep = 'Sending verification code...';
            const mfaSubmitSelector = 'a.btn.btn-primary.btn--login[title="Submit"]';
            
            try {
              await page.waitForSelector(mfaSubmitSelector, { timeout: 10000 });
              
              // Use evaluate to click since it's an Angular link
              await page.evaluate(() => {
                const submitBtn = document.querySelector('a.btn.btn-primary.btn--login[title="Submit"]');
                if (submitBtn) {
                  submitBtn.click();
                }
              });
              
              console.log('[AIL AOB Export] ✅ Clicked submit to send verification code');
            } catch (e) {
              console.error('[AIL AOB Export] ❌ Could not find MFA submit button:', e.message);
              throw new Error('Could not submit MFA delivery method');
            }
            
            // Wait for code entry page
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));
            await captureStep('Verification code sent - waiting for user input');
            
            // Now we need to wait for user to enter the verification code
            session.currentStep = '⏸️ PAUSED: Please enter the verification code you received via text';
            session.status = 'waiting_for_user';
            console.log('[AIL AOB Export] ⏸️ PAUSED: Waiting for user to enter verification code');
            
            // Take screenshot so user can see the code entry field
            await captureStep('Waiting for verification code entry', 1000);
            
            // Wait for the verification code to be provided by the user via API
            let codeEntered = false;
            let attempts = 0;
            const maxAttempts = 60; // Wait up to 5 minutes (check every 5 seconds)
            
            while (!codeEntered && attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 5000));
              
              // Check if user submitted code via API
              if (session.verificationCode) {
                console.log('[AIL AOB Export] ✅ Verification code received from user');
                session.currentStep = 'Entering verification code...';
                
                // Find the verification code input field
                const codeInputSelectors = [
                  'input[type="text"][placeholder*="code"]',
                  'input[type="text"][placeholder*="Code"]',
                  'input[id*="OTP"]',
                  'input[id*="passcode"]',
                  'input[id*="Passcode"]',
                  'input[name*="otp"]',
                  'input.form-control[type="text"]'
                ];
                
                let codeInput = null;
                for (const selector of codeInputSelectors) {
                  try {
                    codeInput = await page.$(selector);
                    if (codeInput) {
                      console.log(`[AIL AOB Export] Found verification code input: ${selector}`);
                      break;
                    }
                  } catch (e) {
                    // Try next
                  }
                }
                
                if (codeInput) {
                  await codeInput.type(session.verificationCode);
                  console.log('[AIL AOB Export] ✅ Typed verification code');
                  await new Promise(r => setTimeout(r, 1000)); // Wait for Angular validation
                  await captureStep('Verification code entered');
                  
                  // Click the verification code submit button
                  session.currentStep = 'Submitting verification code...';
                  const verifySubmitSelector = 'a.btn.btn-primary.btn--login[ng-click*="RegCodeButton"]';
                  
                  try {
                    await page.waitForSelector(verifySubmitSelector, { timeout: 5000 });
                    
                    // Use evaluate to click the Angular-controlled link
                    await page.evaluate(() => {
                      const submitBtn = document.querySelector('a.btn.btn-primary.btn--login[ng-click*="RegCodeButton"]');
                      if (submitBtn) {
                        submitBtn.click();
                      }
                    });
                    
                    console.log('[AIL AOB Export] ✅ Clicked verification code submit button');
                  } catch (e) {
                    console.error('[AIL AOB Export] ❌ Could not find verification submit button:', e.message);
                    console.log('[AIL AOB Export] Trying fallback: pressing Enter');
                    await page.keyboard.press('Enter');
                  }
                  
                  // Wait for navigation
                  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                  await new Promise(r => setTimeout(r, 2000));
                  
                  codeEntered = true;
                  session.status = 'running';
                  session.currentStep = 'Verification successful, continuing...';
                  session.verificationCode = null; // Clear it
                  
                  const afterVerifyUrl = page.url();
                  console.log(`[AIL AOB Export] After verification: ${afterVerifyUrl}`);
                  await captureStep('Verification complete');
                  
                  // Check if we're back at the SSO portal (common after MFA)
                  if (afterVerifyUrl.includes('sso.globelifeinc.com/AILPortal')) {
                    console.log('[AIL AOB Export] Redirected back to SSO portal after MFA');
                    session.currentStep = 'Returning to Agent Appointments...';
                    await captureStep('Back at SSO portal');
                    
                    // Find and click Agent Appointments link again
                    const appointmentsSelectors = [
                      'a[href="https://agentappointments.ailife.com"]',
                      'a[title="Agent Appointments AIL Login"]'
                    ];
                    
                    let foundLink = null;
                    for (const selector of appointmentsSelectors) {
                      try {
                        await page.waitForSelector(selector, { timeout: 5000 });
                        foundLink = selector;
                        console.log(`[AIL AOB Export] Found Agent Appointments link again: ${selector}`);
                        break;
                      } catch (e) {
                        console.log(`[AIL AOB Export] Selector ${selector} not found`);
                      }
                    }
                    
                    if (!foundLink) {
                      throw new Error('Could not find Agent Appointments link after MFA');
                    }
                    
                    // Get the href and navigate (avoid target="_blank")
                    const appointmentsHref = await page.$eval(foundLink, el => el.href);
                    console.log(`[AIL AOB Export] Navigating to appointments: ${appointmentsHref}`);
                    
                    await page.goto(appointmentsHref, { waitUntil: 'networkidle2', timeout: 30000 });
                    await new Promise(r => setTimeout(r, 2000));
                    await captureStep('Agent Appointments portal loaded (post-MFA)');
                    
                    // Check if on AgencyAdmin.aspx after MFA navigation
                    const postMfaUrl = page.url();
                    if (postMfaUrl.includes('AgencyAdmin.aspx')) {
                      console.log('[AIL AOB Export] On AgencyAdmin.aspx after MFA, clicking Save & Continue...');
                      session.currentStep = 'Clicking Save & Continue (post-MFA)...';
                      
                      try {
                        await page.waitForSelector('#cphMain_btnGo', { timeout: 5000 });
                        await Promise.all([
                          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
                          page.click('#cphMain_btnGo')
                        ]);
                        await new Promise(r => setTimeout(r, 2000));
                        await captureStep('Save & Continue clicked (post-MFA)');
                      } catch (e) {
                        console.log('[AIL AOB Export] No Save & Continue after MFA');
                      }
                    }
                  }
                  
                } else {
                  throw new Error('Could not find verification code input field');
                }
              } else {
                // Update screenshot while waiting
                if (page) {
                  const screenshot = await page.screenshot({ encoding: 'base64' });
                  session.screenshots[session.screenshots.length - 1] = `data:image/png;base64,${screenshot}`;
                }
              }
              
              attempts++;
            }
            
            if (!codeEntered) {
              throw new Error('Verification code was not entered within the time limit (5 minutes)');
            }
          }
        } else {
          console.log('[AIL AOB Export] No login fields found after SAML, waiting for redirect...');
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(r => setTimeout(r, 2000));
          
          const afterSamlUrl = page.url();
          console.log(`[AIL AOB Export] After SAML redirect: ${afterSamlUrl}`);
          await captureStep('SAML authentication completed');
        }
      }
    }

    // Check final URL - handle AgencyAdmin.aspx if not already handled
    const currentFinalUrl = page.url();
    if (currentFinalUrl.includes('AgencyAdmin.aspx')) {
      console.log('[AIL AOB Export] Still on AgencyAdmin.aspx, need to click Save & Continue');
      session.currentStep = 'Clicking Save & Continue...';
      
      try {
        await page.waitForSelector('#cphMain_btnGo', { timeout: 5000 });
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
          page.click('#cphMain_btnGo')
        ]);
        await new Promise(r => setTimeout(r, 2000));
        await captureStep('Save & Continue clicked');
      } catch (e) {
        console.log('[AIL AOB Export] Could not find Save & Continue button');
      }
    }

    // ===== NOW PROCEED WITH AOB EXPORT SPECIFIC TASKS =====

    // Navigate to Application Processing Status page
    session.currentStep = 'Navigating to Application Processing Status...';
    console.log('[AIL AOB Export] Going to ApplicationProcessingStatus.aspx');
    
    await page.goto('https://agentappointments.ailife.com/Processing/ApplicationProcessingStatus.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await new Promise(r => setTimeout(r, 2000));
    await captureStep('At Application Processing Status');

    // Change dropdown to "ALL"
    session.currentStep = 'Selecting ALL status...';
    console.log('[AIL AOB Export] Changing status dropdown to ALL');
    await captureStep('At Application Processing Status page');
    
    try {
      // Wait for page to fully load
      await new Promise(r => setTimeout(r, 3000));
      
      // Try multiple selectors for the dropdown
      const dropdownSelectors = [
        '#cphMain_ddlWFStatus',
        'select[id*="ddlWFStatus"]',
        'select[name*="ddlWFStatus"]'
      ];
      
      let dropdownFound = false;
      for (const selector of dropdownSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          console.log(`[AIL AOB Export] Found dropdown: ${selector}`);
          
          // Select "ALL" option
          await page.select(selector, 'ALL');
          dropdownFound = true;
          console.log('[AIL AOB Export] ✅ Selected ALL status');
          break;
        } catch (e) {
          console.log(`[AIL AOB Export] Selector ${selector} not found`);
        }
      }
      
      if (!dropdownFound) {
        // Try to evaluate and set the dropdown directly
        const dropdownExists = await page.evaluate(() => {
          const dropdown = document.querySelector('#cphMain_ddlWFStatus');
          if (dropdown) {
            dropdown.value = 'ALL';
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            dropdown.dispatchEvent(event);
            return true;
          }
          return false;
        });
        
        if (!dropdownExists) {
          await captureStep('Could not find dropdown');
          throw new Error('Could not find status dropdown on page');
        }
        
        console.log('[AIL AOB Export] ✅ Set dropdown via JavaScript');
      }
      
      // Wait for postback to complete
      await new Promise(r => setTimeout(r, 10000)); // Wait 10 seconds for data to load
      await captureStep('Status set to ALL, data loading...');
      
    } catch (e) {
      console.error('[AIL AOB Export] ❌ Could not select ALL status:', e.message);
      await captureStep('Error selecting status');
      throw new Error('Could not change status dropdown: ' + e.message);
    }

    // Click Export to Excel
    session.currentStep = 'Exporting to Excel...';
    console.log('[AIL AOB Export] Clicking Export to Excel');
    
    try {
      await page.waitForSelector('#cphMain_lnbExport', { timeout: 10000 });
      
      // Click export link
      await page.evaluate(() => {
        document.querySelector('#cphMain_lnbExport').click();
      });
      
      console.log('[AIL AOB Export] ✅ Clicked Export to Excel');
      
      // Wait for download to complete
      await new Promise(r => setTimeout(r, 5000));
      await captureStep('Excel export initiated');
      
    } catch (e) {
      console.error('[AIL AOB Export] ❌ Could not click export:', e.message);
      throw new Error('Could not export to Excel');
    }

    // Find the downloaded file
    session.currentStep = 'Processing downloaded file...';
    console.log('[AIL AOB Export] Looking for downloaded file');
    
    const files = fs.readdirSync(downloadPath);
    const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    
    if (excelFiles.length === 0) {
      throw new Error('No Excel file was downloaded');
    }

    // Get the most recent file
    const latestFile = excelFiles
      .map(f => ({ name: f, path: path.join(downloadPath, f), mtime: fs.statSync(path.join(downloadPath, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime)[0];

    console.log(`[AIL AOB Export] Found file: ${latestFile.name}`);

    // Parse Excel file
    const workbook = XLSX.readFile(latestFile.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`[AIL AOB Export] Parsed ${data.length} rows from Excel`);
    session.currentStep = `Processing ${data.length} records...`;

    // Process each row and insert into AOBUpdates table
    let inserted = 0;
    let skipped = 0;
    let linked = 0;
    let errors = 0;

    for (const row of data) {
      try {
        // Map Excel columns to database fields
        const record = {
          ImportDate: row['Import Date'] || row['ImportDate'] || null,
          STPROV: row['ST/PROV'] || row['STPROV'] || null,
          Agent: row['Agent'] || null,
          AgentNumber: row['Agent Number'] || row['AgentNumber'] || null,
          SGAName: row['SGA Name'] || row['SGAName'] || null,
          ApplicantPhoneNumber: row['Applicant Phone Number'] || row['ApplicantPhoneNumber'] || null,
          EmailAddress: row['Email Address'] || row['EmailAddress'] || null,
          MGA: row['MGA'] || null,
          Company: row['Company'] || null,
          WFStatus: row['WF Status'] || row['WFStatus'] || null,
          WFStep: row['WF Step'] || row['WFStep'] || null,
          StepStatus: row['Step Status'] || row['StepStatus'] || null
        };

        // Check if row with same key identifiers already exists
        // Key fields: STPROV, Agent, AgentNumber, ApplicantPhoneNumber, EmailAddress, MGA, WFStatus, WFStep, StepStatus
        const existing = await db.query(
          `SELECT id, ImportDate, SGAName, Company
           FROM AOBUpdates 
           WHERE STPROV <=> ? 
             AND Agent <=> ? 
             AND AgentNumber <=> ?
             AND ApplicantPhoneNumber <=> ?
             AND EmailAddress <=> ?
             AND MGA <=> ?
             AND WFStatus <=> ?
             AND WFStep <=> ?
             AND StepStatus <=> ?
           ORDER BY LastUpdated DESC
           LIMIT 1`,
          [
            record.STPROV,
            record.Agent,
            record.AgentNumber,
            record.ApplicantPhoneNumber,
            record.EmailAddress,
            record.MGA,
            record.WFStatus,
            record.WFStep,
            record.StepStatus
          ]
        );

        let aobId;

        if (existing && existing.length > 0) {
          // Found matching record by key fields, check if other fields changed
          const existingRecord = existing[0];
          const importDateChanged = (existingRecord.ImportDate || null) !== (record.ImportDate || null);
          const sgaNameChanged = (existingRecord.SGAName || null) !== (record.SGAName || null);
          const companyChanged = (existingRecord.Company || null) !== (record.Company || null);
          
          if (!importDateChanged && !sgaNameChanged && !companyChanged) {
            // Nothing changed, skip insert and use existing ID
            aobId = existingRecord.id;
            skipped++;
            console.log(`[AIL AOB Export] ⏭️ No changes detected, skipping (AOB ID: ${aobId}, Agent: ${record.Agent})`);
          } else {
            // Something changed, insert new row to track changes
            console.log(`[AIL AOB Export] 🔄 Changes detected for ${record.Agent}:`, {
              importDateChanged,
              sgaNameChanged,
              companyChanged
            });
            
            const insertResult = await db.query(
              `INSERT INTO AOBUpdates 
                (ImportDate, STPROV, Agent, AgentNumber, SGAName, ApplicantPhoneNumber, 
                 EmailAddress, MGA, Company, WFStatus, WFStep, StepStatus, LastUpdated)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                record.ImportDate,
                record.STPROV,
                record.Agent,
                record.AgentNumber,
                record.SGAName,
                record.ApplicantPhoneNumber,
                record.EmailAddress,
                record.MGA,
                record.Company,
                record.WFStatus,
                record.WFStep,
                record.StepStatus
              ]
            );
            
            aobId = insertResult.insertId;
            inserted++;
            
            console.log(`[AIL AOB Export] ✅ Inserted updated AOB record (ID: ${aobId}, Agent: ${record.Agent})`);
          }
        } else {
          // No existing record found, insert new row
          const insertResult = await db.query(
            `INSERT INTO AOBUpdates 
              (ImportDate, STPROV, Agent, AgentNumber, SGAName, ApplicantPhoneNumber, 
               EmailAddress, MGA, Company, WFStatus, WFStep, StepStatus, LastUpdated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              record.ImportDate,
              record.STPROV,
              record.Agent,
              record.AgentNumber,
              record.SGAName,
              record.ApplicantPhoneNumber,
              record.EmailAddress,
              record.MGA,
              record.Company,
              record.WFStatus,
              record.WFStep,
              record.StepStatus
            ]
          );
          
          aobId = insertResult.insertId;
          inserted++;
          
          console.log(`[AIL AOB Export] ✅ Inserted new AOB record (ID: ${aobId}, Agent: ${record.Agent})`);
        }
        
        if (inserted % 10 === 0) {
          console.log(`[AIL AOB Export] 📝 Progress: ${inserted}/${data.length} records inserted...`);
        }
        
        // Verify aobId before linking
        if (!aobId || aobId === 0) {
          console.error(`[AIL AOB Export] ⚠️ Invalid aobId (${aobId}) for record:`, record);
          errors++;
          continue;
        }
        
        console.log(`[AIL AOB Export] 🔍 Attempting to link AOB ID ${aobId} to pipeline...`);

        // Now try to link to pipeline table
        if (record.EmailAddress || record.ApplicantPhoneNumber || record.Agent) {
          // Clean phone number (remove all non-numeric characters)
          const cleanPhone = record.ApplicantPhoneNumber ? 
            record.ApplicantPhoneNumber.replace(/\D/g, '') : null;
          
          // Parse Agent name from "LAST, FIRST MIDDLE SUFFIX" format
          let parsedAgent = null;
          if (record.Agent) {
            const parts = record.Agent.split(',').map(p => p.trim());
            if (parts.length >= 2) {
              const lastName = parts[0].trim();
              const restParts = parts[1].trim().split(/\s+/); // Split by whitespace
              
              parsedAgent = {
                last: lastName || null,
                first: restParts[0] || null,
                middle: restParts[1] || null,
                suffix: restParts[2] || null
              };
              
              console.log(`[AIL AOB Export] Parsed agent: ${JSON.stringify(parsedAgent)}`);
            }
          }

          // Build dynamic WHERE clause
          const conditions = [];
          const params = [];

          if (record.EmailAddress) {
            conditions.push('p.email = ?');
            params.push(record.EmailAddress);
          }

          if (cleanPhone) {
            conditions.push('REPLACE(REPLACE(REPLACE(REPLACE(p.phone, "-", ""), "(", ""), ")", ""), " ", "") = ?');
            params.push(cleanPhone);
          }

          if (parsedAgent && parsedAgent.last && parsedAgent.first) {
            // Build name match as a separate query to avoid param confusion
            // We'll search for name matches separately if email/phone don't work
            const nameMatchConditions = [];
            const nameMatchParams = [];
            
            nameMatchConditions.push('p.recruit_last = ?');
            nameMatchParams.push(parsedAgent.last);
            
            nameMatchConditions.push('p.recruit_first = ?');
            nameMatchParams.push(parsedAgent.first);
            
            if (parsedAgent.middle) {
              nameMatchConditions.push('(p.recruit_middle = ? OR p.recruit_middle IS NULL OR p.recruit_middle = "")');
              nameMatchParams.push(parsedAgent.middle);
            }
            
            if (parsedAgent.suffix) {
              nameMatchConditions.push('(p.recruit_suffix = ? OR p.recruit_suffix IS NULL OR p.recruit_suffix = "")');
              nameMatchParams.push(parsedAgent.suffix);
            }
            
            // Add as a single condition group
            conditions.push(`(${nameMatchConditions.join(' AND ')})`);
            params.push(...nameMatchParams);
          }

          if (conditions.length > 0) {
            const whereClause = conditions.join(' OR ');
            
            console.log(`[AIL AOB Export] 🔍 Searching pipeline with ${conditions.length} conditions for AOB ID ${aobId}`);
            
            const pipelineMatches = await db.query(
              `SELECT id, recruit_first, recruit_last, recruit_middle, recruit_suffix, email, phone, aob 
               FROM pipeline p
               WHERE ${whereClause}
               LIMIT 1`,
              params
            );

            if (pipelineMatches && pipelineMatches.length > 0) {
              const pipelineRecord = pipelineMatches[0];
              const fullName = [
                pipelineRecord.recruit_first,
                pipelineRecord.recruit_middle,
                pipelineRecord.recruit_last,
                pipelineRecord.recruit_suffix
              ].filter(Boolean).join(' ');
              
              console.log(`[AIL AOB Export] ✅ Found pipeline match: ID ${pipelineRecord.id} (${fullName}), current aob: ${pipelineRecord.aob}`);
              
              // Only update if not already linked to this AOB record
              if (pipelineRecord.aob !== aobId) {
                console.log(`[AIL AOB Export] 🔗 Linking: UPDATE pipeline SET aob = ${aobId} WHERE id = ${pipelineRecord.id}`);
                
                const updateResult = await db.query(
                  'UPDATE pipeline SET aob = ?, date_last_updated = NOW() WHERE id = ?',
                  [aobId, pipelineRecord.id]
                );
                
                console.log(`[AIL AOB Export] 🔗 Update result:`, updateResult);
                
                linked++;
                console.log(`[AIL AOB Export] 🔗 Successfully linked AOB ${aobId} to pipeline ${pipelineRecord.id} (${fullName})`);
              } else {
                console.log(`[AIL AOB Export] ⏭️ Pipeline ${pipelineRecord.id} already linked to AOB ${aobId}`);
              }
            } else {
              console.log(`[AIL AOB Export] ❌ No pipeline match found for AOB ID ${aobId}`);
            }
          } else {
            console.log(`[AIL AOB Export] ⚠️ No matching conditions built for AOB ID ${aobId}`);
          }
        }

      } catch (rowError) {
        console.error('[AIL AOB Export] Error processing row:', rowError);
        console.error('[AIL AOB Export] Row data:', row);
        errors++;
      }
    }

    session.recordsProcessed = data.length;
    session.inserted = inserted;
    session.skipped = skipped;
    session.linked = linked;
    session.errors = errors;

    // Clean up downloaded file
    try {
      fs.unlinkSync(latestFile.path);
      console.log('[AIL AOB Export] Deleted downloaded file');
    } catch (e) {
      console.error('[AIL AOB Export] Could not delete file:', e);
    }

    // Mark as complete
    session.status = errors > 0 ? 'warning' : 'success';
    session.currentStep = `Export complete: ${inserted} new, ${skipped} skipped, ${linked} linked${errors > 0 ? `, ${errors} errors` : ''}`;
    session.completedAt = new Date().toISOString();
    await captureStep('Export process complete', 2000);

    console.log(`[AIL AOB Export] ✅ Complete: ${inserted} inserted, ${skipped} skipped, ${linked} linked to pipeline, ${errors} errors`);

  } catch (error) {
    console.error('[AIL AOB Export] Error:', error);
    session.status = 'error';
    session.error = error.message;
    session.currentStep = `Error: ${error.message}`;
    
    if (browser) {
      try {
        const page = (await browser.pages())[0];
        const screenshot = await page.screenshot({ encoding: 'base64' });
        session.screenshots.push(`data:image/png;base64,${screenshot}`);
      } catch (e) {
        console.error('[AIL AOB Export] Could not capture error screenshot:', e);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }

    // Clean up session after 5 minutes
    setTimeout(() => {
      activeSessions.delete(sessionId);
      console.log(`[AIL AOB Export] Session ${sessionId} cleaned up`);
    }, 5 * 60 * 1000);
  }
}

module.exports = router;

