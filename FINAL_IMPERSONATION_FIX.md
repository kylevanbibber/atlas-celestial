# Final Impersonation Fix - Complete Solution

## Root Cause
The `verifyToken` middleware was using callback-based `db.query()` with a manual timeout mechanism that was causing race conditions. The query would timeout before completing, causing the middleware to use fallback data from the admin's JWT token instead of the impersonated user's actual data.

## What Was Fixed

### 1. `backend/middleware/verifyToken.js`
**Changed:**
- Imported the promise-based `query` function from `db.js`
- Removed manual timeout and `Promise.race()` approach
- Now uses the built-in connection pooling and timeout handling from `db.js`
- Added better logging to track when queries succeed or fail

**Before:**
```javascript
const db = require('../db');
// ... manual timeout with setTimeout and Promise.race
```

**After:**
```javascript
const { query: dbQuery } = require('../db');
// ... uses dbQuery() which returns a promise with proper connection pooling
```

### 2. `backend/routes/admin.js`
**Changed:**
- Added `id` field to the `targetUserData` response

**Before:**
```javascript
targetUserData: {
  userId: user.id,
  // ... no id field
}
```

**After:**
```javascript
targetUserData: {
  id: user.id,
  userId: user.id,
  // ... rest of data
}
```

### 3. Added Debug Logging
- `backend/routes/commits.js`: Logs user context on GET and POST
- `frontend/src/pages/OneOnOne.js`: Logs commit save attempts with user data
- `backend/middleware/verifyToken.js`: Logs impersonation query attempts and results

## How the Fix Works

### Connection Pooling Benefits
The `db.js` module already has:
- Connection pool with 15 connections
- 60-second timeouts for acquire, connect, and query
- Automatic reconnection on connection loss
- Query performance monitoring (warns on slow queries > 3s)

By using `dbQuery()` instead of raw `db.query()`, we leverage all these benefits.

### Impersonation Flow (Fixed)

1. **Frontend**: Sets `X-Impersonated-User-Id: 111` header
2. **Backend Middleware**:
   ```javascript
   const impersonatedUserId = req.headers['x-impersonated-user-id'];
   if (impersonatedUserId) {
     const userResults = await dbQuery(
       'SELECT id, lagnname, clname, Role FROM activeusers WHERE id = ? AND Active = "y"',
       [impersonatedUserId]
     );
     req.user = {
       userId: impersonatedUserId,
       id: impersonatedUserId,
       lagnname: userResults[0].lagnname,  // ✅ Correct user
       clname: userResults[0].clname,      // ✅ Correct class
       Role: userResults[0].Role,
       _isImpersonating: true,
       _originalAdminId: decoded.id
     };
   }
   ```
3. **Commits Route**: Uses `req.user` data directly
4. **Database**: Saves commit with correct user credentials

## Testing Instructions

### 1. Restart Backend
```bash
# Stop current server (Ctrl+C)
cd backend
npm start
```

### 2. Test Impersonation
1. Log in as admin
2. Stop any current impersonation
3. Refresh the page
4. Start fresh impersonation of "KOZEJ SPENCER G" (ID 111)
5. Navigate to OneOnOne page
6. Switch to "RGA" view
7. Set a commit for Hires (e.g., 17)

### 3. Expected Console Output

#### Backend (Terminal)
```
[verifyToken] Fetching impersonated user data for ID 111
[verifyToken] ✅ Successfully fetched impersonated user: KOZEJ SPENCER G (RGA)
[commits] POST - User context: {
  userId: 111,
  lagnname: 'KOZEJ SPENCER G',  // ✅ Correct!
  clname: 'RGA',                 // ✅ Correct!
  isImpersonating: true,
  originalAdminId: 92,
  fullUser: {
    userId: 111,
    id: 111,
    lagnname: 'KOZEJ SPENCER G',
    clname: 'RGA',
    Role: 'Agent',
    _isImpersonating: true,
    _originalAdminId: 92,
    _originalAdminName: 'VANBIBBER KYLE A'
  }
}
```

**NO MORE:**
- ❌ `[verifyToken] Impersonation query timeout`
- ❌ `_fallbackAuth: true`
- ❌ Wrong lagnname/clname from admin

#### Frontend (Browser Console)
```javascript
[OneOnOne] Saving commit: {
  type: 'hires',
  amount: 17,
  user: {
    id: 111,              // ✅ Not undefined
    userId: 111,
    lagnname: 'KOZEJ SPENCER G',
    clname: 'RGA'
  },
  impersonationState: {
    isImpersonating: true,
    impersonatedUserId: 111
  }
}
```

### 4. Verify Database
```sql
SELECT * FROM commits WHERE userId = 111 ORDER BY created_at DESC LIMIT 1;
```

Expected result:
- `userId`: 111
- `lagnname`: "KOZEJ SPENCER G"
- `clname`: "RGA"
- `type`: "hires"
- `amount`: 17

## Why This Fix Works

### Problem with Old Approach
```javascript
// OLD: Manual timeout with race condition
const queryTimeout = setTimeout(() => {
  // This could fire even if query succeeds
  req.user = { ...decoded }; // Uses admin data
  next();
}, 5000);

db.query(sql, params, (err, results) => {
  clearTimeout(queryTimeout);
  // But what if timeout already fired?
});
```

### Solution with New Approach
```javascript
// NEW: Uses db.js promise-based query with proper pooling
const userResults = await dbQuery(sql, params);
// Connection pool handles timeouts internally
// No race conditions
// Proper error handling
req.user = { ...userResults[0] }; // Uses impersonated user data
next();
```

## Troubleshooting

### If you still see `_fallbackAuth: true`:
1. Check database connection: `SELECT 1` should work
2. Verify user exists: `SELECT * FROM activeusers WHERE id = 111 AND Active = 'y'`
3. Check for slow queries in backend logs
4. Look for `[DB] ⚠️ Slow query` warnings

### If frontend still shows `id: undefined`:
1. Make sure you stopped and restarted impersonation
2. Check Network tab for `/admin/impersonateUser` response
3. Verify response includes both `id` and `userId`

### If wrong data is saved:
1. Check `_fallbackReason` in backend logs
2. Verify `X-Impersonated-User-Id` header is being sent
3. Check `window.__IMPERSONATION_STATE__` in frontend console

## Success Criteria

✅ No timeout warnings in backend logs  
✅ Backend logs show correct impersonated user name and class  
✅ Frontend `user.id` is not undefined  
✅ Commits saved with impersonated user's credentials  
✅ Database shows correct userId, lagnname, and clname  
✅ No `_fallbackAuth: true` in logs  

## Performance Notes

The `db.js` query function includes performance monitoring:
- Warns if connection acquire takes > 1 second
- Warns if query takes > 3 seconds
- Logs pool statistics when slow

This helps identify database performance issues early.

