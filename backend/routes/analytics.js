const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// Middleware to restrict access to Kyle VanBibber only
const restrictToKyle = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userQuery = await db.query(
      'SELECT lagnname, Role FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (userQuery.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const user = userQuery[0];
    const normalizedName = user.lagnname.trim().toUpperCase();
    
    // Allow Kyle VanBibber or Admins
    if (normalizedName !== 'VANBIBBER, KYLE A' && user.Role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    next();
  } catch (error) {
    console.error('Error in restrictToKyle middleware:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get currently active (online) users via WebSocket connections
router.get('/active-users', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const notificationManager = global.notificationManager;
    if (!notificationManager) {
      return res.json({ success: true, count: 0, users: [] });
    }

    const activeUserIds = notificationManager.getActiveUserIds();
    const count = activeUserIds.length;

    let users = [];
    if (count > 0) {
      const placeholders = activeUserIds.map(() => '?').join(',');
      users = await db.query(
        `SELECT id, lagnname, clname, profpic FROM activeusers WHERE id IN (${placeholders})`,
        activeUserIds
      );
    }

    res.json({ success: true, count, users });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active users' });
  }
});

// Get most viewed pages
router.get('/pages/most-viewed', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const query = `
      SELECT 
        path,
        label,
        SUM(visitCount) as totalVisits,
        COUNT(DISTINCT userId) as uniqueUsers,
        MAX(lastVisited) as lastAccessed
      FROM user_navigation_history
      GROUP BY path, label
      ORDER BY totalVisits DESC
      LIMIT ?
    `;
    
    const results = await db.query(query, [limit]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching most viewed pages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get most active users
router.get('/users/most-active', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const query = `
      SELECT 
        n.userId,
        u.lagnname,
        u.clname,
        SUM(n.visitCount) as totalPageViews,
        COUNT(DISTINCT n.path) as uniquePagesVisited,
        MAX(n.lastVisited) as lastActive,
        (SELECT COUNT(*) FROM user_search_history WHERE userId = n.userId) as searchCount
      FROM user_navigation_history n
      JOIN activeusers u ON n.userId = u.id
      GROUP BY n.userId, u.lagnname, u.clname
      ORDER BY totalPageViews DESC
      LIMIT ?
    `;
    
    const results = await db.query(query, [limit]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching most active users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get page views by specific user
router.get('/users/:userId/pages', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const query = `
      SELECT 
        path,
        label,
        visitCount,
        lastVisited,
        createdAt
      FROM user_navigation_history
      WHERE userId = ?
      ORDER BY visitCount DESC
    `;
    
    const results = await db.query(query, [userId]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching user pages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get user timeline (activity over time)
router.get('/users/:userId/timeline', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const days = parseInt(req.query.days) || 30;
    
    const query = `
      SELECT 
        DATE(lastVisited) as date,
        COUNT(*) as pageVisitEvents,
        SUM(visitCount) as totalVisits,
        COUNT(DISTINCT path) as uniquePages
      FROM user_navigation_history
      WHERE userId = ?
        AND lastVisited >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(lastVisited)
      ORDER BY date DESC
    `;
    
    const results = await db.query(query, [userId, days]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching user timeline:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get most searched terms
router.get('/searches/top-queries', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const query = `
      SELECT 
        query,
        SUM(searchCount) as totalSearches,
        COUNT(DISTINCT userId) as uniqueUsers,
        MAX(lastSearched) as lastSearched
      FROM user_search_history
      GROUP BY query
      ORDER BY totalSearches DESC
      LIMIT ?
    `;
    
    const results = await db.query(query, [limit]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching top searches:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get user search history
router.get('/users/:userId/searches', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const query = `
      SELECT 
        query,
        searchCount,
        lastSearched,
        createdAt
      FROM user_search_history
      WHERE userId = ?
      ORDER BY lastSearched DESC
    `;
    
    const results = await db.query(query, [userId]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching user searches:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get overall usage statistics
router.get('/stats/overview', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const stats = {};
    
    // Total users with activity
    const activeUsersQuery = await db.query(`
      SELECT COUNT(DISTINCT userId) as count
      FROM user_navigation_history
    `);
    stats.totalActiveUsers = activeUsersQuery[0].count;
    
    // Total page views
    const pageViewsQuery = await db.query(`
      SELECT SUM(visitCount) as count
      FROM user_navigation_history
    `);
    stats.totalPageViews = pageViewsQuery[0].count || 0;
    
    // Total searches
    const searchesQuery = await db.query(`
      SELECT SUM(searchCount) as count
      FROM user_search_history
    `);
    stats.totalSearches = searchesQuery[0].count || 0;
    
    // Total unique pages
    const uniquePagesQuery = await db.query(`
      SELECT COUNT(DISTINCT path) as count
      FROM user_navigation_history
    `);
    stats.uniquePagesVisited = uniquePagesQuery[0].count;
    
    // Activity in last 24 hours
    const recentActivityQuery = await db.query(`
      SELECT COUNT(DISTINCT userId) as count
      FROM user_navigation_history
      WHERE lastVisited >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    stats.activeUsersLast24h = recentActivityQuery[0].count;
    
    // Most active day
    const mostActiveDayQuery = await db.query(`
      SELECT 
        DATE(lastVisited) as date,
        COUNT(DISTINCT userId) as userCount
      FROM user_navigation_history
      GROUP BY DATE(lastVisited)
      ORDER BY userCount DESC
      LIMIT 1
    `);
    stats.mostActiveDay = mostActiveDayQuery[0] || null;
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get page-to-user breakdown (which users view which pages)
router.get('/pages/:path/users', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const path = decodeURIComponent(req.params.path);
    const limit = parseInt(req.query.limit) || 50;
    
    const query = `
      SELECT 
        n.userId,
        u.lagnname,
        u.clname,
        n.visitCount,
        n.lastVisited,
        n.createdAt
      FROM user_navigation_history n
      JOIN activeusers u ON n.userId = u.id
      WHERE n.path = ?
      ORDER BY n.visitCount DESC
      LIMIT ?
    `;
    
    const results = await db.query(query, [path, limit]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching page users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

// Get agent profile view analytics
router.get('/agent-profiles/views', verifyToken, restrictToKyle, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const query = `
      SELECT 
        viewed_agent_name,
        viewed_agent_clname,
        COUNT(*) as totalViews,
        COUNT(DISTINCT viewer_user_id) as uniqueViewers,
        MAX(viewed_at) as lastViewed
      FROM agent_search_history
      GROUP BY viewed_agent_id, viewed_agent_name, viewed_agent_clname
      ORDER BY totalViews DESC
      LIMIT ?
    `;
    
    const results = await db.query(query, [limit]);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching agent profile views:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch data' });
  }
});

module.exports = router;

