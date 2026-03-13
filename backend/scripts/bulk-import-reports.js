const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { query } = require('../db');

async function bulkImportReports(csvFilePath) {
  try {
    console.log('📊 Starting bulk import from CSV...');
    
    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }
    
    // Get available categories
    const categories = await query('SELECT id, name FROM file_categories ORDER BY sort_order');
    console.log('📋 Available categories:');
    console.table(categories);
    
    // Get a user ID for the imports
    const users = await query('SELECT id, lagnname FROM activeusers LIMIT 1');
    const userId = users.length > 0 ? users[0].id : null;
    console.log(`👤 Using user ID: ${userId} (${users[0]?.lagnname || 'NULL'})`);
    
    // Read and parse CSV
    const records = [];
    const parser = fs.createReadStream(csvFilePath).pipe(
      parse({
        columns: true, // Use first row as column headers
        skip_empty_lines: true,
        trim: true
      })
    );
    
    for await (const record of parser) {
      records.push(record);
    }
    
    console.log(`📄 Found ${records.length} records in CSV`);
    
    if (records.length === 0) {
      console.log('⚠️  No records found in CSV file');
      return;
    }
    
    // Show first record as example
    console.log('\n📝 First record example:');
    console.log(records[0]);
    
    let imported = 0;
    let errors = 0;
    const errorLog = [];
    
    console.log('\n📤 Starting import...');
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`\n${i + 1}/${records.length}: ${record.report_name || 'Unnamed Report'}`);
      
      try {
        // Validate required fields
        if (!record.report_name || !record.onedrive_url) {
          throw new Error('Missing required fields: report_name and onedrive_url');
        }
        
        // Find category ID by name
        let categoryId = null;
        if (record.category_name) {
          const category = categories.find(c => 
            c.name.toLowerCase().includes(record.category_name.toLowerCase()) ||
            record.category_name.toLowerCase().includes(c.name.toLowerCase())
          );
          categoryId = category ? category.id : null;
        }
        
        // Set defaults for missing fields
        const reportData = {
          subject: record.subject || record.email_subject || '',
          report_name: record.report_name,
          report_description: record.description || record.report_description || '',
          category_id: categoryId,
          frequency: (record.frequency || 'ad-hoc').toLowerCase(),
          onedrive_url: record.onedrive_url.trim(),
          file_name: record.file_name || extractFileNameFromUrl(record.onedrive_url),
          file_size: record.file_size || '',
          file_type: record.file_type || 'xlsx',
          upload_date: parseDate(record.upload_date || record.date_received) || new Date().toISOString().slice(0, 10),
          is_from_home_office: parseBoolean(record.is_from_home_office) !== false,
          priority: parseInt(record.priority) || 0,
          tags: record.tags ? JSON.stringify(record.tags.split(',').map(t => t.trim())) : '[]'
        };
        
        // Validate frequency
        const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad-hoc'];
        if (!validFrequencies.includes(reportData.frequency)) {
          reportData.frequency = 'ad-hoc';
        }
        
        // Check for existing report with same name and category
        const existingReport = await query(`
          SELECT id FROM onedrive_reports 
          WHERE report_name = ? AND category_id = ?
          ORDER BY added_at DESC 
          LIMIT 1
        `, [reportData.report_name, reportData.category_id]);
        
        if (existingReport.length > 0) {
          console.log(`   📝 Found existing report, creating version...`);
          
          const reportId = existingReport[0].id;
          
          // Add as new version
          await query(`
            INSERT INTO report_versions (
              report_id, version_name, file_name, onedrive_url, file_size,
              upload_date, is_current, version_notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, ?)
          `, [
            reportId,
            `Import ${new Date().toISOString().slice(0, 10)}`,
            reportData.file_name,
            reportData.onedrive_url,
            reportData.file_size,
            reportData.upload_date,
            `Bulk imported from CSV: ${reportData.subject}`,
            userId
          ]);
          
          console.log(`   ✅ Added as version to existing report ID: ${reportId}`);
        } else {
          // Create new report
          const result = await query(`
            INSERT INTO onedrive_reports (
              subject, report_name, report_description, category_id, frequency, onedrive_url,
              file_name, file_size, file_type, upload_date, is_from_home_office,
              priority, tags, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            reportData.subject,
            reportData.report_name,
            reportData.report_description,
            reportData.category_id,
            reportData.frequency,
            reportData.onedrive_url,
            reportData.file_name,
            reportData.file_size,
            reportData.file_type,
            reportData.upload_date,
            reportData.is_from_home_office,
            reportData.priority,
            reportData.tags,
            userId,
            userId
          ]);
          
          console.log(`   ✅ Created new report with ID: ${result.insertId}`);
        }
        
        imported++;
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errors++;
        errorLog.push({
          row: i + 1,
          report_name: record.report_name,
          error: error.message
        });
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${imported}`);
    console.log(`❌ Errors: ${errors}`);
    
    if (errorLog.length > 0) {
      console.log('\n❌ Error Details:');
      console.table(errorLog);
    }
    
    // Show final stats
    const finalStats = await query(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(DISTINCT category_id) as categories_used,
        COUNT(CASE WHEN frequency != 'ad-hoc' THEN 1 END) as reports_with_frequency
      FROM onedrive_reports
    `);
    
    console.log('\n📈 Final Database Stats:');
    console.table(finalStats);
    
  } catch (error) {
    console.error('❌ Bulk import failed:', error);
    throw error;
  }
}

// Helper functions
function extractFileNameFromUrl(url) {
  try {
    // Try to extract filename from OneDrive URL
    const match = url.match(/\/([^\/]+\.xlsx?)(?:\?|$)/i);
    return match ? match[1] : 'Unknown.xlsx';
  } catch (error) {
    return 'Unknown.xlsx';
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  } catch (error) {
    return null;
  }
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === 'yes' || lower === '1';
  }
  return false;
}

// Create sample CSV template
function createSampleCSV() {
  const sampleData = `report_name,category_name,frequency,onedrive_url,subject,description,upload_date,priority,file_size,tags
"VIP Client Weekly Report","VIPs","weekly","https://aagencies-my.sharepoint.com/:x:/g/personal/example.xlsx","Weekly VIP Report - Week 1","Weekly analysis of VIP client performance","2024-01-07","8","245 KB","vip,weekly,analysis"
"Monthly Production Summary","Monthly Reports","monthly","https://sharepoint.company.com/sites/reports/production-jan.xlsx","Monthly Production Report","January production statistics","2024-01-31","7","567 KB","production,monthly"
"Daily Activity Report","Daily Reports","daily","https://onedrive.live.com/edit.aspx?resid=daily-activity.xlsx","Daily Activity - Jan 15","Daily activity metrics","2024-01-15","5","123 KB","daily,activity"`;

  const csvPath = path.join(__dirname, 'sample-import.csv');
  fs.writeFileSync(csvPath, sampleData);
  console.log(`📄 Sample CSV created: ${csvPath}`);
  return csvPath;
}

// Run import if this script is executed directly
if (require.main === module) {
  const command = process.argv[2];
  const csvFile = process.argv[3];
  
  if (command === 'create-sample') {
    createSampleCSV();
    process.exit(0);
  } else if (command === 'import' && csvFile) {
    bulkImportReports(csvFile)
      .then(() => {
        console.log('\n🎉 Bulk import completed!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Bulk import failed:', error);
        process.exit(1);
      });
  } else {
    console.log(`
📊 Bulk Import Tool for Production Reports

Usage:
  node bulk-import-reports.js create-sample     # Create sample CSV template
  node bulk-import-reports.js import <file.csv> # Import reports from CSV

CSV Format:
  Required columns: report_name, onedrive_url
  Optional columns: category_name, frequency, subject, description, upload_date, priority, file_size, tags

Example:
  node bulk-import-reports.js create-sample
  # Edit the sample-import.csv file with your data
  node bulk-import-reports.js import sample-import.csv
`);
    process.exit(1);
  }
}

module.exports = { bulkImportReports, createSampleCSV }; 