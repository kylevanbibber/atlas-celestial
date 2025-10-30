# Production Tracker Feature

## Overview
The Production Tracker is a simplified version of Daily Activity Form designed specifically for users with `teamRole = 'app'` or `Role = 'Admin'`. It provides a streamlined interface to track production metrics across different time periods.

## Access Control
- **Admins** (`Role = 'Admin'`): Full access
- **App Team** (`teamRole = 'app'`): Full access
- **All other users**: No access

## Features

### Day View
- **Daily breakdown for a week**: Supports both Mon-Sun and Wed-Tue week schedules
- **Columns**:
  - `Day` - Day of week abbreviation (Mo, Tu, etc.)
  - `Date` - Date (m/d format)
  - `Send` - Number of applications sent
  - `Gross` - Gross production amount ($)
  - `Net` - Net production amount ($)
- **Features**:
  - Week navigation (< [Dropdown] >)
  - Schedule type toggle (Mon-Sun / Wed-Tue)
  - Daily row editing
  - Today's date highlighting
  - Total row at top

### Week View
- **Weekly aggregated rows**: Shows last 52 weeks
- **Columns**:
  - `Week` - Week date range (e.g., "1/5 - 1/11, 2025")
  - `Gross` - Gross production amount ($)
  - `Net` - Net production amount ($)
- **Features**:
  - No navigation (all 52 weeks shown at once)
  - Weekly row editing
  - Total row at top
  - Data sorted newest to oldest

### Month View
- **Monthly aggregated rows**: Shows last 24 months
- **Columns**:
  - `Month` - Month (MM/YYYY format, e.g., "01/2025") - Read-only
  - `Net` - Net production amount - **Editable** - Displays as currency ($1,234,567.89)
  - `Gross` - Gross production amount - **Editable** - Displays as currency ($1,234,567.89)
- **Features**:
  - No navigation (all 24 months shown at once)
  - **Full editing support**: Click any Net or Gross cell to edit
  - **Currency formatting**: Values display as formatted currency with commas and 2 decimals
  - **Auto-save disabled**: Changes staged locally until Submit is clicked
  - Submit/Cancel buttons appear when edits are made
  - Total row at top
  - Data sorted newest to oldest (most recent month first)
  - **Upsert functionality**: Can create new months or update existing ones

## Files Created/Modified

### New Files
1. **`atlas/frontend/src/components/production/activity/ProductionTracker.js`**
   - Main component for Production Tracker
   - Similar structure to DailyActivityForm but simplified
   - Handles data fetching, editing, and submission
   - Month view integrated with `sga_alp` table

2. **`atlas/database/add_sga_alp_unique_month.sql`**
   - SQL migration to add UNIQUE constraint on `sga_alp.month` column
   - Required for INSERT ... ON DUPLICATE KEY UPDATE functionality

### Modified Files
1. **`atlas/frontend/src/pages/Production.js`**
   - Added ProductionTracker import
   - Added `FiTrendingUp` icon from react-icons
   - Added `hasProductionTrackerAccess` permission check
   - Added 'production-tracker' to available sections
   - Added Production Tracker to sidebar navigation
   - Added case for 'production-tracker' in render switch
   - Set Production Tracker as default for app/admin users (instead of Daily Activity)

2. **`atlas/backend/routes/alp.js`**
   - Added `GET /api/alp/sga-monthly` endpoint to fetch monthly data
   - Added `POST /api/alp/sga-monthly` endpoint to update monthly data
   - Imported `query` function from db for async database operations

3. **`atlas/frontend/src/components/utils/DataTable.js`** (previously fixed)
   - Fixed archive filter bug that was preventing rows from displaying

## UI/UX

### Navigation
- Located in the **Production** sidebar
- Icon: 📈 (FiTrendingUp)
- Label: "Production Tracker"
- Position: After "Leaderboard", before "Release" (if visible) or "Scorecard"

### Controls
- **Period tabs**: Day | Week | Month
- **Date navigation**: < [Dropdown] > (Day view only)
- **Schedule toggle**: Mon-Sun / Wed-Tue (Day view only)
- **Submit/Cancel**: Appears when edits are made
- **Export**: Download CSV of current data

### Styling
- Reuses `DailyActivityForm.css` for consistent styling
- Inherits all DataTable styling (sticky headers, hover effects, etc.)
- Currency formatting for Gross and Net columns

## Backend Implementation

### Month View (Implemented ✅)

The Month view uses the existing `sga_alp` table in the database.

**Table Structure:**
```sql
CREATE TABLE sga_alp (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(10) NOT NULL,  -- Format: MM/YYYY (e.g., "01/2025")
    net DECIMAL(10, 2),
    gross DECIMAL(10, 2),
    rowcolor VARCHAR(50),
    UNIQUE KEY unique_month (month)
);
```

**Endpoints Implemented:**

#### GET `/api/alp/sga-monthly` ✅
Fetches all monthly production data from the `sga_alp` table.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "month": "01/2025",
      "net": 2854240.00,
      "gross": 0.00,
      "rowcolor": null
    },
    ...
  ]
}
```

#### POST `/api/alp/sga-monthly` ✅
Updates monthly production data in the `sga_alp` table.

**Request Body:**
```json
{
  "updates": {
    "01/2025": {
      "gross": 3000000,
      "net": 2400000
    },
    "02/2025": {
      "gross": 2500000,
      "net": 2000000
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully updated 2 month(s)",
  "successCount": 2,
  "errorCount": 0
}
```

**Features:**
- Uses `INSERT ... ON DUPLICATE KEY UPDATE` for upsert functionality
- Automatically creates new months or updates existing ones
- Handles NULL values gracefully

---

## Backend Requirements (Day & Week Views - TODO)

#### 1. GET `/production-tracker/data`
**Purpose**: Fetch production data based on view type and period

**Query Parameters**:
- `view` - "day", "week", or "month"
- `startDate` (YYYY-MM-DD or YYYY-MM) - Used for day view
- `endDate` (YYYY-MM-DD or YYYY-MM) - Used for day view
- For week/month views, backend returns last 52 weeks or 24 months automatically

**Response for Day View**:
```json
{
  "success": true,
  "data": [
    {
      "reportDate": "2025-01-15",
      "send": 10,
      "gross": 15000,
      "net": 12000
    },
    ...
  ]
}
```

**Response for Week View**:
```json
{
  "success": true,
  "data": [
    {
      "reportDate": "2025-01-06",
      "gross": 105000,
      "net": 84000
    },
    ...
  ]
}
```
*Note: `reportDate` for weeks is the Monday of that week (YYYY-MM-DD)*

**Response for Month View**:
```json
{
  "success": true,
  "data": [
    {
      "reportDate": "2025-01",
      "gross": 420000,
      "net": 336000
    },
    ...
  ]
}
```
*Note: `reportDate` for months is in YYYY-MM format*

#### 2. POST `/production-tracker/update`
**Purpose**: Update production data

**Request Body**:
```json
{
  "updates": {
    "2025-01-15": {
      "reportDate": "2025-01-15",
      "send": 12,
      "gross": 16000,
      "net": 13000
    },
    ...
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Production data updated successfully"
}
```

### Database Table Suggestion

```sql
CREATE TABLE IF NOT EXISTS production_tracker (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    reportDate DATE NOT NULL,
    send INT DEFAULT 0,
    gross DECIMAL(10, 2) DEFAULT 0,
    net DECIMAL(10, 2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES activeusers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (userId, reportDate),
    INDEX idx_reportDate (reportDate),
    INDEX idx_userId (userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## LocalStorage

### Keys Used
- `productionTrackerScheduleType`: Stores user's preferred schedule type ('mon-sun' or 'wed-tue')

## Future Enhancements

1. **Weekly Totals** for Month/YTD views
   - Similar to DailyActivityForm's weekly total rows
   - Would require toggle button in ActionBar

2. **Additional Metrics**
   - Could expand to include more production metrics as needed
   - Close ratio calculations
   - Average per send

3. **Team/Hierarchy View**
   - Add ability to view team production data (similar to MGADataTable in DailyActivityForm)
   - Could add hierarchy breakdown for admins

4. **Export Enhancements**
   - Add Excel export (in addition to CSV)
   - Include charts/visualizations in export

5. **Data Visualization**
   - Add charts/graphs for trend analysis
   - Week-over-week comparisons
   - Monthly/quarterly summaries

## Testing Checklist

### Access Control
- [ ] Admin users can access Production Tracker
- [ ] App team users can access Production Tracker
- [ ] Regular users cannot access Production Tracker
- [ ] App/Admin users see Production Tracker in sidebar
- [ ] Regular users do not see Production Tracker in sidebar

### Day View
- [ ] Mon-Sun schedule displays correctly (7 days starting Monday)
- [ ] Wed-Tue schedule displays correctly (7 days starting Wednesday)
- [ ] Schedule toggle persists in localStorage
- [ ] Today's date is highlighted
- [ ] Week navigation works (< and > buttons)
- [ ] Dropdown shows correct week options
- [ ] Data fetches correctly for selected week
- [ ] Send, Gross, Net columns display
- [ ] Edits are staged locally before submission
- [ ] Submit button appears when edits exist
- [ ] Cancel button clears edits
- [ ] Totals row calculates Send, Gross, Net correctly

### Week View
- [ ] Shows last 52 weeks in descending order
- [ ] Week ranges display correctly (e.g., "1/5 - 1/11, 2025")
- [ ] No navigation controls shown (displays "Last 52 Weeks")
- [ ] Gross and Net columns display
- [ ] Schedule toggle is hidden
- [ ] Edits are staged locally before submission
- [ ] Totals row calculates Gross and Net correctly
- [ ] Export works with Week, Gross, Net columns

### Month View
- [ ] Shows last 24 months in descending order
- [ ] Months display in MM/YYYY format (e.g., "01/2025")
- [ ] No navigation controls shown (displays "Last 24 Months")
- [ ] Gross and Net columns display
- [ ] Schedule toggle is hidden
- [ ] Edits are staged locally before submission
- [ ] Totals row calculates Gross and Net correctly
- [ ] Export works with Month, Gross, Net columns

### Navigation
- [ ] Date navigation works forward/backward
- [ ] Dropdown shows correct options
- [ ] URL updates with section parameter
- [ ] Refresh preserves selected period

### Data Operations
- [ ] Cell editing works for all numeric fields
- [ ] Data saves to backend correctly
- [ ] Data refreshes after save
- [ ] Error handling displays appropriately

## Setup Instructions

### 1. Run Database Migration
Execute the SQL migration to add UNIQUE constraint to `sga_alp.month`:
```bash
mysql -u your_user -p your_database < atlas/database/add_sga_alp_unique_month.sql
```

### 2. Restart Backend Server
The new routes in `alp.js` need the backend server to restart:
```bash
# In the atlas directory
npm restart
# or
node server.js
```

### 3. Access Production Tracker
- Log in as an Admin or App Team user
- Navigate to Production → Production Tracker
- Month view is fully functional with data from `sga_alp` table

## Testing Month View Editing

### How to Edit Month Data:

1. **Open Production Tracker**
   - Navigate to Production → Production Tracker
   - Click the "Month" tab

2. **View Current Data**
   - Table shows last 24 months from `sga_alp` table
   - Existing Gross and Net values are displayed
   - Empty cells show blank (can be filled in)

3. **Edit Values**
   - Click any Net or Gross cell to edit
   - Cell switches to input mode (currency formatting removed during editing)
   - Type the new value (numbers only, e.g., `3000000` for $3M)
   - Press Enter or click another cell to save locally
   - Cell displays with currency formatting again (e.g., $3,000,000.00)
   - Edited cells will be highlighted (by DataTable)

4. **Submit Changes**
   - Submit (✓) and Cancel (✕) buttons appear when edits exist
   - Click Submit (✓) to save all changes to database
   - Success message shows count of months updated
   - Data refreshes to show saved values

5. **Cancel Changes**
   - Click Cancel (✕) to discard all unsaved edits
   - Table reverts to original values

### Console Logs to Monitor:
```
[Production Tracker] Cell updated: { id: "01/2025", field: "gross", value: 3000000 }
[Production Tracker] Submitting monthly updates to sga_alp
[Production Tracker] Edited rows: { "01/2025": { gross: 3000000 } }
✅ Successfully updated 1 month(s)
```

### Backend Logs to Monitor:
```
📊 [SGA Monthly] POST request received
📊 [SGA Monthly] Updating month 01/2025: { gross: 3000000, net: undefined }
✅ [SGA Monthly] Successfully updated month 01/2025
📊 [SGA Monthly] Update complete: 1 success, 0 errors
```

## Notes

- **Month View**: ✅ Fully implemented with `sga_alp` table
- **Day View**: ⏳ TODO - requires separate endpoint implementation
- **Week View**: ⏳ TODO - requires separate endpoint implementation
- The component inherits all DataTable features (sorting, pagination disabled, sticky headers, etc.)
- Schedule type preference persists across sessions via localStorage
- Month data format is MM/YYYY (e.g., "01/2025") to match existing `sga_alp` table format

### Data Structure Summary
- **Day View**: Daily rows for a single week (7 rows)
  - Key: Individual dates (YYYY-MM-DD)
  - Fields: send, gross, net
- **Week View**: Weekly aggregated rows for last 52 weeks (52 rows)
  - Key: Week start date (YYYY-MM-DD, typically Monday)
  - Fields: gross, net (no send)
- **Month View**: Monthly aggregated rows for last 24 months (24 rows)
  - Key: Month identifier (YYYY-MM)
  - Fields: gross, net (no send)

### Key Differences from DailyActivityForm
1. **Simplified metrics**: Only tracks Send (day view), Gross, and Net
2. **Aggregated views**: Week and Month views show rolled-up data, not daily breakdowns
3. **Fixed periods**: Week view always shows 52 weeks, Month view always shows 24 months
4. **No expandable rows**: No Discord sales integration or expansion
5. **Direct editing**: All fields are directly editable (no calculations)
6. **Simplified UI**: No hierarchy views or team comparisons

