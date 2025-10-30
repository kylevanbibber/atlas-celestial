# Seed Pipeline for First Pack Ready Agents

## Overview

These scripts create/update **pipeline records** and **auto-complete checklist items** for agents who are ready for their first lead pack but haven't received one yet. They set agents to the Training stage with all prior checklist items completed.

## Criteria for "Ready for First Pack"

An agent is considered ready if they meet ALL of the following:
- ✅ `activeusers.pending = 0` (agent is activated, not pending)
- ✅ `activeusers.released = 0` (agent hasn't been released yet)
- ✅ `activeusers.Active = 'y'` (agent is active)
- ✅ `activeusers.managerActive = 'y'` (manager approved)
- ❌ NOT in `leads_released` with `type = "1st Pack"` and `sent = 1`

## Usage Options

### Option 1: Node.js Script (Recommended)

Run the automated seeding script from the atlas root directory:

```bash
cd atlas
node backend/scripts/seed-first-pack-leads.js
```

**What it does:**
1. Finds all agents matching the criteria
2. Shows you a list of agents to be processed
3. For agents WITHOUT pipeline records:
   - Creates new pipeline record at "Training" stage
   - Links to activeusers via `pipeline_id`
   - Records stage entry in `pipeline_steps`
   - Auto-completes ALL checklist items from prior stages
4. For agents WITH pipeline records at earlier stages:
   - Updates pipeline to "Training" stage
   - Closes previous stage
   - Records new stage entry
   - Auto-completes all prior checklist items
5. Shows summary of created/updated pipeline records and completed items

**Output Example:**
```
🔍 Finding agents ready for first lead pack...

📊 Found 15 agents ready for first lead pack:

   1. Smith John M (12345) - MGA: Johnson Mary L - No pipeline
   2. Doe Jane A (67890) - MGA: Johnson Mary L - Pipeline: 123
   ...

⚙️  Creating/updating pipeline records at Training stage...

   ✅ Created pipeline 456 for Smith John M (15 items completed)
   ✅ Updated pipeline 123 for Doe Jane A (On-boarding → Training, 12 items completed)
   ...

📈 Pipeline Seeding Summary:
   ✅ Created: 8
   🔄 Updated: 5
   ⏭️  Skipped: 2
   📊 Total agents: 15
   ✓ Checklist items completed: 195

✅ Seeding complete!
```

### Option 2: Direct SQL Execution

Execute the SQL file directly in your database:

```bash
mysql -u [user] -p [database] < atlas/database/seed_first_pack_leads.sql
```

Or run it in your MySQL client:
```sql
SOURCE atlas/database/seed_first_pack_leads.sql;
```

**What it does:**
1. Shows count of agents to be processed
2. Lists the agents with their current pipeline status
3. Creates pipeline records for agents without one
4. Updates existing pipelines to Training stage
5. Records stage transitions in `pipeline_steps`
6. Shows what was created/updated
7. Note: Does NOT auto-complete checklist items (SQL limitation)
   - Use Node.js script for complete auto-completion

## What Gets Created/Updated

### For agents WITHOUT pipeline records:

**`pipeline` table:**
- New record with `step = 'Training'`
- `recruit_first` and `recruit_last` extracted from `lagnname`
- `recruiting_agent` set to their MGA
- `agent_number` from `agtnum`

**`pipeline_steps` table:**
- Entry with `step = 'Training'`, `date_entered = NOW()`

**`activeusers` table:**
- `pipeline_id` linked to new pipeline record

### For agents WITH pipeline records at earlier stages:

**`pipeline` table:**
- `step` updated to `'Training'`
- `date_modified` set to `NOW()`

**`pipeline_steps` table:**
- Previous stage closed (`date_exited = NOW()`)
- New entry for Training stage

### Checklist Items (Node.js script only):

**`pipeline_checklist_progress` table:**
- All items from prior stages marked as completed
- `started_at` = `completed_at` = NOW()
- `completed = 1`

## When to Run This Script

Run this script when you need to:
- **Initial setup**: Create pipeline records for existing ready agents
- **Periodic sync**: Find agents who became ready but weren't caught by automated processes
- **Data cleanup**: After fixing data issues or migrations
- **Manual override**: When automated processes weren't running
- **Backfill**: Complete checklist items for agents who were manually progressed

## Integration with Python Processors

Note: The `pending_processor.py` has a `process_ready_for_first_pack()` function that handles this automatically during daily processing. This script is for:
- Initial setup/backfill
- Manual corrections
- Situations where the automated process missed agents

## Checking Results

After running, verify the results:

```sql
-- See all agents at Training stage ready for first pack
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    ps.date_entered as training_started,
    au.mga
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.step = 'Training' AND ps.date_exited IS NULL
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND NOT EXISTS (
      SELECT 1 FROM leads_released lr
      WHERE lr.userId = au.id
        AND lr.type = '1st Pack'
        AND lr.sent = 1
  )
ORDER BY ps.date_entered DESC;

-- Check completed checklist items for an agent
SELECT 
    pci.stage_name,
    pci.item_name,
    pcp.completed,
    pcp.started_at,
    pcp.completed_at
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE pcp.recruit_id = [pipeline_id]
ORDER BY pci.stage_name, pci.item_order;

-- Count agents by status
SELECT 
    COUNT(*) as total_training_agents,
    SUM(CASE WHEN lr.id IS NULL THEN 1 ELSE 0 END) as no_first_pack_sent
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN leads_released lr ON lr.userId = au.id AND lr.type = '1st Pack' AND lr.sent = 1
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND p.step = 'Training';
```

## Pipeline Integration

Agents who are ready for first pack should also be at the "Training" stage in the pipeline. The scripts check for this and can create pipeline records if needed.

## Troubleshooting

### Script shows "0 agents found"
This means all qualifying agents already have pipeline records at Training stage. This is expected after initial setup.

### Script fails with database error
Check:
1. Database connection settings in `backend/config/database.js`
2. You're running from the correct directory (atlas root)
3. Database user has INSERT/UPDATE permissions on `pipeline`, `pipeline_steps`, and `activeusers`

### Agent appears but shouldn't
Verify the agent's status:
```sql
SELECT 
    id,
    lagnname,
    agtnum,
    pending,
    released,
    Active,
    managerActive,
    pipeline_id
FROM activeusers
WHERE agtnum = '12345';
```

All criteria must be met.

### Need to re-run safely
The script checks for existing pipeline records and current stages, so it's safe to run multiple times. It will:
- Skip agents already at Training with complete checklist items
- Update agents at earlier stages to Training
- Fill in any missing checklist items

## Manual Pipeline Creation

If you need to manually create a pipeline for a single agent:

```sql
-- 1. Create pipeline record
INSERT INTO pipeline (
    recruit_first,
    recruit_last,
    step,
    date_added,
    recruiting_agent,
    agentnum,
    MGA
)
SELECT 
    SUBSTRING_INDEX(SUBSTRING_INDEX(lagnname, ' ', 2), ' ', -1),
    SUBSTRING_INDEX(lagnname, ' ', 1),
    'Training',
    NOW(),
    au.mga,
    au.agtnum,
    au.mga
FROM activeusers au
WHERE au.agtnum = '12345';

-- 2. Link to activeuser
UPDATE activeusers 
SET pipeline_id = LAST_INSERT_ID() 
WHERE agtnum = '12345';

-- 3. Record stage entry
INSERT INTO pipeline_steps (recruit_id, step, date_entered)
VALUES (LAST_INSERT_ID(), 'Training', NOW());

-- 4. For checklist completion, use the Node.js script
```

## Related Documentation

- `python/PIPELINE_AUTOMATION_README.md` - Pipeline automation details
- `atlas/PIPELINE_AGENT_ACTIVATION_SUMMARY.md` - Agent activation flow
- Pipeline Progress view in Atlas frontend

