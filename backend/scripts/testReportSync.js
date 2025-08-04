// testReportSync.js
const { syncReports } = require('./reportSyncService');
const logger = require('../utils/logger');

(async () => {
  try {
    logger.info('[TestReportSync] Starting test report sync...');
    await syncReports();
    logger.info('[TestReportSync] Test completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('[TestReportSync] Test failed:', error);
    process.exit(1);
  }
})(); 