const { pool, query } = require('../db');

async function testSimpleUpload() {
  try {
    console.log('🧪 Testing simple manual upload...');
    
    // Check what users exist
    const users = await query('SELECT id, lagnname FROM activeusers LIMIT 5');
    console.log('👥 Available users:');
    console.table(users);
    
    // Check what categories exist
    const categories = await query('SELECT id, name FROM file_categories ORDER BY sort_order');
    console.log('\n📋 Available categories:');
    console.table(categories);
    
    if (categories.length === 0) {
      console.log('⚠️  No categories found. Creating basic categories...');
      
      await query(`
        INSERT INTO file_categories (name, description, icon, color, sort_order) VALUES
        ('VIPs', 'VIP client reports', 'FiUsers', '#dc2626', 0),
        ('Weekly Reports', 'Weekly reports', 'FiCalendar', '#7c3aed', 1),
        ('Monthly Reports', 'Monthly reports', 'FiBarChart2', '#059669', 2)
      `);
      
      const newCategories = await query('SELECT id, name FROM file_categories ORDER BY sort_order');
      console.log('✅ Created categories:');
      console.table(newCategories);
    }
    
    // Test report data
    const testReport = {
      subject: 'Test VIP Report Upload',
      report_name: 'VIP Weekly Test Report',
      report_description: 'Test upload of a VIP weekly report',
      category_id: categories.find(c => c.name.includes('VIP'))?.id || categories[0]?.id,
      frequency: 'weekly',
      onedrive_url: 'https://aagencies-my.sharepoint.com/:x:/g/personal/test_ariasagencies_com/test-file',
      file_name: 'VIP_Test_Report.xlsx',
      file_size: '245 KB',
      file_type: 'xlsx',
      upload_date: new Date().toISOString().slice(0, 10),
      is_from_home_office: true,
      priority: 5,
      tags: JSON.stringify(['test', 'vip', 'weekly'])
    };
    
    console.log('\n📤 Testing report upload...');
    console.log('Report data:', testReport);
    
    // Determine user ID (use first available user or NULL)
    const userId = users.length > 0 ? users[0].id : null;
    console.log(`Using user ID: ${userId}`);
    
    // Try to insert the report
    const result = await query(`
      INSERT INTO onedrive_reports (
        subject, report_name, report_description, category_id, frequency, onedrive_url,
        file_name, file_size, file_type, upload_date, is_from_home_office,
        priority, tags, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testReport.subject,
      testReport.report_name,
      testReport.report_description,
      testReport.category_id,
      testReport.frequency,
      testReport.onedrive_url,
      testReport.file_name,
      testReport.file_size,
      testReport.file_type,
      testReport.upload_date,
      testReport.is_from_home_office,
      testReport.priority,
      testReport.tags,
      userId,
      userId
    ]);
    
    console.log(`✅ Report uploaded successfully with ID: ${result.insertId}`);
    
    // Verify the upload
    const uploadedReport = await query(`
      SELECT r.*, c.name as category_name, u.lagnname as created_by_name
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      LEFT JOIN activeusers u ON r.created_by = u.id
      WHERE r.id = ?
    `, [result.insertId]);
    
    console.log('\n📊 Uploaded report details:');
    console.table(uploadedReport);
    
    // Test version creation
    console.log('\n🔄 Testing version creation...');
    
    await query(`
      INSERT INTO report_versions (
        report_id, version_name, file_name, onedrive_url, file_size,
        upload_date, is_current, version_notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)
    `, [
      result.insertId,
      'Version 1.0',
      'VIP_Test_Report_v1.xlsx',
      'https://aagencies-my.sharepoint.com/:x:/g/personal/test_ariasagencies_com/test-file-v1',
      '250 KB',
      new Date().toISOString().slice(0, 10),
      'Initial version for testing',
      userId
    ]);
    
    console.log('✅ Version created successfully');
    
    // Test retrieval with filters
    console.log('\n🔍 Testing report retrieval...');
    
    const allReports = await query(`
      SELECT r.id, r.report_name, r.frequency, r.priority, c.name as category_name,
             (SELECT COUNT(*) FROM report_versions WHERE report_id = r.id) as version_count
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      ORDER BY r.priority DESC, r.added_at DESC
      LIMIT 5
    `);
    
    console.log('📋 Recent reports:');
    console.table(allReports);
    
    // Test frequency filtering
    const weeklyReports = await query(`
      SELECT r.id, r.report_name, r.frequency, c.name as category_name
      FROM onedrive_reports r
      LEFT JOIN file_categories c ON r.category_id = c.id
      WHERE r.frequency = 'weekly'
    `);
    
    console.log('\n📅 Weekly reports:');
    console.table(weeklyReports);
    
    console.log('\n✅ Manual upload test completed successfully!');
    console.log('\n💡 The system is ready for manual uploads through the web interface.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
if (require.main === module) {
  testSimpleUpload()
    .then(() => {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSimpleUpload }; 