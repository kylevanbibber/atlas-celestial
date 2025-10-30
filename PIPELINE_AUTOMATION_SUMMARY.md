# Pipeline Automation Summary

This document describes all the automatic pipeline checklist item completions and stage progressions that occur throughout the agent release process.

## Overview

The system automatically updates pipeline checklist items and stages when certain events occur:

1. **When 1st Pack is marked as sent** → Complete "Receive First Lead Pack"
2. **When 2nd Pack is marked as sent** → Complete "Receive Release Pack" + Move to "Career Path" stage
3. **When agent passes release call** → Complete "Attend and Pass Release Call"
4. **When agent's pending status changes to 0** → Complete "Activate Agent Number" (via sync script)
5. **When new pending agents are added** → Create/link pipeline records and complete initial checklist items (via sync script)
6. **When applicant is marked as "Hired"** → Move to "Licensing" stage + Complete all Overview and Final Decision checklist items

---

## 1. First Pack Sent (Code Pack Tab)

### Trigger
- **File**: `CodePackTab.js`
- **Action**: User clicks "Mark Sent" for a 1st Pack
- **Backend**: `PUT /release/leads-released/:id` with `sent: 1`

### Automation
✅ **Checklist Item Completed**: "Receive First Lead Pack"
- **Stage**: Training
- **Item Type**: System-controlled
- **Variations Detected**: 
  - "Receive First Lead Pack"
  - "First Pack"
  - "1st Pack"

### Implementation
```javascript
// Backend: atlas/backend/routes/release.js
// Lines: ~357-429

// Determines pack type (1st Pack or 2nd Pack)
// Completes appropriate checklist item automatically
// Sets started_at and completed_at timestamps
```

### Notes
- Only updates if agent has a `pipeline_id`
- Does NOT fail the request if pipeline update fails
- Logs success/warnings to console

---

## 2. Second Pack Sent (Release Pack Tab)

### Trigger
- **File**: `ReleasePackTab.js` or `AgentProgressTable.js`
- **Action**: User clicks "Mark Sent" for a 2nd Pack
- **Backend**: `POST /release/second-pack`

### Automation
✅ **Checklist Item Completed**: "Receive Release Pack"
- **Stage**: Training
- **Item Type**: System-controlled
- **Variations Detected**:
  - "Receive Release Pack"
  - "2nd Pack"
  - "Second Pack"

✅ **Pipeline Stage Updated**: "Career Path"
- **From**: Training (or current stage)
- **To**: Career Path
- **Steps Recorded**:
  1. Close previous stage (`pipeline_steps.date_exited = NOW()`)
  2. Update main pipeline record (`pipeline.step = 'Career Path'`)
  3. Insert new Career Path stage entry

### Implementation
```javascript
// Backend: atlas/backend/routes/release.js
// Lines: ~1210-1302

// Step 1: Complete "Receive Release Pack" checklist item
// Step 2: Update pipeline step to "Career Path"
// Step 3: Record new pipeline step in pipeline_steps table
```

### Notes
- Only updates if agent has a `pipeline_id`
- Checks current stage before updating (won't update if already at Career Path)
- Maintains full audit trail in `pipeline_steps` table
- Does NOT fail the request if pipeline update fails

---

## 3. Pass Release Call (Agent Progress Table)

### Trigger
- **File**: `AgentProgressTable.js`
- **Action**: Admin clicks "Pass" for an agent's release call
- **Backend**: `POST /release/pass-user`

### Automation
✅ **Checklist Item Completed**: "Attend and Pass Release Call"
- **Stage**: Training
- **Item Type**: System-controlled
- **Variations Detected**:
  - "Attend and Pass Release Call"
  - "Pass Release Call"
  - "Attend Release"

✅ **Database Updates**:
- `activeusers.released = 1`
- `JA_Release.passed = 'y'`
- Creates 2nd Pack entry in `leads_released` (if doesn't exist)

### Implementation
```javascript
// Backend: atlas/backend/routes/release.js
// Lines: ~701-760

// Step 1: Update released status
// Step 2: Update JA_Release passed status
// Step 3: Create 2nd Pack entry
// Step 4: Complete "Attend and Pass Release Call" checklist item
```

### Notes
- Creates `JA_Release` record if doesn't exist
- Creates 2nd Pack `leads_released` entry with `sent = 0`
- Only updates checklist if agent has a `pipeline_id`
- Does NOT fail the request if checklist update fails

---

## 4. Activate Agent Number Sync (Scheduled/Manual)

### Trigger
- **Script**: `sync-activate-agent-number.js` or `sync_activate_agent_number.sql`
- **Action**: Manually run or scheduled via cron job
- **Purpose**: Sync historical activations or catch agents activated outside normal flow

### Automation
✅ **Checklist Item Completed**: "Activate Agent Number"
- **Stage**: On-boarding
- **Item Type**: System-controlled
- **Conditions**:
  - `activeusers.pending = 0`
  - `activeusers.clname = 'AGT'`
  - `activeusers.Active = 'y'`
  - `activeusers.managerActive = 'y'`
  - Has valid `pipeline_id`

### Implementation
```javascript
// Node.js: atlas/backend/scripts/sync-activate-agent-number.js
// SQL: atlas/database/sync_activate_agent_number.sql

// Step 1: Find "Activate Agent Number" checklist item
// Step 2: Query agents with pending = 0 but item not completed
// Step 3: Insert new completion records (INSERT IGNORE)
// Step 4: Update existing incomplete records
// Step 5: Verify and report results
```

### When to Run

**One-Time**:
- After initial pipeline deployment
- After bulk data imports
- After manual database corrections

**Recurring** (Recommended):
- Daily cron job at 3 AM
- After running `associates_processor.py`
- Weekly data quality checks
- **Automatic**: Runs on server startup (5 seconds after start)

### Notes
- Idempotent - safe to run multiple times
- Only creates/updates completion records, never deletes
- Serves as safety net for agents activated outside normal flow
- Python processor (`associates_processor.py`) handles real-time activations
- This script catches historical or manual activations

---

## 5. Pending Agents Pipeline Sync (Server Startup)

### Trigger
- **Script**: `sync-pending-agents.js`
- **Action**: Automatically runs on server startup (7 seconds after start)
- **Purpose**: Link new pending agents to pipeline system and set up initial checklist progress

### Automation
✅ **Pipeline Record Created/Linked**
- **Conditions**:
  - `activeusers.pending = 1`
  - `activeusers.Active = 'y'`
  - `activeusers.managerActive = 'y'`
  - `activeusers.clname = 'AGT'`
  - `activeusers.esid >= DATE_SUB(NOW(), INTERVAL 15 DAY)` (within last 15 days)
  - `activeusers.pipeline_id IS NULL or = 0`

✅ **Matching Logic**
1. **Attempts to find existing pipeline record** by matching:
   - `pipeline.recruit_last` = parsed last name from `lagnname`
   - `pipeline.recruit_first` = parsed first name from `lagnname`
   - `pipeline.recruit_middle` = parsed middle name from `lagnname` (if exists)
   - `pipeline.recruit_suffix` = parsed suffix from `lagnname` (if exists)
   - `pipeline.MGA` = `activeusers.mga`

2. **If match found**:
   - Links `activeusers.pipeline_id` to existing pipeline record
   - Skips checklist completion if record already has progress

3. **If no match found**:
   - Creates new pipeline record at **Training** stage
   - Populates from `activeusers`: name, phone, email, MGA
   - Sets `recruiting_agent` and `code_to`: Looks up recruiter's lagnname (SA → GA → MGA priority) in `activeusers` and stores their `id`
   - Records pipeline step entry
   - Links `activeusers.pipeline_id` to new record

✅ **Checklist Items Completed** (for new pipeline records only)
- **All Overview stage items**
- **All On-boarding stage items**
- **Training items UP TO (but not including) "Attend Training"**

### Implementation
```javascript
// Node.js: atlas/backend/scripts/sync-pending-agents.js
// Runs automatically on server startup via app.js

// Step 1: Find pending agents without pipeline_id
// Step 2: Load checklist items
// Step 3: For each agent:
//   - Try to match to existing pipeline record
//   - Create new record if no match
//   - Link activeusers.pipeline_id
//   - Complete checklist items (if new record)
// Step 4: Report summary
```

### Name Parsing
The script handles various `lagnname` formats:
- `"Last First"` → last + first
- `"Last First Middle"` → last + first + middle
- `"Last First Jr"` → last + first + suffix
- `"Last First Middle Jr"` → last + first + middle + suffix

**Recognized suffixes**: Jr, Jr., SR, Sr., II, III, IV, V

### Example Output
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
      ✓ Set recruiting_agent = 456 (from SA)
      ✓ Recorded Training stage entry
      ✓ Linked activeusers.pipeline_id = 892
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

### When to Run

**Automatic**:
- On server startup (7 seconds after start)
- Processes all qualifying pending agents each time

**Manual**:
```bash
node backend/scripts/sync-pending-agents.js
```

### Business Rules

**Why 15 Days for ESID?**
- Ensures only recent hires in active onboarding are processed
- Older pending agents likely have data quality issues

**Why Stop Before "Attend Training"?**
- Pending agents haven't been activated yet
- "Attend Training" should remain unchecked until they actually attend

**Why Match Before Creating?**
- Prevents duplicate pipeline records
- Handles cases where pipeline record was manually created
- Links orphaned records back to activeusers

### Notes
- Uses `INSERT IGNORE` to prevent duplicate entry errors
- Idempotent - safe to run multiple times
- Does NOT modify existing checklist progress if already present
- Links agents to organization hierarchy via MGA matching
- Error handling continues processing even if individual agents fail

---

## 6. Hired Applicant → Licensing Stage (Applicants Page)

### Trigger
- **File**: `Applicants.js`
- **Action**: User marks an applicant as "Hired" and fills out pre-licensing information
- **Backend**: `PUT /recruitment/recruits/:id/pre-lic`

### Automation
✅ **Pipeline Stage Updated**: "Licensing"
- **From**: Any stage (typically "Careers Form", "Final", etc.)
- **To**: Licensing
- **Steps Recorded**:
  1. Close previous stage (`pipeline_steps.date_exited = NOW()`)
  2. Update main pipeline record (`pipeline.step = 'Licensing'`)
  3. Insert new Licensing stage entry

✅ **Checklist Items Completed**: All items from Overview and Final Decision stages only
- **Overview stage items** - All completed
- **Final Decision stage items** - All completed  
- **Licensing stage items** - NOT completed (agent must complete these as they work through the licensing process)
- **State-specific modifications** - Applied based on `resident_state` for prior stages

✅ **Database Updates**:
- `pipeline.resident_state` = provided value
- `pipeline.enrolled` = provided value
- `pipeline.course` = provided value
- `pipeline.expected_complete_date` = provided value
- `pipeline.step` = 'Licensing'
- `pipeline.date_last_updated` = NOW()

### Implementation
```javascript
// Backend: atlas/backend/routes/recruitment.js
// Lines: ~411-477

// Step 1: Get current pipeline data
// Step 2: Update pipeline record with pre-lic info and set step to 'Licensing'
// Step 3: Close previous step in pipeline_steps
// Step 4: Record new Licensing stage entry
// Step 5: Auto-complete all prior stage items (Overview, Final Decision)
//         Note: Licensing items are NOT auto-completed
```

### State-Specific Modifications
The automation respects state-specific requirements defined in `pipeline_state_requirements`:
- Items marked for removal in certain states are automatically excluded
- Only relevant items for the applicant's `resident_state` are completed

### Example Flow
```
User Action:
  → Marks applicant as "Hired"
  → Fills: Resident State = "PA", Enrolled = "y", Course = "ABC", Expected Date = "2025-12-31"

System Automation:
  ✓ Updates pipeline.step from "Final" to "Licensing"
  ✓ Records step transition in pipeline_steps
  ✓ Completes all Overview items (e.g., "Review Compensation", "Review Products")
  ✓ Completes all Final Decision items
  ⬜ Licensing items remain unchecked (agent completes these during licensing process)
  → Result: Applicant at Licensing stage, ready to work through licensing checklist
```

### Notes
- Only completes checklist items from **prior stages** (Overview, Final Decision)
- Licensing stage items remain unchecked for the agent to complete
- Only updates checklist items that don't already exist
- Does NOT overwrite existing checklist progress
- State-specific requirements are dynamically applied to prior stages
- Does NOT fail the request if checklist updates fail
- Logs detailed progress for debugging

---

## Database Schema Impact

### Tables Modified

#### `pipeline_checklist_progress`
```sql
-- New/Updated Fields
completed = 1
started_at = NOW()
completed_at = NOW()
```

#### `pipeline`
```sql
-- Updated for 2nd Pack sent
step = 'Career Path'
date_last_updated = NOW()
```

#### `pipeline_steps`
```sql
-- Previous stage closed
date_exited = NOW()

-- New Career Path stage inserted
(recruit_id, step, date_entered) = (pipeline_id, 'Career Path', NOW())
```

#### `leads_released`
```sql
-- When pack marked as sent
sent = 1
sent_date = NOW()
last_updated = NOW()
```

#### `activeusers`
```sql
-- When pending agent synced to pipeline
pipeline_id = <pipeline.id>
```

---

## Checklist Item IDs Reference

Based on the codebase, these are the key checklist items:

| Item Name | ID | Stage | Trigger |
|-----------|----|----|---------|
| Receive First Lead Pack | 60 | Training | 1st Pack Sent |
| Attend and Pass Release Call | (varies) | Training | Pass Release |
| Receive Release Pack | (varies) | Training | 2nd Pack Sent |

*Note: IDs may vary by database instance*

---

## Error Handling

All pipeline automation operations are wrapped in try-catch blocks:

```javascript
try {
    // Pipeline automation logic
    console.log('✓ Success message');
} catch (error) {
    console.error('Error message:', error);
    // Don't fail the main request
}
```

**Philosophy**: Pipeline updates are **enhancements**, not requirements. The core business operation (marking pack as sent, passing agent) should always succeed even if pipeline updates fail.

---

## Testing Checklist

When testing pipeline automation:

- [ ] Mark 1st Pack as sent → Verify "Receive First Lead Pack" is checked
- [ ] Mark 2nd Pack as sent → Verify "Receive Release Pack" is checked AND stage moves to "Career Path"
- [ ] Pass agent release call → Verify "Attend and Pass Release Call" is checked
- [ ] Mark applicant as "Hired" → Verify stage moves to "Licensing" AND all Overview/Final Decision items are checked (but NOT Licensing items)
- [ ] Test "Hired" with different states → Verify state-specific requirements are applied
- [ ] Run activate sync script → Verify agents with pending=0 have "Activate Agent Number" checked
- [ ] Run pending agents sync script → Verify new pending agents get pipeline_id and initial items completed
- [ ] Test pending agent matching → Verify existing pipeline records are found and linked
- [ ] Test with agent who has NO pipeline_id → Should not fail
- [ ] Test with agent already at Career Path → Should not duplicate records
- [ ] Check `pipeline_steps` table → Verify previous stage is closed (date_exited set)
- [ ] Check console logs → Verify appropriate success/warning messages
- [ ] Run sync scripts twice → Should be idempotent (no duplicate records)
- [ ] Test server startup → Both sync scripts should run automatically (5s and 7s delays)

---

## Related Files

### Frontend
- `atlas/frontend/src/components/utilities/leads/CodePackTab.js` - 1st pack marking
- `atlas/frontend/src/components/utilities/leads/ReleasePackTab.js` - 2nd pack marking
- `atlas/frontend/src/components/production/release/AgentProgressTable.js` - Pass release call
- `atlas/frontend/src/components/recruiting/Applicants.js` - Hired applicant management

### Backend
- `atlas/backend/routes/release.js` - Lead pack and release call automation
- `atlas/backend/routes/recruitment.js` - Hired applicant automation
- `atlas/backend/app.js` - Server startup, runs both sync scripts
- `atlas/backend/scripts/sync-activate-agent-number.js` - Activate sync script (Node.js)
- `atlas/backend/scripts/sync-pending-agents.js` - Pending agents sync script (Node.js)

### Database
- `atlas/database/sync_activate_agent_number.sql` - Activate sync script (SQL)

### Documentation
- `atlas/LEAD_PACK_CHECKLIST_INTEGRATION.md` - Original 1st pack integration docs
- `atlas/backend/scripts/README_SYNC_ACTIVATE_AGENT.md` - Activate sync script documentation
- `atlas/backend/scripts/README_SYNC_PENDING_AGENTS.md` - Pending agents sync script documentation

---

## Pipeline Stage Flow

```
Overview → Final Decision → Licensing → On-boarding → Training → Career Path
                                                          ↑            ↑
                                                    1st Pack Sent  2nd Pack Sent
                                                    Pass Release   (Auto-advance)
```

### Training Stage Checklist Items (in order)
1. ✅ Activate Agent Number (system-controlled)
2. ✅ Receive First Lead Pack (auto-completed when 1st pack sent)
3. ⬜ Attend Training
4. ⬜ Complete Training Modules
5. ⬜ Schedule Release Call
6. ✅ Attend and Pass Release Call (auto-completed when passed)
7. ✅ Receive Release Pack (auto-completed when 2nd pack sent)

---

## Future Enhancements

Potential improvements to consider:

1. **Webhook/Event System**: Decouple pipeline updates from main business logic
2. **Audit Trail**: Store who triggered automation (currently NULL for auto-completions)
3. **Rollback Support**: Allow "un-passing" or "un-sending" with automatic rollback
4. **Bulk Operations**: Handle multiple agents at once for mass actions
5. **Stage Validation**: Verify agent is at correct stage before auto-advancing

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-29 | Added Hired Applicant → Licensing stage automation | System |
| 2025-10-28 | Added Pending Agents Sync on server startup | System |
| 2025-10-28 | Added Activate Agent Number Sync on server startup | System |
| 2025-10-28 | Added 2nd Pack → Career Path automation | System |
| 2025-10-28 | Added Pass Release → Complete checklist | System |
| Previous | Added 1st Pack → Complete checklist | System |

