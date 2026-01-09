# Forgot Password - Quick Start Guide

## 🚀 Setup (One-time)

### Step 1: Run the Database Migration

```bash
cd backend/migrations
node run_password_reset_migration.js
```

This will create the `password_reset_codes` table needed for the forgot password functionality.

### Step 2: Verify Email Configuration

Make sure your `.env` file has these variables (should already be configured):

```env
SMTP_HOST=mail.ariaslife.com
SMTP_PORT=465
SMTP_USER=noreply@ariaslife.com
SMTP_PASS=Ariaslife123!
JWT_SECRET=your-secret-key
```

### Step 3: Restart Your Backend Server

```bash
cd backend
npm start
```

## ✅ That's It!

The forgot password flow is now fully functional.

## 🧪 Quick Test

1. Go to the login page: `http://localhost:3000/login` (or your production URL)
2. Click **"Forgot Password?"**
3. Enter an email address that exists in your system
4. Check that email for a 6-character code
5. Enter the code in the verification step
6. Set a new password
7. Log in with the new password

## 📧 Email Template Preview

Users will receive an email that looks like this:

```
┌─────────────────────────────────────┐
│ Password Reset Request              │
│ You requested to reset your password│
├─────────────────────────────────────┤
│ Hello [User Name],                   │
│                                      │
│ Use the following code to reset     │
│ your password. This code will        │
│ expire in 15 minutes.                │
│                                      │
│ ┌───────────────┐                   │
│ │   ABC123      │                   │
│ └───────────────┘                   │
│                                      │
│ If you didn't request a password    │
│ reset, you can safely ignore this   │
│ email.                               │
└─────────────────────────────────────┘
```

## 🔒 Security Features

✅ Codes expire after 15 minutes  
✅ Codes can only be used once  
✅ Passwords are hashed with bcrypt  
✅ All user sessions invalidated after reset  
✅ Email existence not revealed (security)  

## 🐛 Troubleshooting

**Problem:** Email not sending  
**Solution:** Check SMTP credentials in `.env` and server logs

**Problem:** "Invalid or expired code"  
**Solution:** Code expired (15 min) or already used - request a new one

**Problem:** Can't find user  
**Solution:** Ensure email exists in `activeusers` or `usersinfo` table with `Active='y'`

## 📝 API Endpoints Added

- `POST /auth/send-reset-code-by-email`
- `POST /auth/verify-reset-code`  
- `PUT /auth/update-password`

## 📁 Files Changed

### Created:
- ✨ `backend/migrations/create_password_reset_codes_table.sql`
- ✨ `backend/migrations/run_password_reset_migration.js`

### Modified:
- 📝 `backend/routes/auth.js` (added 3 endpoints + helper)
- 📝 `frontend/src/pages/auth/ForgotPassword.js` (fixed API URLs)
- 📝 `frontend/src/context/AuthContext.js` (added public endpoints)
- 📝 `frontend/src/api.js` (added public endpoints)

---

**Need more details?** See `FORGOT_PASSWORD_IMPLEMENTATION.md` for complete documentation.

