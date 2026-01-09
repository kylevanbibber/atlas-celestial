-- Create table for feedback images (supports multiple images per feedback item)
CREATE TABLE IF NOT EXISTS app_feedback_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    feedbackId INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    deleteHash VARCHAR(100) NULL,
    caption VARCHAR(255) NULL,
    sortOrder INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedbackId) REFERENCES app_feedback(id) ON DELETE CASCADE
);

-- Create index for faster querying
CREATE INDEX idx_feedback_images_feedbackId ON app_feedback_images(feedbackId);

