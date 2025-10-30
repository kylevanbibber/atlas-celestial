-- Pipeline Attachments Table
-- Stores file attachments for checklist items (proof documents, certificates, etc.)
-- Files are uploaded to: uploads/pipeline/
-- Publicly accessible at: https://ariaslife.com/uploads/pipeline/[filename]

CREATE TABLE IF NOT EXISTS pipeline_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recruit_id INT NOT NULL,
  checklist_item_id INT NULL,                    -- NULL if attached to recruit directly, not a specific checklist item
  file_name VARCHAR(255) NOT NULL,               -- Original file name
  file_path VARCHAR(500) NOT NULL,               -- Path/URL to stored file
  file_size INT NOT NULL,                        -- File size in bytes
  file_type VARCHAR(100) NOT NULL,               -- MIME type (e.g., 'application/pdf', 'image/jpeg')
  file_category VARCHAR(50) NULL,                -- Category: 'license', 'certificate', 'proof', 'document'
  description TEXT NULL,                         -- Optional description of the attachment
  uploaded_by INT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (recruit_id) REFERENCES pipeline(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_item_id) REFERENCES pipeline_checklist_items(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES activeusers(id) ON DELETE RESTRICT,
  
  INDEX idx_recruit (recruit_id),
  INDEX idx_checklist_item (checklist_item_id),
  INDEX idx_uploaded_at (uploaded_at),
  INDEX idx_file_category (file_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add a comment to the table
ALTER TABLE pipeline_attachments 
COMMENT = 'Stores file attachments for pipeline recruits and their checklist items';

