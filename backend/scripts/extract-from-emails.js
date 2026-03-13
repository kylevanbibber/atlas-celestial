const fs = require('fs');
const path = require('path');

/**
 * Email extraction script for Production Reports
 * 
 * This script helps extract OneDrive links from email content
 * and creates a CSV file ready for bulk import.
 */

// Regex patterns for finding OneDrive/SharePoint links
const oneDrivePatterns = [
  /https:\/\/[^\/]*sharepoint\.com\/[^\s<>"']+/gi,
  /https:\/\/[^\/]*onedrive\.live\.com\/[^\s<>"']+/gi,
  /https:\/\/1drv\.ms\/[^\s<>"']+/gi,
  /https:\/\/[^\/]*office\.com\/[^\s<>"']+/gi
];

// Patterns for extracting report information from email content
const reportPatterns = {
  // Common subject patterns that indicate report types
  subject: {
    vip: /vip|VIP|priority|high.?value/i,
    weekly: /weekly|week|w\d+/i,
    monthly: /monthly|month|mtd|month.?to.?date/i,
    daily: /daily|day|today|yesterday/i,
    quarterly: /quarterly|quarter|q[1-4]/i,
    annual: /annual|yearly|year.?end/i
  },
  
  // Patterns to extract specific report names
  reportName: [
    /report.?name[:\s]+([^\n\r]+)/i,
    /subject[:\s]+([^\n\r]+)/i,
    /title[:\s]+([^\n\r]+)/i
  ],
  
  // Date patterns
  dates: [
    /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g,
    /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi
  ]
};

function extractOneDriveLinks(text) {
  const links = [];
  
  oneDrivePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(link => {
        // Clean up the link (remove any trailing punctuation)
        const cleanLink = link.replace(/[.,;!?'")\]}>]*$/, '');
        if (!links.includes(cleanLink)) {
          links.push(cleanLink);
        }
      });
    }
  });
  
  return links;
}

function extractReportInfo(emailContent, subject = '') {
  const info = {
    subject: subject.trim(),
    reportName: '',
    frequency: 'ad-hoc',
    category: '',
    date: null,
    links: []
  };
  
  // Extract OneDrive links
  info.links = extractOneDriveLinks(emailContent + ' ' + subject);
  
  // Determine frequency from subject/content
  const combinedText = subject + ' ' + emailContent;
  for (const [freq, pattern] of Object.entries(reportPatterns.subject)) {
    if (pattern.test(combinedText)) {
      info.frequency = freq;
      break;
    }
  }
  
  // Set category based on frequency or content
  if (reportPatterns.subject.vip.test(combinedText)) {
    info.category = 'VIPs';
  } else if (info.frequency === 'weekly') {
    info.category = 'Weekly Reports';
  } else if (info.frequency === 'monthly') {
    info.category = 'Monthly Reports';
  } else if (info.frequency === 'daily') {
    info.category = 'Daily Reports';
  } else if (info.frequency === 'quarterly') {
    info.category = 'Quarterly Reports';
  } else if (info.frequency === 'annual') {
    info.category = 'Annual Reports';
  } else {
    info.category = 'Custom Reports';
  }
  
  // Try to extract a better report name
  for (const pattern of reportPatterns.reportName) {
    const match = combinedText.match(pattern);
    if (match && match[1]) {
      info.reportName = match[1].trim();
      break;
    }
  }
  
  // Fallback to cleaned subject
  if (!info.reportName) {
    info.reportName = subject.replace(/^(re:|fwd?:|fw:)/i, '').trim();
  }
  
  // Extract dates
  for (const pattern of reportPatterns.dates) {
    const matches = combinedText.match(pattern);
    if (matches && matches[0]) {
      try {
        const date = new Date(matches[0]);
        if (!isNaN(date.getTime())) {
          info.date = date.toISOString().slice(0, 10);
          break;
        }
      } catch (e) {
        // Ignore invalid dates
      }
    }
  }
  
  return info;
}

function processEmailFile(filePath) {
  console.log(`📧 Processing email file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Email file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const reports = [];
  
  // Try to split by common email separators
  const emails = content.split(/^From:|^Subject:|^Date:|^To:/gm).filter(section => section.trim());
  
  if (emails.length <= 1) {
    // Single email or different format
    const info = extractReportInfo(content, 'Extracted Report');
    if (info.links.length > 0) {
      info.links.forEach((link, index) => {
        reports.push({
          report_name: info.reportName + (index > 0 ? ` (${index + 1})` : ''),
          category_name: info.category,
          frequency: info.frequency,
          onedrive_url: link,
          subject: info.subject,
          upload_date: info.date || new Date().toISOString().slice(0, 10),
          priority: info.category === 'VIPs' ? 8 : 5
        });
      });
    }
  } else {
    // Multiple emails
    emails.forEach((emailSection, index) => {
      const subjectMatch = emailSection.match(/subject[:\s]+([^\n\r]+)/i);
      const subject = subjectMatch ? subjectMatch[1] : `Email ${index + 1}`;
      
      const info = extractReportInfo(emailSection, subject);
      if (info.links.length > 0) {
        info.links.forEach((link, linkIndex) => {
          reports.push({
            report_name: info.reportName + (linkIndex > 0 ? ` (${linkIndex + 1})` : ''),
            category_name: info.category,
            frequency: info.frequency,
            onedrive_url: link,
            subject: info.subject,
            upload_date: info.date || new Date().toISOString().slice(0, 10),
            priority: info.category === 'VIPs' ? 8 : 5
          });
        });
      }
    });
  }
  
  return reports;
}

function processMultipleEmails(emailsDirectory) {
  console.log(`📂 Processing emails from directory: ${emailsDirectory}`);
  
  if (!fs.existsSync(emailsDirectory)) {
    throw new Error(`Directory not found: ${emailsDirectory}`);
  }
  
  const files = fs.readdirSync(emailsDirectory).filter(file => 
    file.endsWith('.txt') || file.endsWith('.eml') || file.endsWith('.msg')
  );
  
  const allReports = [];
  
  files.forEach(file => {
    try {
      const filePath = path.join(emailsDirectory, file);
      const reports = processEmailFile(filePath);
      allReports.push(...reports);
      console.log(`   📊 Found ${reports.length} reports in ${file}`);
    } catch (error) {
      console.error(`   ❌ Error processing ${file}:`, error.message);
    }
  });
  
  return allReports;
}

function createCSVFromReports(reports, outputPath) {
  const headers = [
    'report_name',
    'category_name', 
    'frequency',
    'onedrive_url',
    'subject',
    'description',
    'upload_date',
    'priority',
    'file_size',
    'tags'
  ];
  
  const csvRows = [headers.join(',')];
  
  reports.forEach(report => {
    const row = [
      `"${(report.report_name || '').replace(/"/g, '""')}"`,
      `"${(report.category_name || '').replace(/"/g, '""')}"`,
      `"${(report.frequency || 'ad-hoc').replace(/"/g, '""')}"`,
      `"${(report.onedrive_url || '').replace(/"/g, '""')}"`,
      `"${(report.subject || '').replace(/"/g, '""')}"`,
      `"${(report.description || '').replace(/"/g, '""')}"`,
      `"${(report.upload_date || '').replace(/"/g, '""')}"`,
      `"${(report.priority || 5).toString().replace(/"/g, '""')}"`,
      `"${(report.file_size || '').replace(/"/g, '""')}"`,
      `"${(report.tags || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  
  fs.writeFileSync(outputPath, csvRows.join('\n'));
  console.log(`📄 CSV created: ${outputPath}`);
  return outputPath;
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  const inputPath = process.argv[3];
  const outputPath = process.argv[4] || 'extracted-reports.csv';
  
  if (command === 'file' && inputPath) {
    try {
      const reports = processEmailFile(inputPath);
      console.log(`📊 Extracted ${reports.length} reports from email file`);
      
      if (reports.length > 0) {
        createCSVFromReports(reports, outputPath);
        console.log('\n✅ Email extraction completed!');
        console.log(`📄 Import the CSV file: node scripts/bulk-import-reports.js import ${outputPath}`);
      } else {
        console.log('⚠️  No OneDrive links found in the email');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  } else if (command === 'directory' && inputPath) {
    try {
      const reports = processMultipleEmails(inputPath);
      console.log(`📊 Extracted ${reports.length} reports from ${reports.length} email files`);
      
      if (reports.length > 0) {
        createCSVFromReports(reports, outputPath);
        console.log('\n✅ Email extraction completed!');
        console.log(`📄 Import the CSV file: node scripts/bulk-import-reports.js import ${outputPath}`);
      } else {
        console.log('⚠️  No OneDrive links found in any emails');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`
📧 Email Extraction Tool for Production Reports

This tool helps extract OneDrive links from emails and creates a CSV file ready for import.

Usage:
  node extract-from-emails.js file <email.txt> [output.csv]      # Process single email file
  node extract-from-emails.js directory <emails-folder> [output.csv]  # Process multiple emails

Supported email formats:
  - Plain text (.txt)
  - Email files (.eml)
  - Outlook message files (.msg)

The tool will:
  1. Find all OneDrive/SharePoint links in the emails
  2. Try to determine report frequency (weekly, monthly, etc.)
  3. Categorize reports based on content
  4. Extract dates and other metadata
  5. Create a CSV file ready for bulk import

Example workflow:
  1. Save your emails as text files
  2. node extract-from-emails.js directory ./my-emails/ reports-to-import.csv
  3. Review and edit the CSV file if needed
  4. node scripts/bulk-import-reports.js import reports-to-import.csv
`);
    process.exit(1);
  }
}

module.exports = {
  extractOneDriveLinks,
  extractReportInfo,
  processEmailFile,
  processMultipleEmails,
  createCSVFromReports
}; 