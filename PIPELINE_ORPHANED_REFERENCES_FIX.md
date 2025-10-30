# Pipeline Orphaned References Fix

## Problem

Some agents in `activeusers` have `pipeline_id` values that point to non-existent records in the `pipeline` table. Additionally, there are orphaned records in `pipeline_checklist_progress` that reference these non-existent pipeline records.

### Primary Issues:

1. **Orphaned pipeline_id references**: Agents have `pipeline_id` but the pipeline record doesn't exist
   - The script checks `if (!agent.pipeline_id)` → FALSE (because it's not null)
   - The script tries to UPDATE the existing pipeline record
   - The pipeline record doesn't exist → Agent gets skipped

2. **Orphaned checklist progress**: Records in `pipeline_checklist_progress` reference non-existent `recruit_id`
   - Causes duplicate key errors when trying to create new progress records
   - Error: `#1062 - Duplicate entry 'X-Y' for key 'unique_progress'`

## Root Cause

This typically happens when:
- Pipeline records were deleted but `activeusers.pipeline_id` wasn't set to NULL
- Data was migrated incorrectly
- Manual database cleanup removed pipeline records

## Solution

The seeding scripts now:
1. **Clean up orphaned checklist progress records** (STEP 0)
2. **Detect and handle orphaned `pipeline_id` references** (STEP 1+)

### Automatic Cleanup (STEP 0)

Both Node.js and SQL scripts now automatically clean up orphaned checklist progress records before creating new pipeline records:

```javascript
// Node.js - Automatic cleanup
const cleanupResult = await db.query(`
  DELETE pcp
  FROM pipeline_checklist_progress pcp
  LEFT JOIN pipeline p ON pcp.recruit_id = p.id
  WHERE p.id IS NULL
`);
console.log(`Cleaned up ${cleanupResult.affectedRows} orphaned checklist progress records`);
```

```sql
-- SQL - Automatic cleanup
DELETE pcp
FROM pipeline_checklist_progress pcp
LEFT JOIN pipeline p ON pcp.recruit_id = p.id
WHERE p.id IS NULL;
```

### Orphaned Reference Detection (STEP 1+)

#### Node.js Script (`seed-post-first-pack-agents.js`)

```javascript
// Check if pipeline_id exists but pipeline record doesn't (orphaned reference)
let needsNewPipeline = !agent.pipeline_id;

if (agent.pipeline_id) {
  const pipelineData = await db.query(
    "SELECT id, step FROM pipeline WHERE id = ?",
    [agent.pipeline_id]
  );
  
  if (pipelineData.length === 0) {
    console.log(`   ⚠️  Orphaned pipeline_id ${agent.pipeline_id} for ${agent.lagnname} - will create new pipeline`);
    needsNewPipeline = true;
  }
}

if (needsNewPipeline) {
  // Create new pipeline record...
}
```

### SQL Script (`seed_post_first_pack_agents.sql`)

```sql
-- Create pipeline records for agents with NULL or orphaned pipeline_id
INSERT INTO pipeline (...)
SELECT ...
FROM activeusers au
JOIN leads_released lr ON lr.userId = au.id
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE ...
  AND (au.pipeline_id IS NULL OR p.id IS NULL)  -- NULL or orphaned
  ...
```

The `LEFT JOIN` allows us to check if the pipeline record exists:
- If `au.pipeline_id IS NULL` → No pipeline reference
- If `au.pipeline_id IS NOT NULL AND p.id IS NULL` → Orphaned reference

## Manual Cleanup (Optional)

If you want to run cleanup separately before the seed scripts:

```bash
mysql -u [user] -p [database] < atlas/database/cleanup_orphaned_checklist_progress.sql
```

This script:
1. Shows count of orphaned checklist progress records
2. Shows details of first 20 orphaned records
3. Deletes all orphaned records
4. Verifies cleanup completed

**Note:** The seed scripts now run this cleanup automatically, so this is only needed if you want to clean up before running the seed scripts or run cleanup independently.

## Testing

Run the diagnostic query to identify orphaned references:

```sql
-- Show orphaned pipeline_id references
SELECT 
    au.id,
    au.lagnname,
    au.pipeline_id as orphaned_pipeline_id,
    'Pipeline record does not exist' as issue
FROM activeusers au
LEFT JOIN pipeline p ON au.pipeline_id = p.id
WHERE au.pipeline_id IS NOT NULL
  AND p.id IS NULL
ORDER BY au.lagnname;
```

Or use the test script:

```bash
mysql -u [user] -p [database] < atlas/database/test_post_first_pack_agents.sql
```

Look for **Step 3b** which shows the count of orphaned references.

## Prevention

To prevent orphaned references in the future:

### Option 1: Set pipeline_id to NULL when deleting pipeline records

```sql
-- Before deleting pipeline records
UPDATE activeusers 
SET pipeline_id = NULL 
WHERE pipeline_id IN (SELECT id FROM pipeline WHERE [deletion_criteria]);

-- Then delete
DELETE FROM pipeline WHERE [deletion_criteria];
```

### Option 2: Add a foreign key constraint (recommended)

```sql
ALTER TABLE activeusers
ADD CONSTRAINT fk_activeusers_pipeline
FOREIGN KEY (pipeline_id) REFERENCES pipeline(id)
ON DELETE SET NULL;
```

This will automatically set `pipeline_id` to NULL when a pipeline record is deleted.

## What the Scripts Do Now

### For Agents with Orphaned pipeline_id:

1. **Detect**: Check if `pipeline_id` points to non-existent record
2. **Create**: Create new pipeline record at Training stage
3. **Link**: Update `activeusers.pipeline_id` to new record
4. **Complete**: Auto-complete all prior stage items and Training items before "Attend Training"

### Console Output Example:

```
🔍 Finding agents who have received their first lead pack...

🧹 Cleaning up orphaned checklist progress records...
   ✓ Cleaned up 847 orphaned checklist progress records

📊 Will keep agents at Training stage and complete items before "Attend Training"

📊 Found 250 agents who have received first lead pack:
   ...

⚙️  Creating/updating pipeline records at Training stage...

⚠️  Orphaned pipeline_id 2629 for ABDIYEV MICHAEL I - will create new pipeline
✅ Created pipeline 3001 for ABDIYEV MICHAEL I at Training (15 items completed)
⚠️  Orphaned pipeline_id 2612 for ABUNDES EVELYN - will create new pipeline
✅ Created pipeline 3002 for ABUNDES EVELYN at Training (15 items completed)
   ...
```

## Related Files

- `atlas/backend/scripts/seed-post-first-pack-agents.js` - Node.js seeding script (with auto-cleanup)
- `atlas/database/seed_post_first_pack_agents.sql` - SQL seeding script (with auto-cleanup)
- `atlas/backend/scripts/seed-first-pack-leads.js` - First pack seeding script (with auto-cleanup)
- `atlas/database/seed_first_pack_leads.sql` - First pack SQL script (with auto-cleanup)
- `atlas/database/cleanup_orphaned_checklist_progress.sql` - Manual cleanup script
- `atlas/database/test_post_first_pack_agents.sql` - Diagnostic queries

## See Also

- `PIPELINE_AGENT_ACTIVATION_SUMMARY.md` - Agent activation flow
- `python/PIPELINE_AUTOMATION_README.md` - Python pipeline automation

