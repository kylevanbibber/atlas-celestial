-- Add instagram column to pipeline table
ALTER TABLE pipeline
ADD COLUMN instagram VARCHAR(255) NULL AFTER phone;

-- Add index for faster searches
CREATE INDEX idx_pipeline_instagram ON pipeline (instagram);




