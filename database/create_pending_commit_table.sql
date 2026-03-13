-- Create pending_commit table to track which pending agents have been committed
-- This tracks when a pending agent is marked as committed (expected to be coded)

CREATE TABLE IF NOT EXISTS pending_commit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    activeusers_id INT NOT NULL,
    lagnname VARCHAR(255) NOT NULL,
    committed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    committed_by INT NULL, -- The user ID who committed them
    notes TEXT NULL,
    FOREIGN KEY (activeusers_id) REFERENCES activeusers(id) ON DELETE CASCADE,
    FOREIGN KEY (committed_by) REFERENCES activeusers(id) ON DELETE SET NULL,
    INDEX idx_activeusers_id (activeusers_id),
    INDEX idx_committed_at (committed_at),
    UNIQUE KEY unique_commit (activeusers_id) -- Prevent duplicate commits
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

