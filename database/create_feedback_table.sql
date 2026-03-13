-- Create table for bug reports and feature requests
CREATE TABLE IF NOT EXISTS app_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('bug', 'feature') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('pending', 'approved', 'in_progress', 'completed', 'rejected') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    authorId INT NULL,
    authorName VARCHAR(255) NULL,
    developerNotes TEXT NULL,
    isPublic BOOLEAN DEFAULT FALSE,
    estimatedCompletion DATE NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL,
    FOREIGN KEY (authorId) REFERENCES activeusers(id) ON DELETE SET NULL
);

-- Create index for faster querying
CREATE INDEX idx_feedback_type ON app_feedback(type);
CREATE INDEX idx_feedback_status ON app_feedback(status);
CREATE INDEX idx_feedback_isPublic ON app_feedback(isPublic);
CREATE INDEX idx_feedback_authorId ON app_feedback(authorId);

