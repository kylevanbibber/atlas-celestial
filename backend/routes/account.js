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
// COMBINED STATUS - All integration statuses in one query
// ============================================================
router.get("/status/all", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Single query to get all integration fields from activeusers
    const results = await query(
      `SELECT
        calendly_username, calendly_link_url, calendly_linked_at, calendly_user_uri,
        zoom_access_token, zoom_user_id, zoom_linked_at,
        google_calendar_email, google_calendar_linked_at,
        outlook_calendar_email, outlook_calendar_linked_at,
        tally_user_id, tally_email, tally_linked_at
      FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const u = results[0];

    // SMS balance (separate table, single query)
    let smsBalance = 0;
    try {
      const smsRows = await query(
        "SELECT balance FROM sms_balances WHERE user_id = ? LIMIT 1",
        [userId]
      );
      if (smsRows && smsRows.length > 0) smsBalance = smsRows[0].balance || 0;
    } catch { /* ignore */ }

    // iCal subscriptions count (separate table, single query)
    let icalCount = 0;
    try {
      const icalRows = await query(
        "SELECT COUNT(*) as cnt FROM calendar_ical_subscriptions WHERE user_id = ?",
        [userId]
      );
      if (icalRows && icalRows.length > 0) icalCount = icalRows[0].cnt || 0;
    } catch { /* ignore */ }

    // Tally subscription (from Dial DB, may not be accessible)
    let tallySubscription = null;
    if (u.tally_user_id) {
      try {
        const tallyRows = await query(
          "SELECT subscription_plan, subscription_status FROM Dial.users WHERE id = ? LIMIT 1",
          [u.tally_user_id]
        );
        if (tallyRows && tallyRows.length > 0) {
          tallySubscription = { plan: tallyRows[0].subscription_plan, status: tallyRows[0].subscription_status };
        }
      } catch { /* Dial DB may not be accessible */ }
    }

    res.json({
      success: true,
      calendly: {
        isLinked: !!(u.calendly_username && u.calendly_linked_at),
        username: u.calendly_username,
        linkUrl: u.calendly_link_url,
        linkedAt: u.calendly_linked_at,
        userUri: u.calendly_user_uri
      },
      zoom: {
        isLinked: !!u.zoom_user_id,
        userId: u.zoom_user_id,
        linkedAt: u.zoom_linked_at
      },
      googleCalendar: {
        isLinked: !!(u.google_calendar_email && u.google_calendar_linked_at),
        email: u.google_calendar_email,
        linkedAt: u.google_calendar_linked_at
      },
      outlookCalendar: {
        isLinked: !!(u.outlook_calendar_email && u.outlook_calendar_linked_at),
        email: u.outlook_calendar_email,
        linkedAt: u.outlook_calendar_linked_at
      },
      tally: {
        isLinked: !!u.tally_user_id,
        email: u.tally_email,
        linkedAt: u.tally_linked_at,
        subscription: tallySubscription
      },
      sms: { balance: smsBalance },
      ical: { count: icalCount, hasSubscriptions: icalCount > 0 }
    });
  } catch (error) {
    console.error("[Account Route] Error fetching combined status:", error);
    res.status(500).json({ success: false, message: "Error fetching account status." });
  }
});

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

// ============================================================
// SMS CREDITS & USAGE
// ============================================================

// Get current SMS credit balance and simple usage summary for the logged-in user
// Uses sms_balances table so we don't store balances on activeusers
router.get("/sms/credits", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;

    const balanceRows = await query(
      `SELECT balance, last_updated 
       FROM sms_balances 
       WHERE user_id = ? 
       LIMIT 1`,
      [userId]
    );

    const balanceRow = balanceRows && balanceRows.length > 0 ? balanceRows[0] : null;

    // Aggregate basic transaction info (optional, used for simple UI summary)
    const txRows = await query(
      `SELECT 
         SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_purchased,
         SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS total_debited
       FROM sms_credit_transactions
       WHERE user_id = ?`,
      [userId]
    );

    const summary = txRows && txRows.length > 0 ? txRows[0] : {};

    res.json({
      success: true,
      balance: balanceRow ? (balanceRow.balance || 0) : 0,
      lastUpdated: balanceRow ? balanceRow.last_updated : null,
      summary: {
        totalPurchased: summary.total_purchased || 0,
        totalDebited: summary.total_debited || 0,
      },
    });
  } catch (error) {
    console.error("[Account Route] Error fetching SMS credits:", error);
    res.status(500).json({ success: false, message: "Error fetching SMS credits." });
  }
});

// Add/purchase SMS credits for the logged-in user
// NOTE: This endpoint only adjusts balances; hook it into your payment processor
// (Stripe, etc.) where appropriate.
router.post("/sms/credits/purchase", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { amount, description } = req.body || {};

    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A positive integer amount is required to purchase credits.",
      });
    }

    // Reasonable guardrail
    if (parsedAmount > 100000) {
      return res.status(400).json({
        success: false,
        message: "Requested credit amount is too large.",
      });
    }

    // Increment balance in sms_balances (insert or update)
    await query(
      `INSERT INTO sms_balances (user_id, balance, last_updated)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         balance = balance + VALUES(balance),
         last_updated = NOW()`,
      [userId, parsedAmount]
    );

    // Record transaction in ledger
    await query(
      `INSERT INTO sms_credit_transactions (user_id, amount, type, description, related_id)
       VALUES (?, ?, 'purchase', ?, NULL)`,
      [userId, parsedAmount, description || null]
    );

    // Fetch updated balance
    const updatedRows = await query(
      `SELECT balance, last_updated 
       FROM sms_balances 
       WHERE user_id = ? 
       LIMIT 1`,
      [userId]
    );

    const updated = updatedRows && updatedRows.length > 0 ? updatedRows[0] : null;

    res.json({
      success: true,
      message: "SMS credits added successfully.",
      balance: updated ? updated.balance : parsedAmount,
      lastUpdated: updated ? updated.last_updated : null,
    });
  } catch (error) {
    console.error("[Account Route] Error purchasing SMS credits:", error);
    res.status(500).json({ success: false, message: "Error purchasing SMS credits." });
  }
});

// Get a paginated view of this user's outbound SMS messages
router.get("/sms/messages", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const messages = await query(
      `SELECT 
         id,
         to_number,
         message,
         status,
         cost_credits,
         provider,
         provider_message_id,
         pipeline_id,
         created_at
       FROM sms_messages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Get total count for simple pagination
    const countRows = await query(
      `SELECT COUNT(*) AS total 
       FROM sms_messages 
       WHERE user_id = ?`,
      [userId]
    );

    const total = countRows && countRows.length > 0 ? countRows[0].total : 0;

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("[Account Route] Error fetching SMS messages:", error);
    res.status(500).json({ success: false, message: "Error fetching SMS messages." });
  }
});

// ============================================================
// GOOGLE CALENDAR INTEGRATION - OAuth 2.0
// ============================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google-calendar/callback';

console.log('[Google Calendar OAuth] Configuration loaded:', {
  hasClientId: !!GOOGLE_CLIENT_ID,
  hasClientSecret: !!GOOGLE_CLIENT_SECRET,
  redirectUri: GOOGLE_REDIRECT_URI
});

// Get Google Calendar status
router.get("/google-calendar/status", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const results = await query(
      `SELECT google_calendar_email, google_calendar_linked_at
       FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const data = results[0];
    res.json({
      success: true,
      isLinked: !!(data.google_calendar_email && data.google_calendar_linked_at),
      email: data.google_calendar_email,
      linkedAt: data.google_calendar_linked_at
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Google Calendar status:", error);
    res.status(500).json({ success: false, message: "Error fetching Google Calendar status." });
  }
});

// Initiate Google Calendar OAuth flow
router.get("/google-calendar/oauth/init", verifyToken, async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google Calendar OAuth is not configured. Please contact support."
      });
    }

    const userId = req.userId;
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', state);

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    console.error("[Account Route] Error initiating Google Calendar OAuth:", error);
    res.status(500).json({ success: false, message: "Error initiating OAuth flow." });
  }
});

// Google Calendar OAuth callback
router.post("/google-calendar/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "Authorization code is required" });
    }

    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
      if (Date.now() - stateData.timestamp > 600000) {
        return res.status(400).json({ success: false, message: "OAuth session expired. Please try again." });
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid state parameter" });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: GOOGLE_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Google Calendar OAuth] Token exchange failed:", errorData);
      return res.status(400).json({ success: false, message: "Failed to exchange authorization code for access token" });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user email from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      return res.status(400).json({ success: false, message: "Failed to retrieve user information from Google" });
    }

    const userData = await userResponse.json();
    const email = userData.email;

    await query(
      `UPDATE activeusers SET
        google_calendar_email = ?,
        google_calendar_access_token = ?,
        google_calendar_refresh_token = ?,
        google_calendar_linked_at = NOW()
       WHERE id = ?`,
      [email, accessToken, refreshToken, userId]
    );

    res.json({
      success: true,
      message: "Google Calendar linked successfully",
      data: { email }
    });
  } catch (error) {
    console.error("[Account Route] Error in Google Calendar OAuth callback:", error);
    res.status(500).json({ success: false, message: "Error completing OAuth flow." });
  }
});

// Refresh Google Calendar token
router.post("/google-calendar/refresh", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const userResults = await query(
      `SELECT google_calendar_refresh_token FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].google_calendar_refresh_token) {
      return res.status(400).json({ success: false, message: "No Google Calendar account linked." });
    }

    const refreshToken = userResults[0].google_calendar_refresh_token;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken
      })
    });

    if (!tokenResponse.ok) {
      return res.status(401).json({
        success: false,
        message: "Google Calendar session expired. Please reconnect your account.",
        requiresReauth: true
      });
    }

    const tokenData = await tokenResponse.json();
    const newAccessToken = tokenData.access_token;

    await query(
      `UPDATE activeusers SET google_calendar_access_token = ? WHERE id = ?`,
      [newAccessToken, userId]
    );

    // Fetch updated user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${newAccessToken}` }
    });

    let email = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      email = userData.email;
    }

    res.json({
      success: true,
      message: "Google Calendar refreshed successfully",
      data: { email }
    });
  } catch (error) {
    console.error("[Account Route] Error refreshing Google Calendar:", error);
    res.status(500).json({ success: false, message: "Error refreshing Google Calendar." });
  }
});

// Unlink Google Calendar
router.delete("/google-calendar/unlink", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    await query(
      `UPDATE activeusers SET
        google_calendar_email = NULL,
        google_calendar_access_token = NULL,
        google_calendar_refresh_token = NULL,
        google_calendar_linked_at = NULL
       WHERE id = ?`,
      [userId]
    );
    res.json({ success: true, message: "Google Calendar unlinked successfully" });
  } catch (error) {
    console.error("[Account Route] Error unlinking Google Calendar:", error);
    res.status(500).json({ success: false, message: "Error unlinking Google Calendar." });
  }
});

// ============================================================
// OUTLOOK CALENDAR INTEGRATION - OAuth 2.0 (Microsoft Graph)
// ============================================================

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/auth/outlook-calendar/callback';

console.log('[Outlook Calendar OAuth] Configuration loaded:', {
  hasClientId: !!OUTLOOK_CLIENT_ID,
  hasClientSecret: !!OUTLOOK_CLIENT_SECRET,
  redirectUri: OUTLOOK_REDIRECT_URI
});

// Get Outlook Calendar status
router.get("/outlook-calendar/status", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const results = await query(
      `SELECT outlook_calendar_email, outlook_calendar_linked_at
       FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const data = results[0];
    res.json({
      success: true,
      isLinked: !!(data.outlook_calendar_email && data.outlook_calendar_linked_at),
      email: data.outlook_calendar_email,
      linkedAt: data.outlook_calendar_linked_at
    });
  } catch (error) {
    console.error("[Account Route] Error fetching Outlook Calendar status:", error);
    res.status(500).json({ success: false, message: "Error fetching Outlook Calendar status." });
  }
});

// Initiate Outlook Calendar OAuth flow
router.get("/outlook-calendar/oauth/init", verifyToken, async (req, res) => {
  try {
    if (!OUTLOOK_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Outlook Calendar OAuth is not configured. Please contact support."
      });
    }

    const userId = req.userId;
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.append('client_id', OUTLOOK_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', OUTLOOK_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'Calendars.Read User.Read offline_access');
    authUrl.searchParams.append('response_mode', 'query');
    authUrl.searchParams.append('state', state);

    res.json({ success: true, authUrl: authUrl.toString() });
  } catch (error) {
    console.error("[Account Route] Error initiating Outlook Calendar OAuth:", error);
    res.status(500).json({ success: false, message: "Error initiating OAuth flow." });
  }
});

// Outlook Calendar OAuth callback
router.post("/outlook-calendar/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "Authorization code is required" });
    }

    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
      if (Date.now() - stateData.timestamp > 600000) {
        return res.status(400).json({ success: false, message: "OAuth session expired. Please try again." });
      }
    } catch (e) {
      return res.status(400).json({ success: false, message: "Invalid state parameter" });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: OUTLOOK_CLIENT_ID,
        client_secret: OUTLOOK_CLIENT_SECRET,
        code,
        redirect_uri: OUTLOOK_REDIRECT_URI,
        scope: 'Calendars.Read User.Read offline_access'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Outlook Calendar OAuth] Token exchange failed:", errorData);
      return res.status(400).json({ success: false, message: "Failed to exchange authorization code for access token" });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      return res.status(400).json({ success: false, message: "Failed to retrieve user information from Microsoft" });
    }

    const userData = await userResponse.json();
    const email = userData.mail || userData.userPrincipalName;

    await query(
      `UPDATE activeusers SET
        outlook_calendar_email = ?,
        outlook_calendar_access_token = ?,
        outlook_calendar_refresh_token = ?,
        outlook_calendar_linked_at = NOW()
       WHERE id = ?`,
      [email, accessToken, refreshToken, userId]
    );

    res.json({
      success: true,
      message: "Outlook Calendar linked successfully",
      data: { email }
    });
  } catch (error) {
    console.error("[Account Route] Error in Outlook Calendar OAuth callback:", error);
    res.status(500).json({ success: false, message: "Error completing OAuth flow." });
  }
});

// Refresh Outlook Calendar token
router.post("/outlook-calendar/refresh", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const userResults = await query(
      `SELECT outlook_calendar_refresh_token FROM activeusers WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!userResults || userResults.length === 0 || !userResults[0].outlook_calendar_refresh_token) {
      return res.status(400).json({ success: false, message: "No Outlook Calendar account linked." });
    }

    const refreshToken = userResults[0].outlook_calendar_refresh_token;

    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: OUTLOOK_CLIENT_ID,
        client_secret: OUTLOOK_CLIENT_SECRET,
        refresh_token: refreshToken,
        scope: 'Calendars.Read User.Read offline_access'
      })
    });

    if (!tokenResponse.ok) {
      return res.status(401).json({
        success: false,
        message: "Outlook Calendar session expired. Please reconnect your account.",
        requiresReauth: true
      });
    }

    const tokenData = await tokenResponse.json();
    const newAccessToken = tokenData.access_token;
    const newRefreshToken = tokenData.refresh_token;

    // Microsoft may rotate refresh tokens, so update both
    await query(
      `UPDATE activeusers SET
        outlook_calendar_access_token = ?,
        outlook_calendar_refresh_token = ?
       WHERE id = ?`,
      [newAccessToken, newRefreshToken || refreshToken, userId]
    );

    // Fetch updated user info
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { 'Authorization': `Bearer ${newAccessToken}` }
    });

    let email = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      email = userData.mail || userData.userPrincipalName;
    }

    res.json({
      success: true,
      message: "Outlook Calendar refreshed successfully",
      data: { email }
    });
  } catch (error) {
    console.error("[Account Route] Error refreshing Outlook Calendar:", error);
    res.status(500).json({ success: false, message: "Error refreshing Outlook Calendar." });
  }
});

// Unlink Outlook Calendar
router.delete("/outlook-calendar/unlink", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    await query(
      `UPDATE activeusers SET
        outlook_calendar_email = NULL,
        outlook_calendar_access_token = NULL,
        outlook_calendar_refresh_token = NULL,
        outlook_calendar_linked_at = NULL
       WHERE id = ?`,
      [userId]
    );
    res.json({ success: true, message: "Outlook Calendar unlinked successfully" });
  } catch (error) {
    console.error("[Account Route] Error unlinking Outlook Calendar:", error);
    res.status(500).json({ success: false, message: "Error unlinking Outlook Calendar." });
  }
});

// ============================================================
// iCAL SUBSCRIPTIONS (multiple per user)
// ============================================================

// GET /ical/list - List all iCal subscriptions for the user
router.get("/ical/list", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const rows = await query(
      "SELECT id, url, label, color, last_synced_at, created_at FROM calendar_ical_subscriptions WHERE user_id = ? ORDER BY created_at ASC",
      [userId]
    );
    res.json({ success: true, subscriptions: rows || [] });
  } catch (error) {
    console.error("[Account Route] Error listing iCal subscriptions:", error);
    res.status(500).json({ success: false, message: "Error listing iCal subscriptions." });
  }
});

// POST /ical/subscribe - Add a new iCal subscription
router.post("/ical/subscribe", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { url, label, color } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, message: "A valid iCal URL is required." });
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('webcal://')) {
      return res.status(400).json({ success: false, message: "URL must start with http://, https://, or webcal://" });
    }

    // Limit to 10 subscriptions per user
    const countRows = await query("SELECT COUNT(*) as cnt FROM calendar_ical_subscriptions WHERE user_id = ?", [userId]);
    if (countRows[0].cnt >= 10) {
      return res.status(400).json({ success: false, message: "Maximum of 10 iCal subscriptions allowed." });
    }

    const result = await query(
      "INSERT INTO calendar_ical_subscriptions (user_id, url, label, color) VALUES (?, ?, ?, ?)",
      [userId, trimmedUrl, (label || '').trim() || 'My Calendar', color || '#17a2b8']
    );

    res.json({ success: true, id: result.insertId, message: "iCal subscription added." });
  } catch (error) {
    console.error("[Account Route] Error adding iCal subscription:", error);
    res.status(500).json({ success: false, message: "Error adding iCal subscription." });
  }
});

// PUT /ical/:id - Update an iCal subscription
router.put("/ical/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const subId = req.params.id;
    const { url, label, color } = req.body;

    // Verify ownership
    const existing = await query("SELECT id FROM calendar_ical_subscriptions WHERE id = ? AND user_id = ?", [subId, userId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found." });
    }

    const updates = [];
    const params = [];
    if (url !== undefined) {
      const trimmedUrl = url.trim();
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('webcal://')) {
        return res.status(400).json({ success: false, message: "URL must start with http://, https://, or webcal://" });
      }
      updates.push('url = ?');
      params.push(trimmedUrl);
    }
    if (label !== undefined) { updates.push('label = ?'); params.push((label || '').trim() || 'My Calendar'); }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }

    if (updates.length === 0) return res.status(400).json({ success: false, message: "Nothing to update." });

    params.push(subId);
    await query(`UPDATE calendar_ical_subscriptions SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: "Subscription updated." });
  } catch (error) {
    console.error("[Account Route] Error updating iCal subscription:", error);
    res.status(500).json({ success: false, message: "Error updating iCal subscription." });
  }
});

// DELETE /ical/:id - Remove an iCal subscription
router.delete("/ical/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const subId = req.params.id;

    // Verify ownership
    const existing = await query("SELECT id FROM calendar_ical_subscriptions WHERE id = ? AND user_id = ?", [subId, userId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: "Subscription not found." });
    }

    await query("DELETE FROM calendar_ical_subscriptions WHERE id = ?", [subId]);

    // Soft-delete synced ical events for this subscription
    await query(
      "UPDATE calendar_events SET deleted_at = NOW() WHERE user_id = ? AND source = 'ical' AND external_id LIKE ? AND deleted_at IS NULL",
      [userId, `ical-${subId}-%`]
    );

    res.json({ success: true, message: "Subscription removed." });
  } catch (error) {
    console.error("[Account Route] Error removing iCal subscription:", error);
    res.status(500).json({ success: false, message: "Error removing iCal subscription." });
  }
});

// ============================================================
// TALLY DIALER INTEGRATION
// ============================================================

const bcrypt = require('bcryptjs');

// Get Tally link status
router.get("/tally/status", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const rows = await query(
      "SELECT tally_user_id, tally_email, tally_linked_at FROM activeusers WHERE id = ? LIMIT 1",
      [userId]
    );
    if (!rows || rows.length === 0) {
      return res.json({ success: true, isLinked: false });
    }
    const user = rows[0];
    if (user.tally_user_id) {
      // Fetch subscription info from Dial database
      let subscription = null;
      try {
        const tallyRows = await query(
          "SELECT subscription_plan, subscription_status FROM Dial.users WHERE id = ? LIMIT 1",
          [user.tally_user_id]
        );
        if (tallyRows && tallyRows.length > 0) {
          subscription = {
            plan: tallyRows[0].subscription_plan,
            status: tallyRows[0].subscription_status
          };
        }
      } catch { /* Dial DB may not be accessible */ }

      return res.json({
        success: true,
        isLinked: true,
        email: user.tally_email,
        linkedAt: user.tally_linked_at,
        subscription
      });
    }
    res.json({ success: true, isLinked: false });
  } catch (error) {
    console.error("[Account Route] Error fetching Tally status:", error);
    res.status(500).json({ success: false, message: "Error fetching Tally status." });
  }
});

// Link Tally account by email/password
router.post("/tally/link", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Check if already linked
    const existing = await query("SELECT tally_user_id FROM activeusers WHERE id = ? LIMIT 1", [userId]);
    if (existing && existing.length > 0 && existing[0].tally_user_id) {
      return res.status(400).json({ success: false, message: "A Tally account is already linked. Unlink it first." });
    }

    // Look up the Tally user in the Dial database
    const tallyUsers = await query("SELECT id, email, password, firstName, lastName FROM Dial.users WHERE email = ? LIMIT 1", [email]);
    if (!tallyUsers || tallyUsers.length === 0) {
      return res.status(400).json({ success: false, message: "No Tally account found with that email." });
    }

    const tallyUser = tallyUsers[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, tallyUser.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid password for that Tally account." });
    }

    // Check if this Tally account is already linked to another Atlas user
    const alreadyLinked = await query(
      "SELECT id, lagnname FROM activeusers WHERE tally_user_id = ? AND id != ? LIMIT 1",
      [tallyUser.id, userId]
    );
    if (alreadyLinked && alreadyLinked.length > 0) {
      return res.status(400).json({
        success: false,
        message: "This Tally account is already linked to another Atlas user."
      });
    }

    // Link the account
    const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    await query(
      "UPDATE activeusers SET tally_user_id = ?, tally_email = ?, tally_linked_at = ? WHERE id = ?",
      [tallyUser.id, tallyUser.email, now, userId]
    );

    console.log(`[Tally] Linked Atlas user ${userId} to Tally user ${tallyUser.id} (${tallyUser.email})`);

    res.json({
      success: true,
      message: "Tally account linked successfully.",
      email: tallyUser.email,
      linkedAt: now
    });
  } catch (error) {
    console.error("[Account Route] Error linking Tally account:", error);
    if (error.code === 'ER_BAD_DB_ERROR' || error.code === 'ER_DBACCESS_DENIED_ERROR') {
      return res.status(500).json({ success: false, message: "Unable to connect to Tally database. Please try again later." });
    }
    res.status(500).json({ success: false, message: "Error linking Tally account." });
  }
});

// Unlink Tally account
router.delete("/tally/unlink", verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    await query(
      "UPDATE activeusers SET tally_user_id = NULL, tally_email = NULL, tally_linked_at = NULL WHERE id = ?",
      [userId]
    );
    console.log(`[Tally] Unlinked Tally account for Atlas user ${userId}`);
    res.json({ success: true, message: "Tally account unlinked." });
  } catch (error) {
    console.error("[Account Route] Error unlinking Tally account:", error);
    res.status(500).json({ success: false, message: "Error unlinking Tally account." });
  }
});

module.exports = router;

