# Production Reports Setup Guide

## ✅ System Status
The production reports system is now fully functional for manual upload and viewing of OneDrive hosted Excel files!

## 🎯 Key Features Implemented

### 1. **Manual Upload System**
- Full admin interface for manually uploading reports
- OneDrive URL validation and support for multiple formats
- Automatic version management for reports with the same name
- Support for categories, frequencies, and priorities

### 2. **Category & Frequency Management**
- **Categories**: VIPs, Daily Reports, Weekly Reports, Monthly Reports, Quarterly Reports, Annual Reports, Custom Reports, Home Office Reports
- **Frequencies**: Daily, Weekly, Monthly, Quarterly, Annual, Ad-hoc
- Easy filtering by both category and frequency

### 3. **OneDrive Integration**
- Support for SharePoint, OneDrive, and Office.com URLs
- Embedded Excel viewer for compatible links
- Download and external viewing options
- Proper URL validation and error handling

### 4. **Version History**
- Automatic version tracking when reports with same name are uploaded
- Version comparison and download capabilities
- Notes and metadata for each version

### 5. **User Management**
- Proper user authentication integration
- Fallback handling for development environments
- Access logging for compliance

## 🚀 How to Use

### For Admins: Manual Upload Process

1. **Access Admin Mode**
   - Navigate to Production Reports section
   - Click "Admin Mode" button (admin permissions required)

2. **Upload a New Report**
   - Click "Add Report" button
   - Fill in the form:
     - **Report Name**: Descriptive name for the report
     - **Category**: Choose appropriate category (VIPs, Weekly, etc.)
     - **Frequency**: Select how often this report is generated
     - **OneDrive URL**: Paste the SharePoint/OneDrive link
     - **Email Subject**: Original email subject (if applicable)
     - **Description**: Brief description of the report content
     - **Priority**: 0-10 (higher numbers appear first)
   - Click "Create" to save

3. **Version Management**
   - When uploading a report with the same name in the same category
   - System automatically creates a new version
   - Previous versions remain accessible through version history

### For Users: Viewing Reports

1. **Browse Reports**
   - Use category filters to find specific types of reports
   - Search by name or description
   - Switch between grid and list views

2. **View Excel Files**
   - Click on any OneDrive report to open the viewer
   - View embedded Excel preview (when supported)
   - Download latest version or access version history
   - Open directly in OneDrive for editing

3. **Access Version History**
   - Click "History" button on any report with multiple versions
   - Download specific versions
   - View version notes and upload dates

## 🔧 Technical Implementation

### Database Schema
- `file_categories`: Report categories with icons, colors, and sorting
- `onedrive_reports`: Main reports table with frequency tracking
- `report_versions`: Version history for each report
- `report_access_logs`: Optional access tracking

### API Endpoints
- `GET /api/production-reports/categories` - List categories
- `GET /api/production-reports/reports` - List reports with filtering
- `POST /api/production-reports/reports` - Create/upload new report
- `PUT /api/production-reports/reports/:id` - Update existing report
- `GET /api/production-reports/reports/:id` - Get report details with versions

### Security Features
- User authentication required for all operations
- Admin permissions required for uploads and management
- OneDrive URL validation
- Proper foreign key constraints with fallback handling

## 📝 Example Use Cases

### VIP Weekly Reports
1. Admin receives VIP client report via email with OneDrive link
2. Goes to Production Reports → Admin Mode → Add Report
3. Fills in:
   - Name: "VIP Client Analysis"
   - Category: "VIPs" 
   - Frequency: "Weekly"
   - OneDrive URL: [paste SharePoint link]
4. System stores report and makes it available to all users

### Monthly Report Updates
1. Same monthly report uploaded multiple times
2. System automatically detects same name + category
3. Creates new version instead of duplicate
4. Users can access all historical versions

### Report Discovery
1. Users browse by category (VIPs, Weekly, etc.)
2. Filter by frequency to see only monthly reports
3. Search for specific client or topic
4. Click to view embedded Excel or download

## 🛠️ Maintenance & Testing

### Test the System
```bash
# From backend directory
node scripts/test-upload-simple.js
```

### Verify Database Setup
```bash
# Check if tables exist and are properly configured
node scripts/migrate-production-reports.js
```

### Clear Test Data
```bash
# Clean up any test reports
node scripts/test-manual-upload.js cleanup
```

## 🔍 Troubleshooting

### Common Issues

1. **Foreign Key Constraint Error**
   - ✅ **Fixed**: System now properly handles user ID fallbacks
   - Uses existing user or NULL when no authenticated user

2. **OneDrive Links Not Embedding**
   - Ensure URL is from SharePoint, OneDrive, or Office.com
   - Some corporate restrictions may prevent embedding
   - Download and external view options always available

3. **Categories Not Appearing**
   - Run the test script to create default categories
   - Check admin permissions for category management

### Access Requirements
- **Admin Mode**: Requires admin permissions
- **Viewing Reports**: All authenticated users
- **OneDrive Access**: Users need appropriate Office 365 permissions

## 🎉 Ready for Production

The system is now ready for production use with:
- ✅ Manual upload functionality working
- ✅ OneDrive viewing and downloading
- ✅ Category and frequency management
- ✅ Version history tracking
- ✅ Proper user authentication
- ✅ Admin interface for management
- ✅ Responsive design for all devices

Users can now efficiently manage and access their OneDrive-hosted Excel reports through a centralized, organized interface! 