/**
 * Scheduler to automatically renew the Gmail Pub/Sub watch on the Python processor.
 * Gmail watches expire every 7 days; this runs daily at 3 AM ET to keep it active.
 */
const cron = require('node-cron');
const axios = require('axios');

const PROCESSOR_URL = process.env.PROCESSOR_URL || 'https://peaceful-badlands-42414-7b2e5f9acb76.herokuapp.com';

// Daily at 3 AM ET (8 AM UTC)
const GMAIL_WATCH_CRON_SCHEDULE = '0 8 * * *';

function initGmailWatchScheduler() {
  console.log(`[GmailWatch] Starting scheduler with schedule: ${GMAIL_WATCH_CRON_SCHEDULE}`);

  const task = cron.schedule(GMAIL_WATCH_CRON_SCHEDULE, async () => {
    const rewatchToken = process.env.REWATCH_TOKEN;
    if (!rewatchToken) {
      console.warn('[GmailWatch] REWATCH_TOKEN not set, skipping renewal');
      return;
    }

    try {
      console.log('[GmailWatch] Renewing Gmail push notification watch...');
      const response = await axios.post(
        `${PROCESSOR_URL}/manage/rewatch`,
        {},
        {
          timeout: 30000,
          headers: { 'X-Auth-Token': rewatchToken },
        }
      );

      const expiration = response.data?.watch?.expiration;
      const expiresAt = expiration ? new Date(Number(expiration)).toISOString() : 'unknown';
      console.log(`[GmailWatch] Watch renewed successfully. Expires: ${expiresAt}`);
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      console.error(`[GmailWatch] Failed to renew watch: ${msg}`);
    }
  });

  return task;
}

module.exports = { initGmailWatchScheduler };
