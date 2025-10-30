# Sync Pending Agents to Pipeline

This script automatically processes new pending agents (`pending = 1`) in `activeusers` and links them to the pipeline system.

## What It Does

### 1. Find Pending Agents
Identifies agents in `activeusers` where:
- `pending = 1` (not yet activated)
- `Active = 'y'`
- `managerActive = 'y'`
- `clname = 'AGT'`
- `esid` within last **15 days**
- `pipeline_id` is NULL or 0

### 2. Match to Existing Pipeline Records
Attempts to find existing pipeline records by matching:
- **Name components**: `recruit_last`, `recruit_first`, `recruit_middle`, `recruit_suffix`
- **MGA**: `pipeline.MGA` matches `activeusers.mga`

**Parsing Logic for `lagnname`:**
The script handles various name formats:
- `"Last First"` → last + first
- `"Last First Middle"` → last + first + middle
- `"Last First Jr"` → last + first + suffix
- `"Last First Middle Jr"` → last + first + middle + suffix

**Recognized suffixes**: Jr, Jr., SR, Sr., II, III, IV, V

### 3. Create New Pipeline Record (if no match)
If no existing pipeline record is found:
- Creates new pipeline record at **Training** stage
- Populates name, phone, email from `activeusers`
- **Sets `recruiting_agent` and `code_to`**:
  1. Gets recruiter's lagnname from hierarchy (SA → GA → MGA priority)
  2. Looks up that lagnname in `activeusers` table
  3. Stores the recruiter's `activeusers.id` (not the lagnname string)
- Records pipeline step entry

### 4. Link to `activeusers`
Updates `activeusers.pipeline_id` to link to the pipeline record (whether matched or newly created).

### 5. Complete Checklist Items
If the pipeline record has no existing checklist progress:
- Completes **all Overview items**
- Completes **all On-boarding items**
- Completes **Training items UP TO (but not including) "Attend Training"**

This ensures pending agents have a clean starting point in the pipeline.

## How to Run

### Automatic (Server Startup)
The script runs automatically **7 seconds** after the server starts.

### Manual Execution
```bash
# From the backend directory
node scripts/sync-pending-agents.js
```

## Example Output

```
🔄 Starting pending agents sync...

📋 STEP 1: Finding pending agents without pipeline...
   ✓ Found 3 pending agents without pipeline

📋 STEP 2: Loading checklist items...
   ✓ Loaded 24 checklist items

📝 STEP 3: Processing agents...

   Processing: SMITH JOHN (ID: 1234)
      ✓ Matched to existing pipeline 567
      ✓ Linked activeusers.pipeline_id = 567
      → Pipeline already has checklist progress, skipping

   Processing: DOE JANE A (ID: 1235)
      → Creating new pipeline record
      ✓ Created pipeline 892
      ✓ Recorded Training stage entry
      ✓ Linked activeusers.pipeline_id = 892
      ✓ Set recruiting_agent = 456 (from SA hierarchy)
      ✓ Completed 18 checklist items

   Processing: JONES ROBERT JR (ID: 1236)
      → Creating new pipeline record
      ✓ Created pipeline 893
      ✓ Recorded Training stage entry
      ✓ Linked activeusers.pipeline_id = 893
      ✓ Completed 18 checklist items

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pending agents sync completed!
   Total agents processed: 3
   Matched to existing pipeline: 1
   Created new pipeline: 2
   Linked to activeusers: 3
   Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Business Rules

### Why 15 Days for ESID?
The 15-day window ensures we only process recent hires who are actively in the onboarding process. Older pending agents likely have data quality issues or were never activated.

### Why Stop Before "Attend Training"?
Pending agents (`pending = 1`) haven't been activated yet, so they haven't attended their initial training. The script completes all setup items but leaves "Attend Training" unchecked until they actually attend.

### Matching vs. Creating
- **Matching**: Prevents duplicate pipeline records for agents who may have been added to the pipeline manually before being imported to `activeusers`.
- **Creating**: Ensures all new pending agents have a pipeline record and proper tracking from day one.

### Recruiter ID Lookup
When creating a new pipeline record:
1. Gets the recruiter's lagnname from agent's hierarchy (SA → GA → MGA, first non-NULL)
2. Looks up that lagnname in `activeusers` table to get the recruiter's `id`
3. Stores the `id` (not the lagnname string) in both `recruiting_agent` and `code_to` fields
4. If recruiter's lagnname is not found in `activeusers`, both fields are set to `NULL`
5. A warning is logged but the pipeline record is still created successfully

## Integration with Other Scripts

This script works alongside:
- **`sync-activate-agent-number.js`**: Runs first (5s), completes "Activate Agent Number" for agents with `pending = 0`
- **`sync-pending-agents.js`**: Runs second (7s), creates pipeline records for new `pending = 1` agents
- **`associates_processor.py`**: Python script that monitors `pending` status changes in Excel uploads

## Database Tables

### Tables Modified
- `activeusers`: Updates `pipeline_id`
- `pipeline`: Inserts new records
- `pipeline_steps`: Records stage entries
- `pipeline_checklist_progress`: Completes checklist items

### Tables Queried
- `activeusers`: Finds pending agents
- `pipeline`: Checks for existing records
- `pipeline_checklist_items`: Gets items to complete

## Error Handling

The script:
- Continues processing even if individual agents fail
- Logs detailed errors for each failure
- Reports error count in final summary
- Does NOT crash the server if sync fails

## Testing

To test the script without affecting production data:

1. **Identify a test agent:**
   ```sql
   SELECT id, lagnname, pipeline_id, pending, esid
   FROM activeusers
   WHERE pending = 1 
     AND Active = 'y' 
     AND managerActive = 'y'
     AND clname = 'AGT'
   LIMIT 1;
   ```

2. **Clear their pipeline_id:**
   ```sql
   UPDATE activeusers SET pipeline_id = NULL WHERE id = <test_id>;
   ```

3. **Run the script:**
   ```bash
   node scripts/sync-pending-agents.js
   ```

4. **Verify results:**
   ```sql
   SELECT au.id, au.lagnname, au.pipeline_id, p.step, COUNT(pcp.id) as completed_items
   FROM activeusers au
   LEFT JOIN pipeline p ON p.id = au.pipeline_id
   LEFT JOIN pipeline_checklist_progress pcp ON pcp.recruit_id = p.id AND pcp.completed = 1
   WHERE au.id = <test_id>
   GROUP BY au.id, au.lagnname, au.pipeline_id, p.step;
   ```

## Notes

- The script uses `INSERT IGNORE` for checklist progress to prevent duplicate entry errors
- Name parsing is case-insensitive
- Empty middle names and suffixes are handled gracefully
- MGA matching ensures agents are linked to the right organization hierarchy

