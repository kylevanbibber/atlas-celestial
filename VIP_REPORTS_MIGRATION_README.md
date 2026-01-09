# VIP Reports Migration - Separate Report Tiles

## Overview
This migration moves the different tabs under "Codes & VIPs" to be separate, independent report tiles in the Reports page. Previously, users had to navigate to "Codes & VIPs" and then select a tab. Now, each section is its own clickable report tile in the main reports grid.

## What Changed

### Before
- Single "Codes & VIPs" navigation item with 5 tabs:
  1. Potential VIPs
  2. Pending
  3. Codes
  4. SAGA Codes
  5. Code Potential

### After
- 5 independent report tiles in the Reports page:
  1. **Potential VIPs Report** - Track agents approaching VIP status
  2. **Pending Users Report** - Monitor agents pending activation
  3. **Codes Report** - Track agent code assignments and processing
  4. **SAGA Codes Report** - Track SA and GA level code assignments
  5. **Code Potential Report** - Identify agents with coding potential

## Files Created

### Frontend Components
1. `frontend/src/components/production/reports/PotentialVIPsReport.js`
2. `frontend/src/components/production/reports/PendingUsersReport.js`
3. `frontend/src/components/production/reports/CodesReport.js`
4. `frontend/src/components/production/reports/SAGACodesReport.js`
5. `frontend/src/components/production/reports/CodePotentialReport.js`

Each wrapper component includes:
- Search functionality
- Filter menu with SA/GA/MGA/RGA options (as applicable)
- Integration with the base Reports component
- Full-screen capability
- Export functionality (inherited from child components)

### Backend Migration
1. `backend/migrations/add_vip_report_tiles.sql` - SQL migration file
2. `backend/migrations/run_add_vip_report_tiles.js` - JavaScript runner for the migration

## Files Modified

### Frontend
1. `frontend/src/components/production/reports/index.js`
   - Added exports for all 5 new report components
   - Updated report registry with new report definitions

2. `frontend/src/components/production/ProductionReports.js`
   - Updated componentMap to include the 5 new report components
   - Enabled dynamic loading of VIP report components

## Database Changes

### Table: `onedrive_reports`
Added 5 new records with the following structure:
- `report_type: 'app'` (indicates in-app component, not OneDrive file)
- `component_name`: Component name for dynamic loading
- `icon_name`: React icon component name
- `category_id`: Links to "Production" category
- `frequency: 'daily'`
- `is_active: TRUE`
- `is_hidden: FALSE`

### Category: "Production"
- Created/updated "Production" category to house these reports
- Icon: FiActivity
- Color: #059669 (green)

## How to Run the Migration

### Option 1: Using the JavaScript Runner (Recommended)
```bash
cd backend
node migrations/run_add_vip_report_tiles.js
```

This will:
- Execute all SQL statements from the migration file
- Show progress for each statement
- Verify the reports were inserted
- Display a summary table of the new reports

### Option 2: Manual SQL Execution
```bash
# Connect to your MySQL database
mysql -u your_username -p your_database

# Run the migration file
source backend/migrations/add_vip_report_tiles.sql
```

## Verification Steps

### 1. Check Database
```sql
SELECT 
    id, 
    report_name, 
    component_name, 
    report_type, 
    is_active 
FROM onedrive_reports 
WHERE component_name IN (
    'PotentialVIPsReport', 
    'PendingUsersReport', 
    'CodesReport', 
    'SAGACodesReport', 
    'CodePotentialReport'
)
ORDER BY sort_order ASC;
```

You should see 5 records returned.

### 2. Check Frontend
1. Navigate to `/resources?active=reports` in your browser
2. Look for the 5 new report tiles in the reports grid
3. Click on each tile to ensure it opens and displays correctly
4. Test search and filter functionality in each report
5. Verify export functionality works

## Features of Each Report

### 1. Potential VIPs Report
- **Icon**: Star (FiStar)
- **Filters**: MGA, GA, SA, VIP Month (1-3), At VIP, Within Reach
- **Metrics**: At VIP count, Within Reach count, Total Potential VIPs
- **Table**: Agent list with production metrics and VIP status
- **Export**: Excel with all filtered data

### 2. Pending Users Report
- **Icon**: Clock (FiClock)
- **Filters**: MGA, GA, SA
- **Purpose**: Track agents awaiting activation
- **Table**: Pending agents with dates and hierarchy info
- **Export**: Excel with pending user data

### 3. Codes Report
- **Icon**: File Text (FiFileText)
- **Filters**: MGA, GA, SA, RGA
- **Metrics**: Daily Average, Weekly Average, Quick Coders
- **Table**: Agent codes with processing time (days to code)
- **Highlighting**: Green highlight for agents coded within 7 days of commitment
- **Export**: Excel with code timing data

### 4. SAGA Codes Report
- **Icon**: Award (FiAward)
- **Filters**: MGA, GA, SA, RGA
- **Purpose**: SA/GA level code tracking
- **Table**: Management-level code assignments
- **Export**: Excel with SAGA code metrics

### 5. Code Potential Report
- **Icon**: Target (FiTarget)
- **Filters**: MGA, GA, SA, RGA
- **Purpose**: Identify agents with coding potential
- **Table**: Analytics and progress tracking
- **Export**: Excel with potential analysis

## Component Architecture

Each report wrapper follows this pattern:

```javascript
import Reports from './Reports';
import [ChildComponent] from '../vips/[ChildComponent]';

const [ReportName] = ({ onBack }) => {
  // State for search and filters
  // Filter menu configuration
  // Search/filter actions component
  
  return (
    <Reports
      reportConfig={config}
      onBack={onBack}
      title="[Title]"
      description="[Description]"
      actions={[searchFilterAction]}
      fullScreenCapable={true}
    >
      <ChildComponent 
        searchQuery={searchQuery}
        filters={filters}
        onFilterOptions={handleFilterOptions}
      />
    </Reports>
  );
};
```

This keeps the original VIP tab components intact and reusable, while wrapping them in the Reports shell for consistency.

## Benefits

1. **Better Discoverability**: Each report is now a top-level tile in the reports grid
2. **Faster Navigation**: Direct access without needing to select a tab
3. **Consistent UI**: All reports use the same Reports wrapper component
4. **URL Support**: Each report can be directly linked via URL
5. **Search Indexing**: Reports can be found via global search
6. **Maintained Functionality**: All original features preserved (search, filters, export, etc.)

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- Remove the report tiles
DELETE FROM onedrive_reports 
WHERE component_name IN (
    'PotentialVIPsReport', 
    'PendingUsersReport', 
    'CodesReport', 
    'SAGACodesReport', 
    'CodePotentialReport'
);
```

The original "Codes & VIPs" section remains functional, so users can still access these features through the original navigation path if the tiles are removed.

## Support

If you encounter any issues:
1. Check browser console for errors
2. Verify database migration ran successfully
3. Ensure all new component files are present
4. Check that ProductionReports.js includes the new components in componentMap
5. Verify the Reports base component is properly exporting search/filter actions

## Next Steps (Optional Enhancements)

1. **Analytics**: Add tracking to see which reports are most accessed
2. **Favorites**: Allow users to favorite/pin reports for quick access
3. **Permissions**: Add role-based visibility if needed
4. **Notifications**: Add alerts when new data is available
5. **Scheduling**: Enable scheduled exports or email delivery
6. **Mobile**: Optimize report viewing for mobile devices

---

**Migration Date**: January 17, 2025  
**Version**: 1.0  
**Author**: AI Assistant  
**Status**: Complete and Ready for Testing

