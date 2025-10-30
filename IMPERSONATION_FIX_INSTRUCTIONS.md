# Impersonation Fix - Instructions

## What Was Fixed

### 1. Backend Middleware (`verifyToken.js`)
- **Problem**: Database queries were timing out when fetching impersonated user data
- **Fix**: 
  - Converted to promise-based queries with `Promise.race()` for better timeout handling
  - Reduced timeout from 5 seconds to 3 seconds
  - Optimized query to only fetch needed columns: `id, lagnname, clname, Role`
  - Added `id` field to `req.user` object (was only setting `userId`)
  - Made the JWT verify callback `async` to support `await`

### 2. Backend Admin Route (`admin.js`)
- **Problem**: `/admin/impersonateUser` endpoint was only returning `userId`, not `id`
- **Fix**: Added `id: user.id` to the `targetUserData` object

### 3. Debug Logging
- Added comprehensive logging in:
  - `backend/routes/commits.js` (GET and POST endpoints)
  - `frontend/src/pages/OneOnOne.js` (saveCommit function)

## How to Test

### Step 1: Restart Backend Server
```bash
# Stop the current backend server (Ctrl+C)
# Then restart it
cd backend
npm start
```

### Step 2: Clear Impersonation State
1. If you're currently impersonating a user, **stop impersonation** first
2. Log out and log back in as admin (or just refresh the page)

### Step 3: Start Fresh Impersonation
1. Log in as admin
2. Use the "Select User" dropdown to impersonate a user (e.g., "KOZEJ SPENCER G" - ID 111)
3. Navigate to the OneOnOne page
4. Switch to "MGA" or "RGA" view (for RGA users)

### Step 4: Set a Commit
1. On the Org Metrics card, click "Set Commit" for Hires, Codes, or VIPs
2. Enter a number (e.g., 17)
3. Click "Save"

### Step 5: Check Console Logs

#### Frontend Console (Browser DevTools)
You should see:
```javascript
[OneOnOne] Saving commit: {
  type: 'hires',
  amount: 17,
  user: {
    id: 111,              // ✅ Should NOT be undefined
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

#### Backend Console (Terminal)
You should see:
```
[commits] POST - User context: {
  userId: 111,
  lagnname: 'KOZEJ SPENCER G',  // ✅ Should be the impersonated user
  clname: 'RGA',                 // ✅ Should be the impersonated user's class
  isImpersonating: true,
  originalAdminId: 92
}
```

**NO MORE** timeout warnings like:
```
[verifyToken] Impersonation query timeout for user 111, using fallback
```

### Step 6: Verify Database
Check the `commits` table:
```sql
SELECT * FROM commits WHERE userId = 111 ORDER BY created_at DESC LIMIT 1;
```

Should show:
- `userId`: 111
- `lagnname`: "KOZEJ SPENCER G"
- `clname`: "RGA"
- `type`: "hires"
- `amount`: 17

## Troubleshooting

### If you still see timeout warnings:
1. Check database connection health
2. Verify the `activeusers` table has an index on `id` column
3. Check if there are any slow queries blocking the database

### If `id` is still undefined in frontend:
1. Make sure you **stopped impersonation** and **started fresh**
2. Check Network tab in DevTools for the `/admin/impersonateUser` response
3. Verify the response includes both `id` and `userId`

### If wrong user data is saved:
1. Check that `window.__IMPERSONATION_STATE__` is set correctly (see frontend console)
2. Verify the `X-Impersonated-User-Id` header is being sent (check Network tab)
3. Look for `_fallbackAuth: true` in backend logs (indicates fallback was used)

## Expected Behavior

✅ **Correct Flow**:
1. Admin impersonates User A (ID 111, "KOZEJ SPENCER G", "RGA")
2. Frontend sets `window.__IMPERSONATION_STATE__`
3. API requests include `X-Impersonated-User-Id: 111` header
4. Backend fetches User A's data from database (no timeout)
5. Commits are saved with User A's credentials
6. Database shows User A as the owner of the commit

❌ **Incorrect Flow (Before Fix)**:
1. Admin impersonates User A
2. Backend query times out
3. Fallback uses admin's credentials from JWT token
4. Commits are saved with wrong user data
5. Database shows wrong user or admin's data

