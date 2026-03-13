/**
 * Scheduler for auto-linking pipeline records to activeusers
 * AND syncing pending agents (creating pipeline records if needed)
 */
const cron = require('node-cron');
const axios = require('axios');
const logger = require('../utils/logger');

// Run daily at 3 AM (after home office reports have processed)
const PIPELINE_LINKING_CRON_SCHEDULE = '0 3 * * *';

/**
 * Initialize the pipeline linking scheduler
 */
function initPipelineLinkingScheduler() {
  logger.info(`Starting pipeline linking scheduler with schedule: ${PIPELINE_LINKING_CRON_SCHEDULE}`);
  
  // Schedule the task
  const task = cron.schedule(PIPELINE_LINKING_CRON_SCHEDULE, async () => {
    try {
      const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001/api';
      
      // Step 1: Sync pending agents (create pipeline records if needed)
      logger.debug('Running scheduled pending agent sync...');
      
      try {
        const syncResponse = await axios.get(`${API_BASE_URL}/pending-agent-sync/sync-all`, {
          headers: { 'X-Internal-Request': 'true' }
        });
        
        if (syncResponse.data.success) {
          logger.info(`Pending agent sync complete: ${syncResponse.data.created} created, ${syncResponse.data.linked} linked, ${syncResponse.data.skipped} skipped`);
        } else {
          logger.error('Pending agent sync failed:', syncResponse.data.message);
        }
      } catch (error) {
        logger.error('Error in pending agent sync:', error.message);
      }
      
      // Step 2: Auto-link any remaining unlinked pipeline records
      logger.debug('Running scheduled pipeline auto-linking...');
      
      try {
        const linkResponse = await axios.get(`${API_BASE_URL}/pipeline-linking/auto-link-all`, {
          headers: { 'X-Internal-Request': 'true' }
        });
        
        if (linkResponse.data.success) {
          logger.info(`Pipeline auto-linking complete: ${linkResponse.data.linkedCount} linked, ${linkResponse.data.errorCount} errors`);
        } else {
          logger.error('Pipeline auto-linking failed:', linkResponse.data.message);
        }
      } catch (error) {
        logger.error('Error in pipeline linking:', error.message);
      }
      
    } catch (error) {
      logger.error('Error in pipeline linking scheduler:', error.message);
    }
  });
  
  // Return the task for potential control (stop/start)
  return task;
}

module.exports = {
  initPipelineLinkingScheduler
};

