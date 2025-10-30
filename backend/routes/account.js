// routes/account.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { query } = require("../db");
const fetch = require('node-fetch');

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const results = await query("SELECT * FROM activeusers WHERE id = ? LIMIT 1", [userId]);

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.json(results[0]);
  } catch (error) {
    console.error("[Account Route] Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Error fetching profile." });
  }
})


// ============================================================
// CALENDLY INTEGRATION - OAuth 2.0
// ============================================================

// Calendly OAuth configuration
const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const CALENDLY_REDIRECT_URI = process.env.CALENDLY_REDIRECT_URI || 'http://localhost:3000/auth/calendly/callback';

// Log configuration on startup (without exposing secrets)
console.log('[Calendly OAuth] Configuration loaded:', {
  hasClientId: !!CALENDLY_CLIENT_ID,
  hasClientSecret: !!CALENDLY_CLIENT_SECRET,
  redirectUri: CALENDLY_REDIRECT_URI,
  clientIdLength: CALENDLY_CLIENT_ID?.length,
  clientSecretLength: CALENDLY_CLIENT_SECRET?.length
});

// Get Calendly account status
router.get("/calendly/status", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const results = await query(
      `SELECT 
        calendly_username,
        calendly_link_url,
        calendly_linked_at,
        calendly_user_uri
      FROM activeusers 
      WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const calendlyData = results[0];
    const isLinked = !!calendlyData.calendly_username && !!calendlyData.calendly_linked_at;

    res.json({
      success: true,
      isLinked,
      username: calendlyData.calendly_username,
      linkUrl: calendlyData.calendly_link_url,
      linkedAt: calendlyData.calendly_linked_at,
      userUri: calendlyData.calendly_user_uri
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Calendly status:", error);
    res.status(500).json({ success: false, message: "Error fetching Calendly status." });
  }
});

// Initiate OAuth flow
router.get("/calendly/oauth/init", verifyToken, async (req, res) => {
  try {
    console.log('[Calendly OAuth] Init request received', {
      userId: req.userId,
      hasClientId: !!CALENDLY_CLIENT_ID,
      clientIdPreview: CALENDLY_CLIENT_ID ? `${CALENDLY_CLIENT_ID.substring(0, 8)}...` : 'none'
    });

    if (!CALENDLY_CLIENT_ID) {
      console.error('[Calendly OAuth] CLIENT_ID not configured!');
      return res.status(500).json({
        success: false,
        message: "Calendly OAuth is not configured. Please contact support."
      });
    }

    // Store user ID in session or temporary token to retrieve after callback
    const userId = req.userId;
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

    // Build Calendly OAuth authorization URL
    const authUrl = new URL('https://auth.calendly.com/oauth/authorize');
    authUrl.searchParams.append('client_id', CALENDLY_CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', CALENDLY_REDIRECT_URI);
    authUrl.searchParams.append('state', state);

    console.log('[Calendly OAuth] Generated auth URL:', {
      redirectUri: CALENDLY_REDIRECT_URI,
      stateLength: state.length
    });

    res.json({
      success: true,
      authUrl: authUrl.toString()
    });
  } catch (error) {
    console.error("[Account Route] Error initiating Calendly OAuth:", error);
    res.status(500).json({ success: false, message: "Error initiating OAuth flow.", error: error.message });
  }
});

// OAuth callback handler
router.post("/calendly/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required"
      });
    }

    // Decode state to get user ID
    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
      
      // Check if state is not too old (10 minutes)
      if (Date.now() - stateData.timestamp > 600000) {
        return res.status(400).json({
          success: false,
          message: "OAuth session expired. Please try again."
        });
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid state parameter"
      });
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CALENDLY_CLIENT_ID,
        client_secret: CALENDLY_CLIENT_SECRET,
        code: code,
        redirect_uri: CALENDLY_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Calendly OAuth] Token exchange failed:", errorData);
      return res.status(400).json({
        success: false,
        message: "Failed to exchange authorization code for access token"
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user info from Calendly
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      return res.status(400).json({
        success: false,
        message: "Failed to retrieve user information from Calendly"
      });
    }

    const userData = await userResponse.json();
    const calendlyUser = userData.resource;
    
    const username = calendlyUser.email || calendlyUser.name;
    const userUri = calendlyUser.uri;
    const schedulingUrl = calendlyUser.scheduling_url;

    // Save to database
    await query(
      `UPDATE activeusers 
      SET 
        calendly_username = ?,
        calendly_access_token = ?,
        calendly_link_url = ?,
        calendly_user_uri = ?,
        calendly_linked_at = NOW()
      WHERE id = ?`,
      [username, accessToken, schedulingUrl, userUri, userId]
    );

    res.json({
      success: true,
      message: "Calendly account linked successfully",
      data: {
        username: username,
        linkUrl: schedulingUrl,
        userUri: userUri
      }
    });
  } catch (error) {
    console.error("[Account Route] Error in Calendly OAuth callback:", error);
    res.status(500).json({ success: false, message: "Error completing OAuth flow." });
  }
});

// Link Calendly account (using Personal Access Token) - LEGACY METHOD
router.post("/calendly/link", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { calendlyApiKey, calendlyUsername, calendlyLinkUrl } = req.body;

    // Validation
    if (!calendlyApiKey || !calendlyUsername) {
      return res.status(400).json({ 
        success: false, 
        message: "Calendly API key and username are required" 
      });
    }

    // Optional: Validate the API key by making a test request to Calendly API
    // This helps ensure the API key is valid before saving it
    try {
      const testResponse = await fetch('https://api.calendly.com/users/me', {
        headers: {
          'Authorization': `Bearer ${calendlyApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!testResponse.ok) {
        return res.status(400).json({
          success: false,
          message: "Invalid Calendly API key. Please check your credentials."
        });
      }

      // Get user data from Calendly
      const calendlyUserData = await testResponse.json();
      const userUri = calendlyUserData?.resource?.uri || null;

      // Save to database
      await query(
        `UPDATE activeusers 
        SET 
          calendly_username = ?,
          calendly_api_key = ?,
          calendly_link_url = ?,
          calendly_user_uri = ?,
          calendly_linked_at = NOW()
        WHERE id = ?`,
        [calendlyUsername, calendlyApiKey, calendlyLinkUrl, userUri, userId]
      );

      res.json({
        success: true,
        message: "Calendly account linked successfully",
        data: {
          username: calendlyUsername,
          linkUrl: calendlyLinkUrl,
          userUri: userUri
        }
      });
    } catch (apiError) {
      console.error("[Account Route] Calendly API validation error:", apiError);
      return res.status(400).json({
        success: false,
        message: "Failed to validate Calendly API key. Please ensure it's correct."
      });
    }
  } catch (error) {
    console.error("[Account Route] Error linking Calendly account:", error);
    res.status(500).json({ success: false, message: "Error linking Calendly account." });
  }
});

// Update Calendly account info
router.put("/calendly/update", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { calendlyUsername, calendlyLinkUrl } = req.body;

    // Build dynamic update query based on provided fields
    const updates = [];
    const values = [];

    if (calendlyUsername !== undefined) {
      updates.push('calendly_username = ?');
      values.push(calendlyUsername);
    }

    if (calendlyLinkUrl !== undefined) {
      updates.push('calendly_link_url = ?');
      values.push(calendlyLinkUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update"
      });
    }

    values.push(userId);

    await query(
      `UPDATE activeusers 
      SET ${updates.join(', ')}
      WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: "Calendly info updated successfully"
    });
  } catch (error) {
    console.error("[Account Route] Error updating Calendly info:", error);
    res.status(500).json({ success: false, message: "Error updating Calendly info." });
  }
});

// Refresh Calendly account info from Calendly API
router.post("/calendly/refresh", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Get current access token
    const userResults = await query(
      `SELECT calendly_access_token FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].calendly_access_token) {
      return res.status(400).json({
        success: false,
        message: "No Calendly account linked. Please connect your account first."
      });
    }

    const accessToken = userResults[0].calendly_access_token;

    // Fetch latest user info from Calendly
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      // Token might be expired or invalid
      if (userResponse.status === 401) {
        return res.status(401).json({
          success: false,
          message: "Calendly access token expired. Please reconnect your account.",
          requiresReauth: true
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "Failed to fetch updated information from Calendly"
      });
    }

    const userData = await userResponse.json();
    const calendlyUser = userData.resource;
    
    const username = calendlyUser.email || calendlyUser.name;
    const userUri = calendlyUser.uri;
    const schedulingUrl = calendlyUser.scheduling_url;

    // Update database with latest info
    await query(
      `UPDATE activeusers 
      SET 
        calendly_username = ?,
        calendly_link_url = ?,
        calendly_user_uri = ?
      WHERE id = ?`,
      [username, schedulingUrl, userUri, userId]
    );

    res.json({
      success: true,
      message: "Calendly info refreshed successfully",
      data: {
        username: username,
        linkUrl: schedulingUrl,
        userUri: userUri
      }
    });
  } catch (error) {
    console.error("[Account Route] Error refreshing Calendly info:", error);
    res.status(500).json({ success: false, message: "Error refreshing Calendly info." });
  }
});

// Unlink Calendly account
router.delete("/calendly/unlink", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    await query(
      `UPDATE activeusers 
      SET 
        calendly_username = NULL,
        calendly_api_key = NULL,
        calendly_link_url = NULL,
        calendly_user_uri = NULL,
        calendly_linked_at = NULL,
        calendly_access_token = NULL
      WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: "Calendly account unlinked successfully"
    });
  } catch (error) {
    console.error("[Account Route] Error unlinking Calendly account:", error);
    res.status(500).json({ success: false, message: "Error unlinking Calendly account." });
  }
});

// ============================================================
// ZOOM INTEGRATION - OAuth 2.0
// ============================================================

// Zoom OAuth configuration
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI || 'http://localhost:3000/auth/zoom/callback';

// Log configuration on startup
console.log('[Zoom OAuth] Configuration loaded:', {
  hasClientId: !!ZOOM_CLIENT_ID,
  hasClientSecret: !!ZOOM_CLIENT_SECRET,
  redirectUri: ZOOM_REDIRECT_URI,
  clientIdLength: ZOOM_CLIENT_ID?.length,
  clientSecretLength: ZOOM_CLIENT_SECRET?.length
});

// Get Zoom account status
router.get("/zoom/status", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const results = await query(
      `SELECT 
        zoom_access_token,
        zoom_user_id,
        zoom_linked_at
      FROM activeusers 
      WHERE id = ? 
      LIMIT 1`,
      [userId]
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const zoomData = results[0];
    const isLinked = !!(zoomData.zoom_user_id);

    // If linked, fetch fresh user info from Zoom
    let username = null;
    let email = null;
    let accountId = null;

    if (isLinked && zoomData.zoom_access_token) {
      try {
        const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
          headers: {
            'Authorization': `Bearer ${zoomData.zoom_access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          username = userData.first_name && userData.last_name 
            ? `${userData.first_name} ${userData.last_name}` 
            : userData.email;
          email = userData.email;
          accountId = userData.account_id;
        }
      } catch (err) {
        console.warn('[Zoom] Could not fetch user info for status check:', err.message);
        // Continue without user info if API fails
      }
    }

    res.json({
      success: true,
      isLinked: isLinked,
      username: username,
      email: email,
      userId: zoomData.zoom_user_id,
      accountId: accountId,
      linkedAt: zoomData.zoom_linked_at
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Zoom status:", error);
    res.status(500).json({ success: false, message: "Error fetching Zoom status." });
  }
});

// Initiate Zoom OAuth flow
router.get("/zoom/oauth/init", verifyToken, async (req, res) => {
  try {
    console.log('[Zoom OAuth] Init request received', {
      userId: req.userId,
      hasClientId: !!ZOOM_CLIENT_ID,
      clientIdPreview: ZOOM_CLIENT_ID ? `${ZOOM_CLIENT_ID.substring(0, 8)}...` : 'none'
    });

    if (!ZOOM_CLIENT_ID) {
      console.error('[Zoom OAuth] CLIENT_ID not configured!');
      return res.status(500).json({
        success: false,
        message: "Zoom OAuth is not configured. Please contact support."
      });
    }

    const userId = req.userId;
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

    // Build Zoom OAuth authorization URL
    const authUrl = new URL('https://zoom.us/oauth/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', ZOOM_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', ZOOM_REDIRECT_URI);
    authUrl.searchParams.append('state', state);

    console.log('[Zoom OAuth] Generated auth URL:', {
      redirectUri: ZOOM_REDIRECT_URI,
      stateLength: state.length
    });

    res.json({
      success: true,
      authUrl: authUrl.toString()
    });
  } catch (error) {
    console.error("[Account Route] Error initiating Zoom OAuth:", error);
    res.status(500).json({ success: false, message: "Error initiating OAuth flow.", error: error.message });
  }
});

// Zoom OAuth callback handler
router.post("/zoom/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required"
      });
    }

    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
      
      if (Date.now() - stateData.timestamp > 600000) { // 10 minutes expiry
        return res.status(400).json({
          success: false,
          message: "OAuth session expired. Please try again."
        });
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "Invalid state parameter"
      });
    }

    // Exchange authorization code for access token
    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: ZOOM_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Zoom OAuth] Token exchange failed:", errorData);
      return res.status(400).json({ 
        success: false, 
        message: "Failed to exchange authorization code for access token" 
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Fetch user information from Zoom
    const userResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      return res.status(400).json({ 
        success: false, 
        message: "Failed to retrieve user information from Zoom" 
      });
    }

    const userData = await userResponse.json();
    
    const username = userData.first_name && userData.last_name 
      ? `${userData.first_name} ${userData.last_name}` 
      : userData.email;
    const email = userData.email;
    const zoomUserId = userData.id;
    const zoomAccountId = userData.account_id;

    // Save tokens and user_id to database (not username/email - fetch on-demand)
    await query(
      `UPDATE activeusers 
      SET 
        zoom_access_token = ?,
        zoom_refresh_token = ?,
        zoom_user_id = ?,
        zoom_linked_at = NOW()
      WHERE id = ?`,
      [accessToken, refreshToken, zoomUserId, userId]
    );

    res.json({
      success: true,
      message: "Zoom account linked successfully",
      data: {
        username: username,
        email: email,
        userId: zoomUserId,
        accountId: zoomAccountId
      }
    });
  } catch (error) {
    console.error("[Account Route] Error in Zoom OAuth callback:", error);
    res.status(500).json({ success: false, message: "Error completing OAuth flow." });
  }
});

// Refresh Zoom account info from Zoom API
router.post("/zoom/refresh", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Get current access token
    const userResults = await query(
      `SELECT zoom_access_token, zoom_refresh_token FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].zoom_access_token) {
      return res.status(400).json({
        success: false,
        message: "No Zoom account linked. Please connect your account first."
      });
    }

    const accessToken = userResults[0].zoom_access_token;
    const refreshToken = userResults[0].zoom_refresh_token;

    // Fetch latest user info from Zoom
    let userResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // If token expired, try to refresh it
    if (userResponse.status === 401 && refreshToken) {
      console.log('[Zoom OAuth] Access token expired, attempting refresh...');
      
      const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');
      const refreshResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!refreshResponse.ok) {
        return res.status(401).json({
          success: false,
          message: "Zoom access token expired. Please reconnect your account.",
          requiresReauth: true
        });
      }

      const newTokenData = await refreshResponse.json();
      const newAccessToken = newTokenData.access_token;
      const newRefreshToken = newTokenData.refresh_token;

      // Update tokens in database
      await query(
        `UPDATE activeusers 
        SET zoom_access_token = ?, zoom_refresh_token = ?
        WHERE id = ?`,
        [newAccessToken, newRefreshToken, userId]
      );

      // Retry fetching user info with new token
      userResponse = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${newAccessToken}`,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!userResponse.ok) {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch updated information from Zoom"
      });
    }

    const userData = await userResponse.json();
    
    const username = userData.first_name && userData.last_name 
      ? `${userData.first_name} ${userData.last_name}` 
      : userData.email;
    const email = userData.email;
    const zoomUserId = userData.id;
    const zoomAccountId = userData.account_id;

    // No need to update database - we're fetching fresh data on-demand
    // Just return the latest info to frontend

    res.json({
      success: true,
      message: "Zoom info refreshed successfully",
      data: {
        username: username,
        email: email,
        userId: zoomUserId,
        accountId: zoomAccountId
      }
    });
  } catch (error) {
    console.error("[Account Route] Error refreshing Zoom info:", error);
    res.status(500).json({ success: false, message: "Error refreshing Zoom info." });
  }
});

// Unlink Zoom account
router.delete("/zoom/unlink", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    await query(
      `UPDATE activeusers 
      SET 
        zoom_access_token = NULL,
        zoom_refresh_token = NULL,
        zoom_user_id = NULL,
        zoom_linked_at = NULL
      WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: "Zoom account unlinked successfully"
    });
  } catch (error) {
    console.error("[Account Route] Error unlinking Zoom account:", error);
    res.status(500).json({ success: false, message: "Error unlinking Zoom account." });
  }
});

// Get Zoom meeting history
router.get("/zoom/meetings", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { from, to, page_size = 30, next_page_token } = req.query;

    // Get user's Zoom tokens
    const userResults = await query(
      `SELECT zoom_access_token, zoom_refresh_token, zoom_user_id FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].zoom_user_id) {
      return res.status(400).json({
        success: false,
        message: "No Zoom account linked. Please connect your account first."
      });
    }

    const accessToken = userResults[0].zoom_access_token;
    const zoomUserId = userResults[0].zoom_user_id;

    // Build query parameters for Zoom Reports API (requires Admin-Managed app)
    const params = new URLSearchParams({
      page_size: page_size.toString()
    });

    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (next_page_token) params.append('next_page_token', next_page_token);

    // Fetch past meetings from Zoom Reports API
    const meetingsResponse = await fetch(
      `https://api.zoom.us/v2/report/users/${zoomUserId}/meetings?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!meetingsResponse.ok) {
      const errorText = await meetingsResponse.text();
      console.error('[Zoom] Failed to fetch meetings:', errorText);
      
      // Return 400 (not 401/403) to avoid triggering frontend auto-logout
      // Check if it's a scope issue
      if (meetingsResponse.status === 403 || meetingsResponse.status === 401) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient permissions to access meeting reports. Please ensure your Zoom app is Admin-Managed and has the report:read:user scope.',
          requiresAdminApp: true,
          zoomError: errorText
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch meetings from Zoom. Your Zoom account may need to be reconnected.',
        zoomError: errorText
      });
    }

    const meetingsData = await meetingsResponse.json();

    res.json({
      success: true,
      data: {
        meetings: meetingsData.meetings || [],
        page_size: meetingsData.page_size,
        next_page_token: meetingsData.next_page_token,
        page_count: meetingsData.page_count,
        total_records: meetingsData.total_records
      }
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Zoom meetings:", error);
    res.status(500).json({ success: false, message: "Error fetching Zoom meetings." });
  }
});

// Get Zoom meeting participants/attendees
router.get("/zoom/meetings/:meetingId/participants", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { meetingId } = req.params;
    const { page_size = 30, next_page_token } = req.query;

    // Get user's Zoom tokens
    const userResults = await query(
      `SELECT zoom_access_token, zoom_refresh_token FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].zoom_access_token) {
      return res.status(400).json({
        success: false,
        message: "No Zoom account linked. Please connect your account first."
      });
    }

    const accessToken = userResults[0].zoom_access_token;

    // Build query parameters
    const params = new URLSearchParams({
      page_size: page_size.toString()
    });

    if (next_page_token) params.append('next_page_token', next_page_token);

    // Fetch participants from Zoom API (using past meeting report)
    const participantsResponse = await fetch(
      `https://api.zoom.us/v2/past_meetings/${meetingId}/participants?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!participantsResponse.ok) {
      const errorText = await participantsResponse.text();
      console.error('[Zoom] Failed to fetch participants:', errorText);
      // Return 400 (not 401) to avoid triggering frontend auto-logout
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch participants from Zoom. Your Zoom account may need to be reconnected.',
        zoomError: errorText
      });
    }

    const participantsData = await participantsResponse.json();
    
    // Log participant data to see what fields are available
    console.log('[Zoom] Participant data sample:', participantsData.participants?.[0]);

    res.json({
      success: true,
      data: {
        participants: participantsData.participants || [],
        page_size: participantsData.page_size,
        next_page_token: participantsData.next_page_token,
        page_count: participantsData.page_count,
        total_records: participantsData.total_records
      }
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Zoom meeting participants:", error);
    res.status(500).json({ success: false, message: "Error fetching meeting participants." });
  }
});

// Get detailed meeting info
router.get("/zoom/meetings/:meetingId", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { meetingId } = req.params;

    // Get user's Zoom tokens
    const userResults = await query(
      `SELECT zoom_access_token FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].zoom_access_token) {
      return res.status(400).json({
        success: false,
        message: "No Zoom account linked."
      });
    }

    const accessToken = userResults[0].zoom_access_token;

    // Fetch meeting details from Zoom API
    const meetingResponse = await fetch(
      `https://api.zoom.us/v2/past_meetings/${meetingId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!meetingResponse.ok) {
      const errorText = await meetingResponse.text();
      console.error('[Zoom] Failed to fetch meeting details:', errorText);
      // Return 400 (not 401) to avoid triggering frontend auto-logout
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch meeting details from Zoom. Your Zoom account may need to be reconnected.',
        zoomError: errorText
      });
    }

    const meetingData = await meetingResponse.json();

    res.json({
      success: true,
      data: meetingData
    });
  } catch (error) {
    console.error("[Account Route] Error fetching meeting details:", error);
    res.status(500).json({ success: false, message: "Error fetching meeting details." });
  }
});

// ============================================================
// CALENDLY SCHEDULED EVENTS (for Zoom attendance tracking)
// ============================================================

// Get Calendly scheduled events
router.get("/calendly/events", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { min_start_time, max_start_time, count = 100 } = req.query;

    // Get user's Calendly access token and user URI
    const userResults = await query(
      `SELECT calendly_access_token, calendly_user_uri FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].calendly_access_token) {
      return res.status(400).json({
        success: false,
        message: "No Calendly account linked. Please connect your account first."
      });
    }

    const accessToken = userResults[0].calendly_access_token;
    const userUri = userResults[0].calendly_user_uri;

    // Build query parameters
    const params = new URLSearchParams({
      user: userUri,
      count: count.toString(),
      status: 'active' // Only get active (not cancelled) events
    });

    if (min_start_time) params.append('min_start_time', min_start_time);
    if (max_start_time) params.append('max_start_time', max_start_time);

    // Fetch scheduled events from Calendly API
    const eventsResponse = await fetch(
      `https://api.calendly.com/scheduled_events?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('[Calendly] Failed to fetch events:', errorText);
      // Return 400 (not 401) to avoid triggering frontend auto-logout
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch events from Calendly. Your Calendly account may need to be reconnected.',
        calendlyError: errorText
      });
    }

    const eventsData = await eventsResponse.json();

    // For each event, fetch invitee details
    const eventsWithInvitees = await Promise.all(
      (eventsData.collection || []).map(async (event) => {
        try {
          const inviteesResponse = await fetch(
            `${event.uri}/invitees`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (inviteesResponse.ok) {
            const inviteesData = await inviteesResponse.json();
            return {
              ...event,
              invitees: inviteesData.collection || []
            };
          } else {
            return {
              ...event,
              invitees: []
            };
          }
        } catch (err) {
          console.warn(`[Calendly] Could not fetch invitees for event ${event.uri}:`, err.message);
          return {
            ...event,
            invitees: []
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        events: eventsWithInvitees,
        pagination: eventsData.pagination
      }
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Calendly events:", error);
    res.status(500).json({ success: false, message: "Error fetching Calendly events." });
  }
});

module.exports = router;

