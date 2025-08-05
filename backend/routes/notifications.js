const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const webpush = require('web-push');
const scheduledNotificationService = require('../services/scheduledNotificationService');
const logger = require('../utils/logger');

// Configure Web Push with VAPID keys from environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

// Only set VAPID details if keys are provided
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT_EMAIL || 'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('✅ Web Push VAPID details configured');
} else {
  console.log('⚠️ Web Push VAPID keys not found - push notifications will be disabled');
}

// Helper function to check if web push is configured
const isWebPushConfigured = () => {
  return !!(vapidKeys.publicKey && vapidKeys.privateKey);
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  // Query the database to check if the user has admin permissions
  db.query('SELECT Role FROM activeusers WHERE id = ?', [req.userId])
    .then(results => {
      if (results.length > 0 && results[0].Role === 'Admin') {
        next();
      } else {
        res.status(403).json({ error: 'Access denied. Admin permissions required.' });
      }
    })
    .catch(error => {
      console.error('Error checking admin permissions:', error);
      res.status(500).json({ error: 'Failed to verify permissions' });
    });
};

// Get current user's notifications
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, includeRead = false } = req.query;
    
    // First, get direct notifications for the user
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ?
    `;
    
    if (!includeRead) {
      query += ` AND is_read = false`;
    }
    
    const directResults = await db.query(query, [req.userId]);
    
    // Now get group-based notifications
    // First, find the groups this user belongs to
    const userGroupsQuery = `
      SELECT group_name FROM user_groups WHERE user_id = ?
    `;
    const userGroups = await db.query(userGroupsQuery, [req.userId]);
    const groupIds = userGroups.map(g => g.group_name);
    
    // Get all group notifications without filtering by read status yet
    const groupNotificationsQuery = `
      SELECT n.*, 
             nr.is_read as user_read_status, 
             nr.is_dismissed as user_dismissed_status 
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE n.target_group IS NOT NULL 
      AND (
        n.target_group IN (?) 
        OR 
        (n.metadata IS NOT NULL AND JSON_EXTRACT(n.metadata, '$.queryData') IS NOT NULL)
      )
    `;
    
    let groupResults = [];
    if (groupIds.length > 0) {
      groupResults = await db.query(groupNotificationsQuery, [req.userId, groupIds]);
    } else {
      // If user isn't in any groups, just get notifications with dynamic queries
      groupResults = await db.query(`
        SELECT n.*, 
               nr.is_read as user_read_status, 
               nr.is_dismissed as user_dismissed_status 
        FROM notifications n
        LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
        WHERE n.target_group IS NOT NULL 
        AND n.metadata IS NOT NULL 
        AND JSON_EXTRACT(n.metadata, '$.queryData') IS NOT NULL
      `, [req.userId]);
    }
    
    // Filter out read notifications if needed
    if (!includeRead) {
      groupResults = groupResults.filter(n => !(n.user_read_status));
    }
    
    // For group notifications with metadata.queryData, check if user is in the target group
    const allResults = [...directResults];
    
    for (const notification of groupResults) {
      // If it's a direct group match, include it
      if (groupIds.includes(notification.target_group)) {
        // Adjust the is_read and is_dismissed flags based on user-specific status
        allResults.push({
          ...notification,
          is_read: notification.user_read_status === 1,
          is_dismissed: notification.user_dismissed_status === 1
        });
        continue;
      }
      
      // If it has query data, check if the user matches the query
      if (notification.metadata) {
        try {
          const metadata = JSON.parse(notification.metadata);
          
          if (metadata.queryData && metadata.tables) {
            // Build a query to check if this specific user matches
            const { query: originalQuery, params } = buildQuery(metadata.queryData, metadata.tables);
            
            // Create a proper user-specific query
            let userCheckQuery;
            if (originalQuery.includes('WHERE')) {
              // If query already has WHERE clause, add user ID condition with AND
              userCheckQuery = originalQuery.replace(
                'SELECT DISTINCT a.id', 
                'SELECT COUNT(*) as matches'
              ).replace(
                'WHERE', 
                `WHERE a.id = ${req.userId} AND `
              );
            } else {
              // If query doesn't have WHERE clause, add one with user ID
              userCheckQuery = originalQuery.replace(
                'SELECT DISTINCT a.id', 
                'SELECT COUNT(*) as matches'
              ) + ` WHERE a.id = ${req.userId}`;
            }
            
            const userMatches = await db.query(userCheckQuery, params);
            
            // If the user matches the query criteria, include the notification
            if (userMatches.length > 0 && userMatches[0].matches > 0) {
              // Adjust the is_read and is_dismissed flags based on user-specific status
              allResults.push({
                ...notification,
                is_read: notification.user_read_status === 1,
                is_dismissed: notification.user_dismissed_status === 1
              });
            }
          }
        } catch (err) {
          console.error('Error parsing notification metadata:', err);
          // Skip this notification if metadata is invalid
        }
      }
    }
    
    // Sort by created_at date (newest first)
    allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Apply pagination manually since we're combining results
    const paginatedResults = allResults.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // Get unread count
    const unreadCount = allResults.filter(n => !n.is_read).length;
    
    res.json({
      notifications: paginatedResults,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if this is a user-specific notification
    const notification = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
    
    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notificationData = notification[0];
    
    // If this is a user-specific notification, update it directly
    if (notificationData.user_id === req.userId) {
      await db.query('UPDATE notifications SET is_read = true WHERE id = ?', [id]);
      
      const updated = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
      return res.json(updated[0]);
    }
    
    // If this is a group notification, we need to create a user-specific record 
    // to track that this user has read it
    if (notificationData.target_group) {
      // Check if user already has a read record for this notification
      const existingRead = await db.query(
        'SELECT * FROM notification_reads WHERE notification_id = ? AND user_id = ?',
        [id, req.userId]
      );
      
      if (existingRead.length === 0) {
        // Create a new read record
        await db.query(
          'INSERT INTO notification_reads (notification_id, user_id, is_read, created_at) VALUES (?, ?, true, NOW())',
          [id, req.userId]
        );
      } else {
        // Update existing read record
        await db.query(
          'UPDATE notification_reads SET is_read = true WHERE notification_id = ? AND user_id = ?',
          [id, req.userId]
        );
      }
      
      // Return the original notification with updated read status
      return res.json({
        ...notificationData,
        is_read: true
      });
    }
    
    // If we get here, the notification exists but is neither for this user nor a group
    // the user belongs to, so return not found
    return res.status(404).json({ error: 'Notification not found' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE (user_id = ? OR target_group IN (
         SELECT group_name FROM user_groups WHERE user_id = ?
       ) OR target_group IS NULL) 
       AND is_read = false`,
      [req.userId, req.userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Mark notification as dismissed
router.put('/:id/dismiss', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if this is a user-specific notification
    const notification = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
    
    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notificationData = notification[0];
    
    // If this is a user-specific notification, update it directly
    if (notificationData.user_id === req.userId) {
      await db.query('UPDATE notifications SET is_dismissed = true WHERE id = ?', [id]);
      
      const updated = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
      return res.json(updated[0]);
    }
    
    // If this is a group notification, we need to create a user-specific record 
    // to track that this user has dismissed it
    if (notificationData.target_group) {
      // Check if user already has a read record for this notification
      const existingRead = await db.query(
        'SELECT * FROM notification_reads WHERE notification_id = ? AND user_id = ?',
        [id, req.userId]
      );
      
      if (existingRead.length === 0) {
        // Create a new read record with dismissed
        await db.query(
          'INSERT INTO notification_reads (notification_id, user_id, is_read, is_dismissed, created_at) VALUES (?, ?, true, true, NOW())',
          [id, req.userId]
        );
      } else {
        // Update existing read record
        await db.query(
          'UPDATE notification_reads SET is_dismissed = true, is_read = true WHERE notification_id = ? AND user_id = ?',
          [id, req.userId]
        );
      }
      
      // Return the original notification with updated dismissed status
      return res.json({
        ...notificationData,
        is_dismissed: true,
        is_read: true
      });
    }
    
    // If we get here, the notification exists but is neither for this user nor a group
    // the user belongs to, so return not found
    return res.status(404).json({ error: 'Notification not found' });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Check subscription status
router.get('/subscription-status', verifyToken, async (req, res) => {
  try {
    // Check if user has an active subscription
    const subscriptionResults = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    
    const hasSubscription = subscriptionResults.length > 0;
    
    res.json({
      hasSubscription,
      publicKey: process.env.VAPID_PUBLIC_KEY
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Subscribe to push notifications - Updated to better handle existing subscriptions
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription data is required' });
    }
    
    // Check if subscription already exists
    const existingResults = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    
    // Parse subscription to store endpoint as a unique identifier
    let subscriptionObj;
    try {
      subscriptionObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid subscription format' });
    }
    
    if (existingResults.length > 0) {
      // Update existing subscription
      await db.query(
        'UPDATE push_subscriptions SET subscription = ?, updated_at = NOW() WHERE user_id = ?',
        [JSON.stringify(subscriptionObj), req.userId]
      );
    } else {
      // Create new subscription
      await db.query(
        'INSERT INTO push_subscriptions (user_id, subscription, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [req.userId, JSON.stringify(subscriptionObj)]
      );
      
      // Also update notification preferences to enable push for all types
      await updatePreferencesForPush(req.userId, true);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// Unsubscribe from push notifications - Updated to also update preferences
router.post('/unsubscribe', verifyToken, async (req, res) => {
  try {
    // Delete subscription
    await db.query(
      'DELETE FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    
    // No need to update preferences since we're just using push_subscriptions table
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    res.status(500).json({ error: 'Failed to delete push subscription' });
  }
});

// Helper function to update push channel in all preferences
async function updatePreferencesForPush(userId, enabled) {
  // This function is simplified since we're not using the notification_preferences table
  // We'll just rely on the push_subscriptions table to track subscriptions
  return true;
}

// Send push notification (used internally)
async function sendPushNotification(userId, notification) {
  try {
    // Input validation
    if (!userId) {
      console.log('Cannot send push notification: Missing user ID');
      return false;
    }
    
    if (!notification || typeof notification !== 'object') {
      console.log(`Cannot send push notification to user ${userId}: Invalid notification object`);
      return false;
    }
    
    // Get user's push subscription
    const results = await db.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );
    
    if (!results || results.length === 0) {
      console.log(`No push subscription found for user ${userId}`);
      return false;
    }
    
    // Ensure subscription is valid
    if (!results[0].subscription) {
      console.log(`Empty subscription found for user ${userId}`);
      return false;
    }
    
    // Parse subscription with error handling
    let subscription;
    try {
      subscription = typeof results[0].subscription === 'string' 
        ? JSON.parse(results[0].subscription) 
        : results[0].subscription;
        
      // Validate the subscription format
      if (!subscription || !subscription.endpoint) {
        console.log(`Invalid subscription format for user ${userId}`);
        return false;
      }
    } catch (parseError) {
      console.error(`Error parsing subscription for user ${userId}:`, parseError);
      return false;
    }
    
    // Prepare notification payload - handle missing fields
    const payload = JSON.stringify({
      title: notification.title || 'New Notification',
      message: notification.message || notification.body || '',
      id: notification.id || Date.now(),
      link_url: notification.link_url || '/notifications'
    });
    
    // Send push notification
    try {
      await webpush.sendNotification(subscription, payload);
      console.log(`Push notification sent to user ${userId}`);
      return true;
    } catch (webpushError) {
      console.error(`Error sending push notification to user ${userId}:`, webpushError);
      
      // If subscription is invalid or expired, remove it
      if (webpushError.statusCode === 404 || webpushError.statusCode === 410) {
        console.log(`Removing invalid subscription for user ${userId}`);
        await db.query('DELETE FROM push_subscriptions WHERE user_id = ?', [userId]);
      }
      
      return false;
    }
  } catch (error) {
    console.error(`Error in push notification process for user ${userId}:`, error);
    return false;
  }
}

// ADMIN ROUTES

// Create a new notification (admin only) - Updated to send push notifications
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { 
      title, 
      message, 
      type = 'info', 
      user_id = null, 
      target_group = null, 
      scheduled_for = null,
      link_url = null,
      metadata = '{}'
    } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    // Convert metadata to string if it's an object
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    
    const result = await db.query(
      `INSERT INTO notifications 
       (title, message, type, user_id, target_group, scheduled_for, link_url, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, message, type, user_id, target_group, scheduled_for, link_url, metadataStr]
    );
    
    const insertedId = result.insertId;
    const inserted = await db.query('SELECT * FROM notifications WHERE id = ?', [insertedId]);
    
    // If this is a direct notification to a user, send push notification
    if (user_id) {
      // Send push notification
      sendPushNotification(user_id, {
        id: insertedId,
        title,
        message,
        link_url
      }).catch(err => console.error('Error sending push notification:', err));

      // Send WebSocket notification for real-time updates
      if (global.notificationManager) {
        global.notificationManager.notifyUser(user_id, {
          id: insertedId,
          title,
          message,
          type,
          link_url,
          created_at: new Date().toISOString()
        });
      }
    } 
    // If this is a group notification, send to all users in the group
    else if (target_group) {
      const groupUsers = await db.query(
        'SELECT user_id FROM user_groups WHERE group_name = ?',
        [target_group]
      );
      
      for (const user of groupUsers) {
        // Send push notification
        sendPushNotification(user.user_id, {
          id: insertedId,
          title,
          message,
          link_url
        }).catch(err => console.error(`Error sending push notification to user ${user.user_id}:`, err));

        // Send WebSocket notification for real-time updates
        if (global.notificationManager) {
          global.notificationManager.notifyUser(user.user_id, {
            id: insertedId,
            title,
            message,
            type,
            link_url,
            created_at: new Date().toISOString()
          });
        }
      }
    }
    // If global notification, send push to all users with a push subscription
    else {
      const allSubs = await db.query('SELECT user_id FROM push_subscriptions');
      for (const user of allSubs) {
        sendPushNotification(user.user_id, {
          id: insertedId,
          title,
          message,
          link_url
        }).catch(err => console.error(`Error sending push notification to user ${user.user_id}:`, err));
      }
    }
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get all notifications (admin only)
router.get('/admin/all', verifyToken, isAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const results = await db.query(
      `SELECT n.*, u.lagnname as username, u.email 
       FROM notifications n
       LEFT JOIN activeusers u ON n.user_id = u.id
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );
    
    const countResults = await db.query('SELECT COUNT(*) as count FROM notifications');
    
    res.json({
      notifications: results,
      total: parseInt(countResults[0].count, 10)
    });
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Update notification (admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      message, 
      type, 
      user_id, 
      target_group,
      scheduled_for,
      link_url,
      metadata
    } = req.body;
    
    // Build the query dynamically based on provided fields
    let query = 'UPDATE notifications SET ';
    const values = [];
    const updateFields = [];
    
    if (title !== undefined) {
      updateFields.push(`title = ?`);
      values.push(title);
    }
    
    if (message !== undefined) {
      updateFields.push(`message = ?`);
      values.push(message);
    }
    
    if (type !== undefined) {
      updateFields.push(`type = ?`);
      values.push(type);
    }
    
    if (user_id !== undefined) {
      updateFields.push(`user_id = ?`);
      values.push(user_id === null ? null : user_id);
    }
    
    if (target_group !== undefined) {
      updateFields.push(`target_group = ?`);
      values.push(target_group === null ? null : target_group);
    }
    
    if (scheduled_for !== undefined) {
      updateFields.push(`scheduled_for = ?`);
      values.push(scheduled_for === null ? null : scheduled_for);
    }
    
    if (link_url !== undefined) {
      updateFields.push(`link_url = ?`);
      values.push(link_url === null ? null : link_url);
    }
    
    if (metadata !== undefined) {
      const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
      updateFields.push(`metadata = ?`);
      values.push(metadataStr);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    query += updateFields.join(', ') + ' WHERE id = ?';
    values.push(id);
    
    await db.query(query, values);
    
    const updated = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
    
    if (updated.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Delete notification (admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM notifications WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Test push notification (admin only)
router.post('/test-push', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, title = 'Test Notification', message = 'This is a test push notification' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Create notification in database
    const result = await db.query(
      `INSERT INTO notifications (title, message, type, user_id) VALUES (?, ?, 'info', ?)`,
      [title, message, userId]
    );
    
    const notificationId = result.insertId;
    
    // Send push notification
    const sent = await sendPushNotification(userId, {
      id: notificationId,
      title,
      message,
      link_url: '/notifications'
    });
    
    if (sent) {
      res.json({ success: true, message: 'Push notification sent successfully' });
    } else {
      res.json({ success: false, message: 'User has no push subscription' });
    }
  } catch (error) {
    console.error('Error sending test push notification:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// Test push notification (user self-test)
router.post('/test', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const title = 'Test Notification';
    const message = 'This is a test notification to verify your push notification settings.';
    const type = 'info';
    const link_url = '/notifications';

    // 1. Insert notification into DB
    const result = await db.query(
      `INSERT INTO notifications (title, message, type, user_id, link_url) VALUES (?, ?, ?, ?, ?)`,
      [title, message, type, userId, link_url]
    );
    const notificationId = result.insertId;

    // 2. Send push notification
    await sendPushNotification(userId, {
      id: notificationId,
      title,
      message,
      link_url
    });

    // 3. Send WebSocket notification for real-time updates
    if (global.notificationManager) {
      global.notificationManager.notifyUser(userId, {
        id: notificationId,
        title,
        message,
        type,
        link_url,
        created_at: new Date().toISOString()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Get VAPID public key
router.get('/vapid-key', verifyToken, async (req, res) => {
  try {
    console.log('VAPID Public Key from env:', process.env.VAPID_PUBLIC_KEY);
    if (!process.env.VAPID_PUBLIC_KEY) {
      console.error('VAPID_PUBLIC_KEY is not set in environment variables');
      return res.status(500).json({ error: 'Push notifications are not configured' });
    }
    
    // Check if user has an active subscription
    const subscriptionResults = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    
    const hasSubscription = subscriptionResults.length > 0;
    
    res.json({ 
      publicKey: process.env.VAPID_PUBLIC_KEY,
      hasSubscription
    });
  } catch (error) {
    console.error('Error getting VAPID key:', error);
    res.status(500).json({ error: 'Failed to get VAPID key' });
  }
});

// Debug endpoint to check environment variables (remove in production)
router.get('/debug-env', (req, res) => {
  res.json({
    hasVapidPublicKey: !!process.env.VAPID_PUBLIC_KEY,
    hasVapidPrivateKey: !!process.env.VAPID_PRIVATE_KEY,
    hasVapidEmail: !!process.env.VAPID_CONTACT_EMAIL,
    nodeEnv: process.env.NODE_ENV
  });
});

// Send notification to specific user (admin only)
router.post('/send', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, title, message, link_url } = req.body;
    
    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'User ID, title, and message are required' });
    }
    
    const notification = {
      title,
      message,
      id: Date.now(),
      link_url: link_url || '/notifications'
    };

    const success = await sendPushNotification(userId, notification);
    
    if (success) {
      res.json({ success: true, message: 'Notification sent successfully' });
    } else {
      res.status(400).json({ error: 'Failed to send notification. User may not have push notifications enabled.' });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get user's notification preferences
router.get('/preferences', verifyToken, async (req, res) => {
  try {
    // First check if user has a push subscription
    const subscriptionResults = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    
    const hasPushSubscription = subscriptionResults.length > 0;
    
    // Return simplified preferences since we don't have the notification_preferences table
    const defaultPreferences = [
      {
        type: 'account_updates',
        enabled: true,
        channels: { email: true, push: hasPushSubscription, inApp: true }
      },
      {
        type: 'security_alerts',
        enabled: true,
        channels: { email: true, push: hasPushSubscription, inApp: true }
      },
      {
        type: 'marketing_updates',
        enabled: false,
        channels: { email: false, push: false, inApp: false }
      },
      {
        type: 'system_notifications',
        enabled: true,
        channels: { email: false, push: hasPushSubscription, inApp: true }
      }
    ];
    
    res.json(defaultPreferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update user's notification preferences
router.post('/preferences', verifyToken, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ error: 'Invalid preferences format' });
    }
    
    // Check if any preference has push channel enabled
    const pushEnabled = preferences.some(pref => 
      pref.enabled && pref.channels && pref.channels.push
    );
    
    // Get current push subscription status
    const subscriptionResults = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    
    const hasPushSubscription = subscriptionResults.length > 0;
    
    // If push is disabled in all preferences but a subscription exists, remove it
    if (!pushEnabled && hasPushSubscription) {
      await db.query(
        'DELETE FROM push_subscriptions WHERE user_id = ?',
        [req.userId]
      );
    }
    
    res.json({ 
      success: true,
      pushStatus: {
        enabled: pushEnabled,
        hasSubscription: hasPushSubscription && pushEnabled
      }
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Helper function to check if a user should receive a notification
async function shouldSendNotification(userId, notificationType, channel) {
  try {
    if (channel === 'push') {
      // For push channel, just check if user has a subscription
      const results = await db.query(
        'SELECT * FROM push_subscriptions WHERE user_id = ?',
        [userId]
      );
      return results.length > 0;
    }
    
    // For other channels, use default settings
    // In a real implementation, you might want to create the notification_preferences table
    if (channel === 'inApp') {
      // By default, all notifications are sent in-app
      return true;
    }
    
    if (channel === 'email') {
      // Only send account and security notifications by email by default
      return ['account_updates', 'security_alerts'].includes(notificationType);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking notification preferences:', error);
    return false;
  }
}

/**
 * Get all notification groups
 */
router.get('/admin/groups', verifyToken, isAdmin, async (req, res) => {
  try {
    const results = await db.query(
      `SELECT * FROM notification_groups ORDER BY name ASC`
    );
    
    res.json({
      success: true,
      groups: results
    });
  } catch (error) {
    console.error('Error fetching notification groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification groups'
    });
  }
});

/**
 * Create a new notification group
 */
router.post('/admin/groups', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, description, queryData, tables } = req.body;
    
    if (!name || !queryData) {
      return res.status(400).json({
        success: false,
        error: 'Name and query data are required'
      });
    }
    
    // Convert objects to JSON strings for storage
    const queryDataStr = JSON.stringify(queryData);
    const tablesStr = JSON.stringify(tables || ['activeusers']);
    
    await db.query(
      `INSERT INTO notification_groups (name, description, query_data, tables, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [name, description, queryDataStr, tablesStr]
    );
    
    const newGroups = await db.query(
      `SELECT * FROM notification_groups ORDER BY created_at DESC LIMIT 1`
    );
    
    res.status(201).json({
      success: true,
      group: newGroups[0]
    });
  } catch (error) {
    console.error('Error creating notification group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification group'
    });
  }
});

/**
 * Update a notification group
 */
router.put('/admin/groups/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, queryData, tables } = req.body;
    
    if (!name || !queryData) {
      return res.status(400).json({
        success: false,
        error: 'Name and query data are required'
      });
    }
    
    // Convert objects to JSON strings for storage
    const queryDataStr = JSON.stringify(queryData);
    const tablesStr = JSON.stringify(tables || ['activeusers']);
    
    await db.query(
      `UPDATE notification_groups 
       SET name = ?, description = ?, query_data = ?, tables = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, description, queryDataStr, tablesStr, id]
    );
    
    const updatedGroup = await db.query(
      `SELECT * FROM notification_groups WHERE id = ?`,
      [id]
    );
    
    if (updatedGroup.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    res.json({
      success: true,
      group: updatedGroup[0]
    });
  } catch (error) {
    console.error('Error updating notification group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification group'
    });
  }
});

/**
 * Delete a notification group
 */
router.delete('/admin/groups/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query(
      `DELETE FROM notification_groups WHERE id = ?`,
      [id]
    );
    
    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification group:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification group'
    });
  }
});

/**
 * Get user count for a notification group
 */
router.get('/admin/groups/:id/count', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the group's query data
    const groupResult = await db.query(
      `SELECT query_data, tables FROM notification_groups WHERE id = ?`,
      [id]
    );
    
    if (groupResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }
    
    const group = groupResult[0];
    const queryData = JSON.parse(group.query_data);
    const tables = JSON.parse(group.tables);
    
    // Build and execute the query
    const { query, params } = buildQuery(queryData, tables);
    const countQuery = `SELECT COUNT(*) as count FROM (${query}) as query_result`;
    
    const result = await db.query(countQuery, params);
    
    res.json({
      success: true,
      count: result[0].count
    });
  } catch (error) {
    console.error('Error getting group user count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get group user count'
    });
  }
});

/**
 * Preview query results
 */
router.post('/admin/query-preview', verifyToken, isAdmin, async (req, res) => {
  try {
    const { conditions, logicOperator, joins, tables = ['activeusers'] } = req.body;
    
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid query conditions are required'
      });
    }
    
    // Build and execute the query with joins support
    const { query, params } = buildQuery({ conditions, logicOperator, joins }, tables);
    const countQuery = `SELECT COUNT(*) as count FROM (${query}) as query_result`;

    // Log the generated query and params
    console.log('[QUERY PREVIEW] SQL:', countQuery);
    console.log('[QUERY PREVIEW] Params:', params);

    const result = await db.query(countQuery, params);

    // Also preview up to 50 user records (id, lagnname, email)
    const previewQuery = `${query} LIMIT 50`;
    const previewResults = await db.query(previewQuery, params);
    const previewUsers = previewResults.map(row => ({
      id: row.id,
      lagnname: row.lagnname,
      email: row.email
    }));

    // Log the preview user results
    console.log('[QUERY PREVIEW] Preview Users:', previewUsers);

    res.json({
      success: true,
      count: result[0].count,
      results: previewUsers
    });
  } catch (error) {
    console.error('Error previewing query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview query'
    });
  }
});

/**
 * Get scheduled notifications
 */
router.get('/admin/schedules', verifyToken, isAdmin, async (req, res) => {
  try {
    const results = await db.query(
      `SELECT n.*, g.name as group_name 
       FROM notifications n
       LEFT JOIN notification_groups g ON n.target_group = g.id
       WHERE n.scheduled_for IS NOT NULL 
          OR (n.metadata IS NOT NULL AND JSON_EXTRACT(n.metadata, '$.recurrence') IS NOT NULL)
       ORDER BY n.scheduled_for DESC`
    );
    
    res.json({
      success: true,
      schedules: results
    });
  } catch (error) {
    console.error('Error fetching scheduled notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled notifications'
    });
  }
});

/**
 * Helper function to build SQL query from conditions with join support
 * (now supports in_subquery and not_in_subquery operators)
 */
function buildQuery(queryData, tables) {
  const { conditions, logicOperator, joins = [] } = queryData;
  const params = [];
  const allowedTables = ['activeusers', 'licenses', 'user_groups', 'user_activity', 'MGAs', 'amore_data', 'licensed_states'];
  
  // Validate tables and filter out invalid ones
  const validTables = tables.filter(table => allowedTables.includes(table));
  if (validTables.length === 0) {
    throw new Error('No valid tables provided');
  }
  // Create table alias mapping
  const tableAliases = {};
  let aliasCounter = 0;
  validTables.forEach(table => {
    if (table === 'activeusers') {
      tableAliases[table] = 'a';
    } else {
      tableAliases[table] = String.fromCharCode(98 + aliasCounter++); // b, c, d...
    }
  });
  const mainTable = validTables[0];
  const mainAlias = tableAliases[mainTable];
  let query = `SELECT DISTINCT ${mainAlias}.id, ${mainAlias}.lagnname, ${mainAlias}.email FROM ${mainTable} ${mainAlias}`;
  if (joins && joins.length > 0) {
    joins.forEach(join => {
      const { type, leftTable, leftField, rightTable, rightField } = join;
      if (!allowedTables.includes(leftTable) || !allowedTables.includes(rightTable) ||
          !validTables.includes(leftTable) || !validTables.includes(rightTable)) {
        return;
      }
      const leftAlias = tableAliases[leftTable];
      const rightAlias = tableAliases[rightTable];
      const joinType = type || 'INNER';
      query += ` ${joinType} JOIN ${rightTable} ${rightAlias} ON ${leftAlias}.${leftField} = ${rightAlias}.${rightField}`;
    });
  } else if (validTables.length > 1) {
    for (let i = 1; i < validTables.length; i++) {
      const table = validTables[i];
      const alias = tableAliases[table];
      if (table === 'licenses') {
        query += ` LEFT JOIN licenses ${alias} ON ${mainAlias}.lagnname = ${alias}.lagnname`;
      } else if (table === 'user_groups') {
        query += ` LEFT JOIN user_groups ${alias} ON ${mainAlias}.id = ${alias}.user_id`;
      } else if (table === 'user_activity') {
        query += ` LEFT JOIN user_activity ${alias} ON ${mainAlias}.id = ${alias}.user_id`;
      } else if (table === 'MGAs') {
        query += ` LEFT JOIN MGAs ${alias} ON ${mainAlias}.lagnname = ${alias}.lagnname`;
      }
    }
  }
  if (conditions && conditions.length > 0) {
    query += ` WHERE `;
    const conditionClauses = [];
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const { field, operator, value, secondaryValue, connector, isMultiValue, subquery } = condition;
      if (!field || !operator) continue;
      
      // Skip conditions with empty field values (this prevents the empty id condition)
      if (field.trim() === '') continue;
      
      const [table, column] = field.split('.');
      if (!table || !column || !validTables.includes(table)) continue;
      const tableAlias = tableAliases[table];
      if (!tableAlias) continue;
      let conditionClause;
      // Subquery support
      if ((operator === 'not_in_subquery' || operator === 'in_subquery') && subquery && subquery.table && subquery.field) {
        // Build subquery SQL
        const subTable = subquery.table;
        const subField = subquery.field;
        const subConditions = subquery.conditions || [];
        // Only allow subquery on allowed tables
        if (!allowedTables.includes(subTable)) continue;
        // Build subquery WHERE
        let subWhere = '';
        const subParams = [];
        if (subConditions.length > 0) {
          const subClauses = subConditions.map(subCond => {
            const [subCondTable, subCondCol] = subCond.field.split('.');
            if (!subCondTable || !subCondCol || subCondTable !== subTable) return null;
            switch (subCond.operator) {
              case 'equals':
                subParams.push(subCond.value);
                return `${subCondCol} = ?`;
              case 'not_equals':
                subParams.push(subCond.value);
                return `${subCondCol} != ?`;
              case 'contains':
                subParams.push(`%${subCond.value}%`);
                return `${subCondCol} LIKE ?`;
              case 'starts_with':
                subParams.push(`${subCond.value}%`);
                return `${subCondCol} LIKE ?`;
              case 'ends_with':
                subParams.push(`%${subCond.value}`);
                return `${subCondCol} LIKE ?`;
              case 'greater_than':
                subParams.push(subCond.value);
                return `${subCondCol} > ?`;
              case 'less_than':
                subParams.push(subCond.value);
                return `${subCondCol} < ?`;
              case 'greater_or_equal':
                subParams.push(subCond.value);
                return `${subCondCol} >= ?`;
              case 'less_or_equal':
                subParams.push(subCond.value);
                return `${subCondCol} <= ?`;
              case 'between':
                subParams.push(subCond.value, subCond.secondaryValue);
                return `${subCondCol} BETWEEN ? AND ?`;
              case 'is_empty':
                return `${subCondCol} IS NULL OR ${subCondCol} = ''`;
              case 'is_not_empty':
                return `${subCondCol} IS NOT NULL AND ${subCondCol} != ''`;
              case 'is_true':
                return `${subCondCol} = 1`;
              case 'is_false':
                return `${subCondCol} = 0`;
              // Add date operators for subquery fields (no alias)
              case 'is_today':
                return `DATE(${subCondCol}) = CURDATE()`;
              case 'is_before_today':
                return `DATE(${subCondCol}) < CURDATE()`;
              case 'is_after_today':
                return `DATE(${subCondCol}) > CURDATE()`;
              case 'is_this_month':
                return `YEAR(${subCondCol}) = YEAR(CURDATE()) AND MONTH(${subCondCol}) = MONTH(CURDATE())`;
              case 'is_this_year':
                return `YEAR(${subCondCol}) = YEAR(CURDATE())`;
              case 'is_in_past':
                return `DATE(${subCondCol}) < CURDATE()`;
              case 'is_in_future':
                return `DATE(${subCondCol}) > CURDATE()`;
              case 'is_null':
                return `${subCondCol} IS NULL`;
              case 'is_not_null':
                return `${subCondCol} IS NOT NULL`;
              default:
                return null;
            }
          }).filter(Boolean);
          if (subClauses.length > 0) {
            subWhere = ' WHERE ' + subClauses.join(' AND ');
          }
        }
        // Build subquery SQL
        const subquerySQL = `SELECT ${subField} FROM ${subTable}${subWhere}`;
        // Add subquery params to main params
        params.push(...subParams);
        // Compose main condition
        if (operator === 'not_in_subquery') {
          conditionClause = `${tableAlias}.${column} NOT IN (${subquerySQL})`;
        } else {
          conditionClause = `${tableAlias}.${column} IN (${subquerySQL})`;
        }
      } else if (operator === 'equals' && value && value.includes(',') && (isMultiValue || isMultiValue === undefined)) {
        const values = value.split(',').map(v => v.trim()).filter(v => v);
        if (values.length > 0) {
          const multiValueClauses = values.map(() => `${tableAlias}.${column} = ?`);
          conditionClause = `(${multiValueClauses.join(' OR ')})`;
          params.push(...values);
        } else {
          conditionClause = `${tableAlias}.${column} = ?`;
          params.push(value);
        }
      } else {
        switch (operator) {
          case 'equals':
            conditionClause = `${tableAlias}.${column} = ?`;
            params.push(value);
            break;
          case 'not_equals':
            conditionClause = `${tableAlias}.${column} != ?`;
            params.push(value);
            break;
          case 'contains':
            conditionClause = `${tableAlias}.${column} LIKE ?`;
            params.push(`%${value}%`);
            break;
          case 'starts_with':
            conditionClause = `${tableAlias}.${column} LIKE ?`;
            params.push(`${value}%`);
            break;
          case 'ends_with':
            conditionClause = `${tableAlias}.${column} LIKE ?`;
            params.push(`%${value}`);
            break;
          case 'greater_than':
            conditionClause = `${tableAlias}.${column} > ?`;
            params.push(value);
            break;
          case 'less_than':
            conditionClause = `${tableAlias}.${column} < ?`;
            params.push(value);
            break;
          case 'greater_or_equal':
            conditionClause = `${tableAlias}.${column} >= ?`;
            params.push(value);
            break;
          case 'less_or_equal':
            conditionClause = `${tableAlias}.${column} <= ?`;
            params.push(value);
            break;
          case 'between':
            conditionClause = `${tableAlias}.${column} BETWEEN ? AND ?`;
            params.push(value, secondaryValue);
            break;
          case 'is_empty':
            conditionClause = `${tableAlias}.${column} IS NULL OR ${tableAlias}.${column} = ''`;
            break;
          case 'is_not_empty':
            conditionClause = `${tableAlias}.${column} IS NOT NULL AND ${tableAlias}.${column} != ''`;
            break;
          case 'is_true':
            conditionClause = `${tableAlias}.${column} = 1`;
            break;
          case 'is_false':
            conditionClause = `${tableAlias}.${column} = 0`;
            break;
          case 'is_today':
            conditionClause = `DATE(${tableAlias}.${column}) = CURDATE()`;
            break;
          case 'is_before_today':
            conditionClause = `DATE(${tableAlias}.${column}) < CURDATE()`;
            break;
          case 'is_after_today':
            conditionClause = `DATE(${tableAlias}.${column}) > CURDATE()`;
            break;
          case 'is_this_month':
            conditionClause = `YEAR(${tableAlias}.${column}) = YEAR(CURDATE()) AND MONTH(${tableAlias}.${column}) = MONTH(CURDATE())`;
            break;
          case 'is_this_year':
            conditionClause = `YEAR(${tableAlias}.${column}) = YEAR(CURDATE())`;
            break;
          case 'is_in_past':
            conditionClause = `DATE(${tableAlias}.${column}) < CURDATE()`;
            break;
          case 'is_in_future':
            conditionClause = `DATE(${tableAlias}.${column}) > CURDATE()`;
            break;
          case 'is_null':
            conditionClause = `${tableAlias}.${column} IS NULL`;
            break;
          case 'is_not_null':
            conditionClause = `${tableAlias}.${column} IS NOT NULL`;
            break;
          default:
            continue;
        }
      }
      if (i > 0 && conditionClause) {
        const currentConnector = condition.connector || logicOperator;
        conditionClauses.push({ clause: conditionClause, connector: currentConnector });
      } else if (conditionClause) {
        conditionClauses.push({ clause: conditionClause, connector: null });
      }
    }
    if (conditionClauses.length > 0) {
      const whereClause = conditionClauses.map((item, idx) => {
        if (idx === 0) return item.clause;
        return `${item.connector} ${item.clause}`;
      }).join(' ');
      query += whereClause;
    } else {
      query = query.replace(' WHERE ', '');
    }
  }
  return { query, params };
}

// Send immediate notification to users based on group query
router.post('/admin/send', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, message, type, link, groupId, queryData, tables } = req.body;
    
    if (!title || !message || !type || !queryData || !tables) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Build the query to find target users
    const { query, params } = buildQuery(queryData, tables);
    
    // Get user IDs that match the query
    // We're using the query directly since it already has the SELECT statement
    const userResults = await db.query(query, params);
    
    if (userResults.length === 0) {
      return res.json({ success: true, count: 0, message: 'No users matched the criteria' });
    }
    
    // Count the number of matching users
    const userCount = userResults.length;
    
    // Get the current timestamp with timezone conversion to Eastern Time
    const now = new Date();
    // Format the date in MySQL format 'YYYY-MM-DD HH:MM:SS'
    const formattedDate = now.toISOString().slice(0, 19).replace('T', ' ');
    
    // Store the query parameters as metadata for dynamic resolution
    const metadata = JSON.stringify({
      queryData,
      tables,
      userCount
    });
    
    // Create a single notification record for the entire group
    const notificationResult = await db.query(
      `INSERT INTO notifications 
        (title, message, type, link_url, created_at, target_group, metadata) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, message, type, link, formattedDate, groupId, metadata]
    );
    
    const notificationId = notificationResult.insertId;
    
    // Send push notifications in batches to avoid overwhelming the server
    try {
      console.log('Starting push notification process');
      
      // Get all users with push subscriptions that match our query
      const pushQuery = `
        SELECT ps.user_id, ps.subscription 
        FROM push_subscriptions ps
        INNER JOIN (${query}) AS matched_users 
        ON ps.user_id = matched_users.id
      `;
      
      console.log('Push query constructed:', pushQuery.substring(0, 100) + '...');
      console.log('Query params:', JSON.stringify(params));
      
      // Wrap in try-catch to handle potential SQL errors
      let pushSubscriptions = [];
      try {
        console.log('Executing push subscriptions query...');
        pushSubscriptions = await db.query(pushQuery, params);
        console.log(`Query returned ${pushSubscriptions ? pushSubscriptions.length : 0} results`);
        console.log('pushSubscriptions type:', typeof pushSubscriptions);
        console.log('Is array?', Array.isArray(pushSubscriptions));
        
        // Log the first result to see structure
        if (pushSubscriptions && pushSubscriptions.length > 0) {
          console.log('First subscription sample:', JSON.stringify(pushSubscriptions[0]).substring(0, 200) + '...');
        }
      } catch (sqlError) {
        console.error('Error executing push subscriptions query:', sqlError);
        console.error('SQL Error details:', {
          code: sqlError.code,
          message: sqlError.message,
          sqlMessage: sqlError.sqlMessage,
          sql: sqlError.sql
        });
        // Continue with empty array
      }
      
      // Make sure pushSubscriptions is an array before processing
      if (!pushSubscriptions) {
        console.log('Push subscriptions is null or undefined');
        pushSubscriptions = [];
      } else if (!Array.isArray(pushSubscriptions)) {
        console.log('Push subscriptions is not an array, converting:', typeof pushSubscriptions);
        // Try to convert to array if possible
        try {
          pushSubscriptions = Array.from(pushSubscriptions);
        } catch (conversionError) {
          console.error('Cannot convert pushSubscriptions to array:', conversionError);
          pushSubscriptions = [];
        }
      }
      
      // Final check
      if (Array.isArray(pushSubscriptions) && pushSubscriptions.length > 0) {
        console.log(`Processing ${pushSubscriptions.length} push subscriptions`);
        
        // Send push notifications in batches of 50
        const batchSize = 50;
        
        // Process in batches
        for (let i = 0; i < pushSubscriptions.length; i += batchSize) {
          console.log(`Processing batch starting at index ${i}`);
          
          // Safely slice the array
          const endIndex = Math.min(i + batchSize, pushSubscriptions.length);
          console.log(`Batch range: ${i} to ${endIndex}`);
          
          try {
            const batch = pushSubscriptions.slice(i, endIndex);
            console.log(`Batch size: ${batch.length}`);
            
            const validPromises = [];
            
            // Create promises for each valid subscription
            for (let j = 0; j < batch.length; j++) {
              const sub = batch[j];
              
              // Log detailed info about the subscription
              console.log(`Subscription ${j}:`, sub ? `user_id: ${sub.user_id}, has subscription: ${!!sub.subscription}` : 'undefined');
              
              if (sub && sub.user_id && sub.subscription) {
                // Directly add promise without nesting - this avoids potential iteration issues
                validPromises.push(
                  sendPushNotification(sub.user_id, {
                    id: notificationId,
                    title,
                    message,
                    link_url: link || '/notifications'
                  }).catch(err => {
                    console.error(`Push notification error for user ${sub.user_id}:`, err);
                    return false; // Continue with other notifications
                  })
                );
              }
            }
            
            // Only await if we have valid promises
            console.log(`Created ${validPromises.length} valid push notification promises`);
            if (validPromises.length > 0) {
              await Promise.all(validPromises);
              console.log(`Processed batch of ${validPromises.length} push notifications`);
            }
          } catch (batchError) {
            console.error(`Error processing batch starting at index ${i}:`, batchError);
            console.error('Error stack:', batchError.stack);
          }
        }
        
        console.log(`Completed sending push notifications to ${pushSubscriptions.length} users`);
      } else {
        console.log('No users with push subscriptions matched the query');
      }
    } catch (pushError) {
      console.error('Error in push notification process:', pushError);
      console.error('Error stack:', pushError.stack);
      // Continue anyway, as we've already created the notification record
    }
    
    res.json({ 
      success: true, 
      count: userCount,
      message: `Notification sent to ${userCount} user(s)` 
    });
  } catch (error) {
    console.error('Error sending admin notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Create scheduled notification
router.post('/scheduled', async (req, res) => {
  try {
    const notificationData = req.body;
    
    // Validate required fields
    if (!notificationData.title || !notificationData.message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }
    
    if (!notificationData.scheduled_for && !notificationData.metadata?.recurrence) {
      return res.status(400).json({ error: 'Either scheduled_for or recurrence settings are required' });
    }
    
    // Ensure target_group is an integer if provided
    if (notificationData.target_group) {
      notificationData.target_group = parseInt(notificationData.target_group, 10);
    }
    
    const notification = await scheduledNotificationService.createScheduledNotification(notificationData);
    res.status(201).json(notification);
  } catch (error) {
    logger.error('Error creating scheduled notification:', error);
    res.status(500).json({ error: 'Failed to create scheduled notification' });
  }
});

// Get all scheduled notifications
router.get('/scheduled', async (req, res) => {
  try {
    const filters = {
      is_sent: req.query.is_sent === 'true' ? true : (req.query.is_sent === 'false' ? false : undefined),
      is_paused: req.query.is_paused === 'true' ? true : (req.query.is_paused === 'false' ? false : undefined),
      target_group: req.query.target_group ? parseInt(req.query.target_group, 10) : undefined,
      type: req.query.type,
      scheduledBefore: req.query.before,
      scheduledAfter: req.query.after,
      orderBy: req.query.order_by || 'scheduled_for',
      orderDirection: req.query.order_direction || 'ASC',
      limit: req.query.limit,
      offset: req.query.offset
    };
    
    const notifications = await scheduledNotificationService.getScheduledNotifications(filters);
    res.json(notifications);
  } catch (error) {
    logger.error('Error retrieving scheduled notifications:', error);
    res.status(500).json({ error: 'Failed to retrieve scheduled notifications' });
  }
});

// Get scheduled notification by ID
router.get('/scheduled/:id', async (req, res) => {
  try {
    const notification = await scheduledNotificationService.getScheduledNotificationById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Scheduled notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    logger.error(`Error retrieving scheduled notification ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve scheduled notification' });
  }
});

// Update scheduled notification
router.put('/scheduled/:id', async (req, res) => {
  try {
    const notification = await scheduledNotificationService.getScheduledNotificationById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Scheduled notification not found' });
    }
    
    const updateData = req.body;
    
    // Ensure target_group is an integer if provided
    if (updateData.target_group) {
      updateData.target_group = parseInt(updateData.target_group, 10);
    }
    
    await scheduledNotificationService.updateScheduledNotification(req.params.id, updateData);
    
    // Get and return the updated notification
    const updatedNotification = await scheduledNotificationService.getScheduledNotificationById(req.params.id);
    res.json(updatedNotification);
  } catch (error) {
    logger.error(`Error updating scheduled notification ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update scheduled notification' });
  }
});

// Delete scheduled notification
router.delete('/scheduled/:id', async (req, res) => {
  try {
    const notification = await scheduledNotificationService.getScheduledNotificationById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Scheduled notification not found' });
    }
    
    await scheduledNotificationService.deleteScheduledNotification(req.params.id);
    res.status(204).end();
  } catch (error) {
    logger.error(`Error deleting scheduled notification ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete scheduled notification' });
  }
});

// Pause/resume scheduled notification
router.patch('/scheduled/:id/status', async (req, res) => {
  try {
    const notification = await scheduledNotificationService.getScheduledNotificationById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ error: 'Scheduled notification not found' });
    }
    
    if (req.body.is_paused === undefined) {
      return res.status(400).json({ error: 'is_paused field is required' });
    }
    
    await scheduledNotificationService.updateScheduledNotification(req.params.id, { 
      is_paused: req.body.is_paused 
    });
    
    // Get and return the updated notification
    const updatedNotification = await scheduledNotificationService.getScheduledNotificationById(req.params.id);
    res.json(updatedNotification);
  } catch (error) {
    logger.error(`Error updating scheduled notification status ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update scheduled notification status' });
  }
});


module.exports = router; 