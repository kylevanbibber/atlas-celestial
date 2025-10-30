# Apply State Licensing Data - Quick Guide

## ✅ You're Ready to Go!

I've converted your state licensing spreadsheet into a comprehensive SQL script that populates state-specific requirements for all 50 states + DC.

## 🚀 Quick Setup (2 steps)

### Step 1: Create the State Requirements Table (if not done already)

```bash
mysql -u your_user -p your_database < atlas/database/create_pipeline_state_requirements_table.sql
```

Or in MySQL:
```sql
SOURCE atlas/database/create_pipeline_state_requirements_table.sql;
```

### Step 2: Load All State Data

```bash
mysql -u your_user -p your_database < atlas/database/seed_state_requirements_from_data.sql
```

Or in MySQL:
```sql
SOURCE atlas/database/seed_state_requirements_from_data.sql;
```

**That's it!** All 51 states are now configured with their specific requirements.

## 📊 What Was Just Loaded

### Background Check Requirements (47 states)
- ✅ Fingerprinting methods (IdentGo, Live Scan, Fieldprint, etc.)
- ✅ States with no background check (IN, KS, ME, MI)
- ✅ Special timing (before/after license)

### Exam Vendors (51 states)
- ✅ Pearson VUE (32 states) - default
- ✅ PSI (14 states) - with state-specific links
- ✅ Prometric (5 states) - with special instructions
- ✅ D&S (Louisiana only)

### Pre-Licensing Requirements (51 states)
- ✅ Required in 26 states + DC
- ✅ Recommended in 25 states

### Total Requirements Added
- **100+ state-specific modifications**
- **51 states covered** (50 states + DC)
- **3 stages affected**: Licensing primarily

## 🧪 Test It

### 1. Pick a state to test (e.g., California)

```sql
-- Update a recruit to be in California
UPDATE pipeline SET resident_state = 'CA' WHERE id = [recruit_id];
```

### 2. Open the Pipeline checklist in the UI
- Navigate to **Pipeline**
- Select the recruit
- Click **View Checklist**

### 3. Look for California-specific changes:
- **Background Check**: Should say "Live Scan fingerprinting"
- **Schedule Test**: Should mention "PSI" vendor
- **Pre-Licensing**: Should be marked as required
- **State Badge**: Look for 🔵 "CA" badge or 🟠 "Modified" badge

### 4. Check Console Logs
Open browser console (F12) and look for:
```
[PipelineChecklist] Recruit state: CA
[PipelineChecklist] Fetched checklist items: 28 for state: CA
[PipelineChecklist] State-specific items: 0
[PipelineChecklist] Modified items: 3
```

## 📋 Verify Data Loaded

Run this query to see all state requirements:

```sql
SELECT 
  state,
  COUNT(*) as modifications,
  GROUP_CONCAT(DISTINCT action) as actions
FROM pipeline_state_requirements
WHERE active = 1
GROUP BY state
ORDER BY state;
```

Expected output (partial):
```
+-------+---------------+------------------+
| state | modifications | actions          |
+-------+---------------+------------------+
| AK    | 2             | modify           |
| AL    | 1             | modify           |
| AZ    | 3             | modify           |
| CA    | 3             | modify           |
| CO    | 2             | modify           |
| ...   | ...           | ...              |
+-------+---------------+------------------+
```

## 🎯 State Examples to Test

### Easy Tests (Clear Differences)

**California (CA)**:
- Background: Live Scan (unique method)
- Exam: PSI (not Pearson VUE)
- Pre-Licensing: Required

**Louisiana (LA)**:
- Exam: D&S (unique vendor)
- Background: Fingerprinting with KIOSK/ID card/paper options

**Maryland (MD)**:
- Exam: Prometric
- Background: Fingerprints collected **at test center** during exam

**Pennsylvania (PA)**:
- Background: Fingerprints **after** getting license (reversed order)
- Pre-Licensing: Required

### States with No Background Check

Test these to verify background check is marked "not required":
- Indiana (IN)
- Kansas (KS)
- Maine (ME)
- Michigan (MI)

## 🔍 Troubleshooting

### No changes showing for a state?

1. **Check recruit has a state set**:
   ```sql
   SELECT id, recruit_first, recruit_last, resident_state FROM pipeline WHERE id = [recruit_id];
   ```

2. **Verify state data was loaded**:
   ```sql
   SELECT * FROM pipeline_state_requirements WHERE state = 'CA' AND active = 1;
   ```
   Should return 3 rows for California.

3. **Check browser console** for errors or warnings.

### Changes not appearing in UI?

1. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)
2. **Clear browser cache**
3. **Restart backend server** if needed
4. Check console logs for API errors

### Wrong vendor showing?

Make sure the state requirement is active:
```sql
SELECT state, stage_name, action, target_item_name, override_description, active
FROM pipeline_state_requirements
WHERE state = 'CA' AND target_item_name = 'Schedule Test';
```

Should show `active = 1` and mention "PSI".

## 📖 Reference Documentation

- **[STATE_LICENSING_REFERENCE.md](./STATE_LICENSING_REFERENCE.md)** - Detailed state-by-state breakdown
- **[PIPELINE_STATE_REQUIREMENTS.md](./PIPELINE_STATE_REQUIREMENTS.md)** - Technical system documentation
- **[PIPELINE_STATE_SETUP.md](./PIPELINE_STATE_SETUP.md)** - General setup guide

## ✏️ Customizing Data

Need to adjust a state's requirements?

### Example: Update Florida's background check description

```sql
UPDATE pipeline_state_requirements 
SET override_description = 'Florida: New fingerprinting process via updated IdentGo portal'
WHERE state = 'FL' AND target_item_name = 'Background Check';
```

### Example: Add a new state-specific requirement

```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, item_name, item_description, item_order
) VALUES (
  'CA', 'Training', 'add',
  'Complete CA Ethics Module',
  'California-specific ethics training (new 2025 requirement)',
  20
);
```

## 🎉 You're All Set!

Your pipeline system now has comprehensive state-specific licensing requirements for all 50 states + DC.

**Next Steps**:
1. ✅ Test with a few different states
2. ✅ Verify the console logs show state modifications
3. ✅ Check that badges appear on state-specific items
4. 📝 Document any additional state-specific processes your team discovers

---

**Questions?** Check the reference docs or console logs for debugging.

