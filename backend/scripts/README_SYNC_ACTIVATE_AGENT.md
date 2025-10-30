# Sync Activate Agent Number Script

## Overview

This script automatically completes the "Activate Agent Number" checklist item for agents whose `pending` status in the `activeusers` table has changed to 0, but the checklist item hasn't been marked as complete yet.

## Purpose

Agents can become "activated" (pending → 0) through multiple paths:
1. Through the normal pipeline flow (automated via `associates_processor.py`)
2. Manual database updates
3. Bulk data imports
4. External system integrations

This script ensures the pipeline checklist stays in sync with the actual agent status, regardless of how the activation occurred.

## Files

### SQL Version
**File**: `atlas/database/sync_activate_agent_number.sql`
- Use for one-time manual sync
- Can be run directly in phpMyAdmin or MySQL client
- Shows detailed before/after statistics
- Safe to run multiple times (idempotent)

### Node.js Version
**File**: `atlas/backend/scripts/sync-activate-agent-number.js`
- Use for automated/scheduled execution
- Better error handling and logging
- Can be integrated into cron jobs
- Provides detailed progress output

## Usage

### Running the Node.js Script

```bash
# From the atlas directory
cd backend
node scripts/sync-activate-agent-number.js
```

### Running the SQL Script

```bash
# Using MySQL client
mysql -u username -p database_name < database/sync_activate_agent_number.sql

# Or paste into phpMyAdmin SQL tab
```

## What It Does

### Step-by-Step Process

1. **Finds the Checklist Item**
   - Locates "Activate Agent Number" in `pipeline_checklist_items`
   - Verifies it's active and gets its ID

2. **Analyzes Current State**
   - Counts agents with `pending = 0`
   - Identifies which ones don't have the checklist item completed

3. **Creates New Records**
   - Inserts completion records for agents who have no progress tracked

4. **Updates Existing Records**
   - Updates incomplete records (completed = 0) to completed = 1

5. **Verifies Results**
   - Shows completion statistics
   - Lists any remaining issues

## Criteria

The script only processes agents who meet ALL of these conditions:

✅ `activeusers.pending = 0` (Agent is activated)
✅ `activeusers.clname = 'AGT'` (Is an agent)
✅ `activeusers.Active = 'y'` (Active status)
✅ `activeusers.managerActive = 'y'` (Manager active status)
✅ Has a valid `pipeline_id` (Linked to pipeline)

## Output Example

```
🔄 Starting "Activate Agent Number" sync...

📋 STEP 1: Finding "Activate Agent Number" checklist item...
   ✓ Found: "Activate Agent Number" (ID: 59, Stage: On-boarding)

📊 STEP 2: Analyzing agents with pending = 0...
   Total agents with pending = 0: 145
   Already completed: 138
   Need completion: 7

📝 STEP 3: Creating new completion records...
   ✓ Created 5 new completion records

🔄 STEP 4: Updating existing incomplete records...
   ✓ Updated 2 existing records to completed

✅ STEP 5: Verifying results...
   Total agents: 145
   Completed: 145
   Not completed: 0
   Completion rate: 100.0%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sync completed successfully!
   Records created: 5
   Records updated: 2
   Total changes: 7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## When to Run

### One-Time Scenarios
- After initial pipeline system deployment
- After bulk data imports
- After manual database corrections
- After system migrations

### Recurring Scenarios
- **Daily cron job** (recommended for ongoing sync)
- After running `associates_processor.py` if issues are detected
- As part of weekly data quality checks

### Example Cron Job

```bash
# Run daily at 3 AM
0 3 * * * cd /path/to/atlas/backend && node scripts/sync-activate-agent-number.js >> /var/log/activate-sync.log 2>&1
```

## Safety Features

✅ **Idempotent**: Safe to run multiple times without duplicates
✅ **Non-Destructive**: Only adds/updates completion records, never deletes
✅ **Read-Only Checks**: Verifies data before making changes
✅ **Error Handling**: Won't crash the system if something goes wrong
✅ **Detailed Logging**: Shows exactly what was changed

## Database Impact

### Tables Modified

#### `pipeline_checklist_progress`
```sql
-- New records inserted
INSERT INTO pipeline_checklist_progress (
  recruit_id,
  checklist_item_id,
  completed,
  started_at,
  completed_at
) VALUES (
  pipeline_id,
  59,
  1,
  NOW(),
  NOW()
);

-- Existing records updated
UPDATE pipeline_checklist_progress
SET completed = 1,
    started_at = COALESCE(started_at, NOW()),
    completed_at = NOW()
WHERE completed = 0;
```

### No Changes To
- `activeusers` table (read-only)
- `pipeline` table (read-only)
- `pipeline_checklist_items` table (read-only)

## Troubleshooting

### Issue: "Activate Agent Number checklist item not found"

**Solution**: Create the checklist item first:
```sql
INSERT INTO pipeline_checklist_items (
  stage_name, 
  item_name, 
  item_description, 
  item_order, 
  is_required, 
  item_type, 
  active
) VALUES (
  'On-boarding',
  'Activate Agent Number',
  'System-controlled item: Agent number activated in the system.',
  999,
  1,
  'checkbox',
  1
);
```

### Issue: Some agents still show "not completed"

**Possible Causes**:
1. Agent doesn't have a `pipeline_id` → Link agent to pipeline first
2. Agent has `pending = 1` still → Verify agent is truly activated
3. Agent doesn't meet criteria (Active='n', etc.) → Check agent status

**Manual Fix**:
```sql
-- Check specific agent
SELECT 
  au.id,
  au.lagnname,
  au.pending,
  au.Active,
  au.managerActive,
  au.clname,
  au.pipeline_id,
  p.id as actual_pipeline_id
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.id = YOUR_AGENT_ID;
```

### Issue: Script runs but makes no changes

**Causes**:
- All agents are already synced (this is good!)
- No agents meet the criteria
- Database connection issues

**Verification**:
```sql
-- Check if there are any agents that should be synced
SELECT COUNT(*) 
FROM activeusers au
JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pending = 0
  AND au.clname = 'AGT'
  AND au.Active = 'y'
  AND au.managerActive = 'y';
```

## Integration with Existing Systems

### With `associates_processor.py`

The Python processor already handles activation for new agents via the `check_and_activate_agent` function. This sync script serves as a **safety net** for:
- Agents activated before the automation existed
- Manual activations outside the normal flow
- Data imported from external systems

### With Pipeline Automation

This sync complements the existing pipeline automation:
1. **Python Processor** (`associates_processor.py`): Activates new agents
2. **This Script**: Syncs historical/manual activations
3. **Backend Routes** (`release.js`): Handles other checklist completions (pack sent, pass release, etc.)

## Related Documentation

- `atlas/PIPELINE_AUTOMATION_SUMMARY.md` - Overview of all pipeline automations
- `atlas/PIPELINE_AGENT_ACTIVATION_SUMMARY.md` - Agent activation flow details
- `python/PIPELINE_AUTOMATION_README.md` - Python automation docs

## Change Log

| Date | Change | Notes |
|------|--------|-------|
| 2025-10-28 | Initial creation | Sync script for "Activate Agent Number" |

## Future Enhancements

Potential improvements:
1. Add webhook/event triggers for real-time sync
2. Extend to sync other system-controlled items
3. Add Slack/email notifications for sync results
4. Create dashboard for sync status monitoring
5. Add rollback functionality for incorrect syncs

