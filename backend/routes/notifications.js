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
  try {
    // Validate VAPID key formats
    console.log('🔍 VAPID Key Validation:');
    console.log('📧 Contact Email:', process.env.VAPID_CONTACT_EMAIL);
    console.log('🔑 Public Key Length:', vapidKeys.publicKey.length);
    console.log('🔑 Private Key Length:', vapidKeys.privateKey.length);
    console.log('🔑 Public Key Format:', vapidKeys.publicKey.startsWith('B') ? 'Valid (Base64URL)' : 'Invalid format');
    console.log('🔑 Private Key Format:', vapidKeys.privateKey.length === 43 ? 'Valid length' : 'Invalid length');
    
    webpush.setVapidDetails(
      process.env.VAPID_CONTACT_EMAIL || 'mailto:ariasorganization@gmail.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log('✅ Web Push VAPID details configured successfully');
  } catch (vapidError) {
    console.error('❌ Error configuring VAPID details:', vapidError);
    console.error('📋 VAPID Details that failed:');
    console.error('   Email:', process.env.VAPID_CONTACT_EMAIL);
    console.error('   Public Key (first 20 chars):', vapidKeys.publicKey?.substring(0, 20));
    console.error('   Private Key (first 20 chars):', vapidKeys.privateKey?.substring(0, 20));
  }
} else {
  console.log('⚠️ Web Push VAPID keys not found - push notifications will be disabled');
  console.log('📋 Missing VAPID environment variables:');
  console.log('   VAPID_PUBLIC_KEY:', !!process.env.VAPID_PUBLIC_KEY);
  console.log('   VAPID_PRIVATE_KEY:', !!process.env.VAPID_PRIVATE_KEY);
  console.log('   VAPID_CONTACT_EMAIL:', !!process.env.VAPID_CONTACT_EMAIL);
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

// Get current user's notifications - ENHANCED STANDARDIZED VERSION
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, includeRead = false } = req.query;
    const limitInt = parseInt(limit);
    const offsetInt = parseInt(offset);
    
    console.log(`🚀 [FETCH] Enhanced notification fetch for user ${req.userId} (limit: ${limitInt}, offset: ${offsetInt}, includeRead: ${includeRead})`);
    
    // 1. Get user's traditional group memberships
    const userGroups = await db.query(
      'SELECT group_name FROM user_groups WHERE user_id = ?',
      [req.userId]
    );
    const groupNames = userGroups.map(g => g.group_name);
    
    console.log(`🔔 [FETCH] User belongs to ${groupNames.length} traditional groups:`, groupNames);
    
    // 2. Build simplified query that gets all notifications with read status from notification_reads
    let baseQuery = `
      SELECT 
        n.*,
        COALESCE(nr.is_read, 0) as is_read,
        COALESCE(nr.is_dismissed, 0) as is_dismissed
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE (
        n.user_id = ?
    `;
    
    let queryParams = [req.userId, req.userId];
    
    // 3. Add traditional group notifications
    if (groupNames.length > 0) {
      baseQuery += ` OR n.target_group IN (${groupNames.map(() => '?').join(',')})`;
      queryParams.push(...groupNames);
    }
    
    baseQuery += `)`;
    
    // 4. Add filter for read notifications if needed
    if (!includeRead) {
      baseQuery += ` AND COALESCE(nr.is_read, 0) = 0`;
    }
    
    // 5. Add ordering and pagination
    baseQuery += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(limitInt * 2, offsetInt); // Get extra for dynamic filtering
    
    console.log(`🔍 [FETCH] Executing query for direct and traditional group notifications...`);
    const directResults = await db.query(baseQuery, queryParams);
    
    console.log(`📊 [FETCH] Retrieved ${directResults.length} direct/traditional notifications`);
    
    // 6. Now check for dynamic group notifications
    const dynamicNotifications = await db.query(`
      SELECT 
        n.*,
        ng.query_data,
        ng.tables,
        COALESCE(nr.is_read, 0) as is_read,
        COALESCE(nr.is_dismissed, 0) as is_dismissed
      FROM notifications n
      INNER JOIN notification_groups ng ON n.target_group = ng.id
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE n.target_group IS NOT NULL 
      AND n.user_id IS NULL
      AND n.target_group NOT IN (${groupNames.length > 0 ? groupNames.map(() => '?').join(',') : "''"})
      ORDER BY n.created_at DESC
    `, [req.userId, ...(groupNames.length > 0 ? groupNames : [])]);
    
    console.log(`🔄 [FETCH] Found ${dynamicNotifications.length} dynamic group notifications to check`);
    
    // 7. Process dynamic notifications to see if user matches the criteria
    const matchingDynamicNotifications = [];
    
    for (const notification of dynamicNotifications) {
      try {
        const queryData = JSON.parse(notification.query_data);
        const tables = JSON.parse(notification.tables);
        
        console.log(`🔍 [FETCH] Checking dynamic notification ${notification.id} with query:`, queryData);
        
        // Build and execute the query to check if user matches
        const { query, params } = buildQuery(queryData, tables);
        
        // Create an efficient EXISTS query to check if user matches
        const userCheckQuery = query.replace('SELECT DISTINCT a.id, a.lagnname, a.email', 'SELECT 1');
        
        let finalUserCheck;
        if (userCheckQuery.includes('WHERE')) {
          finalUserCheck = userCheckQuery.replace('WHERE', `WHERE a.id = ${req.userId} AND `);
        } else {
          finalUserCheck = userCheckQuery + ` WHERE a.id = ${req.userId}`;
        }
        
        // Use EXISTS for better performance
        const existsQuery = `SELECT EXISTS(${finalUserCheck}) as matches`;
        
        console.log(`🔍 [FETCH] Running user match query: ${existsQuery.substring(0, 200)}...`);
        
        const userMatches = await db.query(existsQuery, params);
        
        if (userMatches.length > 0 && userMatches[0].matches > 0) {
          console.log(`✅ [FETCH] User ${req.userId} matches dynamic notification ${notification.id}`);
          
          // Remove the query metadata and add to results
          const cleanNotification = {
            ...notification,
            is_read: notification.is_read,
            is_dismissed: notification.is_dismissed
          };
          delete cleanNotification.query_data;
          delete cleanNotification.tables;
          
          matchingDynamicNotifications.push(cleanNotification);
        } else {
          console.log(`❌ [FETCH] User ${req.userId} does not match dynamic notification ${notification.id}`);
        }
        
      } catch (err) {
        console.warn(`⚠️ [FETCH] Error processing dynamic notification ${notification.id}:`, err.message);
        // Skip this notification if query is invalid
      }
    }
    
    console.log(`🎯 [FETCH] Found ${matchingDynamicNotifications.length} matching dynamic notifications`);
    
    // 8. Combine all results and sort by created_at
    const allResults = [...directResults, ...matchingDynamicNotifications];
    allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // 9. Apply read filter if needed
    let filteredResults = allResults;
    if (!includeRead) {
      filteredResults = allResults.filter(n => !n.is_read);
    }
    
    // 10. Apply final pagination
    const paginatedResults = filteredResults.slice(0, limitInt);
    
    // 11. Get unread count efficiently (include dynamic notifications)
    let unreadCount = 0;
    
    // Count direct/traditional unread
    let unreadCountQuery = `
      SELECT COUNT(*) as count 
      FROM notifications n
      LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = ?
      WHERE (
        n.user_id = ?
    `;
    
    let unreadParams = [req.userId, req.userId];
    
    if (groupNames.length > 0) {
      unreadCountQuery += ` OR n.target_group IN (${groupNames.map(() => '?').join(',')})`;
      unreadParams.push(...groupNames);
    }
    
    unreadCountQuery += `) AND COALESCE(nr.is_read, 0) = 0`;
    
    const directUnreadResult = await db.query(unreadCountQuery, unreadParams);
    unreadCount += directUnreadResult[0]?.count || 0;
    
    // Add dynamic notification unread count
    const dynamicUnreadCount = matchingDynamicNotifications.filter(n => !n.is_read).length;
    unreadCount += dynamicUnreadCount;
    
    console.log(`🎉 [FETCH] Completed enhanced fetch: ${paginatedResults.length} notifications (${directResults.length} direct + ${matchingDynamicNotifications.length} dynamic), ${unreadCount} unread`);
    
    res.json({
      notifications: paginatedResults,
      unreadCount: unreadCount
    });
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read - STANDARDIZED VERSION
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if notification exists
    const notification = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
    
    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notificationData = notification[0];
    
    // Always use notification_reads table for consistency
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
    
    // ✨ Send WebSocket update for real-time sync across tabs
    if (global.notificationManager) {
      global.notificationManager.notifyUser(req.userId, {
        type: 'notification_read',
        notificationId: parseInt(id),
        timestamp: new Date().toISOString()
      });
    }
    
    // Return the notification with updated read status
    return res.json({
      ...notificationData,
      is_read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read - ENHANCED STANDARDIZED VERSION  
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    console.log(`📚 [READ-ALL] Marking all notifications as read for user ${req.userId}`);
    
    // Get all notifications that the user can see (both traditional and dynamic groups)
    const userGroups = await db.query(
      'SELECT group_name FROM user_groups WHERE user_id = ?',
      [req.userId]
    );
    const groupNames = userGroups.map(g => g.group_name);
    
    // Build query to get all traditional notifications for this user
    let allNotificationsQuery = `
      SELECT DISTINCT n.id 
      FROM notifications n
      WHERE n.user_id = ?
    `;
    let queryParams = [req.userId];
    
    // Add traditional group notifications
    if (groupNames.length > 0) {
      allNotificationsQuery += `
        UNION
        SELECT DISTINCT n.id 
        FROM notifications n
        WHERE n.target_group IN (${groupNames.map(() => '?').join(',')})
        AND n.user_id IS NULL
      `;
      queryParams.push(...groupNames);
    }
    
    // Get traditional notification IDs
    const traditionalNotifications = await db.query(allNotificationsQuery, queryParams);
    console.log(`📋 [READ-ALL] Found ${traditionalNotifications.length} traditional notifications`);
    
    // Get dynamic group notifications and check if user matches
    const dynamicNotifications = await db.query(`
      SELECT n.id, ng.query_data, ng.tables
      FROM notifications n
      INNER JOIN notification_groups ng ON n.target_group = ng.id
      WHERE n.target_group IS NOT NULL 
      AND n.user_id IS NULL
      AND n.target_group NOT IN (${groupNames.length > 0 ? groupNames.map(() => '?').join(',') : "''"})
    `, groupNames.length > 0 ? groupNames : []);
    
    console.log(`🔄 [READ-ALL] Checking ${dynamicNotifications.length} dynamic notifications`);
    
    // Check which dynamic notifications the user matches
    const matchingDynamicIds = [];
    for (const notification of dynamicNotifications) {
      try {
        const queryData = JSON.parse(notification.query_data);
        const tables = JSON.parse(notification.tables);
        
        const { query, params } = buildQuery(queryData, tables);
        const userCheckQuery = query.replace('SELECT DISTINCT a.id, a.lagnname, a.email', 'SELECT 1');
        
        let finalUserCheck;
        if (userCheckQuery.includes('WHERE')) {
          finalUserCheck = userCheckQuery.replace('WHERE', `WHERE a.id = ${req.userId} AND `);
        } else {
          finalUserCheck = userCheckQuery + ` WHERE a.id = ${req.userId}`;
        }
        
        const existsQuery = `SELECT EXISTS(${finalUserCheck}) as matches`;
        const userMatches = await db.query(existsQuery, params);
        
        if (userMatches.length > 0 && userMatches[0].matches > 0) {
          matchingDynamicIds.push(notification.id);
        }
      } catch (err) {
        console.warn(`⚠️ [READ-ALL] Error checking dynamic notification ${notification.id}:`, err.message);
      }
    }
    
    console.log(`🎯 [READ-ALL] Found ${matchingDynamicIds.length} matching dynamic notifications`);
    
    // Combine all notification IDs that the user can see
    const allNotificationIds = [
      ...traditionalNotifications.map(n => n.id),
      ...matchingDynamicIds
    ];
    
    console.log(`📋 [READ-ALL] Total ${allNotificationIds.length} notifications to mark as read`);
    
    // For each notification, create or update read record
    for (const notificationId of allNotificationIds) {
      const existingRead = await db.query(
        'SELECT id FROM notification_reads WHERE notification_id = ? AND user_id = ?',
        [notificationId, req.userId]
      );
      
      if (existingRead.length === 0) {
        // Create new read record
        await db.query(
          'INSERT INTO notification_reads (notification_id, user_id, is_read, created_at) VALUES (?, ?, true, NOW())',
          [notificationId, req.userId]
        );
      } else {
        // Update existing read record
        await db.query(
          'UPDATE notification_reads SET is_read = true WHERE notification_id = ? AND user_id = ?',
          [notificationId, req.userId]
        );
      }
    }
    
    console.log(`✅ [READ-ALL] Successfully marked all notifications as read for user ${req.userId}`);
    
    // ✨ Send WebSocket update for real-time sync across tabs
    if (global.notificationManager) {
      global.notificationManager.notifyUser(req.userId, {
        type: 'all_notifications_read',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [READ-ALL] Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// Mark notification as dismissed - STANDARDIZED VERSION
router.put('/:id/dismiss', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if notification exists
    const notification = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
    
    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notificationData = notification[0];
    
    // Always use notification_reads table for consistency
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
    
    // ✨ Send WebSocket update for real-time sync across tabs
    if (global.notificationManager) {
      global.notificationManager.notifyUser(req.userId, {
        type: 'notification_dismissed',
        notificationId: parseInt(id),
        timestamp: new Date().toISOString()
      });
    }
    
    // Return the notification with updated dismissed status
    return res.json({
      ...notificationData,
      is_dismissed: true,
      is_read: true
    });
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

// Subscribe to push notifications - Updated to handle multiple devices properly
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription) {
      return res.status(400).json({ error: 'Subscription data is required' });
    }
    
    // Parse subscription to store endpoint as a unique identifier
    let subscriptionObj;
    try {
      subscriptionObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid subscription format' });
    }
    
    if (!subscriptionObj.endpoint) {
      return res.status(400).json({ error: 'Subscription must have an endpoint' });
    }
    
    console.log(`📱 Subscription attempt for user ${req.userId}, endpoint: ${subscriptionObj.endpoint.substring(0, 50)}...`);
    
    // Check if this specific endpoint already exists for this user
    const existingResults = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ? AND JSON_EXTRACT(subscription, "$.endpoint") = ?',
      [req.userId, subscriptionObj.endpoint]
    );
    
    if (existingResults.length > 0) {
      // Update existing subscription for this specific endpoint
      await db.query(
        'UPDATE push_subscriptions SET subscription = ?, updated_at = NOW() WHERE user_id = ? AND JSON_EXTRACT(subscription, "$.endpoint") = ?',
        [JSON.stringify(subscriptionObj), req.userId, subscriptionObj.endpoint]
      );
      console.log(`✅ Updated existing push subscription for user ${req.userId}, endpoint: ${subscriptionObj.endpoint.substring(0, 50)}...`);
    } else {
      // Create new subscription for this device
      await db.query(
        'INSERT INTO push_subscriptions (user_id, subscription, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [req.userId, JSON.stringify(subscriptionObj)]
      );
      console.log(`✅ Created new push subscription for user ${req.userId}, endpoint: ${subscriptionObj.endpoint.substring(0, 50)}...`);
      
      // Also update notification preferences to enable push for all types
      await updatePreferencesForPush(req.userId, true);
    }
    
    // Log current subscription count for this user
    const userSubscriptions = await db.query(
      'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?',
      [req.userId]
    );
    console.log(`📱 User ${req.userId} now has ${userSubscriptions[0].count} device(s) subscribed to push notifications`);
    
    res.json({ 
      success: true,
      message: 'Subscription saved successfully',
      deviceCount: userSubscriptions[0].count
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    
    // Handle the duplicate entry error gracefully (in case endpoint_hash constraint fails)
    if (error.code === 'ER_DUP_ENTRY') {
      console.log(`🔄 Handling duplicate endpoint for user ${req.userId}, attempting update...`);
      try {
        // Try to update the existing subscription
        const subscriptionObj = typeof req.body.subscription === 'string' 
          ? JSON.parse(req.body.subscription) 
          : req.body.subscription;
          
        await db.query(
          'UPDATE push_subscriptions SET subscription = ?, updated_at = NOW() WHERE user_id = ? AND JSON_EXTRACT(subscription, "$.endpoint") = ?',
          [JSON.stringify(subscriptionObj), req.userId, subscriptionObj.endpoint]
        );
        
        console.log(`✅ Successfully updated subscription after duplicate endpoint error`);
        return res.json({ 
          success: true,
          message: 'Subscription updated successfully (duplicate endpoint resolved)',
          deviceCount: 1
        });
      } catch (updateError) {
        console.error('❌ Failed to update after duplicate entry:', updateError);
        return res.status(500).json({ error: 'Failed to save push subscription' });
      }
    }
    
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
});

// Unsubscribe from push notifications - Updated to handle specific devices
router.post('/unsubscribe', verifyToken, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (subscription) {
      // Unsubscribe specific device
      let subscriptionObj;
      try {
        subscriptionObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid subscription format' });
      }
      
      if (subscriptionObj.endpoint) {
        // Delete specific subscription by endpoint
        const result = await db.query(
          'DELETE FROM push_subscriptions WHERE user_id = ? AND JSON_EXTRACT(subscription, "$.endpoint") = ?',
          [req.userId, subscriptionObj.endpoint]
        );
        console.log(`✅ Unsubscribed specific device for user ${req.userId}, endpoint: ${subscriptionObj.endpoint.substring(0, 50)}...`);
        
        // Check remaining subscriptions
        const remainingSubscriptions = await db.query(
          'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?',
          [req.userId]
        );
        console.log(`📱 User ${req.userId} now has ${remainingSubscriptions[0].count} device(s) remaining`);
        
        // If no subscriptions remain, update preferences
        if (remainingSubscriptions[0].count === 0) {
          await updatePreferencesForPush(req.userId, false);
          console.log(`🔕 Disabled push notifications for user ${req.userId} (no devices remaining)`);
        }
      } else {
        return res.status(400).json({ error: 'Subscription must have an endpoint' });
      }
    } else {
      // Unsubscribe all devices for this user
      const result = await db.query(
        'DELETE FROM push_subscriptions WHERE user_id = ?',
        [req.userId]
      );
      console.log(`✅ Unsubscribed all devices for user ${req.userId} (${result.affectedRows || 0} devices)`);
      
      // Update preferences to disable push
      await updatePreferencesForPush(req.userId, false);
    }
    
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
    
    // Get user's push subscriptions (all devices)
    const results = await db.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );
    
    if (!results || results.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return false;
    }
    
    console.log(`Found ${results.length} push subscription(s) for user ${userId}`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Send to all user's subscriptions (all their devices)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      
      // Ensure subscription is valid
      if (!result.subscription) {
        console.log(`Empty subscription found for user ${userId}, device ${i + 1}`);
        failureCount++;
        continue;
      }
      
      // Parse subscription with error handling
      let subscription;
      try {
        subscription = typeof result.subscription === 'string' 
          ? JSON.parse(result.subscription) 
          : result.subscription;
          
        // Validate the subscription format
        if (!subscription || !subscription.endpoint) {
          console.log(`Invalid subscription format for user ${userId}, device ${i + 1}`);
          failureCount++;
          continue;
        }
      } catch (parseError) {
        console.error(`Error parsing subscription for user ${userId}, device ${i + 1}:`, parseError);
        failureCount++;
        continue;
      }
      
      // Prepare notification payload
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/favicon.ico',
        badge: '/badge-icon.png',
        data: {
          notificationId: notification.id,
          url: notification.url || '/',
          timestamp: Date.now(),
          ...notification.data
        },
        actions: notification.actions || [],
        tag: notification.tag || `notification-${notification.id}`,
        renotify: true,
        requireInteraction: notification.priority === 'high'
      });
      
      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ Push notification sent successfully to user ${userId}, device ${i + 1}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Error sending push notification to user ${userId}, device ${i + 1}:`, error);
        failureCount++;
        
        // If subscription is invalid (410 Gone), remove it from database
        if (error.statusCode === 410) {
          console.log(`🧹 Removing invalid subscription for user ${userId}, device ${i + 1}`);
          try {
            await db.query(
              'DELETE FROM push_subscriptions WHERE user_id = ? AND subscription = ?',
              [userId, result.subscription]
            );
            console.log(`✅ Invalid subscription removed for user ${userId}`);
          } catch (deleteError) {
            console.error(`❌ Error removing invalid subscription:`, deleteError);
          }
        }
      }
    }
    
    console.log(`📊 Push notification summary for user ${userId}: ${successCount} successful, ${failureCount} failed out of ${results.length} devices`);
    
    // Return true if at least one notification was sent successfully
    return successCount > 0;
  } catch (error) {
    console.error(`Error in push notification process for user ${userId}:`, error);
    return false;
  }
}

// ADMIN ROUTES

// Create notification (admin only) - Uses internal function for consistency
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await createNotificationInternal(req.body);
    res.status(201).json(result);
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

// VAPID validation endpoint to help debug JWT issues
router.get('/debug-vapid', verifyToken, (req, res) => {
  try {
    const validation = {
      configured: isWebPushConfigured(),
      publicKeyPresent: !!vapidKeys.publicKey,
      privateKeyPresent: !!vapidKeys.privateKey,
      emailPresent: !!process.env.VAPID_CONTACT_EMAIL,
      publicKeyLength: vapidKeys.publicKey?.length || 0,
      privateKeyLength: vapidKeys.privateKey?.length || 0,
      publicKeyFormat: vapidKeys.publicKey?.startsWith('B') ? 'Valid' : 'Invalid',
      privateKeyFormat: vapidKeys.privateKey?.length === 43 ? 'Valid Length' : 'Invalid Length',
      contactEmail: process.env.VAPID_CONTACT_EMAIL,
      publicKeyPreview: vapidKeys.publicKey?.substring(0, 20) + '...',
      privateKeyPreview: vapidKeys.privateKey?.substring(0, 10) + '...',
    };

    // Test JWT generation (without actually sending)
    try {
      const crypto = require('crypto');
      const jwt = require('jsonwebtoken');
      
      // Try to generate a JWT like webpush would
      const header = {
        typ: 'JWT',
        alg: 'ES256'
      };
      
      const payload = {
        aud: 'https://web.push.apple.com',
        exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12 hours
        sub: process.env.VAPID_CONTACT_EMAIL || 'mailto:ariasorganization@gmail.com'
      };

      // Convert VAPID private key to proper format for JWT signing
      const privateKeyBuffer = Buffer.from(vapidKeys.privateKey, 'base64url');
      validation.privateKeyBufferLength = privateKeyBuffer.length;
      validation.jwtTestResult = 'JWT generation test skipped (complex crypto validation)';
      
    } catch (jwtError) {
      validation.jwtError = jwtError.message;
    }

    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all push subscriptions for VAPID key changes
router.post('/admin/clear-subscriptions', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log(`🧹 Admin clearing all push subscriptions due to VAPID key changes`);
    
    const result = await db.query('DELETE FROM push_subscriptions');
    
    console.log(`✅ Cleared ${result.affectedRows || 0} push subscriptions`);
    
    res.json({ 
      success: true, 
      message: `Cleared ${result.affectedRows || 0} push subscriptions`,
      affectedRows: result.affectedRows || 0
    });
    
  } catch (error) {
    console.error('Error clearing push subscriptions:', error);
    res.status(500).json({ error: 'Failed to clear push subscriptions' });
  }
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

// Test endpoint to manually trigger scheduled notification processing
router.post('/debug/process-scheduled', async (req, res) => {
  try {
    console.log('🔔 [DEBUG] Manually triggering scheduled notification processing...');
    const stats = await scheduledNotificationService.processDueNotifications();
    
    res.json({
      success: true,
      message: 'Scheduled notification processing completed',
      stats: stats
    });
  } catch (error) {
    logger.error('Error in manual scheduled notification processing:', error);
    res.status(500).json({ 
      error: 'Failed to process scheduled notifications',
      details: error.message
    });
  }
});

// Test endpoint to create a scheduled notification due in 1 minute
router.post('/debug/create-test-scheduled', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🔔 [DEBUG] Creating test scheduled notification...');
    
    // Create a notification scheduled for 1 minute from now
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    
    console.log('🔔 [DEBUG] Current time:', now.toISOString());
    console.log('🔔 [DEBUG] Scheduling for:', scheduledFor.toISOString());
    
    const testNotification = {
      title: 'Test Scheduled Notification',
      message: 'This is a test notification scheduled to be sent automatically.',
      type: 'info',
      user_id: req.userId, // Send to the admin creating it
      scheduled_for: scheduledFor.toISOString().slice(0, 19).replace('T', ' '), // MySQL format
      link_url: '/notifications',
      metadata: {},
      is_paused: false
    };
    
    const notification = await scheduledNotificationService.createScheduledNotification(testNotification);
    
    console.log('🔔 [DEBUG] Test scheduled notification created:', notification.id);
    
    res.json({
      success: true,
      message: 'Test scheduled notification created',
      notification: notification,
      scheduledFor: scheduledFor.toISOString(),
      willBeProcessedIn: '1 minute'
    });
  } catch (error) {
    logger.error('Error creating test scheduled notification:', error);
    res.status(500).json({ 
      error: 'Failed to create test scheduled notification',
      details: error.message
    });
  }
});

// Internal function to create and send notifications (used by both routes and scheduler)
async function createNotificationInternal(notificationData) {
  const {
    title,
    message,
    type = 'info',
    user_id = null,
    target_group = null,
    scheduled_for = null,
    link_url = null,
    metadata = '{}',
    created_at = null
  } = notificationData;
  
  if (!title || !message) {
    throw new Error('Title and message are required');
  }
  
  // Convert metadata to string if it's an object
  const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
  
  // Use provided created_at or current time
  const effectiveCreatedAt = created_at || new Date();
  
  const result = await db.query(
    `INSERT INTO notifications 
     (title, message, type, user_id, target_group, scheduled_for, link_url, metadata, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, message, type, user_id, target_group, scheduled_for, link_url, metadataStr, effectiveCreatedAt]
  );
  
  const insertedId = result.insertId;
  const inserted = await db.query('SELECT * FROM notifications WHERE id = ?', [insertedId]);
  
  // If this is a direct notification to a user, send push notification
  if (user_id) {
    console.log(`🔔 [INTERNAL] Processing individual user notification for user_id: ${user_id}`);
    
    // Send push notification
    sendPushNotification(user_id, {
      id: insertedId,
      title,
      message,
      link_url
    }).catch(err => console.error('Error sending push notification:', err));

    // Send WebSocket notification for real-time updates
    if (global.notificationManager) {
      console.log(`🔔 [INTERNAL] Sending WebSocket notification to user ${user_id}`);
      global.notificationManager.notifyUser(user_id, {
        id: insertedId,
        title,
        message,
        type,
        link_url,
        created_at: effectiveCreatedAt.toISOString ? effectiveCreatedAt.toISOString() : new Date(effectiveCreatedAt).toISOString()
      });
    } else {
      console.log(`❌ [INTERNAL] No notificationManager available for WebSocket`);
    }
  } 
  // If this is a group notification, send to all users in the group
  else if (target_group) {
    console.log(`🔔 [INTERNAL] Processing group notification for target_group: ${target_group} (type: ${typeof target_group})`);
    
    let groupUsers = [];
    
    try {
      // First, try to get the notification group definition (like immediate notifications do)
      const groupResult = await db.query(
        'SELECT query_data, tables FROM notification_groups WHERE id = ?',
        [target_group]
      );
      
      if (groupResult.length > 0) {
        console.log(`🔔 [INTERNAL] Found notification group definition for ID ${target_group}`);
        
        // Use the same logic as immediate notifications
        const group = groupResult[0];
        const queryData = JSON.parse(group.query_data);
        const tables = JSON.parse(group.tables);
        
        console.log(`🔔 [INTERNAL] Using dynamic query for group ${target_group}:`, queryData);
        
        // Build and execute the query (same as immediate notifications)
        const { query, params } = buildQuery(queryData, tables);
        const userResults = await db.query(query, params);
        
        // Convert to the expected format
        groupUsers = userResults.map(user => ({ user_id: user.id }));
        console.log(`🔔 [INTERNAL] Dynamic query found ${groupUsers.length} users for group ${target_group}`);
        
      } else {
        console.log(`🔔 [INTERNAL] No notification group found with ID ${target_group}, falling back to user_groups table`);
        
        // Fallback to the old user_groups logic (in case it's still used somewhere)
        const allGroups = await db.query('SELECT DISTINCT group_name FROM user_groups');
        console.log(`🔔 [INTERNAL] Available groups in user_groups table:`, allGroups.map(g => g.group_name));
        
        // Try to handle target_group as both ID and name
        if (typeof target_group === 'string' || isNaN(target_group)) {
          // Query by group_name
          console.log(`🔔 [INTERNAL] Querying users by group_name: ${target_group}`);
          groupUsers = await db.query(
            'SELECT user_id FROM user_groups WHERE group_name = ?',
            [target_group]
          );
        } else {
          // For integer target_group, try common group mappings
          console.log(`🔔 [INTERNAL] target_group is integer: ${target_group}`);
          
          const groupIdToName = {
            1: 'Admin',
            2: 'User', 
            3: 'Manager',
            4: 'Agent'
          };
          
          const groupName = groupIdToName[target_group] || target_group.toString();
          console.log(`🔔 [INTERNAL] Mapping group ID ${target_group} to name: ${groupName}`);
          
          groupUsers = await db.query(
            'SELECT user_id FROM user_groups WHERE group_name = ?',
            [groupName]
          );
        }
      }
    } catch (groupError) {
      console.error(`❌ [INTERNAL] Error processing group ${target_group}:`, groupError);
      groupUsers = [];
    }
    
    console.log(`🔔 [INTERNAL] Found ${groupUsers.length} users in group ${target_group}`);
    
    if (groupUsers.length === 0) {
      console.log(`❌ [INTERNAL] No users found for target_group: ${target_group}`);
      // Log some debugging info
      const allNotificationGroups = await db.query('SELECT id, name FROM notification_groups');
      console.log(`🔔 [INTERNAL] Available notification groups:`, allNotificationGroups.map(g => `${g.id}: ${g.name}`));
    } else {
      // ✅ OPTIMIZED GROUP NOTIFICATION PROCESSING
      console.log(`🚀 [INTERNAL] Starting optimized batch processing for ${groupUsers.length} users`);
      
      try {
        // 1. Batch get all push subscriptions in one query (eliminates N+1 problem)
        const userIds = groupUsers.map(u => u.user_id);
        const subscriptions = userIds.length > 0 ? await db.query(
          `SELECT user_id, subscription FROM push_subscriptions WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
          userIds
        ) : [];
        
        console.log(`🔔 [INTERNAL] Found ${subscriptions.length} push subscriptions for ${userIds.length} users`);
        
        // 2. Create subscription lookup map for fast access
        const subscriptionMap = new Map();
        subscriptions.forEach(sub => {
          if (sub.subscription) {
            try {
              const parsed = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription;
              if (parsed && parsed.endpoint) {
                subscriptionMap.set(sub.user_id, parsed);
              }
            } catch (parseError) {
              console.warn(`❌ [INTERNAL] Invalid subscription for user ${sub.user_id}:`, parseError.message);
            }
          }
        });
        
        console.log(`🔔 [INTERNAL] Processed ${subscriptionMap.size} valid push subscriptions`);
        
        // 3. Send push notifications with controlled concurrency
        const PUSH_CONCURRENCY_LIMIT = 15; // Max concurrent push requests
        const pushNotificationData = {
          id: insertedId,
          title,
          message,
          link_url
        };
        
        // Helper function to send push with retry
        const sendPushWithRetry = async (userId) => {
          const subscription = subscriptionMap.get(userId);
          if (!subscription) {
            console.log(`ℹ️ [INTERNAL] No push subscription for user ${userId}`);
            return { success: false, reason: 'no_subscription' };
          }
          
          try {
            await sendPushNotification(userId, pushNotificationData);
            return { success: true };
          } catch (error) {
            console.error(`❌ [INTERNAL] Push failed for user ${userId}:`, error.message);
            return { success: false, reason: 'push_failed', error: error.message };
          }
        };
        
        // Process push notifications in batches with concurrency control
        const pushPromises = [];
        for (let i = 0; i < userIds.length; i += PUSH_CONCURRENCY_LIMIT) {
          const batch = userIds.slice(i, i + PUSH_CONCURRENCY_LIMIT);
          const batchPromises = batch.map(userId => sendPushWithRetry(userId));
          
          console.log(`🔔 [INTERNAL] Processing push batch ${Math.floor(i/PUSH_CONCURRENCY_LIMIT) + 1}/${Math.ceil(userIds.length/PUSH_CONCURRENCY_LIMIT)} (${batch.length} users)`);
          
          // Wait for this batch to complete before starting the next
          const batchResults = await Promise.allSettled(batchPromises);
          pushPromises.push(...batchResults);
          
          // Small delay between batches to avoid overwhelming push services
          if (i + PUSH_CONCURRENCY_LIMIT < userIds.length) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
        }
        
        // Analyze push results
        const pushStats = {
          total: pushPromises.length,
          successful: pushPromises.filter(p => p.status === 'fulfilled' && p.value.success).length,
          failed: pushPromises.filter(p => p.status === 'rejected' || (p.status === 'fulfilled' && !p.value.success)).length
        };
        
        console.log(`📊 [INTERNAL] Push notification results: ${pushStats.successful}/${pushStats.total} successful, ${pushStats.failed} failed`);
        
        // 4. Send WebSocket notifications in parallel (these are fast)
        if (global.notificationManager) {
          console.log(`🔔 [INTERNAL] Sending WebSocket notifications to ${userIds.length} users`);
          
          const webSocketData = {
            id: insertedId,
            title,
            message,
            type,
            link_url,
            created_at: effectiveCreatedAt.toISOString ? effectiveCreatedAt.toISOString() : new Date(effectiveCreatedAt).toISOString()
          };
          
          // Send all WebSocket notifications in parallel (they're fast and local)
          const wsPromises = userIds.map(userId => {
            try {
              return global.notificationManager.notifyUser(userId, webSocketData);
            } catch (error) {
              console.warn(`❌ [INTERNAL] WebSocket failed for user ${userId}:`, error.message);
              return Promise.resolve();
            }
          });
          
          await Promise.allSettled(wsPromises);
          console.log(`✅ [INTERNAL] WebSocket notifications sent to ${userIds.length} users`);
        } else {
          console.log(`❌ [INTERNAL] No notificationManager available for WebSocket notifications`);
        }
        
        console.log(`🎉 [INTERNAL] Batch processing complete for ${groupUsers.length} users`);
        
      } catch (batchError) {
        console.error(`❌ [INTERNAL] Error in batch processing:`, batchError);
        
        // Fallback to sequential processing if batch fails
        console.log(`🔄 [INTERNAL] Falling back to sequential processing...`);
        for (const user of groupUsers.slice(0, 10)) { // Limit fallback to 10 users
          try {
            await sendPushNotification(user.user_id, {
              id: insertedId,
              title,
              message,
              link_url
            });
            
            if (global.notificationManager) {
              global.notificationManager.notifyUser(user.user_id, {
                id: insertedId,
                title,
                message,
                type,
                link_url,
                created_at: effectiveCreatedAt.toISOString ? effectiveCreatedAt.toISOString() : new Date(effectiveCreatedAt).toISOString()
              });
            }
          } catch (fallbackError) {
            console.error(`❌ [INTERNAL] Fallback failed for user ${user.user_id}:`, fallbackError.message);
          }
        }
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
  
  return inserted[0];
}

// Test endpoint to create a scheduled notification for a specific user (debugging)
router.post('/debug/create-user-scheduled', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🔔 [DEBUG] Creating test scheduled notification for current user...');
    
    // Create a notification scheduled for 1 minute from now for the current user
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    
    console.log('🔔 [DEBUG] Current time:', now.toISOString());
    console.log('🔔 [DEBUG] Scheduling for:', scheduledFor.toISOString());
    console.log('🔔 [DEBUG] User ID:', req.userId);
    
    const testNotification = {
      title: 'Test User Scheduled Notification',
      message: 'This is a test notification scheduled for a specific user.',
      type: 'info',
      user_id: req.userId, // Send to the admin creating it
      target_group: null, // No group, just the user
      scheduled_for: scheduledFor.toISOString().slice(0, 19).replace('T', ' '), // MySQL format
      link_url: '/notifications',
      metadata: {},
      is_paused: false
    };
    
    const notification = await scheduledNotificationService.createScheduledNotification(testNotification);
    
    console.log('🔔 [DEBUG] Test user scheduled notification created:', notification.id);
    
    res.json({
      success: true,
      message: 'Test user scheduled notification created',
      notification: notification,
      scheduledFor: scheduledFor.toISOString(),
      userId: req.userId,
      willBeProcessedIn: '1 minute'
    });
  } catch (error) {
    logger.error('Error creating test user scheduled notification:', error);
    res.status(500).json({ 
      error: 'Failed to create test user scheduled notification',
      details: error.message
    });
  }
});

// Debug endpoint to check notification read status
router.get('/debug/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the notification
    const notification = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
    if (notification.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    const notif = notification[0];
    
    // Check if there's a read record for this user
    const readRecord = await db.query(
      'SELECT * FROM notification_reads WHERE notification_id = ? AND user_id = ?',
      [id, req.userId]
    );
    
    // Get user's groups for context
    const userGroups = await db.query(
      'SELECT group_name FROM user_groups WHERE user_id = ?',
      [req.userId]
    );
    
    const debugInfo = {
      notification: {
        id: notif.id,
        title: notif.title,
        user_id: notif.user_id,
        target_group: notif.target_group,
        is_read: notif.is_read,
        created_at: notif.created_at
      },
      user: {
        id: req.userId,
        groups: userGroups.map(g => g.group_name)
      },
      readRecord: readRecord.length > 0 ? readRecord[0] : null,
      computedReadStatus: readRecord.length > 0 ? readRecord[0].is_read : notif.is_read,
      notificationType: notif.user_id ? 'direct' : 'group'
    };
    
    res.json(debugInfo);
  } catch (error) {
    console.error('Debug status error:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

// Debug endpoint to apply notification standardization (admin only)
router.post('/debug/standardize', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🔧 [DEBUG] Admin triggered notification standardization...');
    
    const { standardizeNotifications } = require('../scripts/apply_notification_standardization');
    await standardizeNotifications();
    
    res.json({
      success: true,
      message: 'Notification standardization completed successfully'
    });
  } catch (error) {
    console.error('Error in notification standardization:', error);
    res.status(500).json({ 
      error: 'Failed to standardize notifications',
      details: error.message
    });
  }
});

// Debug endpoint to test dynamic notification matching (admin only)
router.post('/debug/test-dynamic-match/:userId', verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`🔧 [DEBUG] Testing dynamic notification matching for user ${userId}`);
    
    // Get user details
    const userDetails = await db.query('SELECT * FROM activeusers WHERE id = ?', [userId]);
    if (userDetails.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDetails[0];
    console.log(`👤 [DEBUG] User details:`, {
      id: user.id,
      lagnname: user.lagnname,
      Active: user.Active,
      managerActive: user.managerActive
    });
    
    // Get all dynamic group notifications
    const dynamicNotifications = await db.query(`
      SELECT n.*, ng.name as group_name, ng.query_data, ng.tables
      FROM notifications n
      INNER JOIN notification_groups ng ON n.target_group = ng.id
      WHERE n.target_group IS NOT NULL 
      AND n.user_id IS NULL
    `);
    
    console.log(`🔄 [DEBUG] Found ${dynamicNotifications.length} dynamic notifications`);
    
    const testResults = [];
    
    for (const notification of dynamicNotifications) {
      try {
        const queryData = JSON.parse(notification.query_data);
        const tables = JSON.parse(notification.tables);
        
        console.log(`🔍 [DEBUG] Testing notification ${notification.id} (${notification.group_name})`);
        console.log(`🔍 [DEBUG] Query conditions:`, queryData);
        
        // Build and execute the query
        const { query, params } = buildQuery(queryData, tables);
        
        // Create user-specific check
        const userCheckQuery = query.replace('SELECT DISTINCT a.id, a.lagnname, a.email', 'SELECT 1');
        
        let finalUserCheck;
        if (userCheckQuery.includes('WHERE')) {
          finalUserCheck = userCheckQuery.replace('WHERE', `WHERE a.id = ${userId} AND `);
        } else {
          finalUserCheck = userCheckQuery + ` WHERE a.id = ${userId}`;
        }
        
        const existsQuery = `SELECT EXISTS(${finalUserCheck}) as matches`;
        
        console.log(`🔍 [DEBUG] Generated query: ${existsQuery}`);
        console.log(`🔍 [DEBUG] Query params:`, params);
        
        const userMatches = await db.query(existsQuery, params);
        const matches = userMatches.length > 0 && userMatches[0].matches > 0;
        
        testResults.push({
          notificationId: notification.id,
          title: notification.title,
          groupName: notification.group_name,
          conditions: queryData.conditions,
          matches: matches,
          query: existsQuery,
          params: params
        });
        
        console.log(`${matches ? '✅' : '❌'} [DEBUG] Notification ${notification.id}: ${matches ? 'MATCHES' : 'NO MATCH'}`);
        
      } catch (err) {
        console.error(`❌ [DEBUG] Error testing notification ${notification.id}:`, err);
        testResults.push({
          notificationId: notification.id,
          title: notification.title,
          error: err.message
        });
      }
    }
    
    const matchingCount = testResults.filter(r => r.matches).length;
    console.log(`🎯 [DEBUG] Summary: ${matchingCount}/${testResults.length} notifications match user ${userId}`);
    
    res.json({
      success: true,
      userId: userId,
      user: {
        id: user.id,
        lagnname: user.lagnname,
        Active: user.Active,
        managerActive: user.managerActive
      },
      totalNotifications: testResults.length,
      matchingNotifications: matchingCount,
      results: testResults
    });
    
  } catch (error) {
    console.error('Error in dynamic match test:', error);
    res.status(500).json({ 
      error: 'Failed to test dynamic notification matching',
      details: error.message
    });
  }
});

// Admin route to view push subscription details
router.get('/admin/subscriptions', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        ps.id,
        ps.user_id,
        au.lagnname,
        au.clname,
        JSON_EXTRACT(ps.subscription, '$.endpoint') as endpoint,
        CASE 
          WHEN JSON_EXTRACT(ps.subscription, '$.endpoint') LIKE '%web.push.apple.com%' THEN 'Safari (iOS/macOS)'
          WHEN JSON_EXTRACT(ps.subscription, '$.endpoint') LIKE '%fcm.googleapis.com%' THEN 'Chrome/Edge/Firefox'
          WHEN JSON_EXTRACT(ps.subscription, '$.endpoint') LIKE '%wns%' THEN 'Edge (Windows)'
          WHEN JSON_EXTRACT(ps.subscription, '$.endpoint') LIKE '%mozilla.com%' THEN 'Firefox'
          ELSE 'Unknown'
        END as browser_type,
        ps.created_at,
        ps.updated_at
      FROM push_subscriptions ps
      LEFT JOIN activeusers au ON ps.user_id = au.id
    `;
    
    const params = [];
    
    if (userId) {
      query += ' WHERE ps.user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY ps.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const subscriptions = await db.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM push_subscriptions ps';
    let countParams = [];
    
    if (userId) {
      countQuery += ' WHERE ps.user_id = ?';
      countParams.push(userId);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    
    // Get summary stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(subscriptions_per_user) as avg_subscriptions_per_user
      FROM (
        SELECT user_id, COUNT(*) as subscriptions_per_user 
        FROM push_subscriptions 
        GROUP BY user_id
      ) as user_stats
    `;
    
    const [stats] = await db.query(statsQuery);
    
    // Get browser type breakdown
    const browserStatsQuery = `
      SELECT 
        CASE 
          WHEN JSON_EXTRACT(subscription, '$.endpoint') LIKE '%web.push.apple.com%' THEN 'Safari'
          WHEN JSON_EXTRACT(subscription, '$.endpoint') LIKE '%fcm.googleapis.com%' THEN 'Chrome/Edge/Firefox'
          WHEN JSON_EXTRACT(subscription, '$.endpoint') LIKE '%wns%' THEN 'Edge (Windows)'
          WHEN JSON_EXTRACT(subscription, '$.endpoint') LIKE '%mozilla.com%' THEN 'Firefox'
          ELSE 'Unknown'
        END as browser_type,
        COUNT(*) as count
      FROM push_subscriptions
      GROUP BY browser_type
      ORDER BY count DESC
    `;
    
    const browserStats = await db.query(browserStatsQuery);
    
    res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          total: countResult.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        },
        stats: stats[0],
        browserStats
      }
    });
    
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch subscription details' 
    });
  }
});

module.exports = router;
module.exports.createNotificationInternal = createNotificationInternal; 