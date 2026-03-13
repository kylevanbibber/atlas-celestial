-- Add Google Calendar and Outlook Calendar OAuth columns to activeusers
-- Follows same pattern as Calendly (calendly_*) and Zoom (zoom_*) columns

-- Google Calendar
ALTER TABLE activeusers ADD COLUMN google_calendar_email VARCHAR(255) DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN google_calendar_access_token TEXT DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN google_calendar_refresh_token TEXT DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN google_calendar_linked_at DATETIME DEFAULT NULL;

-- Outlook Calendar
ALTER TABLE activeusers ADD COLUMN outlook_calendar_email VARCHAR(255) DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN outlook_calendar_access_token TEXT DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN outlook_calendar_refresh_token TEXT DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN outlook_calendar_linked_at DATETIME DEFAULT NULL;
