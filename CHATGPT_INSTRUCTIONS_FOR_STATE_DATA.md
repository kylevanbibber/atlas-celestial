# Instructions for Generating State Requirements SQL

## Context

I have a pipeline checklist system for insurance agent licensing. Each state has different requirements for background checks, exam vendors, and pre-licensing courses. I need to generate SQL INSERT statements to populate the `pipeline_state_requirements` table based on my state-by-state data.

## Database Table Structure

```sql
CREATE TABLE pipeline_state_requirements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state VARCHAR(2) NOT NULL,                    -- Two-letter state code (e.g., 'OH', 'CA', 'TX')
  stage_name VARCHAR(100) NOT NULL,             -- Stage (e.g., 'Licensing', 'Training', 'On-boarding')
  action ENUM('add', 'remove', 'modify', 'not_required') NOT NULL,
  
  -- For 'add' action: define new item
  item_name VARCHAR(255) NULL,
  item_description TEXT NULL,
  item_order INT NULL,
  item_type ENUM('checkbox', 'text', 'date', 'number', 'select', 'textarea') DEFAULT 'checkbox',
  item_options TEXT NULL,
  
  -- For 'remove' and 'not_required' actions: reference existing item by name
  target_item_name VARCHAR(255) NULL,
  
  -- For 'modify' action: override specific fields
  override_description TEXT NULL,
  override_required BOOLEAN NULL,
  override_type VARCHAR(50) NULL,
  override_options TEXT NULL,
  
  notes TEXT NULL,
  active BOOLEAN DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Default Checklist Items

These are the default items that exist in `pipeline_checklist_items` for ALL recruits:

**Licensing Stage:**
- Enroll in Pre-Licensing
- Schedule Test
- Pass Test
- Background Check
- Purchase License
- Receive License Approval

**On-boarding Stage:**
- Complete AOB
- Complete Steps 1-4
- Receive Agent Number
- Activate Agent Number

**Training Stage:**
- Receive First Lead Pack
- Attend Training
- Complete Release Checklist
- Attend and Pass Release Call
- Receive Release Pack

## Action Types Explained

### 1. `modify` - Change an existing item
Use when a state has **different instructions** for an existing step.
- **Must set**: `target_item_name` (the existing item to modify)
- **Must set**: `override_description` (the new state-specific description)
- **Can set**: `override_required` (true/false to change required status)
- **Example**: California requires "Live Scan" instead of regular fingerprinting

### 2. `not_required` - Make an existing item optional
Use when a state **doesn't require** a normally required step.
- **Must set**: `target_item_name` (the existing item to make optional)
- **Example**: Indiana doesn't require background checks

### 3. `remove` - Completely remove an item
Use when a state **doesn't need** a step at all.
- **Must set**: `target_item_name` (the existing item to remove)
- **Example**: A state that doesn't use pre-licensing at all

### 4. `add` - Add a new state-specific item
Use when a state has an **additional requirement** not in the default list.
- **Must set**: `item_name`, `item_description`, `item_order`
- **Example**: Ohio requires an additional state-specific ethics course

## Data Mapping Rules

Based on my Excel spreadsheet:

### Background Check Column

**If "Yes (Fingerprinting)" or contains "Fingerprinting":**
```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'XX', 'Licensing', 'modify', 'Background Check',
  '[State]: Fingerprinting required. [Additional instructions from spreadsheet]',
  '[Any notes from Background Check Required column]'
);
```

**If "No" or blank:**
```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, notes
) VALUES (
  'XX', 'Licensing', 'not_required', 'Background Check',
  '[State] does not require background check'
);
```

**Special cases to look for:**
- "Live Scan" → Mention Live Scan specifically in description
- "IdentGo" → Mention IdentGo/IDEMIA process
- "Fieldprint" → Mention Fieldprint process
- "via Prometric" → Mention done at Prometric test center
- "after obtaining license" → Note timing in description

### Exam Vendor Column

**If vendor is NOT "Pearson VUE":**
```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'XX', 'Licensing', 'modify', 'Schedule Test',
  '[State]: Schedule exam through [Vendor Name]. Visit [link from Schedule Exam Link column]',
  '[Vendor Name] vendor'
);
```

**If vendor IS "Pearson VUE":**
- Don't create a requirement (Pearson VUE is the default)

### Exam Required Column (Pre-Licensing)

**If "Yes" (required):**
- Don't create a requirement (pre-licensing is required by default)

**If "No" or contains "recommended":**
```sql
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_required, notes
) VALUES (
  'XX', 'Licensing', 'modify', 'Enroll in Pre-Licensing',
  0,
  'Pre-licensing recommended but not required'
);
```

## Example Output Format

Generate clean SQL with comments for each state:

```sql
-- ============================================================
-- CALIFORNIA (CA)
-- ============================================================

-- Background Check: Live Scan fingerprinting required
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'CA', 'Licensing', 'modify', 'Background Check',
  'California requires Live Scan fingerprinting. Must use a certified Live Scan provider.',
  'Live Scan fingerprinting'
);

-- Exam Vendor: PSI instead of Pearson VUE
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'CA', 'Licensing', 'modify', 'Schedule Test',
  'California: Schedule exam through PSI. Visit https://candidate.psiexams.com/ and select California.',
  'PSI vendor'
);

-- Pre-licensing is required (no entry needed - this is default)
```

## Important Guidelines

1. **Use 2-letter state codes** (ALL CAPS): CA, TX, OH, FL, etc.
2. **stage_name must be exact**: 'Licensing', 'On-boarding', 'Training' (case-sensitive)
3. **target_item_name must match default items exactly**:
   - 'Background Check' (not 'Fingerprinting' or 'Background')
   - 'Schedule Test' (not 'Schedule Exam')
   - 'Enroll in Pre-Licensing' (exact match)
4. **Keep descriptions clear and actionable** - these show to users
5. **Include links in override_description** when available from the spreadsheet
6. **Set active = 1** for all entries (or omit, defaults to 1)
7. **Only create entries for differences from defaults** - don't create entries for standard requirements

## What NOT to include

- Don't create entries for states where everything is standard (Pearson VUE, fingerprinting, pre-licensing required)
- Don't create entries for default values (Pearson VUE exam, required pre-licensing)
- Don't duplicate information - one entry per state per difference

## Steps Required Column - Special Handling

The "Steps (ordered)" column in my spreadsheet shows the sequence of steps. Use this to understand **timing** and add to descriptions when relevant:

- If background check is listed "after exam" → Add timing to override_description
- If pre-licensing must be "before exam" → Add timing note
- If license application is "after fingerprints" → Note in description

## Final Output Requirements

1. **Start with**: `-- State Requirements Generated from Excel Data`
2. **Group by state** with clear comment headers
3. **Order states alphabetically** (AL, AK, AZ, AR, CA, CO, etc.)
4. **Use proper SQL syntax** with single quotes for strings
5. **Escape single quotes** in descriptions (use `''` for `'`)
6. **End with**: A verification comment showing total states and requirements

## Example of Complete Entry

```sql
-- ============================================================
-- OHIO (OH)
-- ============================================================

-- Background Check: Fingerprints required
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'OH', 'Licensing', 'modify', 'Background Check',
  'Ohio requires fingerprints. Submit fingerprints after passing exam.',
  'Fingerprints required'
);

-- Exam Vendor: PSI
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_description, notes
) VALUES (
  'OH', 'Licensing', 'modify', 'Schedule Test',
  'Ohio: Schedule exam through PSI. Visit https://test-takers.psiexams.com/oh/ns',
  'PSI vendor'
);

-- Pre-licensing: Recommended but not required
INSERT INTO pipeline_state_requirements (
  state, stage_name, action, target_item_name, override_required, notes
) VALUES (
  'OH', 'Licensing', 'modify', 'Enroll in Pre-Licensing',
  0,
  'Pre-licensing recommended but not required'
);
```

## What I Need You to Generate

Based on my Excel spreadsheet data, please generate:

1. SQL INSERT statements for each state's differences from default
2. Proper grouping and comments
3. Clean, executable SQL
4. A summary at the end showing:
   - Total states with modifications
   - Total requirements added
   - Breakdown by action type (modify, not_required, etc.)

## Excel Spreadsheet Columns I'll Provide

- State (2-letter code)
- Exam Required (Yes/No for pre-licensing)
- Background Check Required (Yes/No/Special)
- Exam Vendor (Pearson VUE/PSI/Prometric/D&S)
- Schedule Exam Link (URL)
- Steps (ordered) - sequence of actions

Please parse each row and generate the appropriate INSERT statements following the rules above.

