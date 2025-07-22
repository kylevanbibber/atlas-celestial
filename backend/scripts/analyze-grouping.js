const { query } = require('../db');

async function analyzeReportGrouping() {
  try {
    console.log('🔍 Analyzing report grouping issues...\n');
    
    // 1. Check for reports with same name but different categories
    console.log('📊 Reports with duplicate names:\n');
    const duplicateNames = await query(`
      SELECT 
        report_name,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT category_id) as category_ids,
        GROUP_CONCAT(DISTINCT COALESCE(fc.name, 'NULL')) as category_names
      FROM onedrive_reports r
      LEFT JOIN file_categories fc ON r.category_id = fc.id
      GROUP BY report_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.table(duplicateNames);
    
    // 2. Show detailed breakdown of problematic groups
    if (duplicateNames.length > 0) {
      console.log('\n📝 Detailed breakdown:\n');
      
      for (let i = 0; i < Math.min(3, duplicateNames.length); i++) {
        const reportName = duplicateNames[i].report_name;
        console.log(`\n=== Report: "${reportName}" ===`);
        
        const details = await query(`
          SELECT 
            r.id,
            r.subject,
            r.category_id,
            fc.name as category_name,
            r.added_at,
            LEFT(r.onedrive_url, 60) as url_preview
          FROM onedrive_reports r
          LEFT JOIN file_categories fc ON r.category_id = fc.id
          WHERE r.report_name = ?
          ORDER BY r.added_at DESC
        `, [reportName]);
        
        details.forEach((report, index) => {
          console.log(`${index + 1}. ID: ${report.id} | Category: ${report.category_name || 'NULL'} | Subject: "${report.subject}" | Date: ${report.added_at}`);
        });
      }
    }
    
    // 3. Check for NULL categories
    console.log('\n❓ Reports with NULL categories:\n');
    const nullCategories = await query(`
      SELECT COUNT(*) as count
      FROM onedrive_reports 
      WHERE category_id IS NULL
    `);
    
    console.log(`Found ${nullCategories[0].count} reports with NULL category_id`);
    
    if (nullCategories[0].count > 0) {
      const examples = await query(`
        SELECT id, report_name, subject, added_at
        FROM onedrive_reports 
        WHERE category_id IS NULL
        ORDER BY added_at DESC
        LIMIT 5
      `);
      
      console.log('\nExamples:');
      console.table(examples);
    }
    
    // 4. Summary
    console.log('\n📋 SUMMARY:\n');
    console.log('For reports to be grouped as versions, they need:');
    console.log('✓ Exact same report_name');
    console.log('✓ Same category_id (both NOT NULL and equal)');
    console.log('\nCommon issues:');
    console.log('❌ Different category_id values');
    console.log('❌ Some reports have NULL category_id');
    console.log('❌ Slight differences in report_name (extra spaces, punctuation, etc.)');
    
  } catch (error) {
    console.error('❌ Error analyzing reports:', error);
  }
}

async function fixGroupingIssues() {
  try {
    console.log('🔧 Starting automatic grouping fixes...\n');
    
    // 1. Fix NULL categories by assigning them to "Custom Reports"
    const customCategory = await query(`
      SELECT id FROM file_categories WHERE name = 'Custom Reports' LIMIT 1
    `);
    
    if (customCategory.length === 0) {
      console.log('Creating "Custom Reports" category...');
      const result = await query(`
        INSERT INTO file_categories (name, sort_order) VALUES ('Custom Reports', 999)
      `);
      var customCategoryId = result.insertId;
    } else {
      var customCategoryId = customCategory[0].id;
    }
    
    const nullReports = await query(`
      UPDATE onedrive_reports 
      SET category_id = ? 
      WHERE category_id IS NULL
    `, [customCategoryId]);
    
    console.log(`✅ Fixed ${nullReports.affectedRows} reports with NULL category`);
    
    // 2. Find and suggest consolidation for similar report names
    console.log('\n🔗 Looking for similar report names to consolidate...\n');
    
    const reportGroups = await query(`
      SELECT 
        report_name,
        COUNT(*) as count,
        category_id,
        fc.name as category_name
      FROM onedrive_reports r
      LEFT JOIN file_categories fc ON r.category_id = fc.id
      GROUP BY report_name, category_id
      HAVING COUNT(*) = 1
      ORDER BY report_name
    `);
    
    // Group by similar names
    const similarGroups = {};
    reportGroups.forEach(report => {
      const cleanName = report.report_name.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
      
      if (!similarGroups[cleanName]) {
        similarGroups[cleanName] = [];
      }
      similarGroups[cleanName].push(report);
    });
    
    // Show groups with multiple similar names
    let foundSimilar = false;
    Object.keys(similarGroups).forEach(cleanName => {
      if (similarGroups[cleanName].length > 1) {
        if (!foundSimilar) {
          console.log('📝 Similar report names that could be consolidated:');
          foundSimilar = true;
        }
        console.log(`\nGroup: "${cleanName}"`);
        similarGroups[cleanName].forEach(report => {
          console.log(`  - "${report.report_name}" (${report.category_name})`);
        });
      }
    });
    
    if (!foundSimilar) {
      console.log('✅ No obvious similar report names found');
    }
    
    console.log('\n✅ Automatic fixes completed!');
    
  } catch (error) {
    console.error('❌ Error fixing grouping issues:', error);
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'analyze') {
    analyzeReportGrouping().then(() => process.exit(0));
  } else if (command === 'fix') {
    fixGroupingIssues().then(() => process.exit(0));
  } else {
    console.log(`
🔍 Report Grouping Analysis Tool

Usage:
  node analyze-grouping.js analyze    # Analyze current grouping issues
  node analyze-grouping.js fix        # Auto-fix common issues

This tool helps identify and fix issues with report grouping/versioning.

Reports are grouped as versions when they have:
  ✓ Exact same report_name 
  ✓ Same category_id (not NULL)

Common fixes:
  - Assigns NULL categories to "Custom Reports"
  - Identifies similar report names for manual consolidation
`);
    process.exit(1);
  }
} 