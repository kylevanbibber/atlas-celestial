# Pending Commit Feature

## Overview
This feature allows users to commit pending agents by marking them as "committed" (expected to be coded). The system tracks which pending users have been committed, when they were committed, and who committed them.

## Database Setup

### Create the Table
Run the SQL file to create the `pending_commit` table:

```bash
# Execute the SQL file in your MySQL database
mysql -u username -p database_name < atlas/database/create_pending_commit_table.sql
```

Or manually run the SQL:
```sql
CREATE TABLE IF NOT EXISTS pending_commit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activeusers_id INT NOT NULL,
    lagnname VARCHAR(255) NOT NULL,
    committed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    committed_by INT NULL,
    notes TEXT NULL,
    FOREIGN KEY (activeusers_id) REFERENCES activeusers(id) ON DELETE CASCADE,
    FOREIGN KEY (committed_by) REFERENCES activeusers(id) ON DELETE SET NULL,
    INDEX idx_activeusers_id (activeusers_id),
    INDEX idx_committed_at (committed_at),
    UNIQUE KEY unique_commit (activeusers_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Features

### 1. Database Table: `pending_commit`
Stores committed pending users with the following fields:
- `id` - Auto-incrementing primary key
- `activeusers_id` - Foreign key to `activeusers.id`
- `lagnname` - Cached name of the agent
- `committed_at` - Timestamp when committed
- `committed_by` - User ID who performed the commit
- `notes` - Optional notes field for future use
- **Unique constraint** on `activeusers_id` to prevent duplicate commits

### 2. Backend API Endpoints

#### POST `/admin/pending-users/commit`
Commits selected pending users.

**Request Body:**
```json
{
  "userIds": [123, 456, 789]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully committed 3 pending user(s)",
  "committed": 3,
  "totalRequested": 3,
  "updated": 1
}
```

**Features:**
- **Re-commitment allowed**: Users can be committed multiple times
- **Newer commits replace older ones**: Uses `INSERT ... ON DUPLICATE KEY UPDATE`
- When a user is re-committed, the `committed_at` date is updated to NOW()
- The `committed_by` user is also updated to the current committer
- Returns `updated` count to show how many were re-committed vs newly committed
- Automatically tracks who committed the users
- Fetches and caches the `lagnname` for each user

#### GET `/admin/pending-users/commits`
Retrieves all committed pending users.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "activeusers_id": 123,
      "lagnname": "SMITH JOHN",
      "committed_at": "2025-10-16T10:30:00.000Z",
      "committed_by": 456,
      "notes": null,
      "committed_by_name": "DOE JANE"
    }
  ],
  "totalCount": 1
}
```

### 3. Frontend Features

#### Pending Users Filtering
- **60-day limit**: Only shows agents pending 60 days or less
- Agents pending more than 60 days are automatically filtered out
- Console logs show count of filtered users for debugging

#### Mass Selection
- First column has checkboxes for selecting rows
- Header checkbox selects/deselects all visible rows
- Selected rows are tracked in state

#### Commit Button
- **Visibility**: Only appears in action bar when rows are selected
- **Appearance**: Green button with checkmark icon
- **Label**: "Commit (X)" where X is the count of selected rows
- **Confirmation**: Asks for confirmation before committing
- **Feedback**: Shows success/error alerts
- **Auto-refresh**: Refreshes the table after successful commit
- **Auto-clear**: Clears selection after successful commit

#### User Experience
1. User selects one or more pending agents using checkboxes
2. "Commit" button appears in the action bar
3. User clicks "Commit" button
4. Confirmation dialog appears
5. On confirmation, API call is made
6. Success message is displayed
7. Table refreshes to show updated data
8. Selection is cleared

## Usage

### Viewing Pending Users
1. Navigate to VIPs → Pending tab
2. **Automatic filtering**: Only users pending 60 days or less are shown
3. Users pending more than 60 days are hidden automatically
4. Check console for detailed filtering statistics

### Committing Pending Users
1. Navigate to VIPs → Pending tab
2. Select one or more users using the checkboxes (only users ≤60 days pending are visible)
3. Click the green "Commit" button in the action bar
4. Confirm the action
5. Users are marked as committed in the database

### Re-Committing Users
If a pending user was already committed but hasn't coded yet:
1. Select the user again in the Pending tab
2. Click "Commit" button
3. The `committed_at` date will be updated to NOW()
4. The row color will reset based on the new commit date
5. Success message will indicate how many were re-committed

**Use Case**: If an agent was committed 10 days ago (showing red), you can re-commit them to reset the 7-day timer and update their status to orange.

### Row Color System

#### Pending Tab:
- **White (default)**: User is pending but not committed
- **Light Orange (#FFE5CC)**: User was committed 0-7 days ago (acceptable timeframe)
- **Light Red (#FED7D7)**: User was committed more than 7 days ago (overdue - still not coded)

#### Codes Tab:
- **White (default)**: Normal coded agent
- **Light Green (#C6F6D5)**: Agent was committed and then coded within 7 days (success!)

**The color logic tracks the entire lifecycle:**
1. Commit a pending agent → Row turns orange
2. Wait 8 days without coding → Row turns red (warning)
3. Re-commit to reset timer → Row turns orange again
4. Agent codes within 7 days of commit → Shows green in Codes tab

### Viewing Committed Users
You can query the `pending_commit` table to see:
- Which pending users were committed
- When they were committed
- Who committed them

```sql
SELECT 
    pc.*,
    au.lagnname as committed_by_name
FROM pending_commit pc
LEFT JOIN activeusers au ON pc.committed_by = au.id
ORDER BY pc.committed_at DESC;
```

## Future Enhancements

Potential improvements:
- Add a "Committed" tab to view all committed users in the UI
- Add ability to track if committed users eventually get coded
- Add notes/comments when committing
- Export committed users report
- Add bulk uncommit functionality
- Add filtering by commit date range
- Add reporting/analytics on commit-to-coded conversion rate

## Files Modified

### Backend
- `atlas/backend/routes/admin.js` - Added commit and fetch endpoints
- `atlas/database/create_pending_commit_table.sql` - Database schema

### Frontend
- `atlas/frontend/src/components/production/vips/PendingUsers.js` - Added commit functionality and UI
  - Added mass selection column
  - Added commit button to action bar
  - Added commit handler function
  - Added selection state management

## Security
- All endpoints require authentication (verifyToken middleware)
- Commits are tracked with user attribution
- Duplicate commits are prevented with UNIQUE constraint
- Foreign key constraints ensure data integrity

