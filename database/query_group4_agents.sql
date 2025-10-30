-- =============================================================================
-- Query GROUP 4 Agents: Passed Release, Waiting for 2nd Pack
-- =============================================================================
-- This query shows agents who:
-- - released = 1, pending = 0
-- - Active = 'y', managerActive = 'y', clname = 'AGT'
-- - Have passed release (JA_Release passed = 'y')
-- - Waiting for 2nd Pack (leads_released type='2nd Pack', sent=0)
-- =============================================================================

SELECT 
    au.id,
    au.lagnname,
    au.agtnum,
    au.pending,
    au.released,
    au.Active,
    au.managerActive,
    au.clname,
    au.pipeline_id,
    p.id as actual_pipeline_id,
    p.step as pipeline_step,
    lr.type as lead_pack_type,
    lr.sent as lead_pack_sent,
    lr.sentAt as lead_pack_sent_date,
    jr.passed as release_passed,
    jr.release_scheduled,
    (SELECT COUNT(*) 
     FROM pipeline_checklist_progress pcp
     JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
     WHERE pcp.recruit_id = p.id 
       AND pci.stage_name = 'Training' 
       AND pcp.completed = 1
    ) as training_items_completed,
    (SELECT GROUP_CONCAT(pci.item_name ORDER BY pci.item_order SEPARATOR ', ')
     FROM pipeline_checklist_progress pcp
     JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
     WHERE pcp.recruit_id = p.id 
       AND pci.stage_name = 'Training' 
       AND pcp.completed = 1
    ) as completed_training_items,
    (SELECT GROUP_CONCAT(pci.item_name ORDER BY pci.item_order SEPARATOR ', ')
     FROM pipeline_checklist_items pci
     LEFT JOIN pipeline_checklist_progress pcp ON pcp.checklist_item_id = pci.id AND pcp.recruit_id = p.id
     WHERE pci.stage_name = 'Training'
       AND pci.active = 1
       AND (pcp.completed IS NULL OR pcp.completed = 0)
    ) as pending_training_items
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0
ORDER BY au.lagnname;

-- =============================================================================
-- Summary Statistics
-- =============================================================================

SELECT 
    'GROUP 4 Summary' as category,
    COUNT(*) as total_agents,
    SUM(CASE WHEN au.pipeline_id IS NULL THEN 1 ELSE 0 END) as no_pipeline_id,
    SUM(CASE WHEN au.pipeline_id IS NOT NULL AND p.id IS NULL THEN 1 ELSE 0 END) as orphaned_pipeline_id,
    SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) as valid_pipeline,
    SUM(CASE WHEN p.step = 'Training' THEN 1 ELSE 0 END) as at_training_stage
FROM activeusers au
JOIN JA_Release jr ON jr.user_id = au.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 1
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND jr.passed = 'y'
  AND lr.type = '2nd Pack'
  AND lr.sent = 0;

