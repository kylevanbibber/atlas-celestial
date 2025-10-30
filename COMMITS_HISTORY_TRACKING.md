# Commits History Tracking Feature

## Overview
The commits system now maintains a **complete history** of all commit changes. Instead of updating existing commits, every change creates a new row in the database. This allows tracking when and how commits were modified over time.

## Why History Tracking?

### Benefits:
1. **Audit Trail**: See when commitments were changed and by whom (especially useful with impersonation)
2. **Trend Analysis**: Track how users adjust their commitments throughout the month
3. **Accountability**: Know who set what commitment and when
4. **Data Integrity**: Never lose historical data

### Example Use Cases:
- "Did this user lower their commitment mid-month?"
- "How many times did they change their hires commitment?"
- "What was their original commitment vs. final commitment?"
- "When did the admin change this user's commitment while impersonating?"

## How It Works

### Database Structure

**No Unique Constraint**: The table no longer has a unique constraint on `(userId, time_period, type, start, end)`, allowing multiple rows for the same combination.

**Schema:**
```sql
CREATE TABLE commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  lagnname VARCHAR(255) NOT NULL,
  clname VARCHAR(50),
  time_period ENUM('month', 'week') NOT NULL,
  type ENUM('hires', 'codes', 'vips') NOT NULL,
  start DATE NOT NULL,
  end DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- No unique constraint
  INDEX idx_user_period_type_created (userId, time_period, type, start, end, created_at DESC)
);
```

### Backend Behavior

**Always Insert, Never Update:**
```javascript
// Old approach (UPDATE):
if (existing) {
  UPDATE commits SET amount = ? WHERE id = ?
}

// New approach (INSERT):
INSERT INTO commits (...) VALUES (...)
// Always creates a new row
```

### Frontend Behavior

**Fetch Most Recent:**
```javascript
// 1. Fetch all commits for the period
const list = res.data.data || [];

// 2. Sort by created_at descending (most recent first)
filteredList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

// 3. Get the first (most recent) commit for each type
const hiresCommit = filteredList.find(c => c.type === 'hires');
```

## Example Data Flow

### User Changes Hires Commitment 3 Times

#### Initial Commit (Oct 1):
```sql
id: 1
userId: 111
lagnname: 'KOZEJ SPENCER G'
clname: 'MGA'
type: 'hires'
amount: 10
created_at: '2025-10-01 09:00:00'
```

#### First Change (Oct 10):
```sql
id: 2
userId: 111
lagnname: 'KOZEJ SPENCER G'
clname: 'MGA'
type: 'hires'
amount: 15
created_at: '2025-10-10 14:30:00'
```

#### Second Change (Oct 20):
```sql
id: 3
userId: 111
lagnname: 'KOZEJ SPENCER G'
clname: 'MGA'
type: 'hires'
amount: 20
created_at: '2025-10-20 11:15:00'
```

### What User Sees:
- **Current Commitment**: 20 (most recent)
- **History**: Available in database for reporting

## Database Queries

### Get Current (Most Recent) Commit:
```sql
SELECT * FROM commits
WHERE userId = 111
  AND clname = 'MGA'
  AND time_period = 'month'
  AND type = 'hires'
  AND start = '2025-10-01'
  AND end = '2025-10-31'
ORDER BY created_at DESC
LIMIT 1;
```

### Get Full History for a User/Period:
```sql
SELECT * FROM commits
WHERE userId = 111
  AND time_period = 'month'
  AND start = '2025-10-01'
  AND end = '2025-10-31'
ORDER BY type, created_at DESC;
```

### Get All Changes for Specific Type:
```sql
SELECT 
  id,
  amount,
  created_at,
  TIMESTAMPDIFF(DAY, LAG(created_at) OVER (ORDER BY created_at), created_at) as days_since_last_change
FROM commits
WHERE userId = 111
  AND type = 'hires'
  AND time_period = 'month'
  AND start = '2025-10-01'
  AND end = '2025-10-31'
ORDER BY created_at ASC;
```

### Count How Many Times User Changed Commitment:
```sql
SELECT 
  type,
  COUNT(*) as total_changes,
  MIN(amount) as min_commitment,
  MAX(amount) as max_commitment,
  (SELECT amount FROM commits c2 
   WHERE c2.userId = commits.userId 
     AND c2.type = commits.type 
     AND c2.time_period = commits.time_period
     AND c2.start = commits.start
   ORDER BY created_at DESC LIMIT 1) as current_commitment
FROM commits
WHERE userId = 111
  AND time_period = 'month'
  AND start = '2025-10-01'
  AND end = '2025-10-31'
GROUP BY type;
```

## Migration Steps

### If Table Already Exists:

1. **Run Migration Script:**
```bash
mysql -u your_user -p your_database < backend/migrations/remove_commits_unique_constraint.sql
```

2. **Verify:**
```sql
SHOW INDEX FROM commits;
-- Should NOT show 'unique_user_period_type'
-- Should show 'idx_user_period_type_created'
```

### If Creating Fresh Table:
Just run the updated `create_commits_table.sql` - it already has the correct schema without unique constraint.

## RGA/MGA Separate Commits

This history tracking works seamlessly with the RGA/MGA feature:

### Example: RGA User Changes Both MGA and RGA Commits

**MGA Commits History:**
```sql
-- Oct 1: Initial MGA commit
id: 1, userId: 111, clname: 'MGA', type: 'hires', amount: 15, created_at: '2025-10-01'

-- Oct 15: Changed MGA commit
id: 5, userId: 111, clname: 'MGA', type: 'hires', amount: 18, created_at: '2025-10-15'
```

**RGA Commits History:**
```sql
-- Oct 5: Initial RGA commit
id: 3, userId: 111, clname: 'RGA', type: 'hires', amount: 25, created_at: '2025-10-05'

-- Oct 20: Changed RGA commit
id: 7, userId: 111, clname: 'RGA', type: 'hires', amount: 30, created_at: '2025-10-20'
```

Both histories are maintained independently, distinguished by `clname`.

## Performance Considerations

### Indexes
The table has optimized indexes for common queries:
```sql
INDEX idx_user_period_type_created (userId, time_period, type, start, end, created_at DESC)
```

This index supports:
- Fetching all commits for a user/period
- Sorting by created_at (most recent first)
- Filtering by type

### Query Performance
- **Fetching current commit**: O(log n) with index
- **Fetching history**: O(n) where n = number of historical entries (typically small)

### Storage
- Each commit change adds ~100 bytes
- If a user changes 3 types × 3 times/month = 9 rows/month
- 12 months = 108 rows/year/user
- 1000 users = 108,000 rows/year (~10MB)

Very manageable storage requirements.

## Future Enhancements

### Potential Features:
1. **History View UI**: Show users their commitment change history
2. **Change Notifications**: Alert when commitments are changed
3. **Audit Reports**: Admin view of all commitment changes
4. **Rollback**: Ability to revert to previous commitment
5. **Analytics**: Track patterns in commitment changes

### Example History View:
```
Hires Commitment History (October 2025):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Oct 1  | 10 | Initial commitment
Oct 10 | 15 | Increased (+5)
Oct 20 | 20 | Increased (+5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: 20
```

## Testing Checklist

- [ ] Set initial commit for hires (e.g., 10)
- [ ] Verify database has 1 row
- [ ] Change commit to 15
- [ ] Verify database has 2 rows (both with same userId/type/period)
- [ ] Frontend shows 15 (most recent)
- [ ] Change commit to 20
- [ ] Verify database has 3 rows
- [ ] Frontend still shows 20 (most recent)
- [ ] Query history: `SELECT * FROM commits WHERE userId = X ORDER BY created_at`
- [ ] Verify all 3 rows are returned with correct timestamps

## Console Logs

### Backend (on each save):
```
[commits] Creating new commit entry with values: {
  userId: 111,
  lagnname: 'KOZEJ SPENCER G',
  clname: 'MGA',
  type: 'hires',
  amount: 20
}
[commits] New commit created with ID: 3
```

### Frontend (on fetch):
```javascript
[OneOnOne] Fetched commits: {
  totalCommits: 9,  // All historical entries
  filteredCommits: 3,  // For current clname
  mostRecentCommits: {
    hires: { amount: 20, created_at: '2025-10-20T11:15:00Z' },
    codes: { amount: 10, created_at: '2025-10-15T09:30:00Z' },
    vips: { amount: 5, created_at: '2025-10-10T14:00:00Z' }
  }
}
```

## Summary

✅ **Always Insert**: Every commit change creates a new row  
✅ **History Preserved**: Full audit trail of all changes  
✅ **Most Recent Shown**: Frontend displays the latest commitment  
✅ **No Data Loss**: Historical data is never overwritten  
✅ **Performance Optimized**: Proper indexes for fast queries  
✅ **RGA/MGA Compatible**: Works with separate MGA/RGA commits  

