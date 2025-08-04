/**
 * Scheduler for syncing reports from Outlook to database
 */
const cron = require('node-cron');
const { syncReports } = require('../scripts/reportSyncService');
const logger = require('../utils/logger');

// Run daily at 2 AM
const REPORT_SYNC_CRON_SCHEDULE = '0 2 * * *';

/**
 * Initialize the report sync scheduler
 */
function initReportSyncScheduler() {
  logger.info(`Starting report sync scheduler with schedule: ${REPORT_SYNC_CRON_SCHEDULE}`);
  
  // Schedule the task
  const task = cron.schedule(REPORT_SYNC_CRON_SCHEDULE, async () => {
    try {
      logger.debug('Running scheduled report sync...');
      await syncReports();
      logger.info('Report sync processing complete');
    } catch (error) {
      logger.error('Error in report sync scheduler:', error);
    }
  });
  
  // Return the task for potential control (stop/start)
  return task;
}

module.exports = {
  initReportSyncScheduler
}; 