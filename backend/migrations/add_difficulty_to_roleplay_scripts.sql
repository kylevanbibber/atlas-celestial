-- Add difficulty column to roleplay_scripts
ALTER TABLE roleplay_scripts
ADD COLUMN difficulty ENUM('easy', 'medium', 'hard') DEFAULT NULL
COMMENT 'Difficulty level: easy (0-1 objections), medium (2-3 objections), hard (4+ objections)'
AFTER objections;

-- Function to calculate difficulty based on objection count
-- This will be used in application logic, but documenting the rules here:
-- easy: 0-1 objections
-- medium: 2-3 objections  
-- hard: 4+ objections

