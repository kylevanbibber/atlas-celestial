-- Ensure "Activate Agent Number" checklist item exists in the On-boarding stage
-- This item is system-controlled and auto-completed when pending agents are activated

-- Check if the item already exists
SELECT id, stage_name, item_name, item_order
FROM pipeline_checklist_items
WHERE LOWER(item_name) LIKE '%activate agent number%';

-- If it doesn't exist, insert it
-- Note: Adjust the item_order based on your existing checklist items in On-boarding
INSERT INTO pipeline_checklist_items (
    stage_name,
    item_name,
    item_description,
    item_order,
    is_required,
    item_type,
    active,
    created_at
)
SELECT 
    'On-boarding',
    'Activate Agent Number',
    'Agent number has been activated in the system (automatically completed when agent moves from pending to active)',
    (SELECT COALESCE(MAX(item_order), 0) + 1 FROM pipeline_checklist_items WHERE stage_name = 'On-boarding'),
    1,
    'checkbox',
    1,
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_checklist_items 
    WHERE LOWER(item_name) LIKE '%activate agent number%'
);

-- Verify the item was created/exists
SELECT 
    id,
    stage_name,
    item_name,
    item_description,
    item_order,
    is_required,
    active
FROM pipeline_checklist_items
WHERE LOWER(item_name) LIKE '%activate agent number%';

