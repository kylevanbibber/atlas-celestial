-- Email Campaigns System Tables

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    variables JSON,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE,
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at)
);

-- Email Campaigns Table
CREATE TABLE IF NOT EXISTS email_campaigns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    recipient_filter JSON NOT NULL,
    status ENUM('draft', 'scheduled', 'sending', 'sent', 'failed') DEFAULT 'draft',
    scheduled_at DATETIME,
    sent_at DATETIME,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES activeusers(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_scheduled_at (scheduled_at),
    INDEX idx_created_by (created_by)
);

-- Email Recipients Table
CREATE TABLE IF NOT EXISTS email_recipients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    campaign_id INT NOT NULL,
    user_id INT,
    email VARCHAR(255) NOT NULL,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    sent_at DATETIME,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES activeusers(id) ON DELETE SET NULL,
    INDEX idx_campaign_status (campaign_id, status),
    INDEX idx_user_id (user_id)
);

-- Email Variables Table
CREATE TABLE IF NOT EXISTS email_variables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    variable_key VARCHAR(100) NOT NULL UNIQUE,
    variable_name VARCHAR(255) NOT NULL,
    description TEXT,
    table_name VARCHAR(100),
    column_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active)
);

-- Seed Default Variables
INSERT INTO email_variables (variable_key, variable_name, description, table_name, column_name, is_active) VALUES
('lagnname', 'Agent Name', 'User\'s full name', 'activeusers', 'lagnname', TRUE),
('email', 'Email', 'User\'s email address', 'activeusers', 'email', TRUE),
('clname', 'CL Name', 'User\'s contract level name', 'activeusers', 'clname', TRUE),
('esid', 'ESID', 'User\'s ESID number', 'activeusers', 'esid', TRUE),
('phone', 'Phone', 'User\'s phone number', 'activeusers', 'phone', TRUE),
('teamRole', 'Team Role', 'User\'s team role', 'activeusers', 'teamRole', TRUE)
ON DUPLICATE KEY UPDATE variable_name = VALUES(variable_name);


