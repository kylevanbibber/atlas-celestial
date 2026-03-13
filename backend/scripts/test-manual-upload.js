const axios = require('axios');
const { pool } = require('../db');

// Test data for manual upload
const testReports = [
  {
    subject: 'Weekly VIP Report - Week 1',
    report_name: 'VIP Client Analysis',
    report_description: 'Weekly analysis of VIP client activity and performance metrics',
    category_id: 1, // Assumes VIPs category has ID 1
    frequency: 'weekly',
    onedrive_url: 'https://1drv.ms/x/s!example-vip-weekly-report',
    file_name: 'VIP_Analysis_2024_W01.xlsx',
    file_size: '324 KB',
    file_type: 'xlsx',
    upload_date: '2024-01-07',
    is_from_home_office: true,
    priority: 8,
    tags: ['vip', 'weekly', 'analysis']
  },
  {
    subject: 'Monthly Production Summary - January',
    report_name: 'Production Summary',
    report_description: 'Monthly production statistics and KPI analysis',
    category_id: 3, // Monthly Reports category
    frequency: 'monthly',
    onedrive_url: 'https://sharepoint.company.com/sites/reports/production-jan-2024.xlsx',
    file_name: 'Production_Summary_Jan_2024.xlsx',
    file_size: '567 KB',
    file_type: 'xlsx',
    upload_date: '2024-01-31',
    is_from_home_office: true,
    priority: 7,
    tags: ['production', 'monthly', 'kpi']
  },
  {
    subject: 'VIP Client Analysis - January Update',
    report_name: 'VIP Client Analysis', // Same name to test versioning
    report_description: 'Updated VIP client analysis with January data',
    category_id: 1, // VIPs category
    frequency: 'monthly',
    onedrive_url: 'https://1drv.ms/x/s!example-vip-monthly-report-jan',
    file_name: 'VIP_Analysis_Jan_2024.xlsx',
    file_size: '387 KB',
    file_type: 'xlsx',
    upload_date: '2024-01-31',
    is_from_home_office: true,
    priority: 9,
    tags: ['vip', 'monthly', 'updated']
  }
];

async function testManualUpload() {
  try {
    console.log('🧪 Starting manual upload testing...');
    
    // Check if test categories exist
    const categories = await pool.query('SELECT id, name FROM file_categories ORDER BY sort_order');
    console.log('📋 Available categories:');
    console.table(categories);
    
    if (categories.length === 0) {
      console.log('⚠️  No categories found. Please run the setup script first.');
      return;
    }
    
    console.log('\n📤 Testing manual report uploads...');
    
    for (let i = 0; i < testReports.length; i++) {
      const report = testReports[i];
      console.log(`\n${i + 1}. Uploading: ${report.report_name}`);
      
      try {
        // Simulate API call to create report
        const result = await pool.query(`
          INSERT INTO onedrive_reports (
            subject, report_name, report_description, category_id, frequency, onedrive_url,
            file_name, file_size, file_type, upload_date, is_from_home_office,
            priority, tags, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          report.subject,
          report.report_name,
          report.report_description,
          report.category_id,
          report.frequency,
          report.onedrive_url,
          report.file_name,
          report.file_size,
          report.file_type,
          report.upload_date,
          report.is_from_home_office,
          report.priority,
          JSON.stringify(report.tags),
          1, // Test user ID
          1
        ]);
        
        console.log(`   ✅ Successfully uploaded with ID: ${result.insertId}`);
        
        // Test version logic for duplicate names
        if (i === 2) { // Third report has same name as first
          console.log('   🔄 Testing version creation for duplicate name...');
          
          // Check if a report with same name exists
          const existingReport = await pool.query(`
            SELECT id FROM onedrive_reports 
            WHERE report_name = ? AND category_id = ? AND id != ?
            ORDER BY added_at DESC 
            LIMIT 1
          `, [report.report_name, report.category_id, result.insertId]);
          
          if (existingReport.length > 0) {
            const originalReportId = existingReport[0].id;
            
            // Create version entry
            await pool.query(`
              INSERT INTO report_versions (
                report_id, version_name, file_name, onedrive_url, file_size,
                upload_date, is_current, version_notes, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            `, [
              originalReportId,
              `Version ${new Date().toISOString().slice(0, 10)}`,
              report.file_name,
              report.onedrive_url,
              report.file_size,
              report.upload_date,
              `Auto-created from upload: ${report.subject}`,
              1
            ]);
            
            // Update main report
            await pool.query(`
              UPDATE onedrive_reports 
              SET onedrive_url = ?, file_name = ?, file_size = ?, upload_date = ?,
                  frequency = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [
              report.onedrive_url,
              report.file_name,
              report.file_size,
              report.upload_date,
              report.frequency,
              1,
              originalReportId
            ]);
            
            // Delete the duplicate
            await pool.query('DELETE FROM onedrive_reports WHERE id = ?', [result.insertId]);
            
            console.log(`   📝 Created new version for existing report ID: ${originalReportId}`);
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to upload: ${error.message}`);
      }
    }
    
    // Test retrieval and filtering
    console.log('\n📊 Testing report retrieval...');
    
    const allReports = await pool.query(`
      SELECT r.id, r.report_name, r.frequency, r.file_name, r.upload_date,
             c.name as category_name, r.priority,
             (SELECT COUNT(*) FROM report_versions WHERE report_id = r.id) as version_count
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      ORDER BY r.priority DESC, r.upload_date DESC
    `);
    
    console.log('📋 All reports:');
    console.table(allReports);
    
    // Test filtering by category
    const vipReports = await pool.query(`
      SELECT r.*, c.name as category_name
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      WHERE c.name = 'VIPs'
    `);
    
    console.log('\n🌟 VIP Reports:');
    console.table(vipReports.map(r => ({
      id: r.id,
      name: r.report_name,
      frequency: r.frequency,
      file_name: r.file_name,
      priority: r.priority
    })));
    
    // Test filtering by frequency
    const weeklyReports = await pool.query(`
      SELECT r.*, c.name as category_name
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      WHERE r.frequency = 'weekly'
    `);
    
    console.log('\n📅 Weekly Reports:');
    console.table(weeklyReports.map(r => ({
      id: r.id,
      name: r.report_name,
      category: r.category_name,
      file_name: r.file_name
    })));
    
    // Test version history
    const versionsTest = await pool.query(`
      SELECT v.*, r.report_name
      FROM report_versions v
      LEFT JOIN onedrive_reports r ON v.report_id = r.id
      ORDER BY v.report_id, v.upload_date DESC
    `);
    
    if (versionsTest.length > 0) {
      console.log('\n📚 Version History:');
      console.table(versionsTest);
    }
    
    console.log('\n✅ Manual upload testing completed successfully!');
    
    // Summary
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(DISTINCT category_id) as categories_used,
        COUNT(CASE WHEN frequency != 'ad-hoc' THEN 1 END) as reports_with_frequency
      FROM onedrive_reports
    `);
    
    console.log('\n📈 Test Summary:');
    console.table(summary);
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  }
}

// Cleanup function
async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...');
    
    // Delete test reports (assuming they have specific test tags)
    const deleteResult = await pool.query(`
      DELETE FROM onedrive_reports 
      WHERE JSON_CONTAINS(tags, '"vip"') OR JSON_CONTAINS(tags, '"production"')
    `);
    
    console.log(`🗑️  Deleted ${deleteResult.affectedRows} test reports`);
    
    // Delete orphaned versions
    await pool.query(`
      DELETE v FROM report_versions v
      LEFT JOIN onedrive_reports r ON v.report_id = r.id
      WHERE r.id IS NULL
    `);
    
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'cleanup') {
    cleanupTestData()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    testManualUpload()
      .then(() => {
        console.log('\n💡 To cleanup test data, run: node test-manual-upload.js cleanup');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Test failed:', error);
        process.exit(1);
      });
  }
}

module.exports = { testManualUpload, cleanupTestData }; 