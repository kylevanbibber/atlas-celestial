-- Add UNIQUE constraint to sga_alp.month column
-- This allows INSERT ... ON DUPLICATE KEY UPDATE to work properly

ALTER TABLE sga_alp 
ADD UNIQUE KEY unique_month (month);

