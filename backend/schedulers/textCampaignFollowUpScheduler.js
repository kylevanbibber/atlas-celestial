/**
 * Scheduler for processing text campaign follow-up messages.
 * Runs every 5 minutes to find contacts due for their next follow-up
 * and sends the appropriate follow-up message.
 */
const cron = require('node-cron');
const { query } = require('../db');
const { sendSMS, formatPhoneNumber } = require('../services/twilio');

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://atlas-celest-backend-3bb2fea96236.herokuapp.com';
const STATUS_CALLBACK_URL = `${BACKEND_BASE_URL}/api/text-campaigns/webhook/status`;

// Run every 5 minutes
const FOLLOW_UP_CRON_SCHEDULE = '*/5 * * * *';

let isProcessing = false;

async function processFollowUps() {
  if (isProcessing) {
    console.log('[TextCampaignFollowUps] Previous run still in progress, skipping');
    return;
  }
  isProcessing = true;
  try {
    // Find contacts due for their next follow-up step
    const dueContacts = await query(`
      SELECT
        tcc.id AS contact_id,
        tcc.campaign_id,
        tcc.phone_normalized,
        tcc.secondary_phone,
        tcc.follow_ups_sent,
        tcc.last_outbound_at,
        tcc.campaign_status,
        tcfu.step_number,
        tcfu.message AS follow_up_message,
        tcfu.delay_value,
        tcfu.delay_unit,
        tc.created_by
      FROM text_campaign_contacts tcc
      INNER JOIN text_campaigns tc ON tcc.campaign_id = tc.id
      INNER JOIN text_campaign_follow_ups tcfu
        ON tcfu.campaign_id = tcc.campaign_id
        AND tcfu.step_number = tcc.follow_ups_sent + 1
      LEFT JOIN text_campaign_dnc dnc ON tcc.phone_normalized = dnc.phone_normalized
      WHERE tc.status = 'sent'
        AND tcc.campaign_status IN ('sent', 'responded')
        AND dnc.id IS NULL
        AND tcc.last_outbound_at IS NOT NULL
        AND (
          (tcfu.delay_unit = 'hours' AND tcc.last_outbound_at <= DATE_SUB(NOW(), INTERVAL tcfu.delay_value HOUR))
          OR
          (tcfu.delay_unit = 'days'  AND tcc.last_outbound_at <= DATE_SUB(NOW(), INTERVAL tcfu.delay_value DAY))
        )
      ORDER BY tcc.last_outbound_at ASC
      LIMIT 200
    `);

    if (dueContacts.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[TextCampaignFollowUps] Found ${dueContacts.length} contacts due for follow-up`);

    // Immediately increment follow_ups_sent for all selected contacts
    // to prevent re-selection if the scheduler fires again before we finish
    const contactIds = dueContacts.map(c => c.contact_id);
    await query(
      `UPDATE text_campaign_contacts
       SET follow_ups_sent = follow_ups_sent + 1,
           last_outbound_at = NOW(),
           last_message_at = NOW()
       WHERE id IN (${contactIds.map(() => '?').join(',')})`,
      contactIds
    );

    // Load DNC set for secondary phone checks
    const dncRows = await query('SELECT phone_normalized FROM text_campaign_dnc');
    const dncSet = new Set(dncRows.map(r => r.phone_normalized));

    // Build cross-campaign cooldown map (18-day window)
    // Maps phone -> Set of campaign_ids that texted it recently
    const recentSendRows = await query(`
      SELECT DISTINCT tcc2.phone_normalized, tcc2.secondary_phone, tcc2.campaign_id
      FROM text_campaign_messages tcm2
      JOIN text_campaign_contacts tcc2 ON tcm2.contact_id = tcc2.id
      WHERE tcm2.direction = 'outbound'
        AND tcm2.created_at >= DATE_SUB(NOW(), INTERVAL 18 DAY)
    `);
    const phoneCampaignMap = new Map();
    for (const row of recentSendRows) {
      if (row.phone_normalized) {
        if (!phoneCampaignMap.has(row.phone_normalized)) phoneCampaignMap.set(row.phone_normalized, new Set());
        phoneCampaignMap.get(row.phone_normalized).add(row.campaign_id);
      }
      if (row.secondary_phone) {
        const sn = formatPhoneNumber(row.secondary_phone);
        if (sn) {
          if (!phoneCampaignMap.has(sn)) phoneCampaignMap.set(sn, new Set());
          phoneCampaignMap.get(sn).add(row.campaign_id);
        }
      }
    }
    const isInCrossCampaignCooldown = (phone, currentCampaignId) => {
      const campaigns = phoneCampaignMap.get(phone);
      if (!campaigns) return false;
      for (const cid of campaigns) {
        if (cid !== currentCampaignId) return true;
      }
      return false;
    };

    // Track phones sent in this batch to avoid household dupes
    const sentPhones = new Set();
    let sentCount = 0;
    let failedCount = 0;

    for (const contact of dueContacts) {
      // --- Primary phone ---
      if (isInCrossCampaignCooldown(contact.phone_normalized, contact.campaign_id)) {
        console.log('[TextCampaignFollowUps] Skipping primary - cross-campaign cooldown (18d):', contact.phone_normalized);
      } else if (!sentPhones.has(contact.phone_normalized)) {
        try {
          const result = await sendSMS({
            toNumber: contact.phone_normalized,
            message: contact.follow_up_message,
            userId: contact.created_by,
            statusCallback: STATUS_CALLBACK_URL
          });

          if (result.success) {
            sentPhones.add(contact.phone_normalized);
            await query(
              `INSERT INTO text_campaign_messages
                (campaign_id, contact_id, phone_number, direction, message, twilio_sid, status, sent_by, follow_up_step)
               VALUES (?, ?, ?, 'outbound', ?, ?, 'sent', ?, ?)`,
              [contact.campaign_id, contact.contact_id, contact.phone_normalized, contact.follow_up_message, result.messageId, contact.created_by, contact.step_number]
            );
            sentCount++;
          } else {
            const is21610 = result.error && (result.error.includes('21610') || result.error.includes('unsubscribed'));
            if (is21610) {
              await query(
                `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                 VALUES (?, 'twilio_21610', ?, ?)`,
                [contact.phone_normalized, contact.campaign_id, contact.contact_id]
              );
              await query(
                "UPDATE text_campaign_contacts SET campaign_status = 'opted_out' WHERE id = ?",
                [contact.contact_id]
              );
              console.log('[TextCampaignFollowUps] 21610 opt-out, added to DNC:', contact.phone_normalized);
            }
            failedCount++;
            console.error('[TextCampaignFollowUps] Failed to send to', contact.phone_normalized, ':', result.error);
          }
        } catch (err) {
          const is21610 = err.code === 21610 || (err.message && err.message.includes('21610'));
          if (is21610) {
            await query(
              `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
               VALUES (?, 'twilio_21610', ?, ?)`,
              [contact.phone_normalized, contact.campaign_id, contact.contact_id]
            );
            await query(
              "UPDATE text_campaign_contacts SET campaign_status = 'opted_out' WHERE id = ?",
              [contact.contact_id]
            );
          }
          failedCount++;
          console.error('[TextCampaignFollowUps] Error sending to', contact.phone_normalized, ':', err.message);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // --- Secondary phone ---
      if (contact.secondary_phone) {
        const secNorm = formatPhoneNumber(contact.secondary_phone);
        if (secNorm && !sentPhones.has(secNorm) && !dncSet.has(secNorm) && !isInCrossCampaignCooldown(secNorm, contact.campaign_id)) {
          try {
            const secResult = await sendSMS({
              toNumber: secNorm,
              message: contact.follow_up_message,
              userId: contact.created_by,
              statusCallback: STATUS_CALLBACK_URL
            });

            if (secResult.success) {
              sentPhones.add(secNorm);
              await query(
                `INSERT INTO text_campaign_messages
                  (campaign_id, contact_id, phone_number, direction, message, twilio_sid, status, sent_by, follow_up_step)
                 VALUES (?, ?, ?, 'outbound', ?, ?, 'sent', ?, ?)`,
                [contact.campaign_id, contact.contact_id, secNorm, contact.follow_up_message, secResult.messageId, contact.created_by, contact.step_number]
              );
              sentCount++;
            } else {
              const is21610 = secResult.error && (secResult.error.includes('21610') || secResult.error.includes('unsubscribed'));
              if (is21610) {
                await query(
                  `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                   VALUES (?, 'twilio_21610', ?, ?)`,
                  [secNorm, contact.campaign_id, contact.contact_id]
                );
                console.log('[TextCampaignFollowUps] 21610 on secondary, added to DNC:', secNorm);
              }
              failedCount++;
            }
          } catch (err) {
            const is21610 = err.code === 21610 || (err.message && err.message.includes('21610'));
            if (is21610) {
              await query(
                `INSERT IGNORE INTO text_campaign_dnc (phone_normalized, source, campaign_id, contact_id)
                 VALUES (?, 'twilio_21610', ?, ?)`,
                [secNorm, contact.campaign_id, contact.contact_id]
              );
            }
            failedCount++;
            console.error('[TextCampaignFollowUps] Error sending to secondary', secNorm, ':', err.message);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

    }

    if (sentCount > 0 || failedCount > 0) {
      console.log(`[TextCampaignFollowUps] Batch complete: ${sentCount} sent, ${failedCount} failed`);
    }
  } catch (error) {
    console.error('[TextCampaignFollowUps] Scheduler error:', error);
  } finally {
    isProcessing = false;
  }
}

function initTextCampaignFollowUpScheduler() {
  console.log(`[TextCampaignFollowUps] Starting scheduler (${FOLLOW_UP_CRON_SCHEDULE})`);

  cron.schedule(FOLLOW_UP_CRON_SCHEDULE, async () => {
    await processFollowUps();
  });
}

module.exports = {
  initTextCampaignFollowUpScheduler,
  processFollowUps
};
