/**
 * Scheduler: Pending → Code Eligible Notifications
 *
 * When the Python processor flips an agent from pending = 1 → 0 (they appeared
 * in the Daily New Associates ASSOCIATES sheet), their direct manager should be
 * notified in-app so they know the agent is now eligible to request a code pack.
 *
 * Runs every hour. Finds agents where:
 *   pending = 0 AND Active = 'y' AND clname = 'AGT'
 *   AND no row yet exists in code_eligibility_notifications for this agent.
 *
 * For each such agent it:
 *   1. Resolves their direct manager (SA → GA → MGA priority)
 *   2. Inserts a notification record for the manager
 *   3. Sends a push notification (if manager has a push subscription)
 *   4. Sends a WebSocket notification for real-time delivery
 *   5. Inserts a row into code_eligibility_notifications so it never fires again
 */

const cron = require('node-cron');
const webpush = require('web-push');
const { query } = require('../db');

// Run every hour
const SCHEDULE = '0 * * * *';

// Configure VAPID — same keys used by notifications.js
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.SMTP_USER || 'atlas@ariaslife.com'),
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err) {
    console.error('[EligibilityNotifier] Failed to configure VAPID:', err.message);
  }
}

/**
 * Find the activeusers.id for a manager given their lagnname.
 */
async function resolveManagerId(lagnname) {
  if (!lagnname) return null;
  const rows = await query(
    `SELECT id FROM activeusers WHERE UPPER(TRIM(lagnname)) = UPPER(TRIM(?)) AND Active = 'y' LIMIT 1`,
    [lagnname]
  );
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Send a push notification to all of a user's subscribed devices.
 */
async function sendPush(userId, payload) {
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) return;
  try {
    const subs = await query(
      'SELECT id, subscription FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );
    const staleIds = [];
    for (const row of subs) {
      if (!row.subscription) { staleIds.push(row.id); continue; }
      let sub;
      try {
        sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      } catch { staleIds.push(row.id); continue; }
      if (!sub?.endpoint) { staleIds.push(row.id); continue; }
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) staleIds.push(row.id);
      }
    }
    if (staleIds.length > 0) {
      await query(
        `DELETE FROM push_subscriptions WHERE id IN (${staleIds.map(() => '?').join(',')})`,
        staleIds
      );
    }
  } catch (err) {
    console.error('[EligibilityNotifier] Push error for user', userId, err.message);
  }
}

/**
 * Core job: find newly activated agents and notify their managers.
 */
async function runEligibilityNotifications() {
  console.log('[EligibilityNotifier] Checking for newly code-eligible agents...');

  // Only fetch agents that haven't been processed yet (no row in tracking table)
  const agents = await query(`
    SELECT au.id, au.lagnname, au.sa, au.ga, au.mga
    FROM activeusers au
    WHERE au.pending = 0
      AND au.Active = 'y'
      AND au.clname = 'AGT'
      AND au.esid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM code_eligibility_notifications cen WHERE cen.agent_id = au.id
      )
  `);

  if (agents.length === 0) {
    console.log('[EligibilityNotifier] No newly eligible agents found.');
    return;
  }

  console.log(`[EligibilityNotifier] Found ${agents.length} newly eligible agent(s).`);

  for (const agent of agents) {
    try {
      // Resolve manager: SA → GA → MGA
      const managerName = agent.sa || agent.ga || agent.mga;
      const managerId = await resolveManagerId(managerName);

      if (!managerId) {
        console.warn(
          `[EligibilityNotifier] No manager found for ${agent.lagnname} ` +
          `(sa=${agent.sa}, ga=${agent.ga}, mga=${agent.mga}). Recording to skip on next run.`
        );
        // Still record so we don't retry endlessly
        await query(
          'INSERT IGNORE INTO code_eligibility_notifications (agent_id, manager_id) VALUES (?, NULL)',
          [agent.id]
        );
        continue;
      }

      const title = 'Agent Code Eligible';
      const message = `${agent.lagnname} is now eligible to request for a code pack.`;
      const type = 'info';
      const link_url = '/resources?active=leads';

      // 1. Insert notification record
      const insertResult = await query(
        `INSERT INTO notifications (title, message, type, user_id, link_url) VALUES (?, ?, ?, ?, ?)`,
        [title, message, type, managerId, link_url]
      );
      const notificationId = insertResult.insertId;

      // 2. Push notification (fire-and-forget)
      sendPush(managerId, { id: notificationId, title, message, link_url });

      // 3. WebSocket real-time delivery
      if (global.notificationManager) {
        global.notificationManager.notifyUser(managerId, {
          id: notificationId,
          title,
          message,
          type,
          link_url,
          created_at: new Date().toISOString(),
        });
      }

      // 4. Record in tracking table so this agent is never processed again
      await query(
        'INSERT IGNORE INTO code_eligibility_notifications (agent_id, manager_id) VALUES (?, ?)',
        [agent.id, managerId]
      );

      console.log(
        `[EligibilityNotifier] ✅ Notified manager ${managerName} (id=${managerId}) about ${agent.lagnname}`
      );
    } catch (err) {
      console.error(`[EligibilityNotifier] ❌ Error processing agent ${agent.lagnname}:`, err.message);
      // Don't insert into tracking table on error — let the next run retry
    }
  }

  console.log('[EligibilityNotifier] Done.');
}

function initPendingEligibilityNotificationScheduler() {
  cron.schedule(SCHEDULE, async () => {
    try {
      await runEligibilityNotifications();
    } catch (err) {
      console.error('[EligibilityNotifier] Unhandled error in scheduled run:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[EligibilityNotifier] Scheduler registered (hourly).');
}

module.exports = { initPendingEligibilityNotificationScheduler, runEligibilityNotifications };
