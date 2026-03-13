-- Expand source ENUM on calendar_events to include google and outlook
ALTER TABLE calendar_events MODIFY COLUMN source ENUM('manual','calendly','google','outlook','system') DEFAULT 'manual';
