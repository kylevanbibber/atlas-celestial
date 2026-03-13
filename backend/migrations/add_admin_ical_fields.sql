-- Add visibility and created_by_name columns to calendar_ical_subscriptions
-- visibility: 'private' = personal subscription, 'organization' = admin feed visible to all
ALTER TABLE calendar_ical_subscriptions
  ADD COLUMN visibility ENUM('private','organization') DEFAULT 'private',
  ADD COLUMN created_by_name VARCHAR(255) DEFAULT NULL;
