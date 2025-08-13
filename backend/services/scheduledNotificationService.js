/**
 * Service for handling scheduled notifications
 */
const db = require('../db');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Create a new scheduled notification
 * @param {Object} notificationData - The notification data
 * @returns {Promise<Object>} The created notification
 */
async function createScheduledNotification(notificationData) {
  try {
    // Prepare data for insertion
    const {
      title,
      message,
      type = 'info',
      user_id = null,
      target_group = null,
      scheduled_for,
      link_url = null,
      metadata = {},
      is_paused = false
    } = notificationData;

    // Convert metadata to JSON string if needed
    // This handles complex nested objects like queryData examples
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
      logger.warn(`Error processing metadata for new scheduled notification:`, err);
      metadataStr = '{}';
    }
    
    // Ensure target_group is an integer or null
    const targetGroupId = target_group ? parseInt(target_group, 10) : null;

    // Set current timestamp for created_at and updated_at
    const now = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: 'YYYY-MM-DD HH:MM:SS'

    const result = await db.query(
      `INSERT INTO scheduled_notifications 
       (title, message, type, user_id, target_group, scheduled_for, link_url, metadata, is_paused, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, message, type, user_id, targetGroupId, scheduled_for, link_url, metadataStr, is_paused, now, now]
    );

    // Return the created notification with its ID
    return {
      id: result.insertId,
      ...notificationData,
      metadata: metadataStr, // Return the processed metadata string
      target_group: targetGroupId,
      is_sent: false,
      created_at: now,
      updated_at: now
    };
  } catch (error) {
    logger.error('Error creating scheduled notification:', error);
    throw error;
  }
}

/**
 * Get scheduled notification by ID
 * @param {number} id - The notification ID
 * @returns {Promise<Object|null>} The notification or null if not found
 */
async function getScheduledNotificationById(id) {
  try {
    const [notification] = await db.query(
      'SELECT * FROM scheduled_notifications WHERE id = ?',
      [id]
    );
    
    return notification || null;
  } catch (error) {
    logger.error(`Error retrieving scheduled notification ${id}:`, error);
    throw error;
  }
}

/**
 * Update a scheduled notification
 * @param {number} id - The notification ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<boolean>} Success status
 */
async function updateScheduledNotification(id, updateData) {
  try {
    // Extract updatable fields
    const {
      title,
      message,
      type,
      user_id,
      target_group,
      scheduled_for,
      link_url,
      metadata,
      is_paused
    } = updateData;

    // Build SET clause parts and values array
    const setParts = [];
    const values = [];

    // Track if we're making significant changes that should reset is_sent
    let shouldResetSent = false;

    if (title !== undefined) {
      setParts.push('title = ?');
      values.push(title);
      shouldResetSent = true;
    }

    if (message !== undefined) {
      setParts.push('message = ?');
      values.push(message);
      shouldResetSent = true;
    }

    if (type !== undefined) {
      setParts.push('type = ?');
      values.push(type);
      shouldResetSent = true;
    }

    if (user_id !== undefined) {
      setParts.push('user_id = ?');
      values.push(user_id);
      shouldResetSent = true;
    }

    if (target_group !== undefined) {
      setParts.push('target_group = ?');
      // Ensure target_group is an integer or null
      const targetGroupId = target_group ? parseInt(target_group, 10) : null;
      values.push(targetGroupId);
      shouldResetSent = true;
    }

    if (scheduled_for !== undefined) {
      setParts.push('scheduled_for = ?');
      values.push(scheduled_for);
      shouldResetSent = true;
    }

    if (link_url !== undefined) {
      setParts.push('link_url = ?');
      values.push(link_url);
      shouldResetSent = true;
    }

    if (metadata !== undefined) {
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
        logger.warn(`Error processing metadata for updating notification ${id}:`, err);
        metadataStr = '{}';
      }
      
      setParts.push('metadata = ?');
      values.push(metadataStr);
      shouldResetSent = true;
    }

    if (is_paused !== undefined) {
      setParts.push('is_paused = ?');
      values.push(is_paused);
      // Changing pause status doesn't reset is_sent
    }

    // If we're making significant changes, reset is_sent to false
    if (shouldResetSent) {
      // First check if the notification was previously sent
      const [notification] = await db.query(
        'SELECT is_sent FROM scheduled_notifications WHERE id = ?',
        [id]
      );
      
      if (notification && notification.is_sent) {
        // Only add is_sent=FALSE if it was previously sent
        setParts.push('is_sent = FALSE');
        logger.info(`Resetting is_sent flag to FALSE for updated notification ${id}`);
      }
    }

    // Update timestamp
    setParts.push('updated_at = CURRENT_TIMESTAMP');

    // Add ID to values array
    values.push(id);

    // Execute update if there are fields to update
    if (setParts.length > 0) {
      await db.query(
        `UPDATE scheduled_notifications SET ${setParts.join(', ')} WHERE id = ?`,
        values
      );
    }

    return true;
  } catch (error) {
    logger.error(`Error updating scheduled notification ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a scheduled notification
 * @param {number} id - The notification ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteScheduledNotification(id) {
  try {
    await db.query(
      'DELETE FROM scheduled_notifications WHERE id = ?',
      [id]
    );
    return true;
  } catch (error) {
    logger.error(`Error deleting scheduled notification ${id}:`, error);
    throw error;
  }
}

/**
 * Get scheduled notifications based on filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} Array of notifications
 */
async function getScheduledNotifications(filters = {}) {
  try {
    let query = 'SELECT * FROM scheduled_notifications WHERE 1=1';
    const values = [];

    // Apply filters
    if (filters.is_sent !== undefined) {
      query += ' AND is_sent = ?';
      values.push(filters.is_sent);
    }

    if (filters.is_paused !== undefined) {
      query += ' AND is_paused = ?';
      values.push(filters.is_paused);
    }

    if (filters.target_group) {
      query += ' AND target_group = ?';
      values.push(filters.target_group);
    }

    if (filters.type) {
      query += ' AND type = ?';
      values.push(filters.type);
    }

    if (filters.scheduledBefore) {
      query += ' AND scheduled_for <= ?';
      values.push(filters.scheduledBefore);
    }

    if (filters.scheduledAfter) {
      query += ' AND scheduled_for >= ?';
      values.push(filters.scheduledAfter);
    }

    // Add order by and limit if provided
    if (filters.orderBy) {
      query += ` ORDER BY ${filters.orderBy} ${filters.orderDirection || 'ASC'}`;
    } else {
      query += ' ORDER BY scheduled_for ASC';
    }

    if (filters.limit) {
      query += ' LIMIT ?';
      values.push(parseInt(filters.limit, 10));
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      values.push(parseInt(filters.offset, 10));
    }

    return await db.query(query, values);
  } catch (error) {
    logger.error('Error retrieving scheduled notifications:', error);
    throw error;
  }
}

/**
 * Process due notifications - send notifications that are due
 * This function should be called by a scheduler/cron job
 * @returns {Promise<{sent: number, errors: number}>} Count of sent notifications and errors
 */
async function processDueNotifications() {
  try {
    logger.info('Processing due notifications...');
    console.log('🔔 [PROCESSOR] Starting processDueNotifications...');
    
    // Get current time
    const now = new Date();
    console.log('🔔 [PROCESSOR] Current time (UTC):', now.toISOString());
    console.log('🔔 [PROCESSOR] Current time (Local):', now.toLocaleString());
    
    // Find notifications that are due and not paused
    // Note: We need to handle timezone properly here
    const dueNotifications = await db.query(
      `SELECT * FROM scheduled_notifications 
       WHERE scheduled_for <= ? 
       AND is_sent = FALSE 
       AND is_paused = FALSE`,
      [now]
    );
    
    logger.info(`Found ${dueNotifications.length} notifications to process`);
    console.log(`🔔 [PROCESSOR] Found ${dueNotifications.length} due notifications`);
    
    // Debug: Show all scheduled notifications for context with timezone info
    const allScheduled = await db.query('SELECT id, title, scheduled_for, is_sent, is_paused FROM scheduled_notifications ORDER BY scheduled_for DESC LIMIT 5');
    console.log('🔔 [PROCESSOR] Recent scheduled notifications:');
    allScheduled.forEach(n => {
      const scheduledDate = new Date(n.scheduled_for);
      console.log(`  ID ${n.id}: "${n.title}"`);
      console.log(`    DB value: ${n.scheduled_for}`);
      console.log(`    Parsed as: ${scheduledDate.toISOString()} (UTC)`);
      console.log(`    Local time: ${scheduledDate.toLocaleString()}`);
      console.log(`    Is due? ${scheduledDate <= now} (is_sent: ${n.is_sent}, is_paused: ${n.is_paused})`);
      console.log('');
    });
    
    // Track statistics
    const stats = {
      sent: 0,
      errors: 0
    };
    
    // Process each due notification
    for (const notification of dueNotifications) {
      try {
        // Parse metadata to check for recurrence
        let metadata = {};
        try {
          metadata = typeof notification.metadata === 'string' 
            ? JSON.parse(notification.metadata) 
            : notification.metadata || {};
        } catch (err) {
          logger.warn(`Error parsing metadata for notification ${notification.id}:`, err);
          metadata = {};
        }
        
        // Log details about this notification (for debugging)
        logger.info(`Processing notification ${notification.id}: "${notification.title}" (type: ${notification.type})`);
        logger.info(`Target: user_id=${notification.user_id}, target_group=${notification.target_group}`);
        logger.debug(`Metadata: ${JSON.stringify(metadata, null, 2)}`);
        
        // Store original scheduled_for time for reference
        const originalScheduledFor = notification.scheduled_for;
        
        // Ensure metadata is properly formatted for transfer
        // If it's already a string, we'll pass it directly; if it's an object, we'll stringify it
        const metadataToTransfer = typeof notification.metadata === 'string' 
          ? notification.metadata 
          : JSON.stringify(notification.metadata || {});
        
        // Send notification using the same logic as immediate notifications
        // Instead of duplicating push notification logic, use the same internal function
        console.log(`🔔 [PROCESSOR] Creating notification for ID ${notification.id}...`);
        
        try {
          // Import the internal notification creation function
          const { createNotificationInternal } = require('../routes/notifications');
          
          // Create the notification data in the same format as immediate notifications
          const notificationData = {
            title: notification.title,
            message: notification.message,
            type: notification.type,
            user_id: notification.user_id,
            target_group: notification.target_group,
            link_url: notification.link_url,
            metadata: metadataToTransfer,
            scheduled_for: originalScheduledFor,
            created_at: originalScheduledFor
          };
          
          console.log(`🔔 [PROCESSOR] Sending notification via internal route for scheduled ID ${notification.id}`);
          
          // Call the same internal function that immediate notifications use
          // This will handle database creation, push notifications, and WebSocket notifications
          const createdNotification = await createNotificationInternal(notificationData);
          
          console.log(`✅ [PROCESSOR] Successfully sent notification from scheduled ID ${notification.id} via internal route`);
          
        } catch (internalError) {
          console.error(`❌ [PROCESSOR] Error sending notification via internal route for scheduled ID ${notification.id}:`, internalError);
          
          // Fallback to the old method if internal route fails
          console.log(`🔔 [PROCESSOR] Falling back to direct creation for scheduled ID ${notification.id}`);
          
          const createdNotification = await notificationService.createNotification({
            title: notification.title,
            message: notification.message,
            type: notification.type,
            user_id: notification.user_id,
            target_group: notification.target_group,
            link_url: notification.link_url,
            metadata: metadataToTransfer,
            scheduled_for: originalScheduledFor,
            created_at: originalScheduledFor
          });
          
          console.log(`🔔 [PROCESSOR] Fallback creation completed for scheduled ID ${notification.id}`);
        }
        
        // Handle recurrence if applicable
        if (metadata.recurrence) {
          logger.info(`Notification ${notification.id} has recurrence pattern: ${metadata.recurrence.pattern}`);
          console.log(`🔔 [PROCESSOR] Handling recurrence for ID ${notification.id}: ${metadata.recurrence.pattern}`);
          await handleRecurrence(notification, metadata.recurrence);
        } else {
          // Mark as sent for one-time notifications without changing the scheduled_for time
          logger.info(`Marking one-time notification ${notification.id} as sent (preserving original scheduled_for time)`);
          console.log(`🔔 [PROCESSOR] Marking one-time notification ${notification.id} as sent`);
          await db.query(
            'UPDATE scheduled_notifications SET is_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [notification.id]
          );
        }
        
        stats.sent++;
      } catch (err) {
        logger.error(`Error processing notification ${notification.id}:`, err);
        stats.errors++;
      }
    }
    
    logger.info(`Processed due notifications. Sent: ${stats.sent}, Errors: ${stats.errors}`);
    return stats;
  } catch (error) {
    logger.error('Error processing due notifications:', error);
    throw error;
  }
}

/**
 * Handle recurrence for a notification
 * @param {Object} notification - The notification object
 * @param {Object} recurrence - The recurrence settings
 * @returns {Promise<void>}
 */
async function handleRecurrence(notification, recurrence) {
  try {
    // Validate that this is actually a recurring notification
    if (!recurrence || !recurrence.pattern) {
      logger.warn(`handleRecurrence called on notification ${notification.id} without valid recurrence settings`);
      
      // Mark as sent without changing the scheduled date
      await db.query(
        'UPDATE scheduled_notifications SET is_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [notification.id]
      );
      return;
    }

    // Calculate next scheduled date based on recurrence pattern
    const pattern = recurrence.pattern || 'daily';
    const count = recurrence.count || 1;
    const indefinite = recurrence.indefinite || false;
    const endDate = recurrence.end_date ? new Date(recurrence.end_date) : null;
    
    // Get current scheduled date
    const currentDate = new Date(notification.scheduled_for);
    let nextDate = null;
    
    // Calculate next date based on pattern
    switch (pattern) {
      case 'daily':
        // Handle selected days if available
        if (recurrence.selected_days) {
          nextDate = calculateNextDateWithSelectedDays(currentDate, recurrence.selected_days);
        } else {
          // Simple daily increment
          nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + count);
        }
        break;
        
      case 'weekly':
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + (7 * count));
        
        // If weekly_day is specified, adjust to that day of the week
        if (recurrence.weekly_day) {
          nextDate = adjustToWeekday(nextDate, recurrence.weekly_day);
        }
        break;
        
      case 'monthly':
        nextDate = new Date(currentDate);
        nextDate.setMonth(nextDate.getMonth() + count);
        
        // If monthly_day is specified, adjust to that day of the month
        if (recurrence.monthly_day) {
          nextDate = adjustToMonthDay(nextDate, recurrence.monthly_day);
        }
        break;
        
      case 'yearly':
        nextDate = new Date(currentDate);
        nextDate.setFullYear(nextDate.getFullYear() + count);
        break;
        
      default:
        // Default to daily
        nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + count);
    }
    
    // Check if we've reached the end date for non-indefinite recurrences
    if (!indefinite && endDate && nextDate > endDate) {
      // End of recurrence reached, mark as sent and done
      logger.info(`Recurring notification ${notification.id} has reached its end date. Marking as sent.`);
      await db.query(
        'UPDATE scheduled_notifications SET is_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [notification.id]
      );
      return;
    }
    
    // Update the notification with the next date
    logger.info(`Updating recurring notification ${notification.id} with next scheduled date: ${nextDate.toISOString()}`);
    await db.query(
      'UPDATE scheduled_notifications SET scheduled_for = ?, is_sent = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [nextDate, notification.id]
    );
  } catch (error) {
    logger.error(`Error handling recurrence for notification ${notification.id}:`, error);
    throw error;
  }
}

/**
 * Calculate next date based on selected days of the week
 * @param {Date} currentDate - Current scheduled date
 * @param {Object} selectedDays - Object with days of week (monday, tuesday, etc.) as keys and boolean values
 * @returns {Date} Next scheduled date
 */
function calculateNextDateWithSelectedDays(currentDate, selectedDays) {
  // Convert selectedDays object to array of day numbers (0 = Sunday, 1 = Monday, etc.)
  const daysMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  
  const selectedDayNumbers = Object.entries(selectedDays)
    .filter(([_, isSelected]) => isSelected)
    .map(([day]) => daysMap[day]);
  
  if (selectedDayNumbers.length === 0) {
    // No days selected, default to next day
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }
  
  // Get current day of week (0-6)
  const currentDayOfWeek = currentDate.getDay();
  
  // Find the next selected day
  let daysToAdd = 1; // Start with tomorrow
  
  // Keep checking days until we find a selected one
  while (!selectedDayNumbers.includes((currentDayOfWeek + daysToAdd) % 7)) {
    daysToAdd++;
    
    // Safety check - if we've checked 7 days and found nothing, break
    if (daysToAdd > 7) {
      break;
    }
  }
  
  // Create next date by adding days
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

/**
 * Adjust date to specified weekday
 * @param {Date} date - Date to adjust
 * @param {number} targetWeekday - Target weekday (1 = Monday, 7 = Sunday)
 * @returns {Date} Adjusted date
 */
function adjustToWeekday(date, targetWeekday) {
  // Convert to JavaScript weekday (0 = Sunday, 6 = Saturday)
  const jsWeekday = targetWeekday === 7 ? 0 : targetWeekday;
  
  // Get current weekday
  const currentWeekday = date.getDay();
  
  // Calculate days to add
  let daysToAdd = jsWeekday - currentWeekday;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Ensure we move to next week
  }
  
  // Adjust date
  const adjustedDate = new Date(date);
  adjustedDate.setDate(date.getDate() + daysToAdd);
  return adjustedDate;
}

/**
 * Adjust date to specified day of month
 * @param {Date} date - Date to adjust
 * @param {number} targetDay - Target day of month (1-31)
 * @returns {Date} Adjusted date
 */
function adjustToMonthDay(date, targetDay) {
  const adjustedDate = new Date(date);
  
  // Get the last day of the month
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  
  // If target day is valid for this month, set it
  if (targetDay <= lastDayOfMonth) {
    adjustedDate.setDate(targetDay);
  } else {
    // Otherwise, use the last day of the month
    adjustedDate.setDate(lastDayOfMonth);
  }
  
  return adjustedDate;
}

module.exports = {
  createScheduledNotification,
  getScheduledNotificationById,
  updateScheduledNotification,
  deleteScheduledNotification,
  getScheduledNotifications,
  processDueNotifications
}; 