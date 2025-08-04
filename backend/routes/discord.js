// routes/discord.js
const express = require('express');
const axios = require('axios');
const db = require('../db');
const router = express.Router();
require('dotenv').config();

// Middleware to check if user is authenticated
const authMiddleware = require('../middleware/verifyToken');

const jwt = require('jsonwebtoken');

// Import the bot module to access its functions
const bot = require('../bot');

// Rate limit tracking for Discord API calls
const discordRateLimit = {
  remaining: 50,
  reset: Date.now() + 60000,
  lastRequest: 0
};

// Helper function to delay requests to respect rate limits
const delayIfNeeded = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - discordRateLimit.lastRequest;
  
  // Add minimum delay between Discord API requests (200ms)
  if (timeSinceLastRequest < 200) {
    await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastRequest));
  }
  
  discordRateLimit.lastRequest = Date.now();
};

// Enhanced Discord API wrapper with rate limiting
const discordApi = {
  async get(url, options = {}) {
    await delayIfNeeded();
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        ...options.headers
      },
      ...options
    });
    
    // Update rate limit state from headers
    if (response.headers['x-ratelimit-remaining']) {
      discordRateLimit.remaining = parseInt(response.headers['x-ratelimit-remaining']);
    }
    if (response.headers['x-ratelimit-reset']) {
      discordRateLimit.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
    }
    
    return response;
  },
  
  async post(url, data, options = {}) {
    await delayIfNeeded();
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    // Update rate limit state from headers
    if (response.headers['x-ratelimit-remaining']) {
      discordRateLimit.remaining = parseInt(response.headers['x-ratelimit-remaining']);
    }
    if (response.headers['x-ratelimit-reset']) {
      discordRateLimit.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
    }
    
    return response;
  },
  
  async put(url, data, options = {}) {
    await delayIfNeeded();
    const response = await axios.put(url, data, {
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    // Update rate limit state from headers
    if (response.headers['x-ratelimit-remaining']) {
      discordRateLimit.remaining = parseInt(response.headers['x-ratelimit-remaining']);
    }
    if (response.headers['x-ratelimit-reset']) {
      discordRateLimit.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
    }
    
    return response;
  },
  
  async delete(url, options = {}) {
    await delayIfNeeded();
    const response = await axios.delete(url, {
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        ...options.headers
      },
      ...options
    });
    
    // Update rate limit state from headers
    if (response.headers['x-ratelimit-remaining']) {
      discordRateLimit.remaining = parseInt(response.headers['x-ratelimit-remaining']);
    }
    if (response.headers['x-ratelimit-reset']) {
      discordRateLimit.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
    }
    
    return response;
  },
  
  getRateLimitStatus() {
    return {
      ...discordRateLimit,
      isLimited: discordRateLimit.remaining <= 0,
      timeUntilReset: Math.max(0, discordRateLimit.reset - Date.now())
    };
  }
};

// 1) Redirect managers to Discord's OAuth2 consent
router.get('/link', authMiddleware, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state: req.query.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]) || ''
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

// routes/discord.js — inside router.get('/callback', ...)
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  const stateToken = req.query.state;
  if (!code) {
    return res.status(400).send('No code provided');
  }

  let userId;
  try {
    if (!stateToken) {
      throw new Error('No token provided');
    }
    const decoded = jwt.verify(stateToken, process.env.JWT_SECRET || 'default_secret');
    userId = decoded.id || decoded.userId;
  } catch (err) {
    console.error('State token verification failed', err);
    return res.status(403).json({ auth: false, message: 'Invalid token' });
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI,
        scope: 'identify guilds'
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch Discord user
    const userRes = await axios.get(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const discordId = userRes.data.id;

    // Compute expiry timestamp
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiry = nowSeconds + expires_in;

    // Persist to DB
    await db.query(
      `UPDATE activeusers
          SET discord_id      = ?,
              discord_token   = ?,
              discord_refresh = ?,
              discord_expiry  = ?
        WHERE id = ?`,
      [
        discordId,
        access_token,
        refresh_token,
        expiry,
        userId
      ]
    );

    // Build frontend URL with protocol if missing
    const front = process.env.FRONTEND_URL || 'localhost:3000';
    const frontUrl = front.startsWith('http') ? front : `http://${front}`;
    return res.redirect(`${frontUrl}/settings?section=discord&discord=linked`);
  } catch (err) {
    console.error('OAuth callback error', err);
    const front = process.env.FRONTEND_URL || 'localhost:3000';
    const frontUrl = front.startsWith('http') ? front : `http://${front}`;
    return res.redirect(`${frontUrl}/settings?section=discord&discord=error`);
  }
});


// 3) Get user's Discord link status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const rows = await db.query('SELECT discord_id FROM activeusers WHERE id = ?', [userId]);
    if (!rows.length) {
      return res.json({ linked: false, discord_id: null });
    }
    const { discord_id } = rows[0];
    res.json({ linked: !!discord_id, discord_id });
  } catch (error) {
    console.error('Error checking Discord status:', error);
    res.status(500).json({ error: 'Failed to check Discord status' });
  }
});

// 4) Unlink Discord account
router.post('/unlink', authMiddleware, async (req, res) => {
  try {
    // Determine user ID from middleware
    const userId = req.userId || req.user?.userId || req.user?.id;
    await db.query(
      'UPDATE activeusers SET discord_id = NULL, discord_token = NULL WHERE id = ?',
      [userId]
    );
    
    res.json({ success: true, message: 'Discord account unlinked' });
  } catch (error) {
    console.error('Error unlinking Discord:', error);
    res.status(500).json({ error: 'Failed to unlink Discord account' });
  }
});

// 5) Get user's Discord servers
router.get('/guilds', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    // Get user's Discord token
    const users = await db.query(
      'SELECT discord_token, discord_expiry FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (!users || users.length === 0 || !users[0].discord_token) {
      return res.status(401).json({ error: 'Discord not linked' });
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (users[0].discord_expiry && users[0].discord_expiry < now) {
      return res.status(401).json({ error: 'Discord token expired' });
    }
    
    try {
      // Get user's guilds with rate limiting
      const guildsRes = await discordApi.get('https://discord.com/api/users/@me/guilds', {
        headers: {
          'Authorization': `Bearer ${users[0].discord_token}`
        }
      });
      
      const guilds = guildsRes.data.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon_url: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null
      }));
      
      res.json({ guilds });
    } catch (discordError) {
      console.error('Discord API error:', discordError.response?.data || discordError.message);
      
      if (discordError.response?.status === 401) {
        // Token is invalid, unlink Discord
        await db.query(
          'UPDATE activeusers SET discord_token = NULL, discord_refresh = NULL, discord_expiry = NULL WHERE id = ?',
          [userId]
        );
        return res.status(401).json({ error: 'Discord token invalid, please relink your account' });
      }
      
      throw discordError;
    }
  } catch (error) {
    console.error('Error fetching Discord guilds:', error);
    res.status(500).json({ error: 'Failed to fetch Discord servers' });
  }
});

// 6) Get channels for a specific guild
router.get('/guilds/:guildId/channels', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    try {
      // Get guild channels with rate limiting
      const channelsRes = await discordApi.get(`https://discord.com/api/guilds/${guildId}/channels`);
      
      const channels = channelsRes.data
        .filter(channel => channel.type === 0) // Only text channels
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type
        }));
      
      res.json({ channels });
    } catch (discordError) {
      console.error('Discord API error fetching channels:', discordError.response?.data || discordError.message);
      
      if (discordError.response?.status === 403) {
        return res.status(403).json({ error: 'Bot does not have permission to view channels in this server' });
      }
      
      if (discordError.response?.status === 404) {
        return res.status(404).json({ error: 'Server not found or bot is not in this server' });
      }
      
      throw discordError;
    }
  } catch (error) {
    console.error('Error fetching guild channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// 7) Get configured guilds for the manager
router.get('/guilds/configured', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId || req.user?.id;
    const guilds = await db.query(
      'SELECT * FROM guild_configs WHERE manager_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({ guilds });
  } catch (error) {
    console.error('Error fetching configured guilds:', error);
    res.status(500).json({ error: 'Failed to fetch configured servers' });
  }
});

// 8) Configure a guild (add to team servers)
router.post('/guilds/configure', authMiddleware, async (req, res) => {
  try {
    const {
      guild_id,
      guild_name,
      channel_id,
      channel_name,
      bot_added = 0,
      is_primary = 0
    } = req.body;

    // Check if this guild/channel is already configured
    const existing = await db.query(
      'SELECT id FROM guild_configs WHERE guild_id = ? AND channel_id = ?',
      [guild_id, channel_id]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'This channel is already configured' });
    }

    // Add new configuration with bot_added and primary flags
    const userId = req.userId || req.user?.userId || req.user?.id;
    await db.query(
      `INSERT INTO guild_configs 
         (manager_id, guild_id, guild_name, channel_id, channel_name, bot_added, is_primary)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, guild_id, guild_name, channel_id, channel_name, bot_added, is_primary]
    );

    res.json({ success: true, message: 'Server configured successfully' });
  } catch (error) {
    console.error('Error configuring guild:', error);
    res.status(500).json({ error: 'Failed to configure server' });
  }
});

// 9) Add bot to guild
router.post('/guilds/:guildId/bot', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;

    // Try updating existing config
    const result = await db.query(
      `UPDATE guild_configs
         SET bot_added = 1
       WHERE manager_id = ? AND guild_id = ?`,
      [userId, guildId]
    );

    // If no row was updated, insert a minimal record
    if (result.affectedRows === 0) {
      await db.query(
        `INSERT INTO guild_configs
           (manager_id, guild_id, guild_name, bot_added, is_primary)
         VALUES (?, ?, ?, 1, 0)`,
        [userId, guildId, /* you may fetch the name via Discord API or pass it in body */ req.body.guild_name]
      );
    }

    res.json({ success: true, message: 'Bot flag set' });
  } catch (error) {
    console.error('Error setting bot_added:', error);
    res.status(500).json({ error: 'Failed to update bot_added flag' });
  }
});

// 10) Remove bot from guild
router.delete('/guilds/:guildId/bot', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;

    // 1) Delete any inline (no-channel) configs outright
    await db.query(
      `DELETE FROM guild_configs
         WHERE manager_id = ?
           AND guild_id = ?
           AND (channel_id = '' OR channel_id IS NULL)`,
      [userId, guildId]
    );

    // 2) For any fully-configured rows, just clear the bot_added flag
    await db.query(
      `UPDATE guild_configs
         SET bot_added = 0
       WHERE manager_id = ?
         AND guild_id = ?
         AND (channel_id <> '' AND channel_id IS NOT NULL)`,
      [userId, guildId]
    );

    res.json({ success: true, message: 'Configuration removed.' });
  } catch (error) {
    console.error('Error clearing bot_added / deleting row:', error);
    res.status(500).json({ error: 'Failed to remove configuration' });
  }
});

// 11) Get bot guilds
router.get('/bot/guilds', authMiddleware, async (req, res) => {
  try {
    // Add delay if we've recently been rate limited
    if (global.discordRateLimitUntil && global.discordRateLimitUntil > Date.now()) {
      const waitTime = Math.ceil((global.discordRateLimitUntil - Date.now()) / 1000);
      console.log(`Waiting ${waitTime}s due to Discord rate limit`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }
    
    try {
      const response = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { 
          Authorization: `Bot ${process.env.DISCORD_TOKEN}` 
        }
      });
      
      // We only need the IDs
      const botGuildIds = response.data.map(g => g.id);
      res.json({ guild_ids: botGuildIds });
    } catch (apiError) {
      // Handle rate limiting specifically
      if (apiError.response && apiError.response.status === 429) {
        const retryAfter = apiError.response.data.retry_after || 1; // Default to 1 second if not provided
        global.discordRateLimitUntil = Date.now() + (retryAfter * 1000);
        
        console.log(`Discord rate limit hit. Retry after ${retryAfter}s`);
        
        // Return empty guild list instead of error
        res.json({ guild_ids: [], rate_limited: true, retry_after: retryAfter });
      } else {
        // For other errors, log and return empty array
        console.error('Error fetching bot guilds:', apiError);
        res.json({ guild_ids: [], error: apiError.message });
      }
    }
  } catch (error) {
    console.error('Error in bot guilds endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch bot guilds' });
  }
});

// 12) Remove bot from guild (frontend calls this endpoint)
router.delete('/bot/guilds/:guildId', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;

    // 1) Delete any inline (no-channel) configs outright
    await db.query(
      `DELETE FROM guild_configs
         WHERE manager_id = ?
           AND guild_id = ?
           AND (channel_id = '' OR channel_id IS NULL)`,
      [userId, guildId]
    );

    // 2) For any fully-configured rows, just clear the bot_added flag
    await db.query(
      `UPDATE guild_configs
         SET bot_added = 0
       WHERE manager_id = ?
         AND guild_id = ?
         AND (channel_id <> '' AND channel_id IS NOT NULL)`,
      [userId, guildId]
    );

    // 3) Try to remove the bot from the Discord server (optional, may fail due to permissions)
    try {
      await discordApi.delete(`https://discord.com/api/guilds/${guildId}`);
      console.log(`Bot removed from guild ${guildId}`);
    } catch (discordError) {
      console.log(`Could not remove bot from Discord guild ${guildId}:`, discordError.message);
      // Don't fail the request if Discord API call fails
    }

    res.json({ success: true, message: 'Bot removed from server.' });
  } catch (error) {
    console.error('Error removing bot from guild:', error);
    res.status(500).json({ error: 'Failed to remove bot from server' });
  }
});

// 13) Sync bot presence
router.post('/bot/sync', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    const userRow = await db.query('SELECT Role FROM activeusers WHERE id = ?', [req.userId || req.user?.id]);
    if (!userRow || userRow.length === 0 || userRow[0].Role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can trigger bot synchronization' });
    }
    
    // Call the sync function
    if (bot.syncBotPresenceWithDatabase) {
      await bot.syncBotPresenceWithDatabase();
      res.json({ success: true, message: 'Bot presence synchronization triggered successfully' });
    } else {
      res.status(500).json({ error: 'Synchronization function not available' });
    }
  } catch (error) {
    console.error('Error triggering bot sync:', error);
    res.status(500).json({ error: 'Failed to trigger bot synchronization' });
  }
});

// 14) Create a new reminder
router.post('/reminders', authMiddleware, async (req, res) => {
  try {
    const { guild_id, channel_id, cron_expr, message, scheduleType, guild_name, channel_name } = req.body;
    const userId = req.userId || req.user?.userId || req.user?.id;

    // Validate required fields
    if (!guild_id || !channel_id || !cron_expr || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate cron expression
    const cron = require('node-cron');
    if (!cron.validate(cron_expr)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    // Get guild and channel names if not provided
    let guildNameToUse = guild_name;
    let channelNameToUse = channel_name;

    if (!guildNameToUse || !channelNameToUse) {
      const configs = await db.query(
        `SELECT guild_name, channel_name FROM guild_configs 
         WHERE guild_id = ? AND channel_id = ? LIMIT 1`,
        [guild_id, channel_id]
      );

      if (configs && configs.length > 0) {
        guildNameToUse = guildNameToUse || configs[0].guild_name;
        channelNameToUse = channelNameToUse || configs[0].channel_name;
      }

      // If still not found, try to get from Discord API if bot has access
      if (!guildNameToUse || !channelNameToUse) {
        try {
          const client = require('../bot').getClient();
          
          if (!guildNameToUse) {
            const guild = await client.guilds.fetch(guild_id);
            if (guild) {
              guildNameToUse = guild.name;
            }
          }
          
          if (!channelNameToUse) {
            const channel = await client.channels.fetch(channel_id);
            if (channel) {
              channelNameToUse = channel.name;
            }
          }
        } catch (apiError) {
          console.warn('Could not fetch guild/channel names from Discord API:', apiError.message);
        }
      }

      // Use fallbacks if still not found
      guildNameToUse = guildNameToUse || 'Unknown Server';
      channelNameToUse = channelNameToUse || 'Unknown Channel';
    }

    // Insert new reminder
    const result = await db.query(
      `INSERT INTO discord_reminders (manager_id, guild_id, guild_name, channel_id, channel_name, cron_expr, message, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, guild_id, guildNameToUse, channel_id, channelNameToUse, cron_expr, message]
    );

    // Get the created reminder to return in the response
    const reminders = await db.query(
      `SELECT * FROM discord_reminders WHERE id = ?`,
      [result.insertId]
    );

    const createdReminder = reminders[0];

    // If this is a "now" reminder, send it immediately
    if (scheduleType === 'now') {
      try {
        const client = require('../bot').getClient();
        const channel = await client.channels.fetch(channel_id);
        
        if (channel && channel.isTextBased()) {
          await channel.send(message);
          console.log(`Sent immediate reminder to channel ${channel_id}`);
        }
      } catch (immediateError) {
        console.error('Error sending immediate reminder:', immediateError);
        // Don't fail the request, just log the error
      }
    }

    // Reload scheduled jobs to include this new reminder
    await bot.reloadScheduledJobs();

    res.status(201).json({ 
      success: true, 
      message: scheduleType === 'now' ? 'Reminder sent immediately and scheduled for future' : 'Reminder created successfully',
      reminder: createdReminder
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// 14) Get manager's reminders
router.get('/reminders', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    const reminders = await db.query(
      'SELECT * FROM discord_reminders WHERE manager_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({ reminders });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// 15) Update reminder
router.put('/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { guild_id, guild_name, channel_id, channel_name, cron_expr, message, is_active } = req.body;
    const userId = req.userId || req.user?.userId || req.user?.id;

    if (cron_expr) {
      const cron = require('node-cron');
      if (!cron.validate(cron_expr)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    // Get the current reminder to check what's changing
    const currentReminders = await db.query(
      'SELECT * FROM discord_reminders WHERE id = ? AND manager_id = ?',
      [id, userId]
    );

    if (currentReminders.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Update the reminder with all provided fields
    await db.query(
      `UPDATE discord_reminders 
       SET guild_id = COALESCE(?, guild_id),
           guild_name = COALESCE(?, guild_name),
           channel_id = COALESCE(?, channel_id),
           channel_name = COALESCE(?, channel_name),
           cron_expr = COALESCE(?, cron_expr), 
           message = COALESCE(?, message), 
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND manager_id = ?`,
      [guild_id, guild_name, channel_id, channel_name, cron_expr, message, is_active, id, userId]
    );

    // Get the updated reminder to return
    const updatedReminder = await db.query(
      'SELECT * FROM discord_reminders WHERE id = ?',
      [id]
    );

    // Reload scheduled jobs to update this reminder
    await bot.reloadScheduledJobs();

    res.json({ 
      success: true, 
      message: 'Reminder updated successfully',
      reminder: updatedReminder[0]
    });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// 16) Delete reminder
router.delete('/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;

    await db.query(
      'DELETE FROM discord_reminders WHERE id = ? AND manager_id = ?',
      [id, userId]
    );

    // Reload scheduled jobs to remove this reminder
    await bot.reloadScheduledJobs();

    res.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// 17) Send test reminder message
router.post('/reminders/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    // Get the reminder details
    const reminders = await db.query(
      'SELECT * FROM discord_reminders WHERE id = ? AND manager_id = ?',
      [id, userId]
    );
    
    if (!reminders || reminders.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }
    
    const reminder = reminders[0];
    
    try {
      // Get Discord client from bot module
      const client = require('../bot').getClient();
      
      // Check if client exists and is ready
      if (!client) {
        return res.status(500).json({ 
          error: 'Discord bot client not available',
          details: 'Bot client is null or undefined. Bot may not be initialized.'
        });
      }
      
      if (!client.isReady()) {
        return res.status(500).json({ 
          error: 'Discord bot is not ready',
          details: `Bot status: ${client.readyAt ? 'Was ready before but disconnected' : 'Never connected'}. Please check bot configuration and connection.`
        });
      }
      
      console.log(`[TEST] Bot is ready. User: ${client.user?.tag}, Ready since: ${client.readyAt}`);
      
      // Try to fetch the channel
      const channel = await client.channels.fetch(reminder.channel_id);
      
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ 
          error: 'Cannot send message to this channel',
          details: 'Channel not found or is not a text channel'
        });
      }
      
      // Send the test message
      await channel.send(`[TEST] ${reminder.message}`);
      
      res.json({ success: true, message: 'Test reminder sent successfully' });
    } catch (discordError) {
      console.error('Discord API error when sending test reminder:', discordError);
      res.status(500).json({ 
        error: 'Failed to send test reminder', 
        details: discordError.message || 'Discord API error'
      });
    }
  } catch (error) {
    console.error('Error sending test reminder:', error);
    res.status(500).json({ error: 'Failed to process test reminder request' });
  }
});

// 18) Send direct test message to a channel (for new reminders)
router.post('/test-message', authMiddleware, async (req, res) => {
  try {
    const { guild_id, channel_id, message } = req.body;
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    if (!guild_id || !channel_id || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify the user has access to this guild/channel
    const configs = await db.query(
      'SELECT * FROM guild_configs WHERE manager_id = ? AND guild_id = ?',
      [userId, guild_id]
    );
    
    if (!configs || configs.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this Discord server' });
    }
    
    try {
      // Get Discord client from bot module
      const client = require('../bot').getClient();
      
      // Check if client exists and is ready
      if (!client) {
        return res.status(500).json({ 
          error: 'Discord bot client not available',
          details: 'Bot client is null or undefined. Bot may not be initialized.'
        });
      }
      
      if (!client.isReady()) {
        return res.status(500).json({ 
          error: 'Discord bot is not ready',
          details: `Bot status: ${client.readyAt ? 'Was ready before but disconnected' : 'Never connected'}. Please check bot configuration and connection.`
        });
      }
      
      console.log(`[TEST] Bot is ready. User: ${client.user?.tag}, Ready since: ${client.readyAt}`);
      
      // Try to fetch the channel
      const channel = await client.channels.fetch(channel_id);
      
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ 
          error: 'Cannot send message to this channel',
          details: 'Channel not found or is not a text channel'
        });
      }
      
      // Send the test message
      await channel.send(message);
      
      res.json({ success: true, message: 'Test message sent successfully' });
    } catch (discordError) {
      console.error('Discord API error when sending test message:', discordError);
      res.status(500).json({ 
        error: 'Failed to send test message', 
        details: discordError.message || 'Discord API error'
      });
    }
  } catch (error) {
    console.error('Error sending test message:', error);
    res.status(500).json({ error: 'Failed to process test message request' });
  }
});

// 19) Get Discord API rate limit status
router.get('/rate-limit-status', authMiddleware, async (req, res) => {
  try {
    const status = discordApi.getRateLimitStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    res.status(500).json({ error: 'Failed to get rate limit status' });
  }
});

router.get('/managers', authMiddleware, async (req, res) => {
  try {
    // Get MGA managers from MGAs table where active = 'y' and hide = 'n' 
    // Include both MGA and RGA since all RGAs are MGAs
    // Join with activeusers to get corresponding IDs
    const mgaManagers = await db.query(
      `SELECT DISTINCT a.id, m.lagnname, 'MGA' as clname
       FROM MGAs m
       JOIN activeusers a ON m.lagnname = a.lagnname
       WHERE m.active = 'y' AND m.hide = 'n' AND (m.clname = 'MGA' OR m.clname = 'RGA')
       ORDER BY m.lagnname`
    );

    // Get RGA managers from MGAs table where clname = 'RGA' and active = 'y' and hide = 'n'
    // Join with activeusers to get corresponding IDs
    const rgaManagers = await db.query(
      `SELECT a.id, m.lagnname, 'RGA' as clname
       FROM MGAs m
       JOIN activeusers a ON m.lagnname = a.lagnname
       WHERE m.clname = 'RGA' AND m.active = 'y' AND m.hide = 'n'
       ORDER BY m.lagnname`
    );

    // Get Tree options - unique tree values from MGAs where active = 'y' and hide = 'n'
    const treeManagers = await db.query(
      `SELECT DISTINCT m.tree as id, m.tree as lagnname, 'Tree' as clname
       FROM MGAs m
       WHERE m.active = 'y' AND m.hide = 'n' 
       AND m.tree IS NOT NULL AND m.tree != ''
       ORDER BY m.tree`
    );

    // Combine all managers
    const managers = [...mgaManagers, ...rgaManagers, ...treeManagers];
    
    console.log('MGA Managers:', mgaManagers);
    console.log('RGA Managers:', rgaManagers);
    console.log('Tree Managers:', treeManagers);
    console.log('All Managers:', managers);
    
    res.json({ managers });
  } catch (error) {
    console.error('Error fetching managers:', error);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
});

// Create a new leaderboard
router.post('/leaderboards', authMiddleware, async (req, res) => {
  try {
    // Add logging to see what data is being received
    console.log('Received leaderboard creation request:', req.body);
    
    const { 
      guild_id, 
      channel_id, 
      cron_expr, 
      metric_type, 
      leaderboard_type,
      metrics, 
      data_period, 
      scope, 
      top_count,
      guild_name,
      channel_name,
      manager_id // New field for admin users to specify which manager
    } = req.body;
    const createdBy = req.userId || req.user?.userId || req.user?.id;

    // Log the extracted values
    console.log('Extracted values:', {
      guild_id,
      channel_id,
      cron_expr,
      metric_type,
      leaderboard_type,
      metrics,
      data_period,
      scope,
      top_count,
      guild_name,
      channel_name,
      manager_id,
      createdBy
    });

    // Validate required fields
    if (!guild_id || !channel_id || !cron_expr || !metrics || !Array.isArray(metrics) || metrics.length === 0) {
      console.log('Validation failed:', {
        guild_id: !!guild_id,
        channel_id: !!channel_id,
        cron_expr: !!cron_expr,
        metrics: metrics,
        isArray: Array.isArray(metrics),
        length: metrics ? metrics.length : 0
      });
      return res.status(400).json({ error: 'Missing required fields or metrics' });
    }
    
    // Validate cron expression
    const cron = require('node-cron');
    if (!cron.validate(cron_expr)) {
      console.log('Invalid cron expression:', cron_expr);
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    // Get current user's role to determine if they can specify manager_id
    const userResult = await db.query(
      'SELECT Role FROM activeusers WHERE id = ?',
      [createdBy]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userRole = userResult[0].Role;
    let effectiveManagerId = createdBy; // Default to creator
    
    // If user is admin and specified a manager_id, use that instead
    // Skip manager validation for full_agency scope
    if (userRole === 'Admin' && manager_id && scope !== 'full_agency') {
      // Validate that the specified manager exists and is a valid manager
      // Check MGA, RGA, and tree managers from MGAs table
      const managerResult = await db.query(
        `SELECT a.id 
         FROM activeusers a
         JOIN MGAs m ON a.lagnname = m.lagnname
         WHERE a.id = ? 
         AND m.active = 'y' AND m.hide = 'n'
         AND (m.clname = 'MGA' OR m.clname = 'RGA')`,
        [manager_id]
      );
      
      // For tree managers, find the activeusers.id that matches the tree name
      const treeManagerResult = await db.query(
        `SELECT a.id 
         FROM activeusers a
         JOIN MGAs m ON a.lagnname = m.tree
         WHERE m.tree = ? 
         AND m.active = 'y' AND m.hide = 'n'
         AND m.tree IS NOT NULL AND m.tree != ''
         LIMIT 1`,
        [manager_id]
      );
      
      if (managerResult && managerResult.length > 0) {
        effectiveManagerId = manager_id; // Use the numeric ID for MGA/RGA
      } else if (treeManagerResult && treeManagerResult.length > 0) {
        effectiveManagerId = treeManagerResult[0].id; // Use the found activeusers.id for Tree
      } else {
        return res.status(400).json({ error: 'Invalid manager specified' });
      }
    }

    // Get guild and channel names if not provided
    let guildNameToUse = guild_name;
    let channelNameToUse = channel_name;

    if (!guildNameToUse || !channelNameToUse) {
      const configs = await db.query(
        `SELECT guild_name, channel_name FROM guild_configs 
         WHERE guild_id = ? AND channel_id = ? LIMIT 1`,
        [guild_id, channel_id]
      );

      if (configs && configs.length > 0) {
        guildNameToUse = guildNameToUse || configs[0].guild_name;
        channelNameToUse = channelNameToUse || configs[0].channel_name;
      }

      // If still not found, try to get from Discord API if bot has access
      if (!guildNameToUse || !channelNameToUse) {
        try {
          const client = require('../bot').getClient();
          
          if (!guildNameToUse) {
            const guild = await client.guilds.fetch(guild_id);
            if (guild) {
              guildNameToUse = guild.name;
            }
          }
          
          if (!channelNameToUse) {
            const channel = await client.channels.fetch(channel_id);
            if (channel) {
              channelNameToUse = channel.name;
            }
          }
        } catch (apiError) {
          console.warn('Could not fetch guild/channel names from Discord API:', apiError.message);
        }
      }

      // Use fallbacks if still not found
      guildNameToUse = guildNameToUse || 'Unknown Server';
      channelNameToUse = channelNameToUse || 'Unknown Channel';
    }

    // Insert new leaderboard
    const result = await db.query(
      `INSERT INTO discord_leaderboards (
        manager_id, created_by, guild_id, guild_name, channel_id, channel_name, 
        cron_expr, metric_type, leaderboard_type, metrics, data_period, scope, top_count, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        effectiveManagerId,
        createdBy, 
        guild_id, 
        guildNameToUse, 
        channel_id, 
        channelNameToUse, 
        cron_expr, 
        metric_type || 'activity_leaderboard',
        leaderboard_type || 'activity',
        JSON.stringify(metrics),
        JSON.stringify(data_period || ['daily']),
        scope || 'mga_team',
        top_count || 10
      ]
    );

    // Get the created leaderboard to return in the response
    const leaderboards = await db.query(
      `SELECT * FROM discord_leaderboards WHERE id = ?`,
      [result.insertId]
    );

    const createdLeaderboard = leaderboards[0];
    
    // Parse the JSON metrics field for the response
    if (createdLeaderboard.metrics) {
      try {
        createdLeaderboard.metrics = JSON.parse(createdLeaderboard.metrics);
      } catch (e) {
        console.warn('Error parsing metrics JSON:', e);
        createdLeaderboard.metrics = ['sales'];
      }
    }

    // Parse the JSON data_period field for the response
    if (createdLeaderboard.data_period) {
      try {
        createdLeaderboard.data_period = JSON.parse(createdLeaderboard.data_period);
      } catch (e) {
        console.warn('Error parsing data_period JSON:', e);
        createdLeaderboard.data_period = ['daily'];
      }
    } else {
      createdLeaderboard.data_period = ['daily'];
    }

    // Reload scheduled jobs to include this new leaderboard
    await bot.reloadScheduledJobs();

    res.status(201).json({ 
      success: true, 
      message: 'Leaderboard created successfully',
      leaderboard: createdLeaderboard
    });
  } catch (error) {
    console.error('Error creating leaderboard:', error);
    res.status(500).json({ error: 'Failed to create leaderboard' });
  }
});

// Get manager's leaderboards
router.get('/leaderboards', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    // Get current user's role
    const userResult = await db.query(
      'SELECT Role FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userRole = userResult[0].Role;
    let query, params;
    
    if (userRole === 'Admin') {
      // Admin can see all leaderboards with manager info
      query = `
SELECT l.*, 
       m.lagnname as manager_lagnname,
       c.lagnname as created_by_lagnname
FROM discord_leaderboards l
LEFT JOIN activeusers m ON l.manager_id = m.id
LEFT JOIN activeusers c ON l.created_by = c.id
        ORDER BY l.created_at DESC
      `;
      params = [];
    } else {
      // Regular users can only see leaderboards they created
      query = `
        SELECT l.*, 
               m.lagnname as manager_lagnname
        FROM discord_leaderboards l
        LEFT JOIN activeusers m ON l.manager_id = m.id
        WHERE l.created_by = ? 
        ORDER BY l.created_at DESC
      `;
      params = [userId];
    }
    
    const leaderboards = await db.query(query, params);

  // In the GET /leaderboards endpoint, add parsing for data_period:
const parsedLeaderboards = leaderboards.map(leaderboard => {
  // Parse metrics
  if (leaderboard.metrics) {
    try {
      leaderboard.metrics = JSON.parse(leaderboard.metrics);
    } catch (e) {
      console.warn('Error parsing metrics JSON:', e);
      leaderboard.metrics = ['sales'];
    }
  } else {
    leaderboard.metrics = ['sales'];
  }
  
  // Parse data_period (NEW)
  if (leaderboard.data_period) {
    try {
      leaderboard.data_period = JSON.parse(leaderboard.data_period);
    } catch (e) {
      console.warn('Error parsing data_period JSON:', e);
      leaderboard.data_period = ['daily'];
    }
  } else {
    leaderboard.data_period = ['daily'];
  }
  
  return leaderboard;
});

// Add the missing closing brace and return statement:
res.json({ leaderboards: parsedLeaderboards });
} catch (error) {
  console.error('Error fetching leaderboards:', error);
  res.status(500).json({ error: 'Failed to fetch leaderboards' });
}
});

// Update leaderboard
router.put('/leaderboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      guild_id, 
      guild_name, 
      channel_id, 
      channel_name, 
      cron_expr,
      metric_type, 
      leaderboard_type,
      metrics, 
      data_period, 
      scope, 
      top_count, 
      is_active,
      manager_id // Allow admin to change manager
    } = req.body;
    const userId = req.userId || req.user?.userId || req.user?.id;

    if (cron_expr) {
      const cron = require('node-cron');
      if (!cron.validate(cron_expr)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    if (metrics && (!Array.isArray(metrics) || metrics.length === 0)) {
      return res.status(400).json({ error: 'Metrics must be a non-empty array' });
    }

    // Get current user's role
    const userResult = await db.query(
      'SELECT Role FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userRole = userResult[0].Role;
    
    // Get the current leaderboard to check permissions
    let whereClause, whereParams;
    if (userRole === 'Admin') {
      // Admin can edit any leaderboard
      whereClause = 'WHERE id = ?';
      whereParams = [id];
    } else {
      // Regular users can only edit leaderboards they created
      whereClause = 'WHERE id = ? AND created_by = ?';
      whereParams = [id, userId];
    }
    
    const currentLeaderboards = await db.query(
      `SELECT * FROM discord_leaderboards ${whereClause}`,
      whereParams
    );

    if (currentLeaderboards.length === 0) {
      return res.status(404).json({ error: 'Leaderboard not found or access denied' });
    }

    // Validate manager_id if provided and user is admin
    // Skip manager validation for full_agency scope
    let effectiveManagerId = currentLeaderboards[0].manager_id; // Keep current if not changing
    if (userRole === 'Admin' && manager_id !== undefined && scope !== 'full_agency') {
      if (manager_id) {
        // Check MGA/RGA managers
        const managerResult = await db.query(
          `SELECT a.id 
           FROM activeusers a
           JOIN MGAs m ON a.lagnname = m.lagnname
           WHERE a.id = ? 
           AND m.active = 'y' AND m.hide = 'n'
           AND (m.clname = 'MGA' OR m.clname = 'RGA')`,
          [manager_id]
        );
        
        // For tree managers, find the activeusers.id that matches the tree name
        const treeManagerResult = await db.query(
          `SELECT a.id 
           FROM activeusers a
           JOIN MGAs m ON a.lagnname = m.tree
           WHERE m.tree = ? 
           AND m.active = 'y' AND m.hide = 'n'
           AND m.tree IS NOT NULL AND m.tree != ''
           LIMIT 1`,
          [manager_id]
        );
        
        if (managerResult && managerResult.length > 0) {
          effectiveManagerId = manager_id; // Use the numeric ID for MGA/RGA
        } else if (treeManagerResult && treeManagerResult.length > 0) {
          effectiveManagerId = treeManagerResult[0].id; // Use the found activeusers.id for Tree
        } else {
          return res.status(400).json({ error: 'Invalid manager specified' });
        }
      }
    }

    // Update the leaderboard with all provided fields
    await db.query(
      `UPDATE discord_leaderboards 
       SET manager_id = COALESCE(?, manager_id),
           guild_id = COALESCE(?, guild_id),
           guild_name = COALESCE(?, guild_name),
           channel_id = COALESCE(?, channel_id),
           channel_name = COALESCE(?, channel_name),
           cron_expr = COALESCE(?, cron_expr), 
           metric_type = COALESCE(?, metric_type),
           leaderboard_type = COALESCE(?, leaderboard_type),
           metrics = COALESCE(?, metrics),
           data_period = COALESCE(?, data_period),
           scope = COALESCE(?, scope),
           top_count = COALESCE(?, top_count),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        effectiveManagerId,
        guild_id, 
        guild_name, 
        channel_id, 
        channel_name, 
        cron_expr, 
        metric_type,
        leaderboard_type,
        metrics ? JSON.stringify(metrics) : null,
        data_period ? JSON.stringify(data_period) : null,
        scope,
        top_count, 
        is_active, 
        id
      ]
    );

    // Get the updated leaderboard to return
    const updatedLeaderboards = await db.query(
      'SELECT * FROM discord_leaderboards WHERE id = ?',
      [id]
    );

    const updatedLeaderboard = updatedLeaderboards[0];
    
    // Parse the JSON metrics field for the response
    if (updatedLeaderboard.metrics) {
      try {
        updatedLeaderboard.metrics = JSON.parse(updatedLeaderboard.metrics);
      } catch (e) {
        console.warn('Error parsing metrics JSON:', e);
        updatedLeaderboard.metrics = ['sales'];
      }
    }

    // Parse the JSON data_period field for the response
    if (updatedLeaderboard.data_period) {
      try {
        updatedLeaderboard.data_period = JSON.parse(updatedLeaderboard.data_period);
      } catch (e) {
        console.warn('Error parsing data_period JSON:', e);
        updatedLeaderboard.data_period = ['daily'];
      }
    } else {
      updatedLeaderboard.data_period = ['daily'];
    }

    // Reload scheduled jobs to update this leaderboard
    await bot.reloadScheduledJobs();

    res.json({ 
      success: true, 
      message: 'Leaderboard updated successfully',
      leaderboard: updatedLeaderboard
    });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// Delete leaderboard
router.delete('/leaderboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;

    // Get current user's role
    const userResult = await db.query(
      'SELECT Role FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userRole = userResult[0].Role;
    
    // Determine delete permissions
    let whereClause, whereParams;
    if (userRole === 'Admin') {
      // Admin can delete any leaderboard
      whereClause = 'WHERE id = ?';
      whereParams = [id];
    } else {
      // Regular users can only delete leaderboards they created
      whereClause = 'WHERE id = ? AND created_by = ?';
      whereParams = [id, userId];
    }

    const result = await db.query(
      `DELETE FROM discord_leaderboards ${whereClause}`,
      whereParams
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Leaderboard not found or access denied' });
    }

    // Reload scheduled jobs to remove this leaderboard
    await bot.reloadScheduledJobs();

    res.json({ success: true, message: 'Leaderboard deleted successfully' });
  } catch (error) {
    console.error('Error deleting leaderboard:', error);
    res.status(500).json({ error: 'Failed to delete leaderboard' });
  }
});

// Test leaderboard message
router.post('/leaderboards/:id/test', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    // Get current user's role
    const userResult = await db.query(
      'SELECT Role FROM activeusers WHERE id = ?',
      [userId]
    );

    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult[0].Role;
    let query, params;

    if (userRole === 'Admin') {
      // Admin can test any leaderboard
      query = 'SELECT * FROM discord_leaderboards WHERE id = ?';
      params = [id];
    } else {
      // Regular users can only test leaderboards they created
      query = 'SELECT * FROM discord_leaderboards WHERE id = ? AND created_by = ?';
      params = [id, userId];
    }

    // Get the leaderboard details
    const leaderboards = await db.query(query, params);
    
    if (!leaderboards || leaderboards.length === 0) {
      return res.status(404).json({ error: 'Leaderboard not found' });
    }
    
    const leaderboard = leaderboards[0];
    
    try {
      // Generate the leaderboard message(s)
      const leaderboardMessages = await generateLeaderboardMessage(leaderboard);
      
      // Get Discord client from bot module
      const client = require('../bot').getClient();
      
      // Check if client exists and is ready
      if (!client) {
        return res.status(500).json({ 
          error: 'Discord bot client not available',
          details: 'Bot client is null or undefined. Bot may not be initialized.'
        });
      }
      
      if (!client.isReady()) {
        return res.status(500).json({ 
          error: 'Discord bot is not ready',
          details: `Bot status: ${client.readyAt ? 'Was ready before but disconnected' : 'Never connected'}. Please check bot configuration and connection.`
        });
      }
      
      console.log(`[TEST] Bot is ready. User: ${client.user?.tag}, Ready since: ${client.readyAt}`);
      
      // Try to fetch the channel
      const channel = await client.channels.fetch(leaderboard.channel_id);
      
      if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ 
          error: 'Cannot send message to this channel',
          details: 'Channel not found or is not a text channel'
        });
      }
      
      // Send the test message(s)
      if (Array.isArray(leaderboardMessages)) {
        // Send multiple messages with a small delay between them
        for (let i = 0; i < leaderboardMessages.length; i++) {
          await channel.send(`[TEST] ${leaderboardMessages[i]}`);
          // Add a small delay between messages to avoid rate limiting
          if (i < leaderboardMessages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        // Send single message (backwards compatibility)
        await channel.send(`[TEST] ${leaderboardMessages}`);
      }
      
      res.json({ success: true, message: 'Test leaderboard sent successfully' });
    } catch (discordError) {
      console.error('Discord API error when sending test leaderboard:', discordError);
      res.status(500).json({ 
        error: 'Failed to send test leaderboard', 
        details: discordError.message || 'Discord API error'
      });
    }
  } catch (error) {
    console.error('Error sending test leaderboard:', error);
    res.status(500).json({ error: 'Failed to process test leaderboard request' });
  }
});
// Helper function to generate leaderboard message
async function generateLeaderboardMessage(leaderboard) {
  try {
    console.log(`[LEADERBOARD] Generating leaderboard message for leaderboard ID: ${leaderboard.id}`);
    console.log(`[LEADERBOARD] Leaderboard config:`, {
      manager_id: leaderboard.manager_id,
      scope: leaderboard.scope,
      leaderboard_type: leaderboard.leaderboard_type,
      data_period: leaderboard.data_period,
      metrics: leaderboard.metrics,
      top_count: leaderboard.top_count
    });
    
    // Check leaderboard type and delegate to appropriate handler
    if (leaderboard.leaderboard_type === 'production') {
      console.log(`[LEADERBOARD] Generating production leaderboard`);
      return await generateProductionLeaderboardMessage(leaderboard);
    } else {
      console.log(`[LEADERBOARD] Generating activity leaderboard`);
      return await generateActivityLeaderboardMessage(leaderboard);
    }
  } catch (error) {
    console.error('[LEADERBOARD] Error generating leaderboard message:', error);
    throw error;
  }
}

// Helper function to generate activity leaderboard message (existing logic)
async function generateActivityLeaderboardMessage(leaderboard) {
  try {
    // Parse metrics if it's a JSON string
    let metrics = leaderboard.metrics;
    if (typeof metrics === 'string') {
      try {
        metrics = JSON.parse(metrics);
      } catch (e) {
        console.warn('[LEADERBOARD] Error parsing metrics JSON:', e);
        metrics = ['sales'];
      }
    }
    
    if (!Array.isArray(metrics) || metrics.length === 0) {
      metrics = ['sales'];
    }

    console.log(`[LEADERBOARD] Parsed metrics:`, metrics);

    // Parse data_period if it's a JSON string
    let dataPeriods = leaderboard.data_period;
    if (typeof dataPeriods === 'string') {
      try {
        dataPeriods = JSON.parse(dataPeriods);
      } catch (e) {
        console.warn('[LEADERBOARD] Error parsing data_period JSON:', e);
        dataPeriods = ['daily'];
      }
    }

    if (!Array.isArray(dataPeriods) || dataPeriods.length === 0) {
      dataPeriods = ['daily'];
    }

    console.log(`[LEADERBOARD] Parsed data periods:`, dataPeriods);

    // Get users based on scope
    const userIds = await getUsersForScope(leaderboard.manager_id, leaderboard.scope);
    
    console.log(`[LEADERBOARD] Retrieved ${userIds.length} user IDs for scope processing`);
    
    if (userIds.length === 0) {
      console.log(`[LEADERBOARD] No users found for scope, returning empty message`);
      return `${leaderboard.data_period.charAt(0).toUpperCase() + leaderboard.data_period.slice(1)} Leaderboard Update\n\nNo users found for the selected scope.`;
    }

    // Generate leaderboard data for each metric and each period
    const leaderboardsByPeriodAndMetric = {};
    
    for (const metric of metrics) {
      console.log(`[LEADERBOARD] Processing metric: ${metric}`);
      
      for (const period of dataPeriods) {
        console.log(`[LEADERBOARD] Processing period: ${period}`);
        
        // Initialize period object if it doesn't exist
        if (!leaderboardsByPeriodAndMetric[period]) {
          leaderboardsByPeriodAndMetric[period] = {};
        }
        
        // Get date range based on data period
        const dateRange = getDateRangeForPeriod(period);
        console.log(`[LEADERBOARD] Date range for ${period}:`, dateRange);
        
        const leaderboardData = await getLeaderboardData(userIds, metric, dateRange, leaderboard.top_count, leaderboard.scope);
        console.log(`[LEADERBOARD] Leaderboard data for ${metric} (${period}):`, leaderboardData);
        
        if (leaderboardData.length > 0) {
          const metricName = getMetricDisplayName(metric);
          const periodName = getPeriodDisplayName(period, dateRange);
          let section = `${periodName}\n${metricName}\n`;
          
          leaderboardData.forEach((entry, index) => {
            const rank = index + 1;
            const value = entry.total || 0;
            
            // Format value based on metric type
            let formattedValue;
            if (metric === 'alp' || metric === 'refALP') {
              // Format ALP values as currency
              formattedValue = `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            } else {
              // For non-ALP metrics, use regular number formatting
              formattedValue = value.toLocaleString();
            }
            
            // Use different formatting based on scope
            let displayName;
            if (leaderboard.scope === 'rga_team') {
              displayName = formatDisplayNameForRGA(entry.lagnname, entry.mga, entry.clname);
            } else if (leaderboard.scope === 'family_tree' || leaderboard.scope === 'full_agency') {
              displayName = formatDisplayNameForTree(entry.lagnname, entry.mga, entry.clname);
            } else {
              displayName = formatDisplayName(entry.lagnname);
            }
            
            section += `${rank}. ${displayName} - ${formattedValue}\n`;
          });
          
          leaderboardsByPeriodAndMetric[period][metric] = section;
          console.log(`[LEADERBOARD] Added section for ${metric} (${period})`);
        } else {
          console.log(`[LEADERBOARD] No data found for metric: ${metric} (${period})`);
        }
      }
    }

    // Check if we have any data
    const allSections = Object.values(leaderboardsByPeriodAndMetric)
      .map(periodData => Object.values(periodData)).flat();
    if (allSections.length === 0) {
      console.log(`[LEADERBOARD] No leaderboard sections generated, returning empty activity message`);
      return `Leaderboard Update\n\nNo activity data found for the selected period(s).`;
    }

    // Create separate messages for each metric within each period
    const messages = [];
    
    for (const period of dataPeriods) {
      if (leaderboardsByPeriodAndMetric[period]) {
        for (const metric of metrics) {
          if (leaderboardsByPeriodAndMetric[period][metric]) {
            const section = leaderboardsByPeriodAndMetric[period][metric];
            const message = `Leaderboard Update\n\n${section}`;
            messages.push(message);
          }
        }
      }
    }
    
    if (messages.length === 0) {
      console.log(`[LEADERBOARD] No messages generated, returning empty activity message`);
      return `Leaderboard Update\n\nNo activity data found for the selected period(s).`;
    }
    
    if (messages.length === 1) {
      // Single message, return as string for backwards compatibility
      console.log(`[LEADERBOARD] Single message generated:`, messages[0]);
      return messages[0];
    } else {
      // Multiple messages, return as array
      console.log(`[LEADERBOARD] Generated ${messages.length} separate messages`);
      return messages;
    }
    
  } catch (error) {
    console.error('[LEADERBOARD] Error generating leaderboard message:', error);
    throw error;
  }
}

// Helper function to get users based on scope
async function getUsersForScope(managerId, scope) {
  try {
    console.log(`[LEADERBOARD] Getting users for scope: ${scope}, managerId: ${managerId}`);
    
    switch (scope) {
      case 'mga_team':
        console.log(`[LEADERBOARD] Processing MGA team scope for manager ID: ${managerId}`);
        
        // Get manager's lagnname
        const managerResult = await db.query(
          'SELECT lagnname FROM activeusers WHERE id = ?',
          [managerId]
        );
        
        console.log(`[LEADERBOARD] Manager query result:`, managerResult);
        
        if (!managerResult || managerResult.length === 0) {
          console.warn(`[LEADERBOARD] Manager not found for ID: ${managerId}`);
          return [];
        }
        
        const lagnname = managerResult[0].lagnname;
        console.log(`[LEADERBOARD] Manager lagnname: ${lagnname}`);
        
        // Get all users where mga = manager's lagnname
        const teamResult = await db.query(
          'SELECT id FROM activeusers WHERE mga = ? AND Active = "y"',
          [lagnname]
        );
        
        console.log(`[LEADERBOARD] Team query result for mga='${lagnname}':`, teamResult);
        
        const teamUserIds = teamResult.map(user => user.id);
        console.log(`[LEADERBOARD] Final team user IDs array:`, teamUserIds);
        
        return teamUserIds;
        
      case 'rga_team':
        console.log(`[LEADERBOARD] Processing RGA team scope for manager ID: ${managerId}`);
        
        // Get manager's lagnname from activeusers
        const rgaManagerResult = await db.query(
          'SELECT lagnname FROM activeusers WHERE id = ?',
          [managerId]
        );
        
        console.log(`[LEADERBOARD] RGA Manager query result:`, rgaManagerResult);
        
        if (!rgaManagerResult || rgaManagerResult.length === 0) {
          console.warn(`[LEADERBOARD] RGA Manager not found for ID: ${managerId}`);
          return [];
        }
        
        const rgaLagnname = rgaManagerResult[0].lagnname;
        console.log(`[LEADERBOARD] RGA Manager lagnname: ${rgaLagnname}`);
        
        // Step 1: Get the RGA manager's own team members (same as MGA team logic)
        const rgaOwnTeamResult = await db.query(
          'SELECT id FROM activeusers WHERE mga = ? AND Active = "y"',
          [rgaLagnname]
        );
        
        console.log(`[LEADERBOARD] RGA manager's own team members:`, rgaOwnTeamResult);
        
        const allTeamUserIds = rgaOwnTeamResult.map(user => user.id);
        
        // Step 2: Find all MGA managers that report to this RGA manager
        const mgaManagersResult = await db.query(
          `SELECT m.lagnname 
           FROM MGAs m
           WHERE m.RGA = ?`,
          [rgaLagnname]
        );
        
        console.log(`[LEADERBOARD] MGA managers under RGA ${rgaLagnname}:`, mgaManagersResult);
        
        if (mgaManagersResult && mgaManagersResult.length > 0) {
          // Step 3: For each MGA manager, get all their team members
          for (const mgaManager of mgaManagersResult) {
            const mgaLagnname = mgaManager.lagnname;
            console.log(`[LEADERBOARD] Getting team members for MGA: ${mgaLagnname}`);
            
            // Get all users where mga = MGA manager's lagnname (same as MGA team logic)
            const teamResult = await db.query(
              'SELECT id FROM activeusers WHERE mga = ? AND Active = "y"',
              [mgaLagnname]
            );
            
            console.log(`[LEADERBOARD] Team members for MGA ${mgaLagnname}:`, teamResult);
            
            const teamUserIds = teamResult.map(user => user.id);
            allTeamUserIds.push(...teamUserIds);
          }
        }
        
        console.log(`[LEADERBOARD] Final RGA team user IDs array (total: ${allTeamUserIds.length}):`, allTeamUserIds);
        
        return allTeamUserIds;
        
      case 'family_tree':
        console.log(`[LEADERBOARD] Processing family tree scope for manager ID: ${managerId}`);
        
        // Get manager's lagnname from activeusers
        const treeManagerResult = await db.query(
          'SELECT lagnname FROM activeusers WHERE id = ?',
          [managerId]
        );
        
        console.log(`[LEADERBOARD] Tree Manager query result:`, treeManagerResult);
        
        if (!treeManagerResult || treeManagerResult.length === 0) {
          console.warn(`[LEADERBOARD] Tree Manager not found for ID: ${managerId}`);
          return [];
        }
        
        const treeLagnname = treeManagerResult[0].lagnname;
        console.log(`[LEADERBOARD] Tree Manager lagnname: ${treeLagnname}`);
        
        // Step 1: Get the Tree manager's own team members (same as MGA team logic)
        const treeOwnTeamResult = await db.query(
          'SELECT id FROM activeusers WHERE mga = ? AND Active = "y"',
          [treeLagnname]
        );
        
        console.log(`[LEADERBOARD] Tree manager's own team members:`, treeOwnTeamResult);
        
        const allTreeUserIds = treeOwnTeamResult.map(user => user.id);
        
        // Step 2: Find all MGA managers that are in the same tree
        const treeMgaManagersResult = await db.query(
          `SELECT m.lagnname 
           FROM MGAs m
           WHERE m.tree = ?`,
          [treeLagnname]
        );
        
        console.log(`[LEADERBOARD] MGA managers in tree ${treeLagnname}:`, treeMgaManagersResult);
        
        if (treeMgaManagersResult && treeMgaManagersResult.length > 0) {
          // Step 3: For each MGA manager in the tree, get all their team members
          for (const mgaManager of treeMgaManagersResult) {
            const mgaLagnname = mgaManager.lagnname;
            console.log(`[LEADERBOARD] Getting team members for MGA in tree: ${mgaLagnname}`);
            
            // Get all users where mga = MGA manager's lagnname (same as MGA team logic)
            const teamResult = await db.query(
              'SELECT id FROM activeusers WHERE mga = ? AND Active = "y"',
              [mgaLagnname]
            );
            
            console.log(`[LEADERBOARD] Team members for MGA ${mgaLagnname}:`, teamResult);
            
            const teamUserIds = teamResult.map(user => user.id);
            allTreeUserIds.push(...teamUserIds);
          }
        }
        
        console.log(`[LEADERBOARD] Final Tree team user IDs array (total: ${allTreeUserIds.length}):`, allTreeUserIds);
        
        return allTreeUserIds;
        
      case 'agency_tree':
        console.log(`[LEADERBOARD] Processing agency tree scope (fallback to MGA team)`);
        // For agency tree, get all users under the manager's hierarchy
        // For now, return the same as MGA team - this can be expanded later
        return getUsersForScope(managerId, 'mga_team');
        
      case 'full_agency':
        console.log(`[LEADERBOARD] Processing full agency scope`);
        // Get all active users in the agency
        const allUsersResult = await db.query(
          'SELECT id FROM activeusers WHERE Active = "y"'
        );
        
        console.log(`[LEADERBOARD] Full agency query result:`, allUsersResult);
        
        const allUserIds = allUsersResult.map(user => user.id);
        console.log(`[LEADERBOARD] Full agency user IDs array (count: ${allUserIds.length}):`, allUserIds);
        
        return allUserIds;
        
      default:
        console.warn(`[LEADERBOARD] Unknown scope: ${scope}, defaulting to MGA team`);
        return getUsersForScope(managerId, 'mga_team');
    }
  } catch (error) {
    console.error('[LEADERBOARD] Error getting users for scope:', error);
    return [];
  }
}

// Helper function to get date range for period
function getDateRangeForPeriod(period) {
  const now = new Date();
  let startDate, endDate;
  
  switch (period) {
    case 'daily':
      // Current day
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
      
    case 'weekly':
      // Current week (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday (0), go back 6 days to Monday
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 7);
      break;
      
    case 'monthly':
      // Current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
      
    default:
      // Default to daily
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  
  // Format dates as YYYY-MM-DD for SQL
  const formatDate = (date) => {
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  };
  
  return {
    start: formatDate(startDate),
    end: formatDate(endDate)
  };
}

// Helper function to get leaderboard data for a specific metric
async function getLeaderboardData(userIds, metric, dateRange, topCount, scope = null) {
  try {
    console.log(`[LEADERBOARD] Getting leaderboard data for metric: ${metric}`);
    console.log(`[LEADERBOARD] User IDs (${userIds.length}):`, userIds);
    console.log(`[LEADERBOARD] Date range:`, dateRange);
    console.log(`[LEADERBOARD] Top count:`, topCount);
    console.log(`[LEADERBOARD] Scope:`, scope);
    
    // Validate metric column
    const validMetrics = ['calls', 'appts', 'sits', 'sales', 'alp', 'refs', 'refALP'];
    if (!validMetrics.includes(metric)) {
      console.warn(`[LEADERBOARD] Invalid metric: ${metric}`);
      return [];
    }
    
    let query, params;
    
    if (scope === 'full_agency') {
      // For full agency, get all data from Daily_Activity without filtering by specific userIds
      console.log(`[LEADERBOARD] Using full agency query (no user filtering)`);
      
      // Include mga field and clname for full agency scope for consistent formatting
      const selectFields = 'u.lagnname, u.id as user_id, u.mga, u.clname, SUM(d.' + metric + ') as total';
      
      query = `
        SELECT 
          ${selectFields}
        FROM activeusers u
        LEFT JOIN Daily_Activity d ON u.id = d.userId 
          AND d.reportDate >= ? 
          AND d.reportDate < ?
        WHERE u.Active = 'y'
        GROUP BY u.id, u.lagnname, u.mga, u.clname
        HAVING total > 0
        ORDER BY total DESC
        LIMIT ?
      `;
      
      params = [dateRange.start, dateRange.end, parseInt(topCount) || 10];
    } else {
      // For other scopes, filter by specific user IDs
      if (userIds.length === 0) {
        console.log(`[LEADERBOARD] No user IDs provided, returning empty array`);
        return [];
      }
      
      // Create placeholders for the IN clause
      const placeholders = userIds.map(() => '?').join(',');
      
      // Include mga field for RGA team and Tree scope
      const selectFields = (scope === 'rga_team' || scope === 'family_tree')
        ? 'u.lagnname, u.id as user_id, u.mga, u.clname, SUM(d.' + metric + ') as total'
        : 'u.lagnname, u.id as user_id, SUM(d.' + metric + ') as total';
      
      query = `
        SELECT 
          ${selectFields}
        FROM activeusers u
        LEFT JOIN Daily_Activity d ON u.id = d.userId 
          AND d.reportDate >= ? 
          AND d.reportDate < ?
        WHERE u.id IN (${placeholders})
        GROUP BY u.id, u.lagnname${(scope === 'rga_team' || scope === 'family_tree') ? ', u.mga, u.clname' : ''}
        HAVING total > 0
        ORDER BY total DESC
        LIMIT ?
      `;
      
      params = [dateRange.start, dateRange.end, ...userIds, parseInt(topCount) || 10];
    }
    
    console.log(`[LEADERBOARD] Executing query:`, query);
    console.log(`[LEADERBOARD] Query params:`, params);
    
    const results = await db.query(query, params);
    
    console.log(`[LEADERBOARD] Query returned ${results?.length || 0} results for ${metric}:`, results);
    
    return results || [];
    
  } catch (error) {
    console.error(`[LEADERBOARD] Error getting leaderboard data for metric ${metric}:`, error);
    return [];
  }
}

// Helper function to get display name for metric
function getMetricDisplayName(metric) {
  const metricNames = {
    'calls': 'Calls',
    'appts': 'Appointments',
    'sits': 'Sits',
    'sales': 'Sales',
    'alp': 'ALP',
    'refs': 'Referrals',
    'refALP': 'Referral ALP'
  };
  
  return metricNames[metric] || metric;
}

// Helper function to get display name for period with dates
function getPeriodDisplayName(period, dateRange) {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  
  switch (period) {
    case 'daily':
      // Format: "Daily [MM/DD]"
      const dailyDate = startDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit'
      });
      return `Daily ${dailyDate}`;
      
    case 'weekly':
      // Format: "Weekly [M/D-M/D]"
      const weekStart = startDate.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric'
      });
      const weekEnd = new Date(endDate.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        month: 'numeric', 
        day: 'numeric'
      });
      return `Weekly ${weekStart}-${weekEnd}`;
      
    case 'monthly':
      // Format: "Monthly [MM/DD]" (using start of month)
      const monthlyDate = startDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit'
      });
      return `Monthly ${monthlyDate}`;
      
    default:
      return period;
  }
}

// Helper function to format lagnname from "LAST FIRST MIDDLE SUFFIX" to "FIRST LAST SUFFIX"
function formatDisplayName(lagnname) {
  if (!lagnname) return 'Unknown';
  
  // Split the name into parts
  const parts = lagnname.trim().split(' ');
  
  if (parts.length === 1) {
    // Only one part - return as is
    return parts[0];
  } else if (parts.length === 2) {
    // Two parts - assume "LAST FIRST" format
    const [last, first] = parts;
    return `${first} ${last}`;
  } else if (parts.length === 3) {
    // Three parts - could be "LAST FIRST SUFFIX" or "LAST FIRST MIDDLE"
    const [last, first, third] = parts;
    // Check if third part looks like a suffix (Jr, Sr, III, etc.)
    const suffixes = ['Jr', 'Sr', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    if (suffixes.includes(third)) {
      return `${first} ${last} ${third}`;
    } else {
      // Assume it's a middle name, so we'll use "FIRST LAST"
      return `${first} ${last}`;
    }
  } else if (parts.length >= 4) {
    // Four or more parts - "LAST FIRST MIDDLE SUFFIX" format
    const [last, first, ...middleAndSuffix] = parts;
    const middle = middleAndSuffix.slice(0, -1).join(' ');
    const suffix = middleAndSuffix[middleAndSuffix.length - 1];
    
    // Check if last part looks like a suffix
    const suffixes = ['Jr', 'Sr', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    if (suffixes.includes(suffix)) {
      return `${first} ${last} ${suffix}`;
    } else {
      // If last part isn't a suffix, include it as part of the name
      return `${first} ${last}`;
    }
  }
  
  // Fallback - return original
  return lagnname;
}

// Add a new function to format display name for RGA team scope
function formatDisplayNameForRGA(lagnname, mga, clname) {
  if (!lagnname) return 'Unknown';
  
  // Format the lagnname (person's name)
  const formattedName = formatDisplayName(lagnname);
  
  // Format the MGA (shortened to last name)
  let formattedMGA = 'Unknown MGA';
  
  // If person is their own MGA (clname = 'MGA'), use their own name
  if (clname === 'MGA') {
    const nameParts = lagnname.trim().split(' ');
    if (nameParts.length > 0) {
      formattedMGA = nameParts[0]; // Use their last name
    }
  } else if (mga && mga.trim() !== '') {
    const mgaParts = mga.trim().split(' ');
    if (mgaParts.length > 0) {
      // Take just the last name from the MGA
      formattedMGA = mgaParts[0];
    }
  } else {
    // If MGA is empty or unknown, use the person's last name
    const nameParts = lagnname.trim().split(' ');
    if (nameParts.length > 0) {
      formattedMGA = nameParts[0]; // Use their last name
    }
  }
  
  return `${formattedName} - ${formattedMGA}`;
}

// Add a new function to format display name for Tree scope
function formatDisplayNameForTree(lagnname, mga, clname) {
  if (!lagnname) return 'Unknown';
  
  // Format the lagnname (person's name)
  const formattedName = formatDisplayName(lagnname);
  
  // Format the MGA (shortened to last name from mga)
  let formattedMGA = 'Unknown MGA';
  
  // If person is their own MGA (clname = 'MGA'), use their own name
  if (clname === 'MGA') {
    const nameParts = lagnname.trim().split(' ');
    if (nameParts.length > 0) {
      formattedMGA = nameParts[0]; // Use their last name
    }
  } else if (mga && mga.trim() !== '') {
    const mgaParts = mga.trim().split(' ');
    if (mgaParts.length > 0) {
      // Take just the last name from the MGA
      formattedMGA = mgaParts[0];
    }
  } else {
    // If MGA is empty or unknown, use the person's last name
    const nameParts = lagnname.trim().split(' ');
    if (nameParts.length > 0) {
      formattedMGA = nameParts[0]; // Use their last name
    }
  }
  
  return `${formattedName} - ${formattedMGA}`;
}

// 18) Get sales statistics
router.get('/sales/stats', authMiddleware, async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    let timeFilter;
    switch (period) {
      case '24h':
        timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
        break;
      case '7d':
        timeFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        timeFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        timeFilter = 'DATE_SUB(NOW(), INTERVAL 1 DAY)';
    }

    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM discord_sales ds
      JOIN guild_configs gc ON ds.guild_id = gc.guild_id
      WHERE gc.manager_id = ? AND ds.created_at > ${timeFilter}
    `, [userId]);

    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

// Get a single guild by ID
router.get('/guilds/:guildId', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    const userId = req.userId || req.user?.userId || req.user?.id;
    
    // Check if the user has a Discord token
    const userRows = await db.query('SELECT discord_token FROM activeusers WHERE id = ?', [userId]);
    if (!userRows || userRows.length === 0 || !userRows[0].discord_token) {
      return res.status(401).json({ error: 'Discord account not linked' });
    }
    
    // Get user's Discord token
    const discordToken = userRows[0].discord_token;
    
    // Fetch the guild from Discord API
    try {
      const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${discordToken}` }
      });
      
      // Find the requested guild
      const guild = guildsRes.data.find(g => g.id === guildId);
      
      if (guild) {
        // Add icon URL if available
        if (guild.icon) {
          guild.icon_url = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
        } else {
          guild.icon_url = null;
        }
        
        return res.json({ guild });
      } else {
        // If the guild is not found in the user's guilds, check if it's in our database
        const configRows = await db.query(
          'SELECT guild_id, guild_name FROM guild_configs WHERE guild_id = ? AND manager_id = ?', 
          [guildId, userId]
        );
        
        if (configRows && configRows.length > 0) {
          // Return basic guild info from our database
          return res.json({
            guild: {
              id: configRows[0].guild_id,
              name: configRows[0].guild_name,
              icon_url: null
            }
          });
        }
        
        return res.status(404).json({ error: 'Guild not found' });
      }
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Handle Discord rate limit
        return res.status(429).json({ 
          error: 'Rate limited by Discord API',
          retry_after: error.response.data.retry_after || 5
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching guild:', error);
    res.status(500).json({ error: 'Failed to fetch guild' });
  }
});

// Helper function to get production leaderboard data from Weekly_ALP table
async function getProductionLeaderboardData(userIds, metric, period, topCount, scope = null) {
  try {
    console.log(`[PRODUCTION] Getting production leaderboard data for metric: ${metric}, period: ${period}`);
    console.log(`[PRODUCTION] User IDs (${userIds.length}):`, userIds);
    console.log(`[PRODUCTION] Top count:`, topCount);
    console.log(`[PRODUCTION] Scope:`, scope);
    
    // Validate metric
    const validMetrics = ['net', 'gross'];
    if (!validMetrics.includes(metric)) {
      console.warn(`[PRODUCTION] Invalid metric: ${metric}`);
      return [];
    }
    
    // Map period to REPORT value in Weekly_ALP table
    let reportType;
    switch (period) {
      case 'weekly':
        reportType = 'Weekly Recap';
        break;
      case 'mtd':
        reportType = 'MTD Recap';
        break;
      case 'ytd':
        reportType = 'YTD Recap';
        break;
      default:
        console.warn(`[PRODUCTION] Invalid period: ${period}`);
        return [];
    }
    
    // Determine which column to use based on metric
    const metricColumn = metric === 'net' ? 'LVL_1_NET' : 'LVL_1_GROSS';
    
    let query, params;
    
    if (scope === 'full_agency') {
      // For full agency, get all data without filtering by specific userIds
      console.log(`[PRODUCTION] Using full agency query (no user filtering)`);
      
      // First, get the most recent reportdates for this report type (top 2 to capture both branches)
      const maxDateQuery = `
        SELECT DISTINCT reportdate
        FROM Weekly_ALP 
        WHERE REPORT = ?
        ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
        LIMIT 2
      `;
      
      const maxDateResult = await db.query(maxDateQuery, [reportType]);
      
      if (!maxDateResult || maxDateResult.length === 0) {
        console.log(`[PRODUCTION] No data found for report type: ${reportType}`);
        return [];
      }
      
      let recentReportDates = [];
      
      if (maxDateResult.length === 1) {
        // Only one date available, use it
        recentReportDates = [maxDateResult[0].reportdate];
        console.log(`[PRODUCTION] Only one reportdate found for ${reportType}: ${recentReportDates[0]}`);
      } else {
        // Two dates available, check if they're within 3 days of each other
        const mostRecentDate = new Date(maxDateResult[0].reportdate);
        const secondMostRecentDate = new Date(maxDateResult[1].reportdate);
        
        // Calculate the difference in days
        const timeDiff = Math.abs(mostRecentDate.getTime() - secondMostRecentDate.getTime());
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        console.log(`[PRODUCTION] Date comparison for ${reportType}: ${maxDateResult[0].reportdate} vs ${maxDateResult[1].reportdate} (${daysDiff} days apart)`);
        
        if (daysDiff <= 3) {
          // Dates are within 3 days, use both
          recentReportDates = [maxDateResult[0].reportdate, maxDateResult[1].reportdate];
          console.log(`[PRODUCTION] Using both dates (within 3 days): ${recentReportDates.join(', ')}`);
        } else {
          // Dates are more than 3 days apart, use only the most recent
          recentReportDates = [maxDateResult[0].reportdate];
          console.log(`[PRODUCTION] Using only most recent date (more than 3 days apart): ${recentReportDates[0]}`);
        }
      }
      
      // Create placeholders for the IN clause
      const datePlaceholders = recentReportDates.map(() => '?').join(',');
      
      query = `
        SELECT 
          w.LagnName, 
          w.MGA_NAME, 
          au.clname,
          SUM(w.${metricColumn}) as total
        FROM Weekly_ALP w
        LEFT JOIN activeusers au ON w.LagnName = au.lagnname
        WHERE w.REPORT = ?
        AND w.reportdate IN (${datePlaceholders})
        AND w.${metricColumn} IS NOT NULL
        AND w.${metricColumn} > 0
        AND au.Active = 'y'
        GROUP BY w.LagnName, w.MGA_NAME, au.clname
        ORDER BY total DESC
        LIMIT ?
      `;
      
      params = [reportType, ...recentReportDates, parseInt(topCount) || 10];
    } else {
      // For other scopes, filter by specific user IDs
      if (userIds.length === 0) {
        console.log(`[PRODUCTION] No user IDs provided, returning empty array`);
        return [];
      }
      
              // First, get the most recent reportdates for this report type (top 2 to capture both branches)
        const maxDateQuery = `
          SELECT DISTINCT reportdate
          FROM Weekly_ALP 
          WHERE REPORT = ?
          ORDER BY STR_TO_DATE(reportdate, '%m/%d/%Y') DESC
          LIMIT 2
        `;
        
        const maxDateResult = await db.query(maxDateQuery, [reportType]);
        
        if (!maxDateResult || maxDateResult.length === 0) {
          console.log(`[PRODUCTION] No data found for report type: ${reportType}`);
          return [];
        }
        
        let recentReportDates = [];
        
        if (maxDateResult.length === 1) {
          // Only one date available, use it
          recentReportDates = [maxDateResult[0].reportdate];
          console.log(`[PRODUCTION] Only one reportdate found for ${reportType}: ${recentReportDates[0]}`);
        } else {
          // Two dates available, check if they're within 3 days of each other
          const mostRecentDate = new Date(maxDateResult[0].reportdate);
          const secondMostRecentDate = new Date(maxDateResult[1].reportdate);
          
          // Calculate the difference in days
          const timeDiff = Math.abs(mostRecentDate.getTime() - secondMostRecentDate.getTime());
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          console.log(`[PRODUCTION] Date comparison for ${reportType}: ${maxDateResult[0].reportdate} vs ${maxDateResult[1].reportdate} (${daysDiff} days apart)`);
          
          if (daysDiff <= 3) {
            // Dates are within 3 days, use both
            recentReportDates = [maxDateResult[0].reportdate, maxDateResult[1].reportdate];
            console.log(`[PRODUCTION] Using both dates (within 3 days): ${recentReportDates.join(', ')}`);
          } else {
            // Dates are more than 3 days apart, use only the most recent
            recentReportDates = [maxDateResult[0].reportdate];
            console.log(`[PRODUCTION] Using only most recent date (more than 3 days apart): ${recentReportDates[0]}`);
          }
        }
        
        // Create placeholders for the IN clause
        const datePlaceholders = recentReportDates.map(() => '?').join(',');
      
      // Get lagnnames for the user IDs
      const placeholders = userIds.map(() => '?').join(',');
      const lagnameResult = await db.query(
        `SELECT lagnname FROM activeusers WHERE id IN (${placeholders})`,
        userIds
      );
      
      const lagnnames = lagnameResult.map(row => row.lagnname);
      
      if (lagnnames.length === 0) {
        console.log(`[PRODUCTION] No lagnnames found for user IDs, returning empty array`);
        return [];
      }
      
      const lagnamePlaceholders = lagnnames.map(() => '?').join(',');
      
              query = `
          SELECT 
            w.LagnName, 
            w.MGA_NAME, 
            au.clname,
            SUM(w.${metricColumn}) as total
          FROM Weekly_ALP w
          LEFT JOIN activeusers au ON w.LagnName = au.lagnname
          WHERE w.REPORT = ?
          AND w.reportdate IN (${datePlaceholders})
          AND w.LagnName IN (${lagnamePlaceholders})
          AND w.${metricColumn} IS NOT NULL
          AND w.${metricColumn} > 0
          GROUP BY w.LagnName, w.MGA_NAME, au.clname
          ORDER BY total DESC
          LIMIT ?
        `;
        
        params = [reportType, ...recentReportDates, ...lagnnames, parseInt(topCount) || 10];
    }
    
    console.log(`[PRODUCTION] Executing query:`, query);
    console.log(`[PRODUCTION] Query params:`, params);
    
    const results = await db.query(query, params);
    
    console.log(`[PRODUCTION] Query returned ${results?.length || 0} results for ${metric} (${period}):`, results);
    
    return results || [];
    
  } catch (error) {
    console.error(`[PRODUCTION] Error getting production leaderboard data for metric ${metric}:`, error);
    return [];
  }
}

// Helper function to get display name for production metrics
function getProductionMetricDisplayName(metric) {
  const metricNames = {
    'net': 'Net Production',
    'gross': 'Gross Production'
  };
  
  return metricNames[metric] || metric;
}

// Helper function to get display name for production periods
function getProductionPeriodDisplayName(period) {
  const periodNames = {
    'weekly': 'Weekly Production',
    'mtd': 'Month to Date Production', 
    'ytd': 'Year to Date Production'
  };
  
  return periodNames[period] || period;
}

module.exports = router;

// Export helper functions for use by the bot scheduler
module.exports.generateLeaderboardMessage = generateLeaderboardMessage;

// Helper function to generate production leaderboard message using Weekly_ALP table
async function generateProductionLeaderboardMessage(leaderboard) {
  try {
    console.log(`[PRODUCTION] Generating production leaderboard message for leaderboard ID: ${leaderboard.id}`);
    
    // Parse metrics if it's a JSON string
    let metrics = leaderboard.metrics;
    if (typeof metrics === 'string') {
      try {
        metrics = JSON.parse(metrics);
      } catch (e) {
        console.warn('[PRODUCTION] Error parsing metrics JSON:', e);
        metrics = ['net'];
      }
    }
    
    if (!Array.isArray(metrics) || metrics.length === 0) {
      metrics = ['net'];
    }

    console.log(`[PRODUCTION] Parsed metrics:`, metrics);

    // Parse data_period if it's a JSON string
    let dataPeriods = leaderboard.data_period;
    if (typeof dataPeriods === 'string') {
      try {
        dataPeriods = JSON.parse(dataPeriods);
      } catch (e) {
        console.warn('[PRODUCTION] Error parsing data_period JSON:', e);
        dataPeriods = ['weekly'];
      }
    }

    if (!Array.isArray(dataPeriods) || dataPeriods.length === 0) {
      dataPeriods = ['weekly'];
    }

    console.log(`[PRODUCTION] Parsed data periods:`, dataPeriods);

    // Get users based on scope (reuse existing logic)
    const userIds = await getUsersForScope(leaderboard.manager_id, leaderboard.scope);
    
    console.log(`[PRODUCTION] Retrieved ${userIds.length} user IDs for scope processing`);
    
    if (userIds.length === 0) {
      console.log(`[PRODUCTION] No users found for scope, returning empty message`);
      return `Production Leaderboard Update\n\nNo users found for the selected scope.`;
    }

    // Generate leaderboard data for each metric and each period
    const leaderboardsByPeriodAndMetric = {};
    
    for (const metric of metrics) {
      console.log(`[PRODUCTION] Processing metric: ${metric}`);
      
      for (const period of dataPeriods) {
        console.log(`[PRODUCTION] Processing period: ${period}`);
        
        // Initialize period object if it doesn't exist
        if (!leaderboardsByPeriodAndMetric[period]) {
          leaderboardsByPeriodAndMetric[period] = {};
        }
        
        const leaderboardData = await getProductionLeaderboardData(userIds, metric, period, leaderboard.top_count, leaderboard.scope);
        console.log(`[PRODUCTION] Leaderboard data for ${metric} (${period}):`, leaderboardData);
        
        if (leaderboardData.length > 0) {
          const metricName = getProductionMetricDisplayName(metric);
          const periodName = getProductionPeriodDisplayName(period);
          let section = `${periodName}\n${metricName}\n`;
          
          leaderboardData.forEach((entry, index) => {
            const rank = index + 1;
            const value = entry.total || 0;
            
            // Format value as currency for production data
            const formattedValue = `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            // Use same formatting as activity leaderboards based on scope
            let displayName;
            if (leaderboard.scope === 'rga_team') {
              displayName = formatDisplayNameForRGA(entry.LagnName, entry.MGA_NAME, entry.clname);
            } else if (leaderboard.scope === 'family_tree' || leaderboard.scope === 'full_agency') {
              displayName = formatDisplayNameForTree(entry.LagnName, entry.MGA_NAME, entry.clname);
            } else {
              displayName = formatDisplayName(entry.LagnName);
            }
            
            section += `${rank}. ${displayName} - ${formattedValue}\n`;
          });
          
          leaderboardsByPeriodAndMetric[period][metric] = section;
          console.log(`[PRODUCTION] Added section for ${metric} (${period})`);
        } else {
          console.log(`[PRODUCTION] No data found for metric: ${metric} (${period})`);
        }
      }
    }

    // Check if we have any data
    const allSections = Object.values(leaderboardsByPeriodAndMetric)
      .map(periodData => Object.values(periodData)).flat();
    if (allSections.length === 0) {
      console.log(`[PRODUCTION] No leaderboard sections generated, returning empty production message`);
      return `Production Leaderboard Update\n\nNo production data found for the selected period(s).`;
    }

    // Create separate messages for each metric within each period
    const messages = [];
    
    for (const period of dataPeriods) {
      if (leaderboardsByPeriodAndMetric[period]) {
        for (const metric of metrics) {
          if (leaderboardsByPeriodAndMetric[period][metric]) {
            const section = leaderboardsByPeriodAndMetric[period][metric];
            const message = `Production Leaderboard Update\n\n${section}`;
            messages.push(message);
          }
        }
      }
    }
    
    if (messages.length === 0) {
      console.log(`[PRODUCTION] No messages generated, returning empty production message`);
      return `Production Leaderboard Update\n\nNo production data found for the selected period(s).`;
    }
    
    if (messages.length === 1) {
      // Single message, return as string for backwards compatibility
      console.log(`[PRODUCTION] Single message generated:`, messages[0]);
      return messages[0];
    } else {
      // Multiple messages, return as array
      console.log(`[PRODUCTION] Generated ${messages.length} separate messages`);
      return messages;
    }
    
  } catch (error) {
    console.error('[PRODUCTION] Error generating production leaderboard message:', error);
    throw error;
  }
}

// Helper function to get users based on scope

// Check Discord bot status
router.get('/bot/status', async (req, res) => {
  try {
    const client = require('../bot').getClient();
    
    if (!client) {
      return res.json({
        status: 'not_initialized',
        ready: false,
        message: 'Bot client is not initialized'
      });
    }
    
    const status = {
      status: client.isReady() ? 'ready' : 'not_ready',
      ready: client.isReady(),
      user: client.user ? {
        tag: client.user.tag,
        id: client.user.id
      } : null,
      readyAt: client.readyAt,
      uptime: client.uptime,
      ping: client.ws.ping,
      guilds: client.guilds.cache.size
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ 
      error: 'Failed to get bot status',
      details: error.message
    });
  }
});

/**
 * @route GET /api/discord/sales/user-sales
 * @desc Get discord sales for a specific user and date range
 * @access Private
 */
router.get('/sales/user-sales', async (req, res) => {
  try {
    const { startDate, endDate, userId: queryUserId } = req.query;
    
    console.log(`[DISCORD-SALES-API] 🔍 Auth debugging:`, {
      hasReqUser: !!req.user,
      hasReqUserId: !!req.userId,
      queryUserId,
      userObject: req.user,
      userId: req.userId,
      authHeader: req.headers.authorization,
      cookies: req.headers.cookie
    });
    
    // For now, use a fallback to test user (21 - COLEMAN CHARLES) or query param
    // Ensure userId is a single value, not an array
    let userId = req.user?.userId || req.userId || queryUserId || 21;
    if (Array.isArray(userId)) {
      userId = userId[0]; // Take first element if it's an array
    }
    userId = String(userId); // Ensure it's a string

    console.log(`[DISCORD-SALES-API] Starting user-sales request for user ${userId} (fallback: 21)`);
    console.log(`[DISCORD-SALES-API] Date range: ${startDate} to ${endDate}`);

    if (!startDate || !endDate) {
      console.log(`[DISCORD-SALES-API] ❌ Missing required parameters - startDate: ${startDate}, endDate: ${endDate}`);
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const query = `
      SELECT 
        ds.id,
        ds.discord_user,
        ds.guild_id,
        ds.alp,
        ds.refs,
        ds.lead_type,
        ds.image_url,
        ds.ts,
        ds.user_id,
        DATE(ds.ts) as sale_date,
        au.lagnname
      FROM discord_sales ds
      LEFT JOIN activeusers au ON ds.user_id = au.id
      WHERE ds.user_id = ? 
        AND DATE(ds.ts) >= ? 
        AND DATE(ds.ts) <= ?
      ORDER BY ds.ts DESC
    `;

    console.log(`[DISCORD-SALES-API] Executing query with parameters: [${userId}, ${startDate}, ${endDate}]`);
    console.log(`[DISCORD-SALES-API] Query: ${query.replace(/\s+/g, ' ').trim()}`);

    // First, let's check if there's ANY discord_sales data for this user
    console.log(`[DISCORD-SALES-API] 🐛 About to query with userId:`, { 
      userId, 
      userIdType: typeof userId, 
      userIdArray: [userId],
      userIdStringified: JSON.stringify([userId])
    });
    
    const userSalesCount = await db.query(
      'SELECT COUNT(*) as total_sales, MIN(ts) as earliest_sale, MAX(ts) as latest_sale FROM discord_sales WHERE user_id = ?',
      [userId]
    );
    
    console.log(`[DISCORD-SALES-API] User ${userId} total discord sales in database:`, userSalesCount[0]);

    // Also check if there are ANY discord_sales records in the database at all
    const totalSalesCount = await db.query(
      'SELECT COUNT(*) as total_count, COUNT(DISTINCT user_id) as unique_users, MIN(ts) as earliest, MAX(ts) as latest FROM discord_sales'
    );
    
    console.log(`[DISCORD-SALES-API] Total discord sales in database:`, totalSalesCount[0]);

    // Also check the date range we're looking for
    console.log(`[DISCORD-SALES-API] Looking for sales between ${startDate} and ${endDate}`);
    console.log(`[DISCORD-SALES-API] Date comparison: DATE(ts) >= '${startDate}' AND DATE(ts) <= '${endDate}'`);

    // Test the date formatting to see what DATE(ts) actually returns
    if (userSalesCount[0].total_sales > 0) {
      const dateFormatTest = await db.query(
        'SELECT ts, DATE(ts) as date_only, DATE_FORMAT(ts, "%Y-%m-%d") as formatted_date FROM discord_sales WHERE user_id = ? LIMIT 3',
        [userId]
      );
      
      console.log(`[DISCORD-SALES-API] Date format samples for user ${userId}:`, dateFormatTest);
    }

    const salesData = await db.query(query, [userId, startDate, endDate]);

    console.log(`[DISCORD-SALES-API] ✅ Query executed successfully`);
    console.log(`[DISCORD-SALES-API] Raw query result count: ${salesData ? salesData.length : 'null'}`);
    
    if (salesData && salesData.length > 0) {
      console.log(`[DISCORD-SALES-API] Sample record:`, {
        id: salesData[0].id,
        sale_date: salesData[0].sale_date,
        alp: salesData[0].alp,
        refs: salesData[0].refs,
        lead_type: salesData[0].lead_type,
        ts: salesData[0].ts,
        lagnname: salesData[0].lagnname
      });
      
      // Group by date for logging
      const dateGroups = {};
      salesData.forEach(sale => {
        const date = sale.sale_date;
        if (!dateGroups[date]) dateGroups[date] = 0;
        dateGroups[date]++;
      });
      
      console.log(`[DISCORD-SALES-API] Sales by date:`, dateGroups);
    } else {
      console.log(`[DISCORD-SALES-API] ⚠️ No sales data found for user ${userId} between ${startDate} and ${endDate}`);
    }

    const response = {
      success: true,
      data: salesData || []
    };

    console.log(`[DISCORD-SALES-API] Sending response with ${response.data.length} records`);

    res.json(response);

  } catch (error) {
    console.error(`[DISCORD-SALES-API] ❌ Error fetching discord sales:`, error);
    console.error(`[DISCORD-SALES-API] Error stack:`, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discord sales data'
    });
  }
});

/**
 * @route PUT /api/discord/sales/:id
 * @desc Update a discord sale record
 * @access Private
 */
router.put('/sales/:id', authMiddleware, async (req, res) => {
  try {
    const saleId = req.params.id;
    const userId = req.user?.userId || req.userId; // Support both formats
    const { alp, refs, lead_type } = req.body;

    // Validate the sale belongs to the user
    const existingSale = await db.query(
      'SELECT * FROM discord_sales WHERE id = ? AND user_id = ?',
      [saleId, userId]
    );

    if (!existingSale || existingSale.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found or access denied'
      });
    }

    // Update the sale
    await db.query(
      `UPDATE discord_sales 
       SET alp = ?, refs = ?, lead_type = ?
       WHERE id = ? AND user_id = ?`,
      [alp, refs, lead_type, saleId, userId]
    );

    // Update Daily_Activity table after modifying the sale
    const saleRecord = await db.query(
      'SELECT DATE(ts) as sale_date FROM discord_sales WHERE id = ?',
      [saleId]
    );
    
    if (saleRecord && saleRecord.length > 0) {
      const saleDate = saleRecord[0].sale_date;
      await updateDailyActivityFromDiscordSales(userId, saleDate);
    }

    res.json({
      success: true,
      message: 'Discord sale updated successfully'
    });

  } catch (error) {
    console.error('Error updating discord sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update discord sale'
    });
  }
});

/**
 * @route DELETE /api/discord/sales/:id
 * @desc Delete a discord sale record
 * @access Private
 */
router.delete('/sales/:id', authMiddleware, async (req, res) => {
  try {
    const saleId = req.params.id;
    const userId = req.user?.userId || req.userId; // Support both formats

    // Validate the sale belongs to the user
    const existingSale = await db.query(
      'SELECT * FROM discord_sales WHERE id = ? AND user_id = ?',
      [saleId, userId]
    );

    if (!existingSale || existingSale.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found or access denied'
      });
    }

    // Get the sale date before deleting for Daily_Activity update
    const saleDate = existingSale[0].ts ? new Date(existingSale[0].ts).toISOString().split('T')[0] : null;

    // Delete the sale
    await db.query(
      'DELETE FROM discord_sales WHERE id = ? AND user_id = ?',
      [saleId, userId]
    );

    // Update Daily_Activity table after deleting the sale
    if (saleDate) {
      await updateDailyActivityFromDiscordSales(userId, saleDate);
    }

    res.json({
      success: true,
      message: 'Discord sale deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting discord sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete discord sale'
    });
  }
});

/**
 * Update Daily_Activity table with aggregated Discord sales data
 * @param {number} userId - The user ID
 * @param {string} saleDate - The sale date in YYYY-MM-DD format
 */
async function updateDailyActivityFromDiscordSales(userId, saleDate) {
  try {
    console.log(`[DISCORD-API] 📊 Updating Daily_Activity for user ${userId} on ${saleDate}`);

    // Get user details from activeusers
    const userDetails = await db.query(
      'SELECT lagnname, esid, MGA, SA, GA FROM activeusers WHERE id = ?',
      [userId]
    );

    if (!userDetails || userDetails.length === 0) {
      console.error(`[DISCORD-API] ❌ User ${userId} not found in activeusers table`);
      return;
    }

    const user = userDetails[0];

    // Aggregate Discord sales for this user and date
    const salesAggregation = await db.query(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(alp) as total_alp,
        SUM(refs) as total_refs
      FROM discord_sales 
      WHERE user_id = ? AND DATE(ts) = ?
    `, [userId, saleDate]);

    const salesData = salesAggregation[0];
    console.log(`[DISCORD-API] 📈 Discord sales aggregation for ${saleDate}:`, salesData);

    // Check if Daily_Activity record exists for this date and user
    const existingRecord = await db.query(
      'SELECT * FROM Daily_Activity WHERE agent = ? AND reportDate = ?',
      [user.lagnname, saleDate]
    );

    if (existingRecord && existingRecord.length > 0) {
      // Update existing record - preserve manual additions
      const existing = existingRecord[0];
      
      // Calculate manual additions (what user entered beyond Discord sales)
      const existingDiscordSales = existing.discord_sales || 0;
      const existingDiscordAlp = existing.discord_alp || 0;
      const existingDiscordRefs = existing.discord_refs || 0;
      
      const manualSalesAddition = Math.max(0, (existing.sales || 0) - existingDiscordSales);
      const manualAlpAddition = Math.max(0, (existing.alp || 0) - existingDiscordAlp);
      const manualRefsAddition = Math.max(0, (existing.refs || 0) - existingDiscordRefs);
      
      // New totals = Discord totals + manual additions
      const newSales = (salesData.total_sales || 0) + manualSalesAddition;
      const newAlp = (salesData.total_alp || 0) + manualAlpAddition;
      const newRefs = (salesData.total_refs || 0) + manualRefsAddition;

      await db.query(`
        UPDATE Daily_Activity 
        SET 
          sales = ?,
          alp = ?,
          refs = ?,
          discord_sales = ?,
          discord_alp = ?,
          discord_refs = ?
        WHERE agent = ? AND reportDate = ?
      `, [
        newSales, 
        newAlp, 
        newRefs,
        salesData.total_sales || 0,
        salesData.total_alp || 0,
        salesData.total_refs || 0,
        user.lagnname, 
        saleDate
      ]);

      console.log(`[DISCORD-API] ✅ Updated Daily_Activity: total_sales=${newSales}, total_alp=${newAlp}, total_refs=${newRefs}`);
      console.log(`[DISCORD-API] 📊 Discord portion: sales=${salesData.total_sales}, alp=${salesData.total_alp}, refs=${salesData.total_refs}`);
      console.log(`[DISCORD-API] 📝 Manual addition: sales=${manualSalesAddition}, alp=${manualAlpAddition}, refs=${manualRefsAddition}`);
    } else {
      // Create new record
      await db.query(`
        INSERT INTO Daily_Activity (
          reportDate,
          esid,
          MGA,
          Work,
          sales,
          alp,
          refs,
          agent,
          SA,
          GA,
          userId,
          discord_sales,
          discord_alp,
          discord_refs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        saleDate,           // reportDate
        user.esid,          // esid
        user.MGA,           // MGA
        saleDate,           // Work (use same date)
        salesData.total_sales || 0,  // sales
        salesData.total_alp || 0,    // alp
        salesData.total_refs || 0,   // refs
        user.lagnname,      // agent
        user.SA,            // SA
        user.GA,            // GA
        userId,             // userId
        salesData.total_sales || 0,  // discord_sales
        salesData.total_alp || 0,    // discord_alp
        salesData.total_refs || 0    // discord_refs
      ]);

      console.log(`[DISCORD-API] ✅ Created new Daily_Activity record: sales=${salesData.total_sales}, alp=${salesData.total_alp}, refs=${salesData.total_refs}`);
    }

  } catch (error) {
    console.error(`[DISCORD-API] ❌ Error updating Daily_Activity:`, error);
  }
}

/**
 * @route GET /api/discord/sales/breakdown
 * @desc Get breakdown of Discord sales vs manual entries for a date range
 * @access Private
 */
router.get('/sales/breakdown', async (req, res) => {
  try {
    const { startDate, endDate, userId: queryUserId } = req.query;
    
    // For now, use a fallback to test user (21 - COLEMAN CHARLES) or query param
    let userId = req.user?.userId || req.userId || queryUserId || 21;
    if (Array.isArray(userId)) {
      userId = userId[0];
    }
    userId = String(userId);

    console.log(`[DISCORD-BREAKDOWN-API] 📊 Getting breakdown for user ${userId} from ${startDate} to ${endDate}`);

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Get user details
    const userDetails = await db.query(
      'SELECT lagnname FROM activeusers WHERE id = ?',
      [userId]
    );

    if (!userDetails || userDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userDetails[0];

    // Get Discord sales aggregated by date
    const discordSales = await db.query(`
      SELECT 
        DATE(ts) as report_date,
        COUNT(*) as discord_sales,
        SUM(alp) as discord_alp,
        SUM(refs) as discord_refs
      FROM discord_sales 
      WHERE user_id = ? 
        AND DATE(ts) >= ? 
        AND DATE(ts) <= ?
      GROUP BY DATE(ts)
      ORDER BY DATE(ts) DESC
    `, [userId, startDate, endDate]);

    // Get Daily Activity entries for the same period
    const dailyActivity = await db.query(`
      SELECT 
        reportDate as report_date,
        sales as total_sales,
        alp as total_alp,
        refs as total_refs,
        discord_sales,
        discord_alp,
        discord_refs
      FROM Daily_Activity 
      WHERE agent = ? 
        AND reportDate >= ? 
        AND reportDate <= ?
      ORDER BY reportDate DESC
    `, [user.lagnname, startDate, endDate]);

    // Combine the data to show breakdown
    const breakdown = {};
    
    // Add Discord sales
    discordSales.forEach(discord => {
      const date = discord.report_date;
      breakdown[date] = {
        date: date,
        discord_sales: discord.discord_sales || 0,
        discord_alp: parseFloat(discord.discord_alp) || 0,
        discord_refs: discord.discord_refs || 0,
        total_sales: 0,
        total_alp: 0,
        total_refs: 0,
        manual_sales: 0,
        manual_alp: 0,
        manual_refs: 0
      };
    });

    // Add Daily Activity data and calculate manual additions
    dailyActivity.forEach(activity => {
      const date = activity.report_date;
      if (!breakdown[date]) {
        breakdown[date] = {
          date: date,
          discord_sales: 0,
          discord_alp: 0,
          discord_refs: 0,
          total_sales: 0,
          total_alp: 0,
          total_refs: 0,
          manual_sales: 0,
          manual_alp: 0,
          manual_refs: 0
        };
      }
      
      // Set totals from Daily_Activity
      breakdown[date].total_sales = activity.total_sales || 0;
      breakdown[date].total_alp = parseFloat(activity.total_alp) || 0;
      breakdown[date].total_refs = activity.total_refs || 0;
      
      // Use the Discord tracking columns from Daily_Activity (more reliable than aggregating)
      breakdown[date].discord_sales = activity.discord_sales || 0;
      breakdown[date].discord_alp = parseFloat(activity.discord_alp) || 0;
      breakdown[date].discord_refs = activity.discord_refs || 0;
      
      // Calculate manual additions (total - discord)
      breakdown[date].manual_sales = Math.max(0, breakdown[date].total_sales - breakdown[date].discord_sales);
      breakdown[date].manual_alp = Math.max(0, breakdown[date].total_alp - breakdown[date].discord_alp);
      breakdown[date].manual_refs = Math.max(0, breakdown[date].total_refs - breakdown[date].discord_refs);
    });

    const result = Object.values(breakdown).sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`[DISCORD-BREAKDOWN-API] ✅ Breakdown calculated for ${result.length} dates`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(`[DISCORD-BREAKDOWN-API] ❌ Error getting breakdown:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sales breakdown'
    });
  }
});
