const { query } = require('../db');

async function testAPIStructure() {
  try {
    console.log('🔍 Testing API data structure...\n');
    
    // Test what the API would return
    const reports = await query(`
      SELECT r.id, r.subject, r.report_name, r.report_description, r.category_id,
             r.frequency, r.onedrive_url, r.file_name, r.file_size, r.file_type, r.upload_date,
             r.is_hidden, r.is_from_home_office, r.priority, r.tags, r.metadata,
             r.added_at, r.updated_at,
             c.name as category_name, c.color as category_color, c.icon as category_icon,
             (SELECT COUNT(*) FROM report_versions WHERE report_id = r.id) as version_count
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      ORDER BY r.priority DESC, r.upload_date DESC, r.added_at DESC
    `);
    
    console.log(`📊 Found ${reports.length} reports in database`);
    
    // Show all reports with version counts
    console.log('\n📋 Reports Summary:');
    reports.forEach((report, index) => {
      console.log(`${index + 1}. "${report.report_name}" - ${report.version_count} versions`);
    });
    
    // Test version fetching for first report
    if (reports.length > 0) {
      const firstReport = reports[0];
      const versions = await query(`
        SELECT v.*, u.lagnname as created_by_name
        FROM report_versions v
        LEFT JOIN activeusers u ON v.created_by = u.id
        WHERE v.report_id = ?
        ORDER BY v.upload_date DESC, v.created_at DESC
      `, [firstReport.id]);
      
      console.log(`\n📝 All versions for "${firstReport.report_name}":`);
      versions.forEach((version, index) => {
        console.log(`  ${index + 1}. ${version.version_name} - ${version.file_name} - Notes: ${version.version_notes.substring(0, 50)}...`);
      });
      
      // Simulate what the API would return
      const fullReport = {
        ...firstReport,
        versions: versions
      };
      
      console.log(`\n✅ API would return:`);
      console.log(`   Report: "${fullReport.report_name}"`);
      console.log(`   Category: ${fullReport.category_name}`);
      console.log(`   Versions: ${fullReport.versions.length}`);
      console.log(`   This means frontend should show: 1 card with "History (${fullReport.versions.length})" button`);
    }
    
    console.log('\n🎯 Expected Frontend Behavior:');
    console.log(`   • Total report cards: ${reports.length}`);
    console.log(`   • Each card shows version count in history button`);
    console.log(`   • Clicking "History" shows all versions in modal`);
    
  } catch (error) {
    console.error('❌ Error testing API structure:', error);
  }
}

if (require.main === module) {
  testAPIStructure().then(() => process.exit(0));
}

module.exports = { testAPIStructure }; 