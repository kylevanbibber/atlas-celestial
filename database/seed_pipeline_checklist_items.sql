-- Seed Pipeline Checklist Items
-- Populates checklist items for each pipeline stage
-- Based on recruitment process workflow

-- Clear existing checklist items (optional - comment out if you want to keep existing items)
-- DELETE FROM pipeline_checklist_items WHERE team_id IS NULL;

-- =============================================================================
-- OVERVIEW STAGE
-- =============================================================================
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, item_options, active, team_id, created_by)
VALUES
('Overview', 'Watch/Attend Overview', 'Candidate has watched or attended the company overview presentation', 1, 1, 'checkbox', NULL, 1, NULL, NULL),
('Overview', 'Submit Survey', 'Candidate has submitted the initial interest survey', 2, 1, 'checkbox', NULL, 1, NULL, NULL);

-- =============================================================================
-- FINAL DECISION STAGE
-- =============================================================================
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, item_options, active, team_id, created_by)
VALUES
('Final Decision', 'Decision Status', 'Final decision on candidate application', 1, 1, 'select', '["Pending Review", "Approved", "Denied"]', 1, NULL, NULL),
('Final Decision', 'Enroll in Pre-Licensing', 'Candidate has been enrolled in pre-licensing course (attach proof/confirmation)', 2, 1, 'textarea', NULL, 1, NULL, NULL);

-- =============================================================================
-- LICENSING STAGE
-- =============================================================================
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, item_options, active, team_id, created_by)
VALUES
('Licensing', 'Pre-Licensing Course', 'Candidate has completed pre-licensing course requirements', 1, 1, 'checkbox', NULL, 1, NULL, NULL),
('Licensing', 'Schedule Licensing Test', 'Licensing exam has been scheduled (attach proof/confirmation)', 2, 1, 'textarea', NULL, 1, NULL, NULL),
('Licensing', 'Pass Licensing Test', 'Candidate has passed the licensing exam (attach proof/score)', 3, 1, 'textarea', NULL, 1, NULL, NULL),
('Licensing', 'Background Check', 'Background check has been completed and approved', 4, 1, 'checkbox', NULL, 1, NULL, NULL),
('Licensing', 'Purchase License', 'License has been purchased (attach proof/receipt)', 5, 1, 'textarea', NULL, 1, NULL, NULL),
('Licensing', 'Receive License Approval', 'License approval received from state regulatory body (attach approval document)', 6, 1, 'textarea', NULL, 1, NULL, NULL);

-- =============================================================================
-- ON-BOARDING STAGE
-- =============================================================================
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, item_options, active, team_id, created_by)
VALUES
('On-boarding', 'Complete AOB', 'Agent of Record (AOR) documentation completed (attach proof/signed documents)', 1, 1, 'textarea', NULL, 1, NULL, NULL),
('On-boarding', 'Complete Steps 1-4', 'Initial onboarding steps 1 through 4 have been completed', 2, 1, 'checkbox', NULL, 1, NULL, NULL),
('On-boarding', 'Receive Agent Number', 'Agent number has been assigned and received', 3, 1, 'text', NULL, 1, NULL, NULL),
('On-boarding', 'Activate Agent Number', 'Agent number has been activated in the system', 4, 1, 'checkbox', NULL, 1, NULL, NULL);

-- =============================================================================
-- TRAINING STAGE
-- =============================================================================
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, item_options, active, team_id, created_by)
VALUES
('Training', 'Receive First Lead Pack', 'Agent has received their first lead pack', 1, 1, 'checkbox', NULL, 1, NULL, NULL),
('Training', 'Attend Training', 'Agent has attended all required training sessions', 2, 1, 'checkbox', NULL, 1, NULL, NULL),
('Training', 'Complete Release Checklist', 'All release checklist items have been completed', 3, 1, 'checkbox', NULL, 1, NULL, NULL),
('Training', 'Attend and Pass Release Call', 'Agent has attended and successfully passed the release call', 4, 1, 'checkbox', NULL, 1, NULL, NULL),
('Training', 'Receive Release Pack', 'Agent has received the release pack with field materials', 5, 1, 'checkbox', NULL, 1, NULL, NULL);

-- =============================================================================
-- SA CONTRACT STAGE (SA Promotion)
-- =============================================================================
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, item_options, active, team_id, created_by)
VALUES
('SA Contract', 'Write 5K ALP or 16K Net', 'Agent has written 5K ALP for 2 consecutive months OR 16K net over 2 months', 1, 1, 'checkbox', NULL, 1, NULL, NULL);

-- =============================================================================
-- OPTIONAL: Add checklist items for terminal stages if needed
-- =============================================================================
-- Not Interested and Disqualified stages typically don't need checklist items
-- Release stage items are handled in Training stage

-- Verification Query
-- Run this to see all checklist items by stage:
/*
SELECT 
    stage_name,
    item_name,
    item_description,
    item_order,
    is_required,
    item_type,
    item_options
FROM pipeline_checklist_items
WHERE team_id IS NULL
ORDER BY 
    FIELD(stage_name, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training', 'Release', 'SA Contract'),
    item_order;
*/

