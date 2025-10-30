# Pipeline State Requirements - Quick Setup Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Create the Database Table

```bash
# From MySQL or your database tool
mysql -u your_user -p your_database < atlas/database/create_pipeline_state_requirements_table.sql
```

Or run directly in MySQL:
```sql
SOURCE atlas/database/create_pipeline_state_requirements_table.sql;
```

### Step 2: Add Example State Requirements (Optional)

```bash
mysql -u your_user -p your_database < atlas/database/seed_state_requirements_examples.sql
```

This adds common state variations for:
- **Ohio (OH)**: Additional ethics course
- **California (CA)**: No background check needed
- **Texas (TX)**: Different approval process
- **Florida (FL)**: Extended timeline
- **New York (NY)**: Additional training
- **Pennsylvania (PA)**: No pre-licensing
- **Massachusetts (MA)**: Different testing
- **Arizona (AZ)**: Simplified licensing

### Step 3: Test It

1. **Add a recruit with a state** (or update an existing one):
   ```sql
   UPDATE pipeline SET resident_state = 'OH' WHERE id = [recruit_id];
   ```

2. **Open the Pipeline checklist in the UI**
   - Navigate to Pipeline
   - Select the recruit
   - Click "View Checklist"

3. **Look for state badges**:
   - 🔵 Blue badge = State-specific item
   - 🟠 Orange "Modified" badge = Modified for this state

4. **Check browser console**:
   ```
   [PipelineChecklist] Fetched checklist items: 28 for state: OH
   [PipelineChecklist] State-specific items: 1
   [PipelineChecklist] Modified items: 0
   ```

## ✅ What's Working

✓ Default checklist items load for all recruits  
✓ State-specific items automatically merge based on recruit's state  
✓ Visual badges show state-specific and modified items  
✓ 4 action types: `add`, `remove`, `modify`, `not_required`  
✓ Console logging for debugging  
✓ Tooltip indicators for state items  
✓ Works with existing progress tracking for default items  

## 📋 Common Use Cases

### Add a State-Specific Requirement

```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, item_name, item_description, item_order
) VALUES (
  'OH', 'Licensing', 'add', 
  'Complete Ohio Ethics Course', 
  '3-hour state-specific ethics course',
  7
);
```

### Remove an Item for a State

```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name
) VALUES (
  'PA', 'Licensing', 'remove', 'Enroll in Pre-Licensing'
);
```

### Make an Item Optional

```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name
) VALUES (
  'CA', 'Licensing', 'not_required', 'Background Check'
);
```

### Change Item Description

```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description
) VALUES (
  'TX', 'Licensing', 'modify', 
  'Receive License Approval',
  'Texas: Submit to TDI - 10 business day timeline'
);
```

## 🔍 Troubleshooting

### No state-specific items showing?

1. Check recruit has a valid state code:
   ```sql
   SELECT id, recruit_first, recruit_last, state FROM pipeline WHERE id = [recruit_id];
   ```

2. Verify state requirements exist:
   ```sql
   SELECT * FROM pipeline_state_requirements WHERE state = 'OH' AND active = 1;
   ```

3. Check browser console for logs

### Items not saving progress?

- Default items: ✅ Progress saves normally
- Modified items: ✅ Progress saves normally  
- State-specific items (action='add'): ⚠️ Read-only for now (see limitations below)

### Console shows errors?

Check the full logs:
```javascript
[PipelineChecklist] Fetching data for recruit: 123
[PipelineChecklist] Recruit state: OH
[PipelineChecklist] Fetched checklist items: 28 for state: OH
```

## ⚠️ Current Limitations

1. **State-Specific Added Items (action='add')**:
   - Display correctly with badges
   - Cannot track progress yet
   - Have synthetic IDs like `state_123`
   
   **Workaround**: Use `modify` and `not_required` for most customizations. For trackable state items, add them directly to `pipeline_checklist_items` table.

2. **No Admin UI Yet**:
   - Manage state requirements via SQL for now
   - Admin UI planned for future release

## 📊 Verify Setup

Run this query to see all your state requirements:

```sql
SELECT 
  state,
  stage_name,
  action,
  COALESCE(item_name, target_item_name) as item,
  active,
  notes
FROM pipeline_state_requirements
WHERE active = 1
ORDER BY state, stage_name, action;
```

Expected output (if you loaded examples):
```
+-------+------------+-------------+---------------------------+--------+
| state | stage_name | action      | item                      | active |
+-------+------------+-------------+---------------------------+--------+
| AZ    | Licensing  | not_required| Purchase License          | 1      |
| CA    | Licensing  | not_required| Background Check          | 1      |
| FL    | Licensing  | modify      | Receive License Approval  | 1      |
| MA    | Licensing  | modify      | Schedule Test             | 1      |
| NY    | Training   | add         | Complete NY Suitability.. | 1      |
| OH    | Licensing  | add         | Complete Ohio Ethics...   | 1      |
| PA    | Licensing  | remove      | Enroll in Pre-Licensing   | 1      |
| TX    | Licensing  | modify      | Receive License Approval  | 1      |
+-------+------------+-------------+---------------------------+--------+
```

## 📚 Full Documentation

For detailed information, see:
- **[PIPELINE_STATE_REQUIREMENTS.md](./PIPELINE_STATE_REQUIREMENTS.md)** - Complete system documentation
- **[PIPELINE_CHECKLIST_SETUP.md](./PIPELINE_CHECKLIST_SETUP.md)** - General checklist setup

## 🎯 Next Steps

1. ✅ Create the table
2. ✅ Load example data (optional)
3. ✅ Test with a recruit
4. 📝 Document your state-specific requirements
5. 🔧 Add your state requirements via SQL
6. 👀 Monitor console for debugging

## 💡 Tips

- Start with `modify` and `not_required` actions - they're most reliable
- Use meaningful `notes` for each requirement - helps with maintenance
- Test each state requirement individually
- Keep `target_item_name` exact match to default item names
- Use 2-letter uppercase state codes (OH, CA, TX, etc.)

---

**Need Help?** Check browser console, verify SQL data, and review full docs in `PIPELINE_STATE_REQUIREMENTS.md`

