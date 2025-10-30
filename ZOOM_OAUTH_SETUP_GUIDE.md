# Zoom OAuth Integration Setup Guide

## Overview
This guide explains how to set up Zoom OAuth 2.0 integration for Atlas, allowing users to connect their Zoom accounts securely.

## Prerequisites
- A Zoom account (Pro, Business, or Enterprise)
- Access to Zoom Marketplace
- Admin access to your Atlas backend

---

## Step 1: Create a Zoom OAuth App

### 1.1 Go to Zoom Marketplace
Visit: https://marketplace.zoom.us/

### 1.2 Sign In & Navigate to Apps
1. Click **"Sign In"** (top right)
2. After signing in, click **"Develop"** dropdown → **"Build App"**

### 1.3 Create OAuth App
1. Click **"OAuth"** card
2. Click **"Create"**
3. Fill in the app information:
   - **App Name**: `Atlas` (or your app name)
   - **App Type**: Choose **"User-managed app"**
   - **Would you like to publish this app?**: No (for internal use)
4. Click **"Create"**

---

## Step 2: Configure App Settings

### 2.1 App Credentials
On the **"App Credentials"** page, you'll see:
- **Client ID** - Copy this
- **Client Secret** - Copy this

**⚠️ Keep these secure!** Never commit them to git.

### 2.2 OAuth Redirect URL
1. Scroll down to **"OAuth Redirect URL"**
2. Click **"+ Add"**
3. Add your redirect URLs:

**For Development:**
```
http://localhost:3000/auth/zoom/callback
```

**For Production:**
```
https://your-production-domain.com/auth/zoom/callback
```

4. Click **"Continue"**

### 2.3 Information
Fill in basic app information:
- **Short Description**: "Zoom integration for Atlas"
- **Long Description**: (Optional) More detailed description
- **Developer Contact**: Your email

### 2.4 Scopes

**For User-Managed Apps:**
- `user:read:user` - View user profile information
- `meeting:read:meeting` - Read meeting details and instances

**For Admin-Managed Apps (Full Features):**
- `user:read:user` - View user profile information
- `report:read:user` - Read comprehensive meeting reports and history
- `meeting:read:meeting` - Read meeting details

**Note:** User-Managed apps have limited access to meeting history compared to Admin-Managed apps.

### 2.5 Activation
1. Review your settings
2. Click **"Activate your app"**
3. App status should change to **"Active"**

---

## Step 3: Configure Backend Environment Variables

### 3.1 Create/Update `.env` File
In your `backend` directory, add these variables to your `.env` file:

```env
# Zoom OAuth Configuration
ZOOM_CLIENT_ID=your_client_id_here
ZOOM_CLIENT_SECRET=your_client_secret_here
ZOOM_REDIRECT_URI=http://localhost:3000/auth/zoom/callback
```

**For Production:**
```env
ZOOM_REDIRECT_URI=https://your-production-domain.com/auth/zoom/callback
```

### 3.2 Restart Backend Server
After updating `.env`, restart your backend:

```bash
cd backend
npm start
```

---

## Step 4: Run Database Migration

Run the Zoom integration migration:

```sql
SOURCE backend/migrations/add_zoom_integration.sql;
```

Or manually run it in your MySQL client.

---

## Step 5: Test the Integration

### 5.1 Navigate to Account Settings
1. Start your frontend: `cd frontend && npm start`
2. Log in to Atlas
3. Go to **Utilities** → **Account**
4. Scroll to **"Zoom Integration"** section

### 5.2 Connect Zoom Account
1. Click **"Connect with Zoom"**
2. You'll be redirected to Zoom's authorization page
3. Click **"Authorize"**
4. You'll be redirected back to Atlas
5. You should see: **"✓ Connected"** with your Zoom account info

### 5.3 Test Refresh
Click **"🔄 Refresh Info"** to fetch latest account data from Zoom

### 5.4 Test Unlink
Click **"Unlink Account"** to disconnect Zoom (you can reconnect anytime)

---

## Troubleshooting

### Error: "Zoom OAuth is not configured"
- Check that `ZOOM_CLIENT_ID` and `ZOOM_CLIENT_SECRET` are set in `.env`
- Restart your backend server after updating `.env`

### Error: "redirect_uri_mismatch"
- Ensure the redirect URI in Zoom app settings **exactly matches** `ZOOM_REDIRECT_URI` in `.env`
- Check for trailing slashes (should NOT have one)
- Ensure protocol matches (`http://` vs `https://`)

### Error: "Invalid client_id or client_secret"
- Double-check credentials copied from Zoom Marketplace
- Ensure no extra spaces or characters
- Try regenerating credentials in Zoom Marketplace

### Token Expired Errors
- Zoom access tokens expire after ~1 hour
- The backend automatically refreshes tokens using the refresh token
- If refresh fails, user needs to reconnect

---

## Security Best Practices

1. **Never commit `.env` file to git**
   - Add `.env` to your `.gitignore`

2. **Use environment variables for production**
   - Set them in your hosting platform (Heroku, AWS, etc.)

3. **Rotate credentials periodically**
   - Generate new credentials every 6-12 months

4. **Use HTTPS in production**
   - Never use OAuth over HTTP in production

---

## API Endpoints

### Backend Routes (for reference)
- `GET /api/account/zoom/status` - Get connection status
- `GET /api/account/zoom/oauth/init` - Initiate OAuth flow
- `POST /api/account/zoom/oauth/callback` - Handle OAuth callback
- `POST /api/account/zoom/refresh` - Refresh account info
- `DELETE /api/account/zoom/unlink` - Unlink account

---

## Architecture Notes

### Minimal Storage Approach
We only store:
- `zoom_access_token` - For API calls
- `zoom_refresh_token` - For token refresh
- `zoom_user_id` - Unique identifier
- `zoom_linked_at` - Connection timestamp

User info (name, email) is fetched on-demand from Zoom API, ensuring data is always fresh.

### Token Refresh Flow
1. Access token expires after ~1 hour
2. Backend detects 401 error
3. Automatically uses refresh token to get new access token
4. Updates tokens in database
5. Retries original request

---

## Next Steps

Once Zoom is connected, you can extend functionality:
- **Create Meetings**: Use Zoom API to create instant meetings
- **Scheduled Meetings**: Create scheduled meetings for appointments
- **Meeting History**: Fetch user's past meetings
- **Recording Management**: Access and manage cloud recordings

---

## Support

For Zoom API documentation:
- https://marketplace.zoom.us/docs/api-reference/zoom-api

For Atlas-specific issues:
- Contact your development team

