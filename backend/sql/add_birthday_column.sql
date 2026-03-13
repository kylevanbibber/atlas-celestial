-- Add birthday column to pipeline table
-- Run this migration to support the birthday field in onboarding registration

ALTER TABLE pipeline 
ADD COLUMN birthday DATE DEFAULT NULL
AFTER instagram;

-- Add index for birthday queries if needed
-- CREATE INDEX idx_birthday ON pipeline(birthday);

