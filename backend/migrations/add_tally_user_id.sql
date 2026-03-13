-- Add tally_user_id column to activeusers for Tally dialer integration
ALTER TABLE activeusers ADD COLUMN tally_user_id INT DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN tally_email VARCHAR(255) DEFAULT NULL;
ALTER TABLE activeusers ADD COLUMN tally_linked_at DATETIME DEFAULT NULL;
