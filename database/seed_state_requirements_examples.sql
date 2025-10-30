-- Example State Requirements Seed Data
-- Run this after creating the pipeline_state_requirements table
-- These are common state-specific licensing requirements

-- ============================================================
-- OHIO (OH) - Additional Ethics Course Required
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  item_name, 
  item_description, 
  item_order, 
  item_type,
  notes
) VALUES (
  'OH', 
  'Licensing', 
  'add', 
  'Complete Ohio Ethics Course', 
  'Ohio requires a 3-hour state-specific ethics course before license application. Must be completed through an approved provider.',
  7,
  'checkbox',
  'Ohio Department of Insurance requirement effective 2023'
);

-- ============================================================
-- CALIFORNIA (CA) - Background Check Handled by State
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  notes
) VALUES (
  'CA', 
  'Licensing', 
  'not_required', 
  'Background Check',
  'California DOI handles background check automatically during license application process'
);

-- ============================================================
-- TEXAS (TX) - Different License Approval Process
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  override_description,
  notes
) VALUES (
  'TX', 
  'Licensing', 
  'modify', 
  'Receive License Approval',
  'Texas: Submit application to TDI. Allow 10-15 business days for approval. Check status at www.tdi.texas.gov',
  'Texas has expedited online approval process'
);

-- ============================================================
-- FLORIDA (FL) - Extended Approval Timeline
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  override_description,
  notes
) VALUES (
  'FL', 
  'Licensing', 
  'modify', 
  'Receive License Approval',
  'Florida: Submit to FLDOI and wait 15-20 business days for approval. Check status at MyProfile.com. Fingerprinting required.',
  'Florida has longer approval timeline and additional fingerprinting requirement'
);

-- ============================================================
-- NEW YORK (NY) - Additional Continuing Education
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  item_name, 
  item_description, 
  item_order, 
  item_type,
  notes
) VALUES (
  'NY', 
  'Training', 
  'add', 
  'Complete NY Suitability Course', 
  'New York requires a state-specific suitability training course. Must be completed before first sale.',
  15,
  'checkbox',
  'NY DFS requirement for all new agents'
);

-- ============================================================
-- PENNSYLVANIA (PA) - No Pre-Licensing Required
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  notes
) VALUES (
  'PA', 
  'Licensing', 
  'remove', 
  'Enroll in Pre-Licensing',
  'Pennsylvania does not require pre-licensing course for life insurance'
);

-- ============================================================
-- MASSACHUSETTS (MA) - Different Testing Requirements
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  override_description,
  notes
) VALUES (
  'MA', 
  'Licensing', 
  'modify', 
  'Schedule Test',
  'Massachusetts: Schedule exam through PSI. Requires photo ID and confirmation number. Allow 30 days after pre-licensing course.',
  'MA uses PSI testing centers - different from most states'
);

-- ============================================================
-- ARIZONA (AZ) - Simplified Process
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  notes
) VALUES (
  'AZ', 
  'Licensing', 
  'not_required', 
  'Purchase License',
  'Arizona includes license fee in application - no separate purchase step'
);

-- ============================================================
-- View All State Requirements
-- ============================================================

-- Run this to see what requirements are active:
-- SELECT 
--   state,
--   stage_name,
--   action,
--   COALESCE(item_name, target_item_name) as item,
--   LEFT(COALESCE(item_description, override_description, notes), 50) as description_preview,
--   active
-- FROM pipeline_state_requirements
-- WHERE active = 1
-- ORDER BY state, stage_name;

