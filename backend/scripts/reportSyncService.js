// reportSyncService.js
const { query } = require('../db');
const logger = require('../utils/logger');
const { getReportsFromOutlook } = require('../services/microsoftGraphService');

// For now, return empty array since client credentials can't access user emails
// This can be enhanced later with webhooks or other email processing methods
async function fetchNewFilesForReport(report) {
  try {
    logger.info(`[ReportSync] Checking for new files for report: ${report.report_name}`);
    
    // For now, return empty array since we can't access user emails with client credentials
    // TODO: Implement email processing through webhooks or other means
    logger.info(`[ReportSync] No new files found for report ${report.id} (client credentials mode)`);
    return [];
  } catch (error) {
    logger.error(`[ReportSync] Error fetching new files for report ${report.id}:`, error);
    return [];
  }
}

async function syncReports() {
  logger.info('[ReportSync] Starting report sync...');
  
  try {
    // Get all reports from onedrive_reports
    const reports = await query('SELECT * FROM onedrive_reports WHERE is_active = 1');
    logger.info(`[ReportSync] Found ${reports.length} active reports to check`);
    
    for (const report of reports) {
      logger.info(`[ReportSync] Processing report: ${report.report_name} (ID: ${report.id})`);
      
      // Get existing versions for this report
      const versions = await query('SELECT file_name FROM report_versions WHERE report_id = ?', [report.id]);
      const existingFiles = new Set(versions.map(v => v.file_name));
      logger.info(`[ReportSync] Found ${existingFiles.size} existing versions for report ${report.id}`);

      // Fetch new files for this report
      const newFiles = await fetchNewFilesForReport(report);
      logger.info(`[ReportSync] Found ${newFiles.length} potential new files for report ${report.id}`);
      
      for (const file of newFiles) {
        if (existingFiles.has(file.file_name)) {
          logger.info(`[ReportSync] File ${file.file_name} already exists for report ${report.id}, skipping`);
          continue;
        }
        
        // Insert into report_versions (file is already uploaded to OneDrive by the Microsoft Graph service)
        await query(
          `INSERT INTO report_versions (report_id, version_name, file_name, onedrive_url, file_size, upload_date, is_current, version_notes, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
          [
            report.id,
            file.version_name || null,
            file.file_name,
            file.onedrive_url,
            file.file_size,
            file.upload_date,
            0,
            file.version_notes || '',
            file.created_by || report.created_by
          ]
        );
        logger.info(`[ReportSync] Added new version for report_id ${report.id}: ${file.file_name}`);
      }
    }
    logger.info('[ReportSync] Report sync complete.');
  } catch (error) {
    logger.error('[ReportSync] Error during sync:', error);
    throw error;
  }
}

module.exports = { syncReports }; 