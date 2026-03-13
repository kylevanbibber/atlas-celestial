# Seed Pipeline for Post-First-Pack Agents

## Overview

These scripts create/update **pipeline records** for agents who have **received their first lead pack**. They automatically place agents at the **Training** stage with checklist items before "Attend Training" completed (including "Receive First Lead Pack").

## Criteria for "Post-First Pack Ready"

An agent is considered ready if they meet ALL of the following:
- ✅ `activeusers.pending = 0` (agent is activated, not pending)
- ✅ `activeusers.released = 0` (agent hasn't been released yet)
- ✅ `activeusers.Active = 'y'` (agent is active)
- ✅ `activeusers.managerActive = 'y'` (manager approved)
- ✅ IN `leads_released` with `type = "1st Pack"` **AND** `sent = 1` (received first pack)

## Usage Options

### Option 1: Node.js Script (Recommended)

Run the automated seeding script from the atlas root directory:

```bash
cd atlas
node backend/scripts/seed-post-first-pack-agents.js
```

**What it does:**
1. Finds all agents who have received their first lead pack
2. Shows you a list of agents to be processed
3. For agents WITHOUT pipeline records:
   - Creates new pipeline record at **Training** stage
   - Links to activeusers via `pipeline_id`
   - Records stage entry in `pipeline_steps`
   - Auto-completes ALL checklist items from prior stages (Overview → On-boarding)
   - Completes Training items **before** "Attend Training" (including "Receive First Lead Pack")
4. For agents WITH pipeline records at stages before Training:
   - Updates pipeline to Training stage
   - Closes previous stage
   - Records new stage entry
   - Auto-completes prior stage items and Training items before "Attend Training"
5. For agents already at Training:
   - Ensures items before "Attend Training" are completed
6. Shows summary of created/updated pipeline records and completed items

**Output Example:**
```
🔍 Finding agents who have received their first lead pack...

📊 Will keep agents at Training stage and complete items before "Attend Training"

📊 Found 23 agents who have received first lead pack:

   1. Smith John M (12345) - Pipeline: 456 - Sent: 2024-01-15
   2. Doe Jane A (67890) - No pipeline - Sent: 2024-01-16
   ...

⚙️  Creating/updating pipeline records to Training stage...

   ✅ Created pipeline 789 for Doe Jane A at Training (15 items completed)
   ✅ Updated pipeline 456 for Smith John M (On-boarding → Training, 12 items completed)
   ...

📈 Pipeline Seeding Summary:
   ✅ Created: 5
   🔄 Updated: 18
   ⏭️  Skipped: 0
   📊 Total agents: 23
   ✓ Checklist items completed: 282

✅ Seeding complete!
```

### Option 2: Direct SQL Execution

Execute the SQL file directly in your database:

```bash
mysql -u [user] -p [database] < atlas/database/seed_post_first_pack_agents.sql
```

Or run it in your MySQL client:
```sql
SOURCE atlas/database/seed_post_first_pack_agents.sql;
```

**What it does:**
1. Shows your current stage order
2. Shows count of agents to be processed
3. Creates pipeline records at **Training** stage for agents without one
4. Updates existing pipelines to Training stage if at earlier stages
5. Records stage transitions in `pipeline_steps`
6. Completes Training items before "Attend Training" for all agents
7. Shows what was created/updated

**Note:** The SQL script completes specific checklist items but may not auto-complete all prior stage items as efficiently as the Node.js version. For complete automation, use the Node.js script.

## Difference from seed-first-pack-leads

| Script | Agents Targeted | Pipeline Stage | Checklist Items Completed |
|--------|----------------|----------------|---------------------------|
| `seed-first-pack-leads.js` | Have NOT received 1st pack | Training | All prior stages |
| `seed-post-first-pack-agents.js` | HAVE received 1st pack | Training | All prior stages + Training items before "Attend Training" |

**Workflow:**
1. Agent activates (pending → active) → Run `seed-first-pack-leads` → Agent at Training with prior stages complete
2. Agent receives 1st pack → Run `seed-post-first-pack-agents` → Agent at Training with "Receive First Lead Pack" completed
3. Agent attends training → Manually complete "Attend Training" → Agent ready for next stage
4. Continue progression...

## What Gets Created/Updated

### For agents WITHOUT pipeline records:

**`pipeline` table:**
- New record with `step = 'Training'`
- `recruit_first` and `recruit_last` extracted from `lagnname`
- `recruiting_agent` set to their MGA name (varchar, not ID)
- `agentnum` from `agtnum`
- `MGA` set to their MGA name

**`pipeline_steps` table:**
- Entry with `step = 'Training'`, `date_entered = NOW()`

**`activeusers` table:**
- `pipeline_id` linked to new pipeline record

### For agents WITH pipeline records at earlier stages:

**`pipeline` table:**
- `step` updated to 'Training'
- `date_last_updated` set to `NOW()`

**`pipeline_steps` table:**
- Previous stage closed (`date_exited = NOW()`)
- New entry for Training stage

### For agents already at Training:

- Ensures all items before "Attend Training" are completed
- No stage change

### Checklist Items:

**`pipeline_checklist_progress` table:**
- All items from prior stages (Overview → On-boarding) marked as completed ✅
- Training items with `item_order` < "Attend Training" marked as completed:
  - **"Receive First Lead Pack"** (item_order 1) ✅
  - Any other Training items before "Attend Training" ✅
- `started_at` = `completed_at` = NOW()
- `completed = 1`

**Special Note:** The "Receive First Lead Pack" checklist item is explicitly completed for all agents who have received their first pack, as this directly corresponds to the `leads_released` table entry.

## When to Run This Script

Run this script when you need to:
- **Initial setup**: Create pipeline records for agents who already received first pack
- **Periodic sync**: Progress agents after first pack distribution
- **Data cleanup**: After fixing data issues or migrations
- **Backfill**: Complete checklist items for agents who were manually progressed

## Checking Results

After running, verify the results:

```sql
-- See all agents who have received first pack with their pipeline status
SELECT 
    au.lagnname,
    au.agtnum,
    p.id as pipeline_id,
    p.step,
    ps.date_entered as stage_started,
    lr.sent_date as first_pack_sent,
    au.mga
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
JOIN leads_released lr ON lr.userId = au.id
JOIN pipeline_steps ps ON ps.recruit_id = p.id AND ps.step = p.step AND ps.date_exited IS NULL
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
  AND lr.type = '1st Pack'
  AND lr.sent = 1
ORDER BY ps.date_entered DESC;

-- Check completed checklist items for an agent (including Training)
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

-- Count agents by first pack status and pipeline stage
SELECT 
    p.step,
    COUNT(*) as agent_count,
    COUNT(DISTINCT lr.id) as with_first_pack
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
LEFT JOIN leads_released lr ON lr.userId = au.id AND lr.type = '1st Pack' AND lr.sent = 1
WHERE au.pending = 0
  AND au.released = 0
  AND au.Active = 'y'
  AND au.managerActive = 'y'
GROUP BY p.step
ORDER BY p.step;
```

## Troubleshooting

### Script shows "0 agents found"
This means no agents have received their first pack yet, or all who have are already at Training stage with all items before "Attend Training" completed.

### Script fails with database error
Check:
1. Database connection settings in `backend/config/database.js`
2. You're running from the correct directory (atlas root)
3. Database user has INSERT/UPDATE permissions

### "Attend Training" item not found
The script looks for a checklist item named "Attend Training" in the Training stage. Verify it exists:
```sql
SELECT * FROM pipeline_checklist_items 
WHERE stage_name = 'Training' 
AND item_name = 'Attend Training' 
AND active = 1;
```

### Agent not progressing
Verify the agent meets all criteria:
```sql
SELECT 
    au.id,
    au.lagnname,
    au.agtnum,
    au.pending,
    au.released,
    au.Active,
    au.managerActive,
    au.pipeline_id,
    lr.type,
    lr.sent,
    lr.sent_date
FROM activeusers au
LEFT JOIN leads_released lr ON lr.userId = au.id AND lr.type = '1st Pack'
WHERE au.agtnum = '12345';
```

## Integration

### Recommended Workflow

1. **Daily Pending Report** → Activates agents → `seed-first-pack-leads.js` → Agents at Training
2. **First Pack Distribution** → Mark as sent in `leads_released` → `seed-post-first-pack-agents.js` → Agents progress
3. Continue with your pipeline stages...

### Automation

You can integrate this into your lead distribution workflow:
```javascript
// After marking first pack as sent
await db.query(`
  UPDATE leads_released 
  SET sent = 1, sent_date = NOW() 
  WHERE userId = ? AND type = '1st Pack'
`, [userId]);

// Trigger pipeline progression
const { exec } = require('child_process');
exec('node backend/scripts/seed-post-first-pack-agents.js');
```

## Related Documentation

- `atlas/backend/scripts/README_SEED_FIRST_PACK.md` - For agents ready for first pack
- `python/PIPELINE_AUTOMATION_README.md` - Pipeline automation details
- `atlas/PIPELINE_AGENT_ACTIVATION_SUMMARY.md` - Agent activation flow

