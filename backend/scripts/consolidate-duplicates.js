const { query } = require('../db');

async function getUserId() {
  const users = await query('SELECT id FROM activeusers LIMIT 1');
  return users.length > 0 ? users[0].id : null;
}

async function consolidateDuplicateReports() {
  try {
    console.log('🔧 Starting duplicate report consolidation...\n');
    
    const userId = await getUserId();
    console.log(`👤 Using user ID: ${userId} for operations\n`);
    
    // Find all reports with duplicate names/categories
    const duplicateGroups = await query(`
      SELECT 
        report_name,
        category_id,
        COUNT(*) as count,
        GROUP_CONCAT(id ORDER BY added_at ASC) as report_ids
      FROM onedrive_reports 
      GROUP BY report_name, category_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log(`📊 Found ${duplicateGroups.length} groups of duplicate reports:`);
    console.table(duplicateGroups.map(g => ({
      report_name: g.report_name,
      category_id: g.category_id,
      count: g.count
    })));
    
    let totalConsolidated = 0;
    
    for (const group of duplicateGroups) {
      console.log(`\n🔄 Processing "${group.report_name}" (${group.count} duplicates)...`);
      
      const reportIds = group.report_ids.split(',').map(id => parseInt(id));
      const keepReportId = reportIds[0]; // Keep the first/oldest report
      const duplicateIds = reportIds.slice(1); // These will become versions
      
      console.log(`   📌 Keeping report ID ${keepReportId} as main report`);
      console.log(`   🔄 Converting ${duplicateIds.length} reports to versions: ${duplicateIds.join(', ')}`);
      
      // Get details of all reports to create versions
      const allReports = await query(`
        SELECT * FROM onedrive_reports 
        WHERE id IN (${reportIds.map(() => '?').join(',')})
        ORDER BY added_at ASC
      `, reportIds);
      
      // Clear any existing versions for the main report
      await query('DELETE FROM report_versions WHERE report_id = ?', [keepReportId]);
      
      // Create versions for ALL reports (including the one we're keeping)
      for (let i = 0; i < allReports.length; i++) {
        const report = allReports[i];
        const isMain = report.id === keepReportId;
        const versionNumber = i + 1;
        
        console.log(`   📝 Creating version ${versionNumber} from report ID ${report.id}...`);
        
        await query(`
          INSERT INTO report_versions (
            report_id, version_name, file_name, onedrive_url, file_size,
            upload_date, is_current, version_notes, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          keepReportId,
          `Version ${versionNumber}`,
          report.file_name,
          report.onedrive_url,
          report.file_size,
          report.upload_date,
          i === allReports.length - 1, // Mark the last (newest) version as current
          `Consolidated from report ID ${report.id}: ${report.subject}`,
          userId,
          report.added_at
        ]);
      }
      
      // Update the main report with the newest version's details
      const newestReport = allReports[allReports.length - 1];
      await query(`
        UPDATE onedrive_reports 
        SET 
          onedrive_url = ?,
          file_name = ?,
          file_size = ?,
          upload_date = ?,
          subject = ?,
          report_description = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        newestReport.onedrive_url,
        newestReport.file_name,
        newestReport.file_size,
        newestReport.upload_date,
        newestReport.subject,
        newestReport.report_description,
        userId,
        keepReportId
      ]);
      
      // Delete the duplicate reports (not the main one)
      if (duplicateIds.length > 0) {
        await query(`
          DELETE FROM onedrive_reports 
          WHERE id IN (${duplicateIds.map(() => '?').join(',')})
        `, duplicateIds);
        
        console.log(`   ✅ Deleted ${duplicateIds.length} duplicate reports`);
      }
      
      // Verify the consolidation
      const versionCount = await query(`
        SELECT COUNT(*) as count FROM report_versions WHERE report_id = ?
      `, [keepReportId]);
      
      console.log(`   ✅ Report now has ${versionCount[0].count} versions`);
      totalConsolidated += duplicateIds.length;
    }
    
    console.log(`\n🎉 Consolidation completed!`);
    console.log(`📈 Summary:`);
    console.log(`   • Processed ${duplicateGroups.length} groups of duplicates`);
    console.log(`   • Consolidated ${totalConsolidated} duplicate reports into versions`);
    console.log(`   • Created ${duplicateGroups.reduce((sum, g) => sum + g.count, 0)} total versions`);
    
    // Show final stats
    const finalStats = await query(`
      SELECT 
        COUNT(*) as total_reports,
        SUM(CASE WHEN (SELECT COUNT(*) FROM report_versions WHERE report_id = onedrive_reports.id) > 0 THEN 1 ELSE 0 END) as reports_with_versions,
        (SELECT COUNT(*) FROM report_versions) as total_versions
      FROM onedrive_reports
    `);
    
    console.log('\n📊 Final Database Stats:');
    console.table(finalStats);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error consolidating duplicates:', error);
    throw error;
  }
}

async function previewConsolidation() {
  try {
    console.log('👀 Previewing consolidation (no changes will be made)...\n');
    
    // Find all reports with duplicate names/categories
    const duplicateGroups = await query(`
      SELECT 
        report_name,
        category_id,
        fc.name as category_name,
        COUNT(*) as count,
        MIN(added_at) as oldest_date,
        MAX(added_at) as newest_date
      FROM onedrive_reports r
      LEFT JOIN file_categories fc ON r.category_id = fc.id
      GROUP BY report_name, category_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log(`📊 Preview: Found ${duplicateGroups.length} groups that will be consolidated:`);
    console.table(duplicateGroups);
    
    // Show details for top groups
    for (let i = 0; i < Math.min(3, duplicateGroups.length); i++) {
      const group = duplicateGroups[i];
      console.log(`\n📝 Details for "${group.report_name}":`);
      
      const reports = await query(`
        SELECT id, subject, added_at, LEFT(onedrive_url, 60) as url_preview
        FROM onedrive_reports 
        WHERE report_name = ? AND category_id = ?
        ORDER BY added_at ASC
      `, [group.report_name, group.category_id]);
      
      reports.forEach((report, index) => {
        console.log(`   ${index + 1}. ID: ${report.id} | Date: ${report.added_at} | Subject: "${report.subject}"`);
      });
      
      console.log(`   → Will keep ID ${reports[0].id} as main report`);
      console.log(`   → Will create ${reports.length} versions`);
      console.log(`   → Will delete ${reports.length - 1} duplicate entries`);
    }
    
    const totalReports = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
    const totalToDelete = duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0);
    
    console.log(`\n📋 Consolidation Impact:`);
    console.log(`   • ${totalReports} total duplicate reports found`);
    console.log(`   • ${totalToDelete} reports will be converted to versions`);
    console.log(`   • ${duplicateGroups.length} main reports will remain`);
    console.log(`   • ${totalReports} total versions will be created`);
    
  } catch (error) {
    console.error('❌ Error previewing consolidation:', error);
    throw error;
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'preview') {
    previewConsolidation().then(() => process.exit(0));
  } else if (command === 'run') {
    console.log('⚠️  WARNING: This will make permanent changes to your database!');
    console.log('   Duplicate reports will be consolidated into versions.');
    console.log('   Make sure you have a backup before proceeding.\n');
    
    consolidateDuplicateReports()
      .then(() => {
        console.log('\n✅ Consolidation completed successfully!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Consolidation failed:', error);
        process.exit(1);
      });
  } else {
    console.log(`
🔧 Duplicate Report Consolidation Tool

This tool fixes reports that should be versions but were created as separate entries.

Usage:
  node consolidate-duplicates.js preview    # Preview what will be consolidated
  node consolidate-duplicates.js run        # Actually consolidate the reports

What this does:
  1. Finds reports with identical report_name and category_id
  2. Keeps the oldest report as the "main" report
  3. Converts all duplicates into versions of that main report
  4. Deletes the duplicate report entries
  5. Updates the main report with the newest version's details

Example: Your 49 "Potential VIPs MTD" reports will become:
  → 1 main report titled "Potential VIPs MTD"
  → 49 versions showing the history
  → Version modal will show all 49 versions with dates

⚠️  IMPORTANT: Run 'preview' first to see what will be changed!
`);
    process.exit(1);
  }
}

module.exports = { consolidateDuplicateReports, previewConsolidation }; 