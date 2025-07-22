// routes/discord.js
const express = require('express');
const axios = require('axios');
const db = require('../db');
const router = express.Router();
require('dotenv').config();

// Middleware to check if user is authenticated
const authMiddleware = require('../middleware/verifyToken');

const jwt = require('jsonwebtoken');

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

// 5) Get user's Discord servers (guilds)
router.get('/guilds', authMiddleware, async (req, res) => {
  try {
    // Determine user ID from middleware
    const userId = req.userId || req.user?.userId;
    const [row] = await db.query(
      `SELECT discord_token, discord_refresh, discord_expiry
         FROM activeusers
        WHERE id = ?`,
      [userId]
    );

    if (!row || !row.discord_token) {
      return res.status(400).json({ error: 'Discord account not linked' });
    }

    let token = row.discord_token;
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Refresh if expired
    if (nowSeconds >= row.discord_expiry) {
      const refreshParams = new URLSearchParams({
        client_id:     process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: row.discord_refresh
      }).toString();

      const refreshRes = await axios.post(
        'https://discord.com/api/oauth2/token',
        refreshParams,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      token = refreshRes.data.access_token;
      const newExpiry = nowSeconds + refreshRes.data.expires_in;

      // Save new tokens
      await db.query(
        `UPDATE activeusers
            SET discord_token   = ?,
                discord_refresh = ?,
                discord_expiry  = ?
          WHERE id = ?`,
        [
          refreshRes.data.access_token,
          refreshRes.data.refresh_token,
          newExpiry,
          userId
        ]
      );
    }

    // Fetch guilds
    const guildsRes = await axios.get(
      'https://discord.com/api/users/@me/guilds',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const guilds = guildsRes.data.map(guild => ({
      ...guild,
      icon_url: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
    }));

    return res.json({ guilds });
  } catch (error) {
    console.error('Error fetching Discord guilds:', error);
    return res.status(500).json({ error: 'Failed to fetch Discord servers' });
  }
});


// 6) Get channels for a specific guild
router.get('/guilds/:guildId/channels', authMiddleware, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Fetch channels from Discord API
    const channelsRes = await axios.get(`https://discord.com/api/guilds/${guildId}/channels`, {
      headers: { 
        Authorization: `Bot ${process.env.DISCORD_TOKEN}` 
      }
    });

    // Filter for text channels only
    const textChannels = channelsRes.data.filter(channel => 
      channel.type === 0 && channel.permissions & 0x800 // Text channel with send messages permission
    );

    res.json({ channels: textChannels });
  } catch (error) {
    console.error('Error fetching Discord channels:', error);
    res.status(500).json({ error: 'Failed to fetch Discord channels' });
  }
});

// 7) Configure guild (server) for the manager
router.post('/guilds/configure', authMiddleware, async (req, res) => {
  try {
    const { guild_id, guild_name, channel_id, channel_name } = req.body;

    // Check if this guild/channel is already configured
    const [existing] = await db.query(
      'SELECT id FROM guild_configs WHERE guild_id = ? AND channel_id = ?',
      [guild_id, channel_id]
    );

    if (existing) {
      return res.status(400).json({ error: 'This channel is already configured' });
    }

    // Add new configuration
    const userId = req.userId || req.user?.userId || req.user?.id;
    await db.query(
      `INSERT INTO guild_configs (manager_id, guild_id, guild_name, channel_id, channel_name)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, guild_id, guild_name, channel_id, channel_name]
    );

    res.json({ success: true, message: 'Server configured successfully' });
  } catch (error) {
    console.error('Error configuring guild:', error);
    res.status(500).json({ error: 'Failed to configure server' });
  }
});

// 8) Get manager's configured guilds
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

// 9) Remove guild configuration
router.delete('/guilds/:guildId/channels/:channelId', authMiddleware, async (req, res) => {
  try {
    const { guildId, channelId } = req.params;

    const userId = req.userId || req.user?.userId || req.user?.id;
    await db.query(
      'DELETE FROM guild_configs WHERE manager_id = ? AND guild_id = ? AND channel_id = ?',
      [userId, guildId, channelId]
    );

    res.json({ success: true, message: 'Server configuration removed' });
  } catch (error) {
    console.error('Error removing guild configuration:', error);
    res.status(500).json({ error: 'Failed to remove server configuration' });
  }
});

// 10) Create reminder
router.post('/reminders', authMiddleware, async (req, res) => {
  try {
    const { guild_id, channel_id, cron_expr, message } = req.body;

    // Validate cron expression
    const cron = require('node-cron');
    if (!cron.validate(cron_expr)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    await db.query(
      `INSERT INTO discord_reminders (manager_id, guild_id, channel_id, cron_expr, message)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, guild_id, channel_id, cron_expr, message]
    );

    res.json({ success: true, message: 'Reminder created successfully' });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// 11) Get manager's reminders
router.get('/reminders', authMiddleware, async (req, res) => {
  try {
    const reminders = await db.query(
      'SELECT * FROM discord_reminders WHERE manager_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ reminders });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// 12) Update reminder
router.put('/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { cron_expr, message, is_active } = req.body;

    if (cron_expr) {
      const cron = require('node-cron');
      if (!cron.validate(cron_expr)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    await db.query(
      `UPDATE discord_reminders 
       SET cron_expr = COALESCE(?, cron_expr), 
           message = COALESCE(?, message), 
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND manager_id = ?`,
      [cron_expr, message, is_active, id, req.user.id]
    );

    res.json({ success: true, message: 'Reminder updated successfully' });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// 13) Delete reminder
router.delete('/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM discord_reminders WHERE id = ? AND manager_id = ?',
      [id, req.user.id]
    );

    res.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// 14) Create leaderboard
router.post('/leaderboards', authMiddleware, async (req, res) => {
  try {
    const { guild_id, channel_id, cron_expr, metric_type, top_count } = req.body;

    // Validate cron expression
    const cron = require('node-cron');
    if (!cron.validate(cron_expr)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }

    await db.query(
      `INSERT INTO discord_leaderboards (manager_id, guild_id, channel_id, cron_expr, metric_type, top_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, guild_id, channel_id, cron_expr, metric_type, top_count]
    );

    res.json({ success: true, message: 'Leaderboard created successfully' });
  } catch (error) {
    console.error('Error creating leaderboard:', error);
    res.status(500).json({ error: 'Failed to create leaderboard' });
  }
});

// 15) Get manager's leaderboards
router.get('/leaderboards', authMiddleware, async (req, res) => {
  try {
    const leaderboards = await db.query(
      'SELECT * FROM discord_leaderboards WHERE manager_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ leaderboards });
  } catch (error) {
    console.error('Error fetching leaderboards:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboards' });
  }
});

// 16) Update leaderboard
router.put('/leaderboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { cron_expr, metric_type, top_count, is_active } = req.body;

    if (cron_expr) {
      const cron = require('node-cron');
      if (!cron.validate(cron_expr)) {
        return res.status(400).json({ error: 'Invalid cron expression' });
      }
    }

    await db.query(
      `UPDATE discord_leaderboards 
       SET cron_expr = COALESCE(?, cron_expr), 
           metric_type = COALESCE(?, metric_type), 
           top_count = COALESCE(?, top_count), 
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND manager_id = ?`,
      [cron_expr, metric_type, top_count, is_active, id, req.user.id]
    );

    res.json({ success: true, message: 'Leaderboard updated successfully' });
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// 17) Delete leaderboard
router.delete('/leaderboards/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM discord_leaderboards WHERE id = ? AND manager_id = ?',
      [id, req.user.id]
    );

    res.json({ success: true, message: 'Leaderboard deleted successfully' });
  } catch (error) {
    console.error('Error deleting leaderboard:', error);
    res.status(500).json({ error: 'Failed to delete leaderboard' });
  }
});

// 18) Get sales statistics
router.get('/sales/stats', authMiddleware, async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
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
    `, [req.user.id]);

    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

module.exports = router;
