# Calendly OAuth Setup Guide

## Overview
This guide will help you set up Calendly OAuth integration so users can connect their Calendly accounts with just one click, instead of manually entering API keys.

---

## ✨ **What's Changed?**

### **Before (Manual API Key):**
1. User goes to Calendly website
2. Generates a Personal Access Token
3. Copies the token
4. Pastes it in your app
5. Enters username manually

### **After (OAuth):**
1. User clicks "Connect with Calendly"
2. Authorizes in Calendly's website
3. Automatically linked! ✅

---

## 🔧 **Setup Steps**

### **Step 1: Register Your OAuth App with Calendly**

1. **Go to Calendly Integrations:**
   - Visit [https://calendly.com/integrations/api_webhooks](https://calendly.com/integrations/api_webhooks)
   - Sign in with your Calendly account

2. **Create OAuth Application:**
   - Scroll to the "OAuth Applications" section
   - Click **"Create New Application"**

3. **Fill in Application Details:**
   ```
   Application Name: AriaLife Platform
   Description: Connect your Calendly scheduling to AriaLife
   Homepage URL: https://yourdomain.com (or http://localhost:3000 for dev)
   ```

4. **Set Redirect URI:**
   - **For Development:** `http://localhost:3000/auth/calendly/callback`
   - **For Production:** `https://yourdomain.com/auth/calendly/callback`
   
   ⚠️ **Important:** The redirect URI must match EXACTLY (including http/https, domain, and path)

5. **Save and Get Credentials:**
   - After creating, you'll receive:
     - **Client ID** (looks like: `abc123xyz456`)
     - **Client Secret** (looks like: `secret_abc123xyz456`)
   - ⚠️ **Save the Client Secret immediately** - you can't view it again!

---

### **Step 2: Configure Backend Environment Variables**

1. **Create/Update `.env` file in `backend/` directory:**

```bash
# Calendly OAuth Configuration
CALENDLY_CLIENT_ID=your_client_id_here
CALENDLY_CLIENT_SECRET=your_client_secret_here
CALENDLY_REDIRECT_URI=http://localhost:3000/auth/calendly/callback
```

2. **For Production, update CALENDLY_REDIRECT_URI:**

```bash
CALENDLY_REDIRECT_URI=https://yourdomain.com/auth/calendly/callback
```

---

### **Step 3: Restart Backend Server**

```bash
cd backend
npm restart
```

The server will now load the Calendly OAuth credentials from the environment variables.

---

### **Step 4: Test the Integration**

1. **Navigate to Account Settings:**
   - Go to `Utilities → Account`
   - Scroll to "Calendly Integration" section

2. **Click "Connect with Calendly":**
   - Should redirect to Calendly's authorization page
   - Approve the connection
   - Should redirect back and show success

3. **Verify in Database:**
   ```sql
   SELECT 
     id, 
     lagnname, 
     calendly_username, 
     calendly_link_url, 
     calendly_linked_at
   FROM activeusers
   WHERE calendly_username IS NOT NULL;
   ```

---

## 🔄 **OAuth Flow Diagram**

```
User clicks "Connect with Calendly"
          ↓
Frontend calls /api/account/calendly/oauth/init
          ↓
Backend generates auth URL with state parameter
          ↓
User redirected to Calendly OAuth page
          ↓
User approves connection
          ↓
Calendly redirects to /auth/calendly/callback?code=XXX&state=YYY
          ↓
Frontend sends code & state to /api/account/calendly/oauth/callback
          ↓
Backend exchanges code for access token
          ↓
Backend fetches user info from Calendly API
          ↓
Backend saves to database
          ↓
Success! User redirected to Account Settings
```

---

## 🎯 **API Endpoints**

### **1. Initiate OAuth Flow**
```
GET /api/account/calendly/oauth/init
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "authUrl": "https://auth.calendly.com/oauth/authorize?client_id=..."
}
```

### **2. Handle OAuth Callback**
```
POST /api/account/calendly/oauth/callback
Body: {
  "code": "authorization_code_from_calendly",
  "state": "encoded_state_parameter"
}

Response:
{
  "success": true,
  "message": "Calendly account linked successfully",
  "data": {
    "username": "user@example.com",
    "linkUrl": "https://calendly.com/username",
    "userUri": "https://api.calendly.com/users/XXXXX"
  }
}
```

---

## 🔐 **Security Features**

1. **State Parameter:**
   - Prevents CSRF attacks
   - Encodes user ID and timestamp
   - Expires after 10 minutes

2. **Access Token Storage:**
   - Stored securely in database
   - Used for future API calls to Calendly
   - Can be refreshed if needed

3. **User-Specific:**
   - Each user's OAuth flow is isolated
   - Can't link to another user's account

---

## 🐛 **Troubleshooting**

### **Error: "Calendly OAuth is not configured"**
- **Cause:** Environment variables not set
- **Solution:** Check `.env` file has `CALENDLY_CLIENT_ID` and `CALENDLY_CLIENT_SECRET`

### **Error: "redirect_uri_mismatch"**
- **Cause:** Redirect URI doesn't match what's registered in Calendly
- **Solution:** 
  - Check Calendly OAuth app settings
  - Ensure `CALENDLY_REDIRECT_URI` in `.env` matches exactly
  - Include http/https, domain, and path

### **Error: "OAuth session expired"**
- **Cause:** User took more than 10 minutes to approve
- **Solution:** Try connecting again

### **Error: "Failed to exchange authorization code"**
- **Cause:** Client Secret is incorrect or code is invalid
- **Solution:** 
  - Verify `CALENDLY_CLIENT_SECRET` in `.env`
  - Make sure code hasn't been used already (codes are single-use)

### **User says "I clicked Connect but nothing happened"**
- **Check:**
  1. Browser console for JavaScript errors
  2. Backend logs for API errors
  3. Popup blockers (OAuth opens new window)

---

## 🔄 **Migration from Manual API Keys**

Users who linked accounts with manual API keys will continue to work. They can:
1. Unlink their account
2. Re-link using OAuth for better experience

Or keep using their API key - both methods are supported.

---

## 📝 **Environment Variables Summary**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CALENDLY_CLIENT_ID` | Yes | OAuth Client ID from Calendly | `abc123xyz456` |
| `CALENDLY_CLIENT_SECRET` | Yes | OAuth Client Secret from Calendly | `secret_abc123xyz456` |
| `CALENDLY_REDIRECT_URI` | No | OAuth callback URL (defaults to localhost) | `https://yourdomain.com/auth/calendly/callback` |

---

## 🚀 **Deployment Checklist**

- [ ] Register OAuth app in Calendly with production URL
- [ ] Add `CALENDLY_CLIENT_ID` to production `.env`
- [ ] Add `CALENDLY_CLIENT_SECRET` to production `.env`
- [ ] Set `CALENDLY_REDIRECT_URI` to production callback URL
- [ ] Test OAuth flow in production
- [ ] Verify database is storing tokens correctly
- [ ] Check that unlink functionality works

---

## 📚 **Additional Resources**

- [Calendly OAuth Documentation](https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-oauth)
- [Calendly API Reference](https://developer.calendly.com/api-docs/ZG9jOjI3ODM2Mzg-calendly-developer-welcome)

---

## 🎉 **Success!**

Once configured, users can connect their Calendly accounts with just one click! Much better UX than manual API keys.

If you need help or encounter issues, check the backend logs for detailed error messages.

