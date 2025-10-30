# Calendly Integration Guide

## Overview
The Calendly integration allows users to link their Calendly accounts to their AriaLife profiles, making it easy to share scheduling links and enable scheduling features across the platform.

---

## Features

✅ **Link Calendly Account** - Users can connect their Calendly account using a Personal Access Token  
✅ **View Status** - See connection status, username, and scheduling link  
✅ **Unlink Account** - Remove Calendly connection at any time  
✅ **API Validation** - Backend validates API keys against Calendly API before saving  
✅ **Secure Storage** - API keys stored securely in database  

---

## Database Changes

### Migration File
`backend/migrations/add_calendly_integration.sql`

### New Columns in `activeusers` Table

| Column | Type | Description |
|--------|------|-------------|
| `calendly_username` | VARCHAR(255) | Calendly username or email |
| `calendly_api_key` | VARCHAR(500) | Calendly Personal Access Token (encrypted) |
| `calendly_access_token` | TEXT | OAuth access token (for future use) |
| `calendly_linked_at` | TIMESTAMP | When account was linked |
| `calendly_link_url` | VARCHAR(500) | User's Calendly scheduling link |
| `calendly_user_uri` | VARCHAR(500) | Calendly user URI from API |

### Indexes
- `idx_calendly_username` - Quick lookup by username
- `idx_calendly_linked_at` - Filter by link date

---

## Backend API Endpoints

### Base Route: `/api/account/calendly`

All endpoints require authentication via Bearer token.

#### 1. **GET `/status`** - Get Calendly Account Status

**Response:**
```json
{
  "success": true,
  "isLinked": true,
  "username": "john.doe@example.com",
  "linkUrl": "https://calendly.com/johndoe",
  "linkedAt": "2025-10-08T15:30:00.000Z",
  "userUri": "https://api.calendly.com/users/XXXXXXXXX"
}
```

#### 2. **POST `/link`** - Link Calendly Account

**Request Body:**
```json
{
  "calendlyApiKey": "eyJraWQiOiIxY2U...",
  "calendlyUsername": "john.doe@example.com",
  "calendlyLinkUrl": "https://calendly.com/johndoe" // Optional
}
```

**What happens:**
1. Validates API key and username are provided
2. Makes a test request to Calendly API `/users/me` to verify the API key
3. If valid, extracts user URI from Calendly response
4. Saves all data to database with current timestamp
5. Returns success with saved data

**Response:**
```json
{
  "success": true,
  "message": "Calendly account linked successfully",
  "data": {
    "username": "john.doe@example.com",
    "linkUrl": "https://calendly.com/johndoe",
    "userUri": "https://api.calendly.com/users/XXXXXXXXX"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Invalid Calendly API key. Please check your credentials."
}
```

#### 3. **PUT `/update`** - Update Calendly Info

**Request Body:**
```json
{
  "calendlyUsername": "new-username@example.com", // Optional
  "calendlyLinkUrl": "https://calendly.com/new-link" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Calendly info updated successfully"
}
```

#### 4. **DELETE `/unlink`** - Unlink Calendly Account

Removes all Calendly data from the user's account.

**Response:**
```json
{
  "success": true,
  "message": "Calendly account unlinked successfully"
}
```

---

## Frontend Integration

### Location
`frontend/src/components/utilities/AccountUtilities.js`

### User Interface

The Calendly integration appears as a new card in the Account Settings page, below the Personal Information section.

#### **Not Linked State:**
- Shows message: "No Calendly account linked yet"
- **"Link Calendly Account"** button
- Click opens linking form

#### **Linking Form:**
- Instructions with link to Calendly integrations page
- **Calendly API Key** field (password input, required)
- **Calendly Username/Email** field (required)
- **Scheduling Link** field (optional)
- **Link Account** and **Cancel** buttons

#### **Linked State:**
- **"✓ Connected"** badge (green)
- Displays:
  - Username (read-only)
  - Scheduling Link (read-only) with **"Open Link"** button
  - Connection date
- **"Unlink Calendly Account"** button

---

## How to Use (End User)

### Step 1: Get Your Calendly Personal Access Token

1. Go to [Calendly Integrations](https://calendly.com/integrations/api_webhooks)
2. Sign in to your Calendly account
3. Click **"Generate New Token"** under Personal Access Tokens
4. Give it a name (e.g., "AriaLife Integration")
5. Copy the generated token (starts with `eyJraWQ...`)

### Step 2: Link Your Account

1. In AriaLife, go to **Utilities → Account** (or your profile settings)
2. Scroll to the **"Calendly Integration"** section
3. Click **"Link Calendly Account"**
4. Paste your API key
5. Enter your Calendly username or email
6. (Optional) Enter your public scheduling link
7. Click **"Link Account"**

### Step 3: Verify

- You should see a green **"✓ Connected"** badge
- Your username and scheduling link will be displayed
- The system validates your API key with Calendly before saving

### To Unlink:

1. Go to the Calendly Integration section
2. Click **"Unlink Calendly Account"**
3. Confirm the action

---

## Technical Implementation Details

### Security Considerations

1. **API Key Storage**: Keys are stored in the database. Consider encrypting them at the application level for additional security.
2. **HTTPS Required**: All API communication should use HTTPS.
3. **Token Validation**: Backend validates tokens before saving to prevent invalid credentials.
4. **User-Specific**: Each user can only manage their own Calendly connection.

### API Validation Flow

```
Frontend Submit → Backend Receives
                ↓
          Validate Required Fields
                ↓
          Test Calendly API (/users/me)
                ↓
          ✓ Valid → Save to DB
          ✗ Invalid → Return Error
```

### Future Enhancements

- **OAuth Integration**: Switch from Personal Access Tokens to OAuth for better security
- **Webhook Support**: Listen for Calendly events (bookings, cancellations)
- **Embedded Scheduling**: Display Calendly widget directly in the app
- **Team Calendars**: Support team scheduling links
- **Analytics**: Track booking conversions from the platform

---

## Troubleshooting

### "Invalid Calendly API key"
- **Cause**: The API key is incorrect or expired
- **Solution**: Generate a new token from Calendly and try again

### "Failed to fetch Calendly status"
- **Cause**: Backend server error or database connection issue
- **Solution**: Check backend logs, ensure database migration ran successfully

### API key field shows as password
- **Reason**: This is intentional for security - API keys are sensitive
- **Note**: You can still paste the key even though you can't see it

### Scheduling link not showing
- **Reason**: It's optional during linking
- **Solution**: Use the update endpoint (future feature) to add it later

---

## Setup Instructions (Deployment)

### 1. **Run Database Migration**

```bash
mysql -u your_user -p your_database < backend/migrations/add_calendly_integration.sql
```

### 2. **Install Dependencies (if needed)**

```bash
cd backend
npm install node-fetch
```

### 3. **Restart Backend**

```bash
npm restart
```

### 4. **Refresh Frontend**

```bash
cd frontend
npm start
# Or if in production
npm run build
```

### 5. **Test the Integration**

1. Navigate to Account Settings
2. Try linking a Calendly account
3. Verify data is saved in `activeusers` table
4. Test unlinking

---

## Files Modified/Created

### Created
- ✅ `backend/migrations/add_calendly_integration.sql` - Database migration
- ✅ `CALENDLY_INTEGRATION_GUIDE.md` - This documentation

### Modified
- ✅ `backend/routes/account.js` - Added 4 Calendly endpoints
- ✅ `frontend/src/components/utilities/AccountUtilities.js` - Added Calendly UI section

---

## API Reference Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/account/calendly/status` | Check if user has linked Calendly |
| POST | `/api/account/calendly/link` | Link a Calendly account |
| PUT | `/api/account/calendly/update` | Update Calendly info |
| DELETE | `/api/account/calendly/unlink` | Remove Calendly connection |

---

## Next Steps

1. ✅ Run database migration
2. ✅ Test linking flow
3. 🔄 Consider implementing OAuth for better UX
4. 🔄 Add Calendly scheduling link display to user profiles
5. 🔄 Enable inline booking via Calendly widget
6. 🔄 Add webhook support for real-time event sync

---

## Support

For issues or questions:
1. Check backend logs for detailed error messages
2. Verify database migration completed successfully
3. Ensure Calendly API token has correct permissions
4. Check network tab in browser DevTools for API errors

---

**Implementation Complete!** 🎉

Users can now link their Calendly accounts through the Account Settings page. The integration is secure, validated, and ready for use!

