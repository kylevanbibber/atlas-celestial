/**
 * Script to process scheduled notifications and handle recurring notifications
 * 
 * This script should be run by a cron job every minute
 * Example cron entry: * * * * * node /path/to/atlas/backend/scripts/process-scheduled-notifications.js
 */

const db = require('../db');
const webpush = require('web-push');

// Configure Web Push with VAPID keys from environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

webpush.setVapidDetails(
  process.env.VAPID_CONTACT_EMAIL || 'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Helper function to parse dates safely
function parseDate(dateString) {
  try {
    if (!dateString) return null;
    
    // Try standard date parsing
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error(`Invalid date format: ${dateString}`);
      return null;
    }
    
    return date;
  } catch (error) {
    console.error(`Error parsing date ${dateString}:`, error);
    return null;
  }
}

// Main function to process scheduled notifications
async function processScheduledNotifications() {
  console.log('Processing scheduled notifications...');
  
  try {
    // Get current time
    const now = new Date();
    
    // Get all notifications scheduled for now or earlier that haven't been processed
    const scheduledNotifications = await db.query(
      `SELECT * FROM notifications 
       WHERE scheduled_for <= ? 
       AND is_read = 0 
       AND is_dismissed = 0`,
      [now]
    );
    
    console.log(`Found ${scheduledNotifications.length} notifications to process`);
    
    // Process each notification
    for (const notification of scheduledNotifications) {
      console.log(`Processing notification ID ${notification.id}: ${notification.title}`);
      
      try {
        // Verify scheduled_for is a valid date before processing
        const scheduledFor = parseDate(notification.scheduled_for);
        if (!scheduledFor) {
          console.error(`Skipping notification ${notification.id} due to invalid scheduled_for date: ${notification.scheduled_for}`);
          continue;
        }
        
        // Send the notification
        await sendNotification(notification);
        
        // Mark the notification as sent by updating the scheduled_for to NULL
        // This prevents it from being processed again while keeping the notification intact
        await db.query(
          `UPDATE notifications SET scheduled_for = NULL WHERE id = ?`,
          [notification.id]
        );
        
        // Check if this is a recurring notification
        await handleRecurringNotification(notification);
        
      } catch (error) {
        console.error(`Error processing notification ID ${notification.id}:`, error);
      }
    }
    
    console.log('Finished processing scheduled notifications');
  } catch (error) {
    console.error('Error in processScheduledNotifications:', error);
  }
}

// Send a notification to its target users
async function sendNotification(notification) {
  // If notification is for a specific user
  if (notification.user_id) {
    await sendToUser(notification.user_id, notification);
    return;
  }
  
  // If notification is for a group
  if (notification.target_group) {
    // Get all users in the group
    const groupUsers = await db.query(
      'SELECT user_id FROM user_groups WHERE group_name = ?',
      [notification.target_group]
    );
    
    // Send to each user in the group
    for (const user of groupUsers) {
      await sendToUser(user.user_id, notification);
    }
    return;
  }
  
  // If no specific target, it's a global notification - send to all users
  const allUsers = await db.query('SELECT id FROM activeusers');
  
  for (const user of allUsers) {
    await sendToUser(user.id, notification);
  }
}

// Send notification to a specific user
async function sendToUser(userId, notification) {
  try {
    // Get user's push subscriptions (all devices)
    const subscriptions = await db.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );
    
    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }
    
    console.log(`Found ${subscriptions.length} subscription(s) for user ${userId}`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Send to all user's subscriptions (all their devices)
    for (let i = 0; i < subscriptions.length; i++) {
      try {
        const subscription = JSON.parse(subscriptions[i].subscription);
        
        const payload = JSON.stringify({
          title: notification.title,
          body: notification.message,
          icon: notification.icon || '/favicon.ico',
          badge: '/badge-icon.png',
          data: {
            notificationId: notification.id,
            url: notification.link_url || '/notifications',
            timestamp: Date.now()
          },
          tag: `scheduled-${notification.id}`,
          renotify: true
        });
        
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ Scheduled notification sent to user ${userId}, device ${i + 1}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error sending to user ${userId}, device ${i + 1}:`, error);
        failureCount++;
        
        // If subscription is invalid (410 Gone), remove it from database
        if (error.statusCode === 410) {
          console.log(`🧹 Removing invalid subscription for user ${userId}, device ${i + 1}`);
          try {
            await db.query(
              'DELETE FROM push_subscriptions WHERE user_id = ? AND subscription = ?',
              [userId, subscriptions[i].subscription]
            );
          } catch (deleteError) {
            console.error(`❌ Error removing invalid subscription:`, deleteError);
          }
        }
      }
    }
    
    console.log(`📊 Scheduled notification summary for user ${userId}: ${successCount} successful, ${failureCount} failed out of ${subscriptions.length} devices`);
    
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}

// Handle recurring notifications
async function handleRecurringNotification(notification) {
  try {
    // Check if notification has recurrence metadata
    if (!notification.metadata) return;
    
    const metadata = JSON.parse(notification.metadata);
    
    if (!metadata.recurrence || !metadata.recurrence.pattern) return;
    
    const { pattern, count, end_date, indefinite, monthly_day, weekly_day, selected_days } = metadata.recurrence;
    
    // Calculate next scheduled date
    const currentSchedule = new Date(notification.scheduled_for);
    let nextSchedule = new Date(currentSchedule);
    
    switch (pattern) {
      case 'daily':
        if (selected_days) {
          // Using specific days of the week
          // Start from the next day and find the next selected day
          nextSchedule.setDate(currentSchedule.getDate() + 1);
          
          // Convert to Day of Week where 0 = Sunday, 6 = Saturday
          const dayMap = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6
          };
          
          // Check up to 7 days to find the next selected day
          for (let i = 0; i < 7; i++) {
            const dayOfWeek = nextSchedule.getDay(); // 0-6
            const dayName = Object.keys(dayMap).find(key => dayMap[key] === dayOfWeek);
            
            if (selected_days[dayName]) {
              // Found the next selected day
              break;
            }
            
            // Move to the next day
            nextSchedule.setDate(nextSchedule.getDate() + 1);
          }
        } else {
          // Using simple daily pattern
          nextSchedule.setDate(currentSchedule.getDate() + count);
        }
        break;
        
      case 'weekly':
        if (weekly_day) {
          // Using specific day of week
          // Get current day of week (0-6 where 0 is Sunday)
          const currentDayOfWeek = currentSchedule.getDay();
          
          // Convert weekly_day (1-7 where 1 is Monday) to JavaScript day (0-6 where 0 is Sunday)
          const targetDay = weekly_day === 7 ? 0 : weekly_day;
          
          // Calculate days to add to get to the target day next week
          let daysToAdd = targetDay - currentDayOfWeek;
          if (daysToAdd <= 0) {
            daysToAdd += 7; // Go to next week
          }
          
          // Add the calculated days plus additional weeks from count
          daysToAdd += (count - 1) * 7;
          
          nextSchedule.setDate(currentSchedule.getDate() + daysToAdd);
        } else {
          // Simple weekly pattern
          nextSchedule.setDate(currentSchedule.getDate() + (count * 7));
        }
        break;
        
      case 'monthly':
        if (monthly_day) {
          // Using specific day of month
          // First, go to the next month(s) based on count
          nextSchedule.setMonth(currentSchedule.getMonth() + count);
          
          // Then set the specific day
          // Make sure the day is valid for the month (handle months with fewer days)
          const lastDayOfMonth = new Date(nextSchedule.getFullYear(), nextSchedule.getMonth() + 1, 0).getDate();
          const validDay = Math.min(monthly_day, lastDayOfMonth);
          
          nextSchedule.setDate(validDay);
        } else {
          // Simple monthly pattern
          nextSchedule.setMonth(currentSchedule.getMonth() + count);
        }
        break;
        
      case 'yearly':
        nextSchedule.setFullYear(currentSchedule.getFullYear() + count);
        break;
        
      default:
        console.log(`Unknown recurrence pattern: ${pattern}`);
        return;
    }
    
    // Check if we've passed the end date (skip if indefinite is true)
    if (!indefinite && end_date) {
      const endDate = new Date(end_date);
      if (nextSchedule > endDate) {
        console.log(`Recurrence end date reached for notification ${notification.id}`);
        return;
      }
    }
    
    // Preserve the time part from the original schedule
    nextSchedule.setHours(currentSchedule.getHours());
    nextSchedule.setMinutes(currentSchedule.getMinutes());
    nextSchedule.setSeconds(currentSchedule.getSeconds());
    
    // Create a new notification with the next schedule date
    console.log(`Creating recurring notification for ${notification.id} scheduled for ${nextSchedule}`);
    
    await db.query(
      `INSERT INTO notifications 
        (title, message, type, user_id, target_group, scheduled_for, link_url, metadata, is_read, is_dismissed) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        notification.title,
        notification.message,
        notification.type,
        notification.user_id,
        notification.target_group,
        nextSchedule,
        notification.link_url,
        notification.metadata
      ]
    );
    
    console.log(`Created next recurring notification for ${notification.id}`);
    
  } catch (error) {
    console.error(`Error handling recurring notification ${notification.id}:`, error);
  }
}

// Run the main function
processScheduledNotifications()
  .then(() => {
    console.log('Script execution complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 