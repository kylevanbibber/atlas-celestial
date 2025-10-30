const cron = require('node-cron');
const { sendWeeklyReports } = require('../services/weeklyReportEmailService');
const logger = require('../utils/logger');

/**
 * Weekly Report Email Scheduler
 * Sends production reports every Monday at 9:00 AM
 */

function startWeeklyReportScheduler() {
  logger.info('Starting weekly report email scheduler...');
  
  // Run every Monday at 9:00 AM
  // Cron format: minute hour day month day-of-week
  // '0 9 * * 1' = At 09:00 on Monday
  cron.schedule('0 9 * * 1', async () => {
    logger.info('=== Weekly Report Email Job Starting ===');
    const startTime = Date.now();
    
    try {
      const result = await sendWeeklyReports();
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      logger.info(`=== Weekly Report Email Job Completed ===`);
      logger.info(`Duration: ${duration}s`);
      logger.info(`Results: ${result.successCount} sent, ${result.failCount} failed out of ${result.total} total`);
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`=== Weekly Report Email Job Failed ===`);
      logger.error(`Duration: ${duration}s`);
      logger.error('Error:', error);
    }
  }, {
    timezone: 'America/New_York' // Eastern Time
  });

  logger.info('Weekly report email scheduler started (runs every Monday at 9:00 AM ET)');
}

// If this script is run directly (for testing)
if (require.main === module) {
  startWeeklyReportScheduler();
  
  // Keep the process running
  process.on('SIGINT', () => {
    logger.info('Stopping weekly report scheduler...');
    process.exit(0);
  });

  // Also add a manual test function that can be called
  logger.info('Scheduler started. Press Ctrl+C to stop.');
  logger.info('To test manually, uncomment the sendWeeklyReports() call below.');
  
  // Uncomment the next line to test immediately:
  // sendWeeklyReports().then(() => logger.info('Manual test complete')).catch(err => logger.error('Manual test failed:', err));
}

module.exports = {
  startWeeklyReportScheduler
};

