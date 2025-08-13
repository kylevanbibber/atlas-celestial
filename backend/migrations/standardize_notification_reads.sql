-- Migration: Standardize notification reads to always use notification_reads table
-- This migration removes is_read and is_dismissed from notifications table
-- and migrates existing read/dismissed states to notification_reads table

-- Step 1: Migrate existing read/dismissed states from notifications to notification_reads
-- For notifications with user_id set and is_read=true or is_dismissed=true
INSERT INTO notification_reads (notification_id, user_id, is_read, is_dismissed, created_at)
SELECT 
    id as notification_id,
    user_id,
    COALESCE(is_read, 0) as is_read,
    COALESCE(is_dismissed, 0) as is_dismissed,
    NOW() as created_at
FROM notifications 
WHERE user_id IS NOT NULL 
AND (is_read = 1 OR is_dismissed = 1)
AND NOT EXISTS (
    SELECT 1 FROM notification_reads nr 
    WHERE nr.notification_id = notifications.id 
    AND nr.user_id = notifications.user_id
);

-- Step 2: Remove the columns from notifications table
ALTER TABLE notifications DROP COLUMN is_read;
ALTER TABLE notifications DROP COLUMN is_dismissed;

-- Step 3: Add helpful comment
ALTER TABLE notifications COMMENT = 'Core notification data - read/dismiss status tracked in notification_reads table'; 