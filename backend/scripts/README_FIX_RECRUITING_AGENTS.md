# Fix NULL Recruiting Agents Script

## Overview

This script fixes pipeline rows where `recruiting_agent` and `coded_to` fields are NULL by populating them from the agent's hierarchy in the `activeusers` table.

## Problem

Some pipeline rows have NULL values for:
- `recruiting_agent` - The person who recruited this agent
- `coded_to` - The person this agent is coded to (usually the same as recruiting_agent)

This can happen when:
- Pipeline records are created without proper recruiter information
- Data is imported from external systems
- Manual database operations occur
- Historical data exists before hierarchy tracking was implemented

## Solution

The script uses the agent's hierarchy to determine the appropriate recruiter:

```
Priority Order:
1. SA (Senior Associate) - if exists, use this
2. GA (General Agent) - if SA is NULL, use this
3. MGA (Managing General Agent) - if GA is NULL, use this
```

Both `recruiting_agent` and `coded_to` are set to the same value (the recruiter's `lagnname`).

## Files

### SQL Version
**File**: `atlas/database/fix_null_recruiting_agents.sql`
- Use for one-time manual execution
- Run directly in phpMyAdmin or MySQL client
- Shows detailed before/after statistics

### Node.js Version
**File**: `atlas/backend/scripts/fix-null-recruiting-agents.js`
- Use for automated execution
- Better logging and error handling
- Can be integrated into deployment scripts

## Usage

### Running the Node.js Script

```bash
# From the atlas directory
cd backend
node scripts/fix-null-recruiting-agents.js
```

### Running the SQL Script

```bash
# Using MySQL client
mysql -u username -p database_name < database/fix_null_recruiting_agents.sql

# Or paste into phpMyAdmin SQL tab
```

## What It Does

### Step-by-Step Process

1. **Analyzes Current Status**
   - Counts total pipeline rows
   - Identifies rows with NULL recruiting_agent
   - Identifies rows with NULL coded_to

2. **Shows Sample Data**
   - Displays rows that will be updated
   - Shows which recruiter will be used
   - Shows recruiter level (SA/GA/MGA)

3. **Verifies Recruiters Exist**
   - Checks that recruiter names exist in activeusers
   - Warns if any recruiters are missing

4. **Updates recruiting_agent**
   - Sets to COALESCE(sa, ga, mga)
   - Updates date_last_updated timestamp

5. **Updates coded_to**
   - Sets to COALESCE(sa, ga, mga)
   - Updates date_last_updated timestamp

6. **Updates MGA Column** (Bonus)
   - Fixes NULL MGA values while we're at it

7. **Verifies Results**
   - Shows final statistics
   - Displays recruiter level distribution
   - Lists any remaining issues

## Example Output

```
🔧 Starting fix for NULL recruiting_agent and coded_to fields...

📊 STEP 1: Analyzing current status...
   Total pipeline rows: 453
   NULL recruiting_agent: 67
   NULL coded_to: 67
   Both NULL: 67

📋 STEP 2: Sample of rows that will be updated...
   Found 10 sample rows (showing first 10):
   1. Pipeline 125: John Doe
      Agent: Doe John M
      Will use: Smith Jane A (SA)
   2. Pipeline 126: Mary Johnson
      Agent: Johnson Mary L
      Will use: Brown Robert K (GA)
   ...

🔍 STEP 3: Verifying recruiters exist in activeusers...
   Unique recruiters needed: 23
   Recruiters found in activeusers: 23

🔄 STEP 4: Updating recruiting_agent...
   ✓ Updated recruiting_agent for 67 rows

🔄 STEP 5: Updating coded_to...
   ✓ Updated coded_to for 67 rows

🔄 STEP 6: Updating MGA column (bonus fix)...
   ✓ Updated MGA column for 12 rows

✅ STEP 7: Verifying results...
   Total pipeline rows: 453
   NULL recruiting_agent: 0
   NULL coded_to: 0
   Both populated: 453

📊 STEP 8: Recruiter level distribution...
   SA (Senior Associate): 145 (32.0%)
   GA (General Agent): 198 (43.7%)
   MGA (Managing General Agent): 110 (24.3%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Fix completed successfully!
   recruiting_agent updated: 67 rows
   coded_to updated: 67 rows
   MGA updated: 12 rows
   Total changes: 146 updates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## When to Run

### One-Time Scenarios
- ✅ After initial pipeline system deployment
- ✅ After bulk data imports
- ✅ After data migrations
- ✅ When historical data needs cleanup

### Recurring Scenarios
- After running scripts that create pipeline records
- As part of data quality audits
- When you notice missing recruiter information

## SQL Logic Explained

The key logic uses MySQL's `COALESCE` function:

```sql
COALESCE(au.sa, au.ga, au.mga)
```

This returns the **first non-NULL value** from the list:
1. Try `au.sa` - if not NULL, return this
2. If SA is NULL, try `au.ga` - if not NULL, return this
3. If GA is NULL, try `au.mga` - if not NULL, return this
4. If all are NULL, return NULL

### Example Scenarios

**Scenario 1: Agent has SA**
```
Agent: John Doe
SA: Smith Jane A
GA: Brown Robert K
MGA: Wilson Michael T

Result: recruiting_agent = "Smith Jane A" (SA takes priority)
```

**Scenario 2: Agent has no SA, but has GA**
```
Agent: Mary Johnson
SA: NULL
GA: Brown Robert K
MGA: Wilson Michael T

Result: recruiting_agent = "Brown Robert K" (GA is used)
```

**Scenario 3: Agent has only MGA**
```
Agent: Bob Williams
SA: NULL
GA: NULL
MGA: Wilson Michael T

Result: recruiting_agent = "Wilson Michael T" (MGA is used)
```

## Database Impact

### Tables Modified

#### `pipeline`
```sql
-- Fields updated
recruiting_agent = COALESCE(au.sa, au.ga, au.mga)
coded_to = COALESCE(au.sa, au.ga, au.mga)
MGA = au.mga (if NULL)
date_last_updated = NOW()
```

### Tables Read (No Changes)
- `activeusers` - Read hierarchy information

## Safety Features

✅ **Non-Destructive** - Only updates NULL values, never overwrites existing data
✅ **Verification** - Checks that recruiters exist before updating
✅ **Logging** - Shows exactly what will be changed before changing it
✅ **Rollback Safe** - Updates can be manually reversed if needed
✅ **Bonus Fix** - Also fixes NULL MGA values

## Troubleshooting

### Issue: "Recruiters not found in activeusers"

**Cause**: The hierarchy field (SA/GA/MGA) contains a lagnname that doesn't exist in activeusers

**Solution**: 
1. Check if the recruiter name is spelled correctly
2. Verify the recruiter has an activeusers record
3. Update the agent's hierarchy fields to valid recruiter names

```sql
-- Find agents with invalid recruiters
SELECT 
  au.id,
  au.lagnname,
  au.sa,
  au.ga,
  au.mga
FROM activeusers au
LEFT JOIN activeusers sa_user ON sa_user.lagnname = au.sa
LEFT JOIN activeusers ga_user ON ga_user.lagnname = au.ga
LEFT JOIN activeusers mga_user ON mga_user.lagnname = au.mga
WHERE (au.sa IS NOT NULL AND sa_user.id IS NULL)
   OR (au.ga IS NOT NULL AND ga_user.id IS NULL)
   OR (au.mga IS NOT NULL AND mga_user.id IS NULL);
```

### Issue: "No hierarchy data"

**Cause**: Agent has NULL for SA, GA, and MGA fields

**Solution**: 
1. Research the agent's actual recruiter/upline
2. Update the appropriate hierarchy field in activeusers

```sql
-- Update agent hierarchy
UPDATE activeusers
SET mga = 'Wilson Michael T'
WHERE id = 123;
```

### Issue: Script runs but some rows still NULL

**Possible Causes**:
1. Agent not linked to activeusers via pipeline_id
2. Agent has no hierarchy data (all NULL)
3. Hierarchy contains invalid recruiter names

**Diagnosis**:
```sql
-- Check specific pipeline row
SELECT 
  p.id,
  p.recruiting_agent,
  p.coded_to,
  au.id as agent_id,
  au.lagnname,
  au.sa,
  au.ga,
  au.mga
FROM pipeline p
LEFT JOIN activeusers au ON au.pipeline_id = p.id
WHERE p.id = YOUR_PIPELINE_ID;
```

## Comparison with Other Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `sync-activate-agent-number.js` | Complete "Activate Agent Number" checklist | After agent activation |
| `fix-null-recruiting-agents.js` | Populate recruiting_agent/coded_to | After pipeline creation |
| `seed-first-pack-leads.js` | Create pipeline for agents ready for 1st pack | For GROUP 2 agents |
| `seed-post-first-pack-agents.js` | Update pipeline for agents who received 1st pack | For GROUP 3 agents |

## Related Documentation

- `atlas/PIPELINE_AUTOMATION_SUMMARY.md` - Overview of all pipeline automations
- `atlas/backend/scripts/README_SYNC_ACTIVATE_AGENT.md` - Activate sync docs
- `atlas/database/README_SEED_FIRST_PACK.md` - First pack seeding docs

## Change Log

| Date | Change | Notes |
|------|--------|-------|
| 2025-10-28 | Initial creation | Fix NULL recruiting_agent and coded_to |

## Future Enhancements

Potential improvements:
1. Add validation rules to prevent NULL recruiters on insert
2. Create triggers to auto-populate on pipeline insert
3. Add email notifications when recruiters are missing
4. Extend to validate entire hierarchy chain
5. Add dashboard showing hierarchy health metrics

