// syncReports.js
const { syncReports } = require('./reportSyncService');
const logger = require('../utils/logger');

(async () => {
  try {
    logger.info('[SyncReports] Starting...');
    await syncReports();
    logger.info('[SyncReports] Done.');
    process.exit(0);
  } catch (err) {
    logger.error('[SyncReports] Error:', err);
    process.exit(1);
  }
})(); 