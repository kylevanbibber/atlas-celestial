-- =============================================================================
-- Query GROUP 3 Agents: 1st Pack Sent, Not Yet Passed Release
-- =============================================================================
-- This query shows agents who:
-- - pending = 0, released = 0
-- - Have received 1st Pack (leads_released type='1st Pack', sent=1)
-- - Have NOT passed release (not in JA_Release OR passed IS NULL)
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
    p.step as pipeline_stage,
    lr.type as lead_pack_type,
    lr.sent as lead_pack_sent,
    lr.sent_date,
    jr.id as ja_release_id,
    jr.passed as release_passed,
    jr.release_scheduled,
    (SELECT COUNT(*) 
     FROM pipeline_checklist_progress pcp
     JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
     WHERE pcp.recruit_id = p.id 
       AND pci.stage_name = 'Training' 
       AND pcp.completed = 1
    ) as training_items_completed
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y')
ORDER BY au.lagnname;

-- Show summary counts
SELECT 
    'GROUP 3 Summary' as summary,
    COUNT(*) as total_agents,
    SUM(CASE WHEN jr.id IS NULL THEN 1 ELSE 0 END) as not_in_ja_release,
    SUM(CASE WHEN jr.id IS NOT NULL AND jr.passed IS NULL THEN 1 ELSE 0 END) as in_ja_release_passed_null,
    SUM(CASE WHEN jr.id IS NOT NULL AND jr.passed != 'y' THEN 1 ELSE 0 END) as in_ja_release_not_passed
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN JA_Release jr ON jr.user_id = au.id
WHERE au.clname = 'AGT'
  AND au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
  AND (jr.id IS NULL OR jr.passed IS NULL OR jr.passed != 'y');

