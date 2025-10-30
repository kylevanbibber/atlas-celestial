# Pipeline Before/After Architecture

## Overview
The pipeline system has been updated to use a flexible **before/after positioning** system instead of rigid integer-based ordering. This allows for easier insertion of custom stages anywhere in the pipeline flow without needing to renumber existing stages.

---

## Architecture Summary

### Database Tables

#### 1. **`pipeline`** (Existing - No Changes)
Stores recruit information and their current stage.
- `id` - Recruit ID
- `recruit_first`, `recruit_last`, `email`, `phone` - Recruit details
- `step` (VARCHAR) - Current stage name
- `recruiting_agent` - Agent responsible
- `date_added`, `date_last_updated` - Timestamps

#### 2. **`pipeline_steps`** (Existing - No Changes)
Tracks complete history of a recruit's journey through stages.
- `id` - Step ID
- `recruit_id` - FK to pipeline
- `step` (VARCHAR) - Stage name
- `date_entered` - When they entered this stage
- `date_exited` (NULL = current stage)
- `rowcolor` - Display color

#### 3. **`pipeline_stage_definitions`** (UPDATED ✨)
Defines available stages and their order using before/after relationships.

**New Structure:**
```sql
CREATE TABLE pipeline_stage_definitions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stage_name VARCHAR(100) NOT NULL,
  stage_color VARCHAR(20) DEFAULT '#3498db',
  stage_description TEXT NULL,
  
  -- NEW: Before/After positioning
  position_after VARCHAR(100) NULL,   -- "Place this stage after X"
  position_before VARCHAR(100) NULL,  -- "Place this stage before Y"
  
  is_default BOOLEAN DEFAULT 1,       -- System default vs custom
  is_terminal BOOLEAN DEFAULT 0,      -- End state (Released, Not Interested, etc.)
  team_id INT NULL,                   -- NULL = global, otherwise team-specific
  active BOOLEAN DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Key Changes:**
- ❌ Removed: `stage_order INT` (rigid ordering)
- ✅ Added: `position_after VARCHAR(100)` (flexible positioning)
- ✅ Added: `position_before VARCHAR(100)` (flexible positioning)

#### 4. **`pipeline_checklist_items`** (No Changes)
Tasks that must be completed per stage.

#### 5. **`pipeline_checklist_progress`** (No Changes)
Tracks completion status per recruit per checklist item.

#### 6. **`pipeline_notes`** (No Changes)
Notes/comments per recruit for collaboration.

---

## How Before/After Positioning Works

### The Chain Structure

Stages form a **linked list** using `position_after` and `position_before`:

```
NULL ← [Careers Form] → [Overview] → [Final] → ... → [Released] → NULL
       ↑ Start                                               ↑ End
```

**Example Default Chain:**
```
Careers Form:      position_after: NULL,            position_before: 'No Answer - Career Form'
No Answer - CF:    position_after: 'Careers Form',  position_before: 'Overview'
Overview:          position_after: 'No Answer - CF', position_before: 'Final'
Final:             position_after: 'Overview',      position_before: 'Pre-Lic'
...
Released:          position_after: 'Release Ready', position_before: NULL
```

### Adding Custom Stages

**Example: Insert "Interview Prep" between "Overview" and "Final"**

```sql
INSERT INTO pipeline_stage_definitions (
  stage_name, 
  stage_color,
  position_after, 
  position_before,
  is_default,
  team_id
) VALUES (
  'Interview Prep',
  '#9b59b6',
  'Overview',        -- ← Place after this
  'Final',           -- ← Place before this
  0,                 -- Not a default stage
  328                -- Team-specific
);
```

**Result:**
```
Before: Careers Form → Overview → Final → Pre-Lic
After:  Careers Form → Overview → Interview Prep → Final → Pre-Lic
                                  ↑ NEW STAGE!
```

No need to update any other stages! 🎉

---

## Frontend Implementation

### Stage Ordering Algorithm

The frontend uses a `buildStageOrder()` function to convert the before/after relationships into an ordered array:

```javascript
const buildStageOrder = (stageList) => {
  // Filter out terminal stages (not in main pipeline)
  const pipelineStages = stageList.filter(s => !s.is_terminal);
  
  // Find the starting stage (position_after is NULL)
  let currentStage = pipelineStages.find(s => s.position_after === null);
  
  const orderedStages = [];
  const visited = new Set();
  
  // Follow the chain
  while (currentStage && !visited.has(currentStage.stage_name)) {
    orderedStages.push(currentStage);
    visited.add(currentStage.stage_name);
    
    // Find next stage (where position_after === current stage_name)
    currentStage = pipelineStages.find(s => 
      s.position_after === currentStage.stage_name && 
      !visited.has(s.stage_name)
    );
  }
  
  return orderedStages;
};
```

**Used in:**
- `PipelineProgress.js` - To display stages in correct order
- `PipelineSettings.js` - To show stages in settings and populate before/after dropdowns

---

## Migration Steps

### 1. **Run the Migration**
```sql
-- File: backend/migrations/update_pipeline_to_before_after_positioning.sql
```

This migration:
- Adds `position_after` and `position_before` columns
- Migrates existing `stage_order` data to before/after relationships
- Drops the old `stage_order` column and index
- Adds indexes for the new positioning columns

### 2. **Verify Migration**
```sql
SELECT 
  stage_name, 
  position_after, 
  position_before, 
  is_default,
  is_terminal
FROM pipeline_stage_definitions
WHERE team_id IS NULL
ORDER BY id;
```

You should see a chain like:
```
Careers Form       | NULL              | No Answer - Career Form | 1 | 0
No Answer - CF     | Careers Form      | Overview                | 1 | 0
Overview           | No Answer - CF    | Final                   | 1 | 0
...
Released           | Release Ready     | NULL                    | 1 | 1
```

---

## User Interface

### Pipeline Progress Page
- **Stage Cards**: Display in order determined by `buildStageOrder()`
- **DataTable**: Allows inline stage editing with color-coded dropdowns
- **Checklist Modal**: View/edit recruit's checklist progress

### Pipeline Settings Page
- **Add Custom Stage**: Button opens form with:
  - Stage Name
  - Description
  - Color picker
  - **Position After** dropdown (select which stage comes before)
  - **Position Before** dropdown (select which stage comes after)
- **Stage List**: Shows all stages in correct order
  - Default stages: Cannot be deleted (locked)
  - Custom stages: Can be deleted (shows delete button)
- **Checklist Items**: Expandable per-stage configuration

---

## Example Workflow: Adding a Custom Stage

### Step 1: Click "Add Custom Stage"
From Settings page, click the button.

### Step 2: Fill in Form
- **Stage Name**: "Background Interview"
- **Description**: "Final background check interview"
- **Color**: Choose from color picker
- **Position After**: "Final"
- **Position Before**: "Pre-Lic"

### Step 3: Save
The new stage is inserted into the chain:
```
Before: ... → Final → Pre-Lic → ...
After:  ... → Final → Background Interview → Pre-Lic → ...
```

### Step 4: Add Checklist Items
- Expand the new stage
- Click "Add Item"
- Create checklist items for that stage

### Step 5: Use in Pipeline
- Go to Pipeline Progress
- Select a recruit
- Change their stage to "Background Interview"
- View/complete checklist items

---

## Benefits of This Architecture

1. **✅ Flexible Insertion**: Add stages anywhere without renumbering
2. **✅ Intuitive**: "After X, Before Y" is clearer than "stage_order = 5.5"
3. **✅ Team Customization**: Each team can add custom stages
4. **✅ No Breaking Changes**: Existing data migrates seamlessly
5. **✅ Performance**: Indexed for fast lookups
6. **✅ Visual**: Frontend rebuilds order dynamically

---

## Testing Checklist

### Database
- [ ] Run migration successfully
- [ ] Verify stages are in correct order
- [ ] Verify terminal stages (Not Interested, etc.) have NULL for both position_after and position_before

### Frontend - Progress
- [ ] Stages display in correct order
- [ ] Stage cards show correct counts
- [ ] Can filter recruits by stage
- [ ] Can change recruit's stage via dropdown
- [ ] Checklist modal opens and works

### Frontend - Settings
- [ ] Stages display in correct order
- [ ] "Add Custom Stage" button works
- [ ] Position After/Before dropdowns populate correctly
- [ ] Can create custom stage
- [ ] Custom stage appears in correct position
- [ ] Can delete custom stage (not default stages)
- [ ] Can add checklist items to any stage

### Edge Cases
- [ ] What if there's a break in the chain? (Algorithm appends orphaned stages to end with warning)
- [ ] What if someone creates a cycle? (Frontend will stop at first revisit)
- [ ] What if position_after references a non-existent stage? (Stage becomes orphaned)

---

## Files Modified

### Database
- ✅ `backend/migrations/update_pipeline_to_before_after_positioning.sql` (NEW)
- ✅ `backend/migrations/create_pipeline_configuration_tables.sql` (UPDATED)
- ✅ `backend/migrations/seed_default_pipeline_stages.sql` (UPDATED)

### Frontend
- ✅ `frontend/src/components/recruiting/Pipeline/PipelineProgress.js` (UPDATED)
- ✅ `frontend/src/components/recruiting/Pipeline/PipelineSettings.js` (UPDATED)
- ✅ `frontend/src/components/recruiting/Pipeline/PipelineSettings.css` (UPDATED)

### Backend
- No changes needed! The API already returns all fields from `pipeline_stage_definitions`, including the new `position_after` and `position_before` columns.

---

## Next Steps

1. **Run the migration** in your database
2. **Refresh the frontend** to pick up changes
3. **Test the pipeline** functionality
4. **Add custom stages** to verify insertion works
5. **Verify ordering** is correct throughout

---

## Troubleshooting

### Stages Not in Correct Order?
Check the console for warnings from `buildStageOrder()`. It will log:
- `[Pipeline] No starting stage found` - No stage with `position_after: NULL`
- `[Pipeline] Stage "X" not in chain` - Orphaned stage detected

### Can't Delete a Stage?
- Default stages (`is_default: 1`) cannot be deleted
- Only custom stages (`is_default: 0`) can be removed

### Custom Stage Not Showing?
- Check `active: 1` in database
- Verify `is_terminal: 0` (terminal stages don't show in main pipeline)
- Check that `team_id` matches your user's team or is NULL

---

## Summary

The new before/after positioning system provides a **flexible, intuitive, and powerful** way to manage pipeline stages. It allows teams to customize their recruiting process without complex renumbering or breaking existing functionality.

**Key Takeaway:** Insert stages anywhere by simply saying "after X, before Y" - the system handles the rest! 🎯

