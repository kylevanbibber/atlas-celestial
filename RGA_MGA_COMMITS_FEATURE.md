# RGA/MGA Separate Commits Feature

## Overview
RGA users can now set **two separate sets of commits**:
1. **MGA Commits**: Set when viewing the "MGA" tab (for their MGA role)
2. **RGA Commits**: Set when viewing the "RGA" tab (for their RGA role)

This allows RGA users (who are also MGAs) to track commitments for both their MGA team and their broader RGA organization separately.

## How It Works

### Database Structure
The `commits` table stores commits with:
- `userId`: The user's ID (same for both MGA and RGA commits)
- `lagnname`: The user's name (same for both)
- `clname`: **'MGA'** or **'RGA'** (distinguishes which role the commit is for)
- `type`: 'hires', 'codes', or 'vips'
- `time_period`: 'month' or 'week'
- `start`, `end`: Date range
- `amount`: The commitment amount

### Frontend Logic (`OneOnOne.js`)

#### Saving Commits
When a user sets a commit, the `clname` is determined by:
```javascript
let commitClname = user?.clname;
if (user?.clname === 'RGA') {
  commitClname = viewScope === 'mga' ? 'MGA' : 'RGA';
} else if (user?.clname === 'MGA') {
  commitClname = 'MGA';
}
```

- **RGA user on MGA tab**: Saves with `clname = 'MGA'`
- **RGA user on RGA tab**: Saves with `clname = 'RGA'`
- **MGA user**: Always saves with `clname = 'MGA'`

#### Fetching Commits
When fetching commits, the frontend filters by the appropriate `clname`:
```javascript
if (user?.clname === 'RGA') {
  const targetClname = viewScope === 'mga' ? 'MGA' : 'RGA';
  filteredList = list.filter(c => c.clname === targetClname);
}
```

This ensures that:
- On the **MGA tab**: Only MGA commits are shown
- On the **RGA tab**: Only RGA commits are shown

### Backend Logic (`commits.js`)

The backend accepts `clname` from the request body:
```javascript
const clname = req.body?.clname || req.user?.clname;
```

This allows the frontend to override the user's actual `clname` based on which tab they're viewing.

## User Experience

### For RGA Users:
1. Navigate to OneOnOne page
2. Switch to "MGA" tab
3. See Org Metrics card with MGA-specific data
4. Set commits for Hires, Codes, VIPs (saved with `clname = 'MGA'`)
5. Switch to "RGA" tab
6. See Org Metrics card with RGA-specific data
7. Set different commits for Hires, Codes, VIPs (saved with `clname = 'RGA'`)
8. Switch back to "MGA" tab → See MGA commits
9. Switch to "RGA" tab → See RGA commits

### For MGA Users:
1. Navigate to OneOnOne page
2. Switch to "Team" view
3. See Org Metrics card
4. Set commits (saved with `clname = 'MGA'`)

## Example Data in Database

### User: KOZEJ SPENCER G (RGA)

#### MGA Commits (set while on MGA tab):
```sql
userId: 111
lagnname: 'KOZEJ SPENCER G'
clname: 'MGA'
type: 'hires'
amount: 15
```

#### RGA Commits (set while on RGA tab):
```sql
userId: 111
lagnname: 'KOZEJ SPENCER G'
clname: 'RGA'
type: 'hires'
amount: 25
```

Both commits exist simultaneously for the same user, distinguished by `clname`.

## Database Queries

### Fetch All Commits for User 111:
```sql
SELECT * FROM commits 
WHERE userId = 111 
  AND time_period = 'month' 
  AND start = '2025-10-01' 
  AND end = '2025-10-31';
```

Returns both MGA and RGA commits.

### Fetch Only MGA Commits:
```sql
SELECT * FROM commits 
WHERE userId = 111 
  AND clname = 'MGA'
  AND time_period = 'month' 
  AND start = '2025-10-01' 
  AND end = '2025-10-31';
```

### Fetch Only RGA Commits:
```sql
SELECT * FROM commits 
WHERE userId = 111 
  AND clname = 'RGA'
  AND time_period = 'month' 
  AND start = '2025-10-01' 
  AND end = '2025-10-31';
```

## Unique Constraint

The table has a unique constraint:
```sql
UNIQUE KEY unique_user_period_type (userId, time_period, type, start, end)
```

**Note**: This constraint does NOT include `clname`, which means a user can have multiple commits for the same type and period if they have different `clname` values (MGA vs RGA).

### Should We Update the Constraint?

**Current behavior**: The constraint prevents duplicate commits, but since it doesn't include `clname`, you can only have one commit per user/period/type combination.

**Recommended change**: Add `clname` to the unique constraint:
```sql
ALTER TABLE commits DROP INDEX unique_user_period_type;
ALTER TABLE commits ADD UNIQUE KEY unique_user_period_type_clname (userId, time_period, type, start, end, clname);
```

This would allow:
- User 111, MGA, hires, October 2025 → amount: 15
- User 111, RGA, hires, October 2025 → amount: 25

Both can exist simultaneously.

## Testing Checklist

### RGA User Testing:
- [ ] Log in as or impersonate an RGA user (e.g., KOZEJ SPENCER G)
- [ ] Navigate to OneOnOne page
- [ ] Switch to "MGA" tab
- [ ] Set commit for Hires (e.g., 15)
- [ ] Verify frontend shows "15 / 15"
- [ ] Switch to "RGA" tab
- [ ] Verify commit field is empty (no value)
- [ ] Set commit for Hires (e.g., 25)
- [ ] Verify frontend shows "25 / 25"
- [ ] Switch back to "MGA" tab
- [ ] Verify it still shows "15 / 15"
- [ ] Check database: Should have 2 rows for hires, one with clname='MGA', one with clname='RGA'

### MGA User Testing:
- [ ] Log in as or impersonate an MGA user
- [ ] Navigate to OneOnOne page
- [ ] Switch to "Team" view
- [ ] Set commit for Codes (e.g., 10)
- [ ] Verify frontend shows "10 / 10"
- [ ] Check database: Should have 1 row with clname='MGA'

## Console Logs

### Frontend (when saving):
```javascript
[OneOnOne] Saving commit: {
  type: 'hires',
  amount: 15,
  viewScope: 'mga',
  user: {
    clname: 'RGA',
    commitClname: 'MGA'  // ✅ Overridden based on tab
  }
}
```

### Backend (when receiving):
```
[commits] POST - User context: {
  userId: '111',
  lagnname: 'KOZEJ SPENCER G',
  clname: 'MGA',  // ✅ From request body
  clnameSource: 'request body',
  userClname: 'RGA'  // Original user clname
}
```

### Frontend (when fetching):
```javascript
[OneOnOne] Fetched commits: {
  viewScope: 'mga',
  userClname: 'RGA',
  totalCommits: 6,  // All commits for this user
  filteredCommits: 3,  // Only MGA commits
  commits: { hires: 15, codes: 10, vips: 5 }
}
```

## Benefits

1. **Separate Tracking**: RGA users can set different goals for their MGA team vs their entire RGA organization
2. **Context-Aware**: Commits automatically switch when changing tabs
3. **No Confusion**: Clear separation between MGA and RGA commitments
4. **Flexible**: System works for MGA-only users and RGA users seamlessly

