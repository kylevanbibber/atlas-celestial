# Forgot Password Flow Implementation

## Overview
This document describes the complete forgot password implementation for the Atlas application.

## What Was Implemented

### 1. Database Migration
**File:** `backend/migrations/create_password_reset_codes_table.sql`

Creates a `password_reset_codes` table with the following structure:
- `id` - Primary key
- `userId` - Foreign key to activeusers table
- `reset_code` - 6-character alphanumeric code
- `created_at` - Timestamp when code was created
- `expires_at` - Timestamp when code expires (15 minutes)
- `used` - Boolean flag to prevent code reuse

**Migration Runner:** `backend/migrations/run_password_reset_migration.js`

To run the migration:
```bash
cd backend/migrations
node run_password_reset_migration.js
```

### 2. Backend API Endpoints
**File:** `backend/routes/auth.js`

#### POST `/auth/send-reset-code-by-email`
- Accepts: `{ email: string }`
- Finds user by email (checks both `activeusers` and `usersinfo` tables)
- Generates a 6-character random code (uppercase letters and numbers)
- Stores code in database with 15-minute expiration
- Sends formatted email with the reset code
- Returns: `{ success: boolean, message: string, userId: number }`

#### POST `/auth/verify-reset-code`
- Accepts: `{ userId: number, code: string }`
- Verifies the code is valid and not expired
- Returns: `{ success: boolean, message: string }`

#### PUT `/auth/update-password`
- Accepts: `{ userId: number, emailCode: string, newPassword: string }`
- Verifies the reset code again
- Hashes the new password using bcrypt
- Updates user's password in the database
- Marks the reset code as used
- Invalidates all existing user tokens (forces re-login)
- Returns: `{ success: boolean, message: string }`

### 3. Frontend Updates
**File:** `frontend/src/pages/auth/ForgotPassword.js`

Updated to use the configured API instance from `api.js` instead of hardcoded URLs:
- Now correctly uses environment-based API URLs (production vs development)
- Proper error handling with server response messages
- Three-step flow:
  1. Enter email → Send reset code
  2. Enter code → Verify code
  3. Enter new password → Reset password

**File:** `frontend/src/pages/auth/Login.js`

Already has the "Forgot Password?" link that opens the ForgotPassword component.

## How It Works

### User Flow
1. **User clicks "Forgot Password?"** on login page
2. **Enter Email:** User enters their registered email address
3. **Receive Code:** User receives a 6-character code via email (expires in 15 minutes)
4. **Verify Code:** User enters the code to verify ownership
5. **Reset Password:** User enters and confirms their new password
6. **Success:** Password is updated and user can log in with new password

### Security Features
- Codes expire after 15 minutes
- Codes can only be used once (marked as used after password reset)
- Old reset codes are automatically deleted when a new one is requested
- Passwords are hashed with bcrypt before storage
- All existing user sessions are invalidated after password reset
- Generic success message on email submission (doesn't reveal if email exists)
- Codes are case-insensitive for better user experience

### Email Template
The reset code email includes:
- Professional styling matching the app's design
- Clear display of the 6-character code
- Expiration notice (15 minutes)
- Security notice about ignoring unwanted emails
- Sent from: `noreply@ariaslife.com`

## Testing the Flow

### Prerequisites
1. Ensure the database migration has been run
2. Ensure email configuration is correct in the environment variables
3. Ensure the backend server is running

### Test Steps

#### Test 1: Successful Password Reset
1. Navigate to the login page
2. Click "Forgot Password?"
3. Enter a valid email address registered in the system
4. Check email for the 6-character code
5. Enter the code in the app
6. Enter and confirm a new password
7. Verify you can log in with the new password

#### Test 2: Invalid Email
1. Enter an email not in the system
2. Should receive generic success message (security feature)
3. No email should be sent

#### Test 3: Expired Code
1. Request a reset code
2. Wait 16+ minutes
3. Try to use the code
4. Should receive "Invalid or expired reset code" error

#### Test 4: Code Reuse
1. Successfully reset password with a code
2. Try to use the same code again
3. Should receive "Invalid or expired reset code" error

#### Test 5: Multiple Code Requests
1. Request a reset code
2. Request another reset code for the same email
3. First code should be deleted
4. Only the second code should work

## Environment Variables
Ensure these are set in your `.env` file:

```env
# Email Configuration (already configured)
SMTP_HOST=mail.ariaslife.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@ariaslife.com
SMTP_PASS=Ariaslife123!

# JWT Secret (for token invalidation)
JWT_SECRET=your-secret-key
```

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/send-reset-code-by-email` | Send reset code to user's email |
| POST | `/auth/verify-reset-code` | Verify the reset code is valid |
| PUT | `/auth/update-password` | Update password with verified code |

## Files Modified/Created

### Created
- `backend/migrations/create_password_reset_codes_table.sql` - Database schema
- `backend/migrations/run_password_reset_migration.js` - Migration runner
- `FORGOT_PASSWORD_IMPLEMENTATION.md` - This documentation

### Modified
- `backend/routes/auth.js` - Added 3 new API endpoints and helper function
- `frontend/src/pages/auth/ForgotPassword.js` - Updated to use correct API configuration
- `frontend/src/context/AuthContext.js` - Added password reset endpoints to public endpoints list
- `frontend/src/api.js` - Added password reset endpoints to public endpoints list

## Troubleshooting

### "Failed to send reset code"
- Check email configuration in `.env`
- Verify SMTP credentials are correct
- Check server logs for email sending errors

### "Invalid or expired reset code"
- Code may have expired (15 minutes)
- Code may have already been used
- Verify code is entered correctly (case-insensitive)

### "User not found"
- Email may not be registered in the system
- Check both `activeusers` and `usersinfo` tables
- User must have `Active = 'y'` status

## Future Enhancements (Optional)
- Add rate limiting to prevent abuse
- Add CAPTCHA to prevent automated attacks
- Send confirmation email after password change
- Add password strength requirements
- Track failed reset attempts
- Admin dashboard to view reset attempts

