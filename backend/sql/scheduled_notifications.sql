CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success'
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_group VARCHAR(100), -- For group-targeted notifications
    scheduled_for TIMESTAMP,
    link_url TEXT, -- Optional URL to direct users to
    metadata JSON, -- Additional flexible data (recurrence pattern, etc.)
    is_sent BOOLEAN DEFAULT FALSE, -- Indicates if the notification has been sent
    is_paused BOOLEAN DEFAULT FALSE, -- Allows temporarily pausing recurring notifications
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_target_group ON scheduled_notifications(target_group);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_is_sent ON scheduled_notifications(is_sent);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_is_paused ON scheduled_notifications(is_paused); 