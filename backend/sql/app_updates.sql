-- Create app_updates table for storing application updates/announcements

CREATE TABLE app_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('update', 'feature', 'bugfix') DEFAULT 'update',
    priority ENUM('low', 'normal', 'high') DEFAULT 'normal',
    authorId INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (createdAt),
    INDEX idx_type (type),
    INDEX idx_priority (priority),
    INDEX idx_author (authorId),
    FOREIGN KEY (authorId) REFERENCES activeusers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample update
INSERT INTO app_updates (title, content, type, priority, authorId) VALUES 
('Welcome to Updates', 'This is the new Updates page where you can view application announcements, bug fixes, and new feature releases. Stay tuned for more updates!', 'update', 'normal', 1);
