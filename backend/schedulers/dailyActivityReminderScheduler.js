/**
 * Scheduler for sending daily activity reminder emails at 9 PM ET.
 * Sends a reminder to AGT, SA, and GA users who haven't logged activity for the day.
 */
const cron = require('node-cron');
const { query } = require('../db');
const emailService = require('../services/emailService');

// 9:00 PM Eastern Time every day
const DAILY_REMINDER_CRON_SCHEDULE = '0 21 * * *';

// Admin address that receives a summary after each run
const ADMIN_SUMMARY_EMAIL = 'kvanbibber@ariasagencies.com';

/**
 * Get today's date string in Eastern Time (YYYY-MM-DD)
 */
function getTodayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Extract first name from lagnname (format: "LAST, FIRST MIDDLE")
 */
function getFirstName(lagnname) {
  if (!lagnname) return 'Agent';
  const parts = lagnname.split(',');
  if (parts.length < 2) return lagnname.trim();
  const firstPart = parts[1].trim().split(/\s+/)[0];
  // Title-case it
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
}

/**
 * Build the reminder email HTML
 */
function buildReminderEmail(firstName) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; font-size: 22px; }
    .message { background: #fff3e0; padding: 20px; border-left: 4px solid #ff9800; border-radius: 4px; margin: 20px 0; }
    .cta-button {
      display: inline-block;
      background: #3498db;
      color: #ffffff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      font-size: 16px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Daily Activity Reminder</h1>
    <p>Hello ${firstName},</p>

    <div class="message">
      <strong>You haven't submitted your daily activity yet today.</strong>
      <p style="margin: 8px 0 0 0;">Take a moment to log your calls, appointments, sits, and sales so your numbers stay up to date.</p>
    </div>

    <p style="text-align: center;">
      <a href="https://agents.ariaslife.com/production?section=daily-activity" class="cta-button">
        Submit Daily Activity
      </a>
    </p>

    <div class="footer">
      <p>This is an automated reminder from Arias Life. You received this because you have not yet reported your daily activity.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build the admin summary email HTML
 */
function buildSummaryEmail({ today, eligible, alreadyReported, optedOut = 0, sent, failed, failures }) {
  const failureRows = failures.length > 0
    ? failures.map(f => `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${f.email}</td><td style="padding:4px 8px;border:1px solid #ddd;">${f.name}</td><td style="padding:4px 8px;border:1px solid #ddd;color:#c0392b;">${f.error}</td></tr>`).join('')
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; font-size: 20px; }
    .stat-grid { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
    .stat { background: #f8f9fa; border-radius: 6px; padding: 12px 16px; flex: 1; min-width: 120px; text-align: center; }
    .stat .num { font-size: 28px; font-weight: bold; color: #2c3e50; }
    .stat .label { font-size: 12px; color: #777; text-transform: uppercase; }
    .success { border-left: 4px solid #27ae60; }
    .fail { border-left: 4px solid #e74c3c; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th { background: #f1f1f1; padding: 6px 8px; border: 1px solid #ddd; text-align: left; font-size: 13px; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Daily Activity Reminder — Summary</h1>
    <p style="color:#555;">Date: <strong>${today}</strong></p>

    <div class="stat-grid">
      <div class="stat"><div class="num">${eligible}</div><div class="label">Eligible</div></div>
      <div class="stat"><div class="num">${alreadyReported}</div><div class="label">Already Reported</div></div>
      ${optedOut > 0 ? `<div class="stat"><div class="num">${optedOut}</div><div class="label">Opted Out</div></div>` : ''}
      <div class="stat success"><div class="num">${sent}</div><div class="label">Reminders Sent</div></div>
      <div class="stat fail"><div class="num">${failed}</div><div class="label">Failed</div></div>
    </div>

    ${failures.length > 0 ? `
    <h3 style="color:#c0392b;margin-top:24px;">Failed Deliveries</h3>
    <table>
      <tr><th>Email</th><th>Name</th><th>Error</th></tr>
      ${failureRows}
    </table>` : '<p style="color:#27ae60;">All reminders delivered successfully.</p>'}

    <div class="footer">
      <p>Automated summary from Atlas — Daily Activity Reminder Scheduler</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main function: find users who haven't reported and send reminders
 */
async function sendDailyActivityReminders() {
  const today = getTodayET();
  console.log(`[DailyActivityReminder] Starting for ${today}`);

  try {
    // 1. Get all active AGT/SA/GA users with emails
    const eligibleUsers = await query(`
      SELECT id, lagnname, email
      FROM activeusers
      WHERE clname IN ('AGT', 'SA', 'GA')
        AND Active = 'y'
        AND email IS NOT NULL AND email != ''
    `);

    if (eligibleUsers.length === 0) {
      console.log('[DailyActivityReminder] No eligible users found');
      return;
    }

    // 2. Get userIds who already reported today
    const reportedRows = await query(`
      SELECT DISTINCT userId
      FROM Daily_Activity
      WHERE reportDate = ?
    `, [today]);

    const reportedIds = new Set(reportedRows.map(r => r.userId));

    // 3. Filter to users who have NOT reported
    const unreportedUsers = eligibleUsers.filter(u => !reportedIds.has(u.id));

    // 4. Filter out users who opted out of daily reminder emails
    const optedOutRows = await query(`
      SELECT user_id FROM email_preferences
      WHERE preference_type = 'daily_reminder' AND enabled = 0
    `);
    const optedOutIds = new Set(optedOutRows.map(r => r.user_id));
    const usersToRemind = unreportedUsers.filter(u => !optedOutIds.has(u.id));
    const skippedOptOut = unreportedUsers.length - usersToRemind.length;

    console.log(`[DailyActivityReminder] ${eligibleUsers.length} eligible, ${reportedIds.size} already reported, ${skippedOptOut} opted out, ${usersToRemind.length} to remind`);

    if (usersToRemind.length === 0) {
      console.log('[DailyActivityReminder] Everyone has reported or opted out. No reminders needed.');
      await sendAdminSummary({ today, eligible: eligibleUsers.length, alreadyReported: reportedIds.size, optedOut: skippedOptOut, sent: 0, failed: 0, failures: [] });
      return;
    }

    // 4. Create a batch for tracking
    const emailSubject = 'Reminder: Submit Your Daily Activity';
    const batchId = await emailService.createBatch('daily_reminder', emailSubject, { date: today });

    // 5. Send reminder emails in concurrent batches
    const BATCH_SIZE = 15; // Send 15 emails concurrently
    const BATCH_DELAY = 200; // ms pause between batches to avoid SMTP throttling
    let sent = 0;
    let failed = 0;
    const failures = [];

    for (let i = 0; i < usersToRemind.length; i += BATCH_SIZE) {
      const batch = usersToRemind.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(user => {
          const firstName = getFirstName(user.lagnname);
          const html = buildReminderEmail(firstName);
          return emailService.sendEmail(
            user.email,
            emailSubject,
            html,
            { batchId, source: 'daily_reminder', recipientName: user.lagnname }
          );
        })
      );

      // Tally results
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          const user = batch[idx];
          failures.push({ email: user.email, name: user.lagnname, error: result.reason?.message || 'Unknown error' });
          console.error(`[DailyActivityReminder] Failed to send to ${user.email}:`, result.reason?.message);
        }
      });

      // Log progress for large runs
      if (usersToRemind.length > BATCH_SIZE) {
        console.log(`[DailyActivityReminder] Progress: ${Math.min(i + BATCH_SIZE, usersToRemind.length)}/${usersToRemind.length} processed`);
      }

      // Pause between batches (skip after the last batch)
      if (i + BATCH_SIZE < usersToRemind.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // 6. Complete the batch
    await emailService.completeBatch(batchId, sent, failed);

    console.log(`[DailyActivityReminder] Done — ${sent} sent, ${failed} failed`);

    // 8. Send summary email to admin (skip logging this meta-email)
    await sendAdminSummary({ today, eligible: eligibleUsers.length, alreadyReported: reportedIds.size, optedOut: skippedOptOut, sent, failed, failures });
  } catch (err) {
    console.error('[DailyActivityReminder] Error:', err);
  }
}

/**
 * Send summary email to admin after each run
 */
async function sendAdminSummary(stats) {
  try {
    const html = buildSummaryEmail(stats);
    await emailService.sendEmail(
      ADMIN_SUMMARY_EMAIL,
      `[Atlas] Daily Activity Reminder Summary — ${stats.today}`,
      html,
      { skipLog: true }
    );
    console.log(`[DailyActivityReminder] Summary email sent to ${ADMIN_SUMMARY_EMAIL}`);
  } catch (err) {
    console.error(`[DailyActivityReminder] Failed to send summary email:`, err.message);
  }
}

/**
 * Initialize the cron scheduler
 */
function initDailyActivityReminderScheduler() {
  cron.schedule(DAILY_REMINDER_CRON_SCHEDULE, () => {
    sendDailyActivityReminders();
  }, {
    timezone: 'America/New_York'
  });

  console.log(`[DailyActivityReminder] Scheduled at ${DAILY_REMINDER_CRON_SCHEDULE} America/New_York`);
}

module.exports = { initDailyActivityReminderScheduler, sendDailyActivityReminders };
