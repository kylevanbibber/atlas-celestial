-- Seed Default Pipeline Stages
-- Based on existing step names from pipeline_steps table
-- These are the default stages available to all teams
-- Uses before/after positioning for flexible ordering

INSERT INTO pipeline_stage_definitions (stage_name, stage_color, stage_description, position_after, position_before, is_default, is_terminal, team_id) VALUES
-- Active Pipeline Stages (in order)
('Careers Form', '#3498db', 'Initial application received from careers form', NULL, 'No Answer - Career Form', 1, 0, NULL),
('No Answer - Career Form', '#95a5a6', 'Attempted contact but no response', 'Careers Form', 'Overview', 1, 0, NULL),
('Overview', '#2ecc71', 'Overview/initial interview scheduled', 'No Answer - Career Form', 'Final', 1, 0, NULL),
('Final', '#f1c40f', 'Final interview/decision stage', 'Overview', 'Pre-Lic', 1, 0, NULL),
('Pre-Lic', '#e67e22', 'Pre-licensing education in progress', 'Final', 'Test', 1, 0, NULL),
('Test', '#9b59b6', 'Licensing exam scheduled/completed', 'Pre-Lic', 'Licensed', 1, 0, NULL),
('Licensed', '#1abc9c', 'Successfully licensed', 'Test', 'Background Check', 1, 0, NULL),
('Background Check', '#34495e', 'Background check in progress', 'Licensed', 'Compliance', 1, 0, NULL),
('Compliance', '#16a085', 'Compliance documentation review', 'Background Check', 'Release Ready', 1, 0, NULL),
('Release Ready', '#27ae60', 'Ready for field release', 'Compliance', 'Released', 1, 0, NULL),
('Released', '#27ae60', 'Successfully released to field', 'Release Ready', NULL, 1, 1, NULL),

-- Terminal States (not in main chain - standalone stages)
('Not Interested', '#e74c3c', 'Candidate no longer interested', NULL, NULL, 1, 1, NULL),
('Disqualified', '#c0392b', 'Candidate disqualified', NULL, NULL, 1, 1, NULL),
('No Show', '#e67e22', 'Candidate did not show for scheduled events', NULL, NULL, 1, 1, NULL);

-- Default Checklist Items for each stage

-- Careers Form Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Careers Form', 'Application Received', 'Confirm application form is complete', 1, 1, 'checkbox', NULL),
('Careers Form', 'Contact Information Verified', 'Verify phone and email are valid', 2, 1, 'checkbox', NULL),
('Careers Form', 'Initial Outreach Made', 'First contact attempt recorded', 3, 1, 'checkbox', NULL),
('Careers Form', 'Contact Date', 'Date of first successful contact', 4, 0, 'date', NULL);

-- Overview Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Overview', 'Overview Scheduled', 'Overview meeting scheduled', 1, 1, 'checkbox', NULL),
('Overview', 'Overview Date/Time', 'Scheduled date and time', 2, 1, 'date', NULL),
('Overview', 'Overview Completed', 'Overview meeting conducted', 3, 1, 'checkbox', NULL),
('Overview', 'Candidate Interest Level', 'Gauge interest after overview', 4, 0, 'select', NULL),
('Overview', 'Follow-up Scheduled', 'Next step scheduled', 5, 0, 'checkbox', NULL);

-- Update select options for Candidate Interest Level
UPDATE pipeline_checklist_items 
SET item_options = '["High - Very Interested", "Medium - Considering", "Low - Unsure", "Not Interested"]'
WHERE item_name = 'Candidate Interest Level';

-- Final Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Final', 'Final Interview Scheduled', 'Final decision meeting scheduled', 1, 1, 'checkbox', NULL),
('Final', 'Final Interview Date', 'Date of final interview', 2, 1, 'date', NULL),
('Final', 'Final Interview Completed', 'Final interview conducted', 3, 1, 'checkbox', NULL),
('Final', 'Intent to Hire Confirmed', 'Candidate confirmed intent to proceed', 4, 1, 'checkbox', NULL),
('Final', 'State Selection', 'State(s) where candidate will be licensed', 5, 1, 'text', NULL);

-- Pre-Lic Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Pre-Lic', 'Enrolled in Pre-Licensing', 'Candidate enrolled in pre-licensing course', 1, 1, 'checkbox', NULL),
('Pre-Lic', 'Course Provider', 'Name of pre-licensing course provider', 2, 0, 'text', NULL),
('Pre-Lic', 'Expected Completion Date', 'When pre-licensing should be completed', 3, 1, 'date', NULL),
('Pre-Lic', 'Current Progress %', 'Percentage of course completed', 4, 0, 'number', NULL),
('Pre-Lic', 'Pre-Lic Certificate Uploaded', 'Certificate of completion received', 5, 1, 'checkbox', NULL);

-- Test Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Test', 'Exam Scheduled', 'Licensing exam scheduled', 1, 1, 'checkbox', NULL),
('Test', 'Exam Date', 'Date of licensing exam', 2, 1, 'date', NULL),
('Test', 'Exam Completed', 'Exam has been taken', 3, 1, 'checkbox', NULL),
('Test', 'Exam Passed', 'Passed licensing exam', 4, 1, 'checkbox', NULL),
('Test', 'License Number', 'State license number', 5, 1, 'text', NULL);

-- Licensed Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Licensed', 'License Verified', 'State license verified in system', 1, 1, 'checkbox', NULL),
('Licensed', 'License Document Uploaded', 'Copy of license uploaded', 2, 1, 'checkbox', NULL),
('Licensed', 'E&O Insurance', 'Errors & Omissions insurance confirmed', 3, 1, 'checkbox', NULL),
('Licensed', 'State Appointments Started', 'Carrier appointment process initiated', 4, 0, 'checkbox', NULL);

-- Background Check Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Background Check', 'Background Check Requested', 'Background check initiated', 1, 1, 'checkbox', NULL),
('Background Check', 'Request Date', 'Date background check was requested', 2, 1, 'date', NULL),
('Background Check', 'Background Check Cleared', 'Background check passed', 3, 1, 'checkbox', NULL),
('Background Check', 'Issues Noted', 'Any issues found (leave blank if none)', 4, 0, 'textarea', NULL);

-- Compliance Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Compliance', 'Compliance Documents Submitted', 'All required documents submitted', 1, 1, 'checkbox', NULL),
('Compliance', 'Documents Reviewed', 'Compliance team has reviewed documents', 2, 1, 'checkbox', NULL),
('Compliance', 'Compliance Approved', 'Approved by compliance', 3, 1, 'checkbox', NULL),
('Compliance', 'Contracting Date', 'Date officially contracted', 4, 1, 'date', NULL);

-- Release Ready Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Release Ready', 'Training Scheduled', 'Initial field training scheduled', 1, 1, 'checkbox', NULL),
('Release Ready', 'Training Date', 'Date of field training', 2, 1, 'date', NULL),
('Release Ready', 'Trainer Assigned', 'Field trainer assigned', 3, 1, 'text', NULL),
('Release Ready', 'Equipment Provided', 'All necessary equipment provided', 4, 1, 'checkbox', NULL),
('Release Ready', 'System Access Granted', 'Access to all required systems', 5, 1, 'checkbox', NULL);

-- Released Stage
INSERT INTO pipeline_checklist_items (stage_name, item_name, item_description, item_order, is_required, item_type, team_id) VALUES
('Released', 'Release Date', 'Official release date', 1, 1, 'date', NULL),
('Released', 'First Week Completed', 'Completed first week in field', 2, 0, 'checkbox', NULL),
('Released', 'First Sale', 'Made first sale', 3, 0, 'checkbox', NULL),
('Released', '30-Day Check-In', '30-day progress check completed', 4, 0, 'checkbox', NULL);

