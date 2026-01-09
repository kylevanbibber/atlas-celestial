-- Create presentations table
CREATE TABLE IF NOT EXISTS presentations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active TINYINT(1) DEFAULT 1,
    INDEX idx_created_by (created_by),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create presentation_slides table
CREATE TABLE IF NOT EXISTS presentation_slides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    presentation_id INT NOT NULL,
    slide_order INT NOT NULL DEFAULT 0,
    title VARCHAR(255),
    image_url TEXT,
    script TEXT,
    notes TEXT,
    duration INT DEFAULT 0,
    is_hidden TINYINT(1) DEFAULT 0,
    transition_type VARCHAR(50) DEFAULT 'fade',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_presentation_id (presentation_id),
    INDEX idx_presentation_order (presentation_id, slide_order),
    FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes are already created inline above

-- Insert a sample presentation
INSERT INTO presentations (title, description, created_by, is_active) 
VALUES ('Welcome Presentation', 'Default American Income Life presentation', 1, 1);

-- Insert sample slides
INSERT INTO presentation_slides (presentation_id, slide_order, title, script, notes) VALUES
(1, 0, 'Welcome', 
'Good evening! Thank you for meeting with me today. My name is [Agent Name] and I represent American Income Life Insurance Company. We''ve been protecting families since 1951.',
'Introduce yourself and build rapport'),

(1, 1, 'About Us',
'American Income Life is a labor union insurance company that specializes in providing supplemental life insurance to working families. We''re one of the fastest growing insurance companies in North America.',
'Emphasize company strength and credibility'),

(1, 2, 'Coverage Options',
'Today I want to show you three main types of coverage we offer: Whole Life Insurance, Accidental Death & Dismemberment, and our Supplemental Health benefits. Each one is designed to protect you and your family.',
'Overview of products - gauge interest'),

(1, 3, 'Thank You',
'Do you have any questions? I''m here to help ensure you and your family are protected.',
'Close and ask for the sale');

