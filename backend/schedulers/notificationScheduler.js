/**
 * Scheduler for processing scheduled notifications
 */
const cron = require('node-cron');
const scheduledNotificationService = require('../services/scheduledNotificationService');
const logger = require('../utils/logger');

// Run every minute
const NOTIFICATION_CRON_SCHEDULE = '* * * * *';

/**
 * Initialize the notification scheduler
 */
function initNotificationScheduler() {
  
  // Schedule the task
  const task = cron.schedule(NOTIFICATION_CRON_SCHEDULE, async () => {
    try {
      
      const stats = await scheduledNotificationService.processDueNotifications();
      
      
      if (stats.sent > 0 || stats.errors > 0) {
      }
    } catch (error) {
      logger.error('Error in notification scheduler:', error);
      console.error('🔔 [SCHEDULER] Error:', error);
    }
  });
  
  
  // Return the task for potential control (stop/start)
  return task;
}

module.exports = {
  initNotificationScheduler
}; 