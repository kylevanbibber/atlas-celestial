const cron = require('node-cron');
const db = require('../db');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Process scheduled email campaigns
 * Runs every 5 minutes to check for campaigns that need to be sent
 */
async function processScheduledCampaigns() {
  try {
    logger.info('Checking for scheduled campaigns...');

    // Find campaigns that are scheduled and past their scheduled time
    const campaigns = await db.query(`
      SELECT * FROM email_campaigns 
      WHERE status = 'scheduled' 
      AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
    `);

    if (campaigns.length === 0) {
      logger.info('No scheduled campaigns to process');
      return;
    }

    logger.info(`Found ${campaigns.length} campaign(s) to process`);

    for (const campaign of campaigns) {
      try {
        logger.info(`Processing campaign ${campaign.id}: ${campaign.name}`);

        // Update status to sending
        await db.query(
          'UPDATE email_campaigns SET status = ? WHERE id = ?',
          ['sending', campaign.id]
        );

        // Get recipients for this campaign
        const recipients = await db.query(`
          SELECT 
            er.*,
            au.lagnname,
            au.email,
            au.clname,
            au.esid,
            au.phone,
            au.teamRole
          FROM email_recipients er
          LEFT JOIN activeusers au ON er.user_id = au.id
          WHERE er.campaign_id = ? AND er.status = 'pending'
        `, [campaign.id]);

        if (recipients.length === 0) {
          logger.warn(`Campaign ${campaign.id} has no pending recipients`);
          await db.query(
            'UPDATE email_campaigns SET status = ? WHERE id = ?',
            ['failed', campaign.id]
          );
          continue;
        }

        logger.info(`Sending emails to ${recipients.length} recipient(s)`);

        let sentCount = 0;
        let failedCount = 0;

        // Send emails in batch
        for (const recipient of recipients) {
          try {
            // Prepare user data for variable replacement
            const userData = {
              lagnname: recipient.lagnname,
              email: recipient.email,
              clname: recipient.clname,
              esid: recipient.esid,
              phone: recipient.phone,
              teamRole: recipient.teamRole
            };

            // Send email
            await emailService.sendTemplateEmail(
              recipient.email,
              campaign.subject,
              campaign.body,
              userData
            );

            // Update recipient status
            await db.query(
              'UPDATE email_recipients SET status = ?, sent_at = NOW() WHERE id = ?',
              ['sent', recipient.id]
            );

            sentCount++;
            logger.info(`Email sent successfully to ${recipient.email}`);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            logger.error(`Failed to send email to ${recipient.email}:`, error);
            
            // Update recipient with error
            await db.query(
              'UPDATE email_recipients SET status = ?, error_message = ? WHERE id = ?',
              ['failed', error.message, recipient.id]
            );

            failedCount++;
          }
        }

        // Update campaign status
        await db.query(
          'UPDATE email_campaigns SET status = ?, sent_at = NOW() WHERE id = ?',
          ['sent', campaign.id]
        );

        logger.info(`Campaign ${campaign.id} completed: ${sentCount} sent, ${failedCount} failed`);

      } catch (error) {
        logger.error(`Error processing campaign ${campaign.id}:`, error);
        
        // Mark campaign as failed
        await db.query(
          'UPDATE email_campaigns SET status = ? WHERE id = ?',
          ['failed', campaign.id]
        );
      }
    }

  } catch (error) {
    logger.error('Error in processScheduledCampaigns:', error);
  }
}

// Schedule the job to run every 5 minutes
function startScheduler() {
  logger.info('Starting email campaign scheduler...');
  
  // Run every 5 minutes: */5 * * * *
  cron.schedule('*/5 * * * *', async () => {
    await processScheduledCampaigns();
  });

  logger.info('Email campaign scheduler started (runs every 5 minutes)');
}

// If this script is run directly
if (require.main === module) {
  startScheduler();
  
  // Keep the process running
  process.on('SIGINT', () => {
    logger.info('Stopping email campaign scheduler...');
    process.exit(0);
  });
}

module.exports = {
  processScheduledCampaigns,
  startScheduler
};


