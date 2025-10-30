# Commits Feature - Impersonation Flow Documentation

## Overview
The commits feature properly handles user impersonation for admin users. When an admin impersonates another user, all commits are saved with the **impersonated user's** credentials, not the admin's.

## How It Works

### 1. Frontend Setup (`frontend/src/context/AuthContext.js`)
When an admin starts impersonating a user:
- The `startImpersonation()` function is called with the target user's ID
- The impersonated user's data is fetched from the backend
- The `user` state is updated to the impersonated user's data
- A global `window.__IMPERSONATION_STATE__` object is set:
  ```javascript
  window.__IMPERSONATION_STATE__ = {
    isImpersonating: true,
    impersonatedUserId: targetUserData.userId
  };
  ```

### 2. API Request Interceptor (`frontend/src/api.js`)
Every API request automatically includes impersonation headers:
```javascript
// Lines 68-73
const impersonationData = window.__IMPERSONATION_STATE__;
if (impersonationData && impersonationData.isImpersonating && impersonationData.impersonatedUserId) {
  config.headers['X-Impersonated-User-Id'] = impersonationData.impersonatedUserId;
}
```

### 3. Backend Middleware (`backend/middleware/verifyToken.js`)
The `verifyToken` middleware checks for the impersonation header:
```javascript
// Lines 49-124
const impersonatedUserId = req.headers['x-impersonated-user-id'];

if (impersonatedUserId) {
  // Fetch the impersonated user's data from the database
  const getUserQuery = `SELECT * FROM activeusers WHERE id = ? LIMIT 1`;
  // ... query execution ...
  
  // Set request context with impersonated user's actual data
  req.user = {
    userId: impersonatedUserId,
    lagnname: impersonatedUser.lagnname,
    clname: impersonatedUser.clname,
    Role: impersonatedUser.Role,
    _isImpersonating: true,
    _originalAdminId: decoded.id || decoded.userId
  };
}
```

### 4. Commits Route (`backend/routes/commits.js`)
The commits route uses the `verifyToken` middleware and extracts user data:
```javascript
// Lines 47-49
const userId = req.user?.id || req.user?.userId;
const lagnname = req.user?.lagnname;
const clname = req.user?.clname;
```

When saving a commit:
```javascript
// Line 76-78
INSERT INTO commits (userId, lagnname, clname, time_period, type, start, end, amount)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

## Data Flow Example

### Scenario: Admin impersonating User "John Doe"

1. **Admin starts impersonation**:
   - Admin (ID: 1, lagnname: "Admin User", clname: "Admin")
   - Target User (ID: 7426, lagnname: "John Doe", clname: "MGA")

2. **Frontend state**:
   ```javascript
   user = {
     userId: 7426,
     lagnname: "John Doe",
     clname: "MGA",
     _isImpersonatedView: true,
     _originalAdminId: 1
   }
   
   window.__IMPERSONATION_STATE__ = {
     isImpersonating: true,
     impersonatedUserId: 7426
   }
   ```

3. **API Request** (when saving a commit):
   ```
   POST /api/commits
   Headers:
     Authorization: Bearer <admin_jwt_token>
     X-Impersonated-User-Id: 7426
   Body:
     { time_period: 'month', type: 'hires', amount: 10, ... }
   ```

4. **Backend Processing**:
   - `verifyToken` middleware decodes admin's JWT token
   - Sees `X-Impersonated-User-Id: 7426` header
   - Queries database for user ID 7426
   - Sets `req.user` with John Doe's data:
     ```javascript
     req.user = {
       userId: 7426,
       lagnname: "John Doe",
       clname: "MGA",
       _isImpersonating: true,
       _originalAdminId: 1
     }
     ```

5. **Database Insert**:
   ```sql
   INSERT INTO commits (userId, lagnname, clname, time_period, type, start, end, amount)
   VALUES (7426, 'John Doe', 'MGA', 'month', 'hires', '2025-10-01', '2025-10-31', 10)
   ```

## Debugging

### Frontend Console Logs
When saving a commit, check the browser console for:
```
[OneOnOne] Saving commit: {
  type: 'hires',
  amount: 10,
  user: { id: 7426, userId: 7426, lagnname: 'John Doe', clname: 'MGA' },
  impersonationState: { isImpersonating: true, impersonatedUserId: 7426 }
}
```

### Backend Console Logs
Check the backend logs for:
```
[commits] POST - User context: {
  userId: 7426,
  lagnname: 'John Doe',
  clname: 'MGA',
  isImpersonating: true,
  originalAdminId: 1
}
```

## Security Considerations

1. **Admin Verification**: The backend should verify admin permissions before allowing impersonation (handled in the `/admin/impersonateUser` endpoint)
2. **Audit Trail**: The `_originalAdminId` is tracked in `req.user` for audit purposes
3. **Token Security**: The admin's JWT token is still used for authentication, ensuring only authenticated admins can impersonate

## Testing Checklist

- [ ] Admin can start impersonation
- [ ] Frontend shows impersonated user's data
- [ ] `window.__IMPERSONATION_STATE__` is set correctly
- [ ] API requests include `X-Impersonated-User-Id` header
- [ ] Backend logs show impersonated user's data
- [ ] Commits are saved with impersonated user's ID, lagnname, and clname
- [ ] Admin can stop impersonation and return to their own view
- [ ] Commits saved during impersonation appear for the impersonated user, not the admin

