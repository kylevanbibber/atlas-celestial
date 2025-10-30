# How to Generate State Requirements SQL with ChatGPT

## Quick Steps

### Option 1: Short Version (Recommended)

1. **Open ChatGPT** (GPT-4 recommended for best results)

2. **Copy and paste** the contents of `CHATGPT_PROMPT.txt`

3. **Attach or paste your Excel data**
   - You can upload the Excel file directly to ChatGPT
   - Or copy/paste the spreadsheet data as text/table

4. **ChatGPT will generate** the SQL INSERT statements

5. **Save the output** to `atlas/database/seed_state_requirements_from_data.sql`

6. **Run the SQL**:
   ```bash
   mysql -u your_user -p your_database < atlas/database/seed_state_requirements_from_data.sql
   ```

### Option 2: Detailed Version

If you need more context or want to understand the full system:

1. **Open** `CHATGPT_INSTRUCTIONS_FOR_STATE_DATA.md`

2. **Copy the entire file** contents

3. **Paste into ChatGPT** with your Excel data

4. Follow steps 4-6 from Option 1 above

## What ChatGPT Needs from Your Excel

Your spreadsheet should have these columns (or similar):
- **State** - 2-letter state code (CA, TX, OH, etc.)
- **Exam Required** or **Pre-Licensing** - Yes/No/Recommended
- **Background Check Required** - Yes/No/Fingerprinting/Live Scan/etc.
- **Exam Vendor** - Pearson VUE/PSI/Prometric/D&S
- **Schedule Exam Link** - URL to exam portal
- **Steps (ordered)** - Sequence of actions (optional, for timing)

## Example Prompt to ChatGPT

```
[Paste CHATGPT_PROMPT.txt contents here]

Here's my state data:

State | Exam Required | Background Check | Exam Vendor | Link
----- | ------------- | ---------------- | ----------- | ----
CA    | Yes           | Yes (Live Scan)  | PSI         | https://...
OH    | No (Rec)      | Yes (Fingerprinting) | PSI     | https://...
IN    | Yes           | No               | Pearson VUE | https://...
...
```

## Expected Output

ChatGPT should generate something like:

```sql
-- ============================================================
-- CALIFORNIA (CA)
-- ============================================================

INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'CA', 'Licensing', 'modify', 'Background Check',
  'California requires Live Scan fingerprinting through certified providers.',
  'Live Scan fingerprinting'
);

INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'CA', 'Licensing', 'modify', 'Schedule Test',
  'California: Schedule exam through PSI at https://candidate.psiexams.com/',
  'PSI vendor'
);

-- ============================================================
-- OHIO (OH)
-- ============================================================
...
```

## Verify the Output

After ChatGPT generates the SQL:

1. **Check for syntax errors** - Look for missing commas, quotes, etc.

2. **Verify state codes** - Should be 2-letter UPPERCASE (CA, TX, OH)

3. **Check target_item_name** - Must match exactly:
   - `Background Check` (not "Fingerprinting")
   - `Schedule Test` (not "Schedule Exam")
   - `Enroll in Pre-Licensing` (not "Pre-Licensing Course")

4. **Verify stage_name** - Should be `Licensing` for these items

5. **Run verification**:
   ```bash
   mysql -u your_user -p your_database < atlas/database/verify_state_requirements.sql
   ```

## Common Issues and Fixes

### Issue: Target item names don't match
**Fix**: Replace with exact names:
- "Fingerprinting" → "Background Check"
- "Schedule Exam" → "Schedule Test"
- "Pre-Licensing Course" → "Enroll in Pre-Licensing"

### Issue: Action types are wrong
**Fix**: Follow these rules:
- Changing instructions? → `action = 'modify'`
- Making optional? → `action = 'not_required'`
- Adding new requirement? → `action = 'add'`
- Removing completely? → `action = 'remove'`

### Issue: Too many entries
**Fix**: Only create entries for **differences** from defaults. Don't create entries for:
- States using Pearson VUE (it's the default)
- States requiring pre-licensing (it's the default)
- States with standard background checks (it's the default)

### Issue: Missing descriptions
**Fix**: Add clear, actionable descriptions:
- ✅ "Ohio requires fingerprints via IdentGo after passing exam"
- ❌ "Fingerprints required"

## Testing the Generated SQL

1. **Create table** (if not done):
   ```bash
   mysql -u your_user -p your_database < atlas/database/create_pipeline_state_requirements_table.sql
   ```

2. **Load your generated SQL**:
   ```bash
   mysql -u your_user -p your_database < atlas/database/seed_state_requirements_from_data.sql
   ```

3. **Verify it loaded**:
   ```bash
   mysql -u your_user -p your_database < atlas/database/verify_state_requirements.sql
   ```

4. **Test in UI**:
   ```sql
   UPDATE pipeline SET resident_state = 'CA' WHERE id = [some_recruit_id];
   ```
   Then open the checklist and look for state badges and modified descriptions.

## Need Help?

If ChatGPT's output isn't quite right:

1. **Be specific** in your follow-up: "The target_item_name should be 'Background Check' not 'Fingerprinting'"

2. **Provide examples** of what the correct output should look like

3. **Iterate**: You can ask ChatGPT to fix specific states or regenerate with better instructions

4. **Manual cleanup**: Small fixes can be done by hand after generation

## Files Reference

- **`CHATGPT_PROMPT.txt`** - Short version to copy-paste (⭐ USE THIS)
- **`CHATGPT_INSTRUCTIONS_FOR_STATE_DATA.md`** - Detailed version with full context
- **`create_pipeline_state_requirements_table.sql`** - Creates the table
- **`verify_state_requirements.sql`** - Checks the data loaded correctly

---

**Pro Tip**: After ChatGPT generates the SQL, ask it to also generate a summary showing:
- How many states were modified
- What action types were used
- Any states with no modifications

This helps verify the output looks reasonable before running it!

