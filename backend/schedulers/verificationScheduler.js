/**
 * Scheduler for sending queued verification surveys daily at 8 AM EST.
 * Sends email + SMS to all applications with status 'Queued'.
 */
const cron = require('node-cron');
const { query } = require('../db');
const twilioService = require('../services/twilio');
const nodemailer = require('nodemailer');
const emailService = require('../services/emailService');

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://atlas-celest-backend-3bb2fea96236.herokuapp.com';
const VERIFY_STATUS_CALLBACK_URL = `${BACKEND_BASE_URL}/api/verify/webhook/status`;

// 8:00 AM EST = 13:00 UTC (EST is UTC-5)
const VERIFICATION_CRON_SCHEDULE = '0 13 * * *';

const transporter = nodemailer.createTransport({
  host: 'mail.ariaslife.com',
  port: 465,
  secure: true,
  auth: {
    user: 'noreply@ariaslife.com',
    pass: 'Ariaslife123!'
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function processQueuedVerifications() {
  try {
    const results = await query(`
      SELECT application_id, client_email, agent_email, agent_name, url, client_phoneNumber
      FROM verify
      WHERE status = 'Queued'
    `);

    if (results.length === 0) return;

    console.log(`[VerificationScheduler] Found ${results.length} queued applications`);

    const verifySubject = 'Welcome to Globe Life - AIL/NIL Arias Organization';
    const batchId = await emailService.createBatch('verification', verifySubject, { count: results.length });

    let successCount = 0;
    let failCount = 0;

    for (const row of results) {
      try {
        // Send email
        await transporter.sendMail({
          from: 'noreply@ariaslife.com',
          to: row.client_email,
          subject: verifySubject,
          html: `
            <p>Thank you for choosing us to protect you and your family.</p>
            <p>Please use this <a href="${row.url}">link</a> to verify your application information.</p>
            <p>This checklist is required to move forward with the application process.</p>
            <p>If you have any questions, please reach out to your agent.</p>
          `
        });

        // Log to unified email_log
        await emailService._logEmail(batchId, row.client_email, row.agent_name, verifySubject, 'verification', 'sent', null);

        // Log email in verify_messages
        await query(
          `INSERT INTO verify_messages (application_id, recipient_email, phone_number, direction, message_type, message, status)
           VALUES (?, ?, NULL, 'outbound', 'email', ?, 'sent')`,
          [row.application_id, row.client_email, `Verification survey email sent to ${row.client_email}`]
        );

        // Send SMS if phone number exists
        if (row.client_phoneNumber) {
          try {
            const smsMessage = `Please review your American Income Life application survey: ${row.url}`;
            const smsResult = await twilioService.sendSMS({
              toNumber: row.client_phoneNumber,
              message: smsMessage,
              userId: null,
              statusCallback: VERIFY_STATUS_CALLBACK_URL
            });

            if (smsResult.success) {
              await query(
                `INSERT INTO verify_messages (application_id, phone_number, direction, message_type, message, twilio_sid, status)
                 VALUES (?, ?, 'outbound', 'sms', ?, ?, 'sent')`,
                [row.application_id, row.client_phoneNumber, smsMessage, smsResult.messageId]
              );
            }
          } catch (smsError) {
            console.error(`[VerificationScheduler] SMS failed for ${row.application_id}:`, smsError.message);
          }
        }

        // Update status to 'Sent'
        await query("UPDATE verify SET status = 'Sent' WHERE application_id = ?", [row.application_id]);
        successCount++;
      } catch (error) {
        // Log failure to unified email_log
        await emailService._logEmail(batchId, row.client_email, row.agent_name, verifySubject, 'verification', 'failed', error.message);
        console.error(`[VerificationScheduler] Failed for ${row.application_id}:`, error.message);
        failCount++;
      }
    }

    await emailService.completeBatch(batchId, successCount, failCount);
    console.log(`[VerificationScheduler] Batch complete: ${successCount} sent, ${failCount} failed`);
  } catch (error) {
    console.error('[VerificationScheduler] Scheduler error:', error);
  }
}

function initVerificationScheduler() {
  console.log(`[VerificationScheduler] Starting scheduler (${VERIFICATION_CRON_SCHEDULE}) - daily 8 AM EST`);

  cron.schedule(VERIFICATION_CRON_SCHEDULE, async () => {
    await processQueuedVerifications();
  });
}

module.exports = {
  initVerificationScheduler,
  processQueuedVerifications
};
