/**
 * Service for handling notifications
 */
const db = require('../db');
const logger = require('../utils/logger');

/**
 * Create a new notification
 * @param {Object} notificationData - The notification data
 * @returns {Promise<Object>} The created notification
 */
async function createNotification(notificationData) {
  try {
    // Prepare data for insertion
    const {
      title,
      message,
      type = 'info',
      user_id = null,
      target_group = null,
      scheduled_for = null,
      link_url = null,
      metadata = {},
      created_at = null
    } = notificationData;


    // Process metadata with proper error handling
    let metadataStr;
    try {
      if (typeof metadata === 'string') {
        // Verify it's valid JSON by parsing and re-stringifying
        metadataStr = JSON.stringify(JSON.parse(metadata));
      } else if (typeof metadata === 'object') {
        metadataStr = JSON.stringify(metadata);
      } else {
        // Default to empty object for invalid types
        metadataStr = '{}';
      }
    } catch (err) {
      logger.warn(`Error processing metadata for new notification:`, err);
      metadataStr = '{}';
    }

    // For scheduled notifications, use the scheduled_for time as the created_at time
    // This ensures the notification appears to have been created at the intended schedule time
    const effectiveCreatedAt = created_at || scheduled_for || new Date();
    
    // Ensure target_group is an integer or null
    const targetGroupId = target_group ? parseInt(target_group, 10) : null;

    const result = await db.query(
      `INSERT INTO notifications 
       (title, message, type, user_id, target_group, scheduled_for, link_url, metadata, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, message, type, user_id, targetGroupId, scheduled_for, link_url, metadataStr, effectiveCreatedAt]
    );

    // Return the created notification with its ID
    return {
      id: result.insertId,
      ...notificationData,
      metadata: metadataStr,
      target_group: targetGroupId,
      created_at: effectiveCreatedAt
    };
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notification by ID
 * @param {number} id - The notification ID
 * @returns {Promise<Object|null>} The notification or null if not found
 */
async function getNotificationById(id) {
  try {
    const [notification] = await db.query(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    );
    
    return notification || null;
  } catch (error) {
    logger.error(`Error retrieving notification ${id}:`, error);
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {number} userId - The user ID
 * @param {Object} options - Options for filtering notifications
 * @returns {Promise<Array>} Array of notifications
 */
async function getUserNotifications(userId, options = {}) {
  try {
    const { limit = 20, includeRead = false } = options;
    
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ?
    `;
    
    if (!includeRead) {
      query += ` AND is_read = false`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    
    return await db.query(query, [userId, limit]);
  } catch (error) {
    logger.error(`Error retrieving notifications for user ${userId}:`, error);
    throw error;
  }
}

module.exports = {
  createNotification,
  getNotificationById,
  getUserNotifications
}; 