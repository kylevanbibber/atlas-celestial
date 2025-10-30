# Date Overrides Setup Instructions

## Overview
The Date Overrides feature allows admins to set custom date ranges for specific months in ProductionGoals when they don't align with traditional calendar months.

## Database Setup

1. **Run the SQL migration to create the table:**
   ```sql
   -- Run this in your MySQL database
   -- File: backend/migrations/create_date_overrides_table.sql
   
   CREATE TABLE IF NOT EXISTS date_overrides (
     id INT AUTO_INCREMENT PRIMARY KEY,
     year INT NOT NULL,
     month INT NOT NULL,
     start_date DATE NOT NULL,
     end_date DATE NOT NULL,
     schedule_type ENUM('mon-sun', 'wed-tue') DEFAULT 'mon-sun',
     created_by INT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY unique_year_month (year, month),
     FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE SET NULL,
     INDEX idx_year_month (year, month)
   );
   ```

2. **Add schedule type to existing tables (if needed):**
   ```sql
   -- Run this if you already have a date_overrides table without schedule_type
   -- File: backend/migrations/add_schedule_type_to_date_overrides.sql
   
   ALTER TABLE date_overrides 
   ADD COLUMN schedule_type ENUM('mon-sun', 'wed-tue') DEFAULT 'mon-sun' 
   AFTER end_date;
   ```

3. **Test with example data (optional):**
   ```sql
   INSERT INTO date_overrides (year, month, start_date, end_date, schedule_type, created_by) 
   VALUES (2025, 10, '2025-09-24', '2025-10-31', 'wed-tue', 92);
   ```

## How to Use

### For Admins:
1. **Navigate to Date Overrides:**
   - Go to `/utilities?section=date-overrides`
   - Or use the "Date Overrides" option in the Utilities sidebar (Admin only)

2. **Add a Date Override:**
   - Click "Add Date Override"
   - Select the year and month
   - Set the start and end dates
   - Choose schedule type:
     - **Monday-Sunday**: Traditional week layout (Mon-Sun)
     - **Wednesday-Tuesday**: Alternative week layout (Wed-Tue)
   - Save

3. **Edit/Delete Overrides:**
   - Use the action buttons in the table
   - Mass delete is available for selected rows

### For Users:
- When viewing ProductionGoals, the system automatically:
  - Checks for date overrides for the selected month/year
  - Uses override dates if found, otherwise uses default month boundaries
  - Updates working days generation
  - Adjusts calendar display
  - Modifies activity data loading

## API Endpoints

- `GET /api/date-overrides` - Get all date overrides
- `GET /api/date-overrides/:year/:month` - Get specific override
- `POST /api/date-overrides` - Create new override
- `PUT /api/date-overrides/:id` - Update override
- `DELETE /api/date-overrides/:id` - Delete override

## Features Implemented

✅ **Database Table**: `date_overrides` with proper indexes and foreign keys
✅ **Backend API**: Full CRUD operations with validation
✅ **Admin Interface**: Complete UI for managing date overrides
✅ **ProductionGoals Integration**: Automatic date override detection and usage
✅ **Calendar Logic**: Updated to handle custom date ranges
✅ **Working Days**: Generated based on override dates when available
✅ **Activity Loading**: Uses override date ranges for data fetching
✅ **Admin Navigation**: Added to Utilities page for admin users only

## Example Use Case

**October 2025 Override Example:**
- Traditional: October 1, 2025 - October 31, 2025 (Mon-Sun layout)
- Override: September 24, 2025 - October 31, 2025 (Wed-Tue layout)

When users view October 2025 in ProductionGoals:
- Calendar will show September 24-31 as part of October
- Calendar layout will use Wednesday-Tuesday week structure
- Working days will be calculated from Sept 24 - Oct 31
- Activity data will load for the full override range
- Goal calculations will use the extended date range

## Schedule Types

**Monday-Sunday (mon-sun):**
- Traditional week layout: Mon | Tue | Wed | Thu | Fri | Sat | Sun
- Business week typically runs Monday through Friday
- Weekend is Saturday and Sunday

**Wednesday-Tuesday (wed-tue):**
- Alternative week layout: Wed | Thu | Fri | Sat | Sun | Mon | Tue
- Business week might run Wednesday through Tuesday
- Different weekend structure to accommodate business cycles
- Useful for companies with non-traditional business periods

## Console Debugging

The system includes extensive console logging prefixed with `📅` to help debug date override functionality:
- `[loadDateOverride]` - Date override loading
- `[generateWorkingDays]` - Working days generation
- `[loadActivity]` - Activity data loading
- `[CalendarView]` - Calendar rendering

## Permissions

- Only users with `Role === 'Admin'` and `teamRole === 'app'` can access Date Overrides
- All users benefit from date overrides when viewing ProductionGoals
- Date overrides are applied transparently without user intervention
