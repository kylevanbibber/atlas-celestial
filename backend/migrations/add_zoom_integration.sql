-- Migration: Add Zoom Integration Fields to activeusers table
-- Date: 2025-10-08
-- Minimal approach: Store only tokens and user_id, fetch other data on-demand

ALTER TABLE activeusers
ADD COLUMN zoom_access_token TEXT NULL,
ADD COLUMN zoom_refresh_token TEXT NULL,
ADD COLUMN zoom_user_id VARCHAR(255) NULL,
ADD COLUMN zoom_linked_at TIMESTAMP NULL;

