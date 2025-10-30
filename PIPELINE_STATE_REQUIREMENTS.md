# Pipeline State Requirements System

## Overview

The Pipeline State Requirements system allows you to customize checklist items based on the recruit's state. Different states have different licensing requirements, so this system lets you:

- **Add** state-specific items
- **Remove** items that don't apply to a state
- **Modify** existing items (change description, make optional, etc.)
- **Mark as not required** for specific states

## Database Setup

### 1. Create the State Requirements Table

```sql
-- Run this SQL script first
source atlas/database/create_pipeline_state_requirements_table.sql
```

### 2. Table Structure

```sql
CREATE TABLE pipeline_state_requirements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state VARCHAR(2) NOT NULL,                    -- Two-letter state code (e.g., 'OH', 'CA', 'TX')
  stage_name VARCHAR(100) NOT NULL,             -- Stage to apply to (e.g., 'Licensing')
  action ENUM('add', 'remove', 'modify', 'not_required') NOT NULL,
  
  -- For 'add' action:
  item_name VARCHAR(255) NULL,
  item_description TEXT NULL,
  item_order INT NULL,
  item_type ENUM('checkbox', 'text', 'date', 'number', 'select', 'textarea') DEFAULT 'checkbox',
  item_options TEXT NULL,
  
  -- For 'remove' and 'not_required' actions:
  target_item_name VARCHAR(255) NULL,           -- Name of the default item to target
  
  -- For 'modify' action:
  override_description TEXT NULL,
  override_required BOOLEAN NULL,
  override_type VARCHAR(50) NULL,
  override_options TEXT NULL,
  
  notes TEXT NULL,                              -- Admin notes
  active BOOLEAN DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## How It Works

### Backend Process

1. When fetching checklist items for a recruit, the system:
   - Gets the recruit's state from the `pipeline.resident_state` column
   - Fetches all default checklist items
   - Queries `pipeline_state_requirements` for that state
   - Applies modifications in order: remove → not_required → modify → add
   - Returns the final merged checklist

2. **API Endpoint**: `GET /api/recruitment/recruits/:recruitId/checklist/items`
   - Returns checklist items with state requirements applied
   - Includes flags: `state_specific` and `state_modified`

### Frontend Display

1. **State-Specific Items**: Show a blue badge with the state code (e.g., "OH")
2. **Modified Items**: Show an orange "Modified" badge
3. **Tooltips**: Hover over badges to see why the item is state-specific

## Usage Examples

### Example 1: Add State-Specific Item (Ohio requires ethics course)

```sql
INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  item_name, 
  item_description, 
  item_order, 
  item_type,
  notes
) VALUES (
  'OH', 
  'Licensing', 
  'add', 
  'Complete State-Specific Ethics Course', 
  'Ohio requires additional 3-hour ethics course before license application',
  7,
  'checkbox',
  'Ohio Department of Insurance requirement - must be completed before exam'
);
```

### Example 2: Mark Item as Not Required (California doesn't require background check)

```sql
INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  notes
) VALUES (
  'CA', 
  'Licensing', 
  'not_required', 
  'Background Check',
  'California DOI handles background check automatically during license application'
);
```

### Example 3: Remove Item (Texas doesn't use pre-licensing)

```sql
INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  notes
) VALUES (
  'TX', 
  'Licensing', 
  'remove', 
  'Enroll in Pre-Licensing',
  'Texas agents use alternative qualification path'
);
```

### Example 4: Modify Item Description (Florida has different approval timeline)

```sql
INSERT INTO pipeline_state_requirements (
  state, 
  stage_name, 
  action, 
  target_item_name,
  override_description,
  notes
) VALUES (
  'FL', 
  'Licensing', 
  'modify', 
  'Receive License Approval',
  'Florida: Submit to FLDOI and wait 15 business days for approval. Check status at MyProfile.com',
  'Florida has longer approval timeline than most states'
);
```

## Important Notes

### Current Limitations

1. **State-Specific Items (action: 'add')**:
   - Currently displayed as read-only items with synthetic IDs (`state_123`)
   - Progress cannot be saved for these items yet
   - **Workaround**: Manually add state-specific items to `pipeline_checklist_items` table with appropriate metadata

2. **Recommended Approach**:
   - Use `modify`, `remove`, and `not_required` actions for most customizations
   - Only use `add` for displaying informational state-specific requirements
   - For trackable state-specific items, add them directly to `pipeline_checklist_items`

### Future Enhancements

- [ ] Add `state` column to `pipeline_checklist_items` table
- [ ] Auto-create checklist items from state requirements on first recruit in that state
- [ ] Allow progress tracking for dynamically added state items
- [ ] State requirements admin UI for managing state differences

## Visual Indicators

### State-Specific Badge (Blue)
- Shown when item is added only for this state
- Displays the state code (e.g., "OH", "CA")
- Tooltip: "Required only in [STATE]"

### Modified Badge (Orange)
- Shown when item is modified from the default
- Tooltip: "Modified for this state"

### Required Star (Red)
- Standard indicator for required items
- Can be overridden by state requirements

## Testing

### Test the System

1. **Create a recruit in a state with requirements**:
   ```sql
   INSERT INTO pipeline (recruit_first, recruit_last, state, ...) 
   VALUES ('John', 'Doe', 'OH', ...);
   ```

2. **Open the checklist in the UI**
   - Navigate to Pipeline → Select recruit → Open checklist
   - Look for state-specific badges
   - Console logs will show: `[PipelineChecklist] State-specific items: X`

3. **Verify in console**:
   ```
   [PipelineChecklist] Fetched checklist items: 25 for state: OH
   [PipelineChecklist] State-specific items: 2
   [PipelineChecklist] Modified items: 1
   ```

## Admin Management

### View All State Requirements

```sql
SELECT 
  state,
  stage_name,
  action,
  COALESCE(item_name, target_item_name) as item,
  notes,
  active
FROM pipeline_state_requirements
WHERE active = 1
ORDER BY state, stage_name, action;
```

### Disable a Requirement (Soft Delete)

```sql
UPDATE pipeline_state_requirements 
SET active = 0 
WHERE id = [requirement_id];
```

### States with Custom Requirements

```sql
SELECT 
  state,
  COUNT(*) as requirement_count,
  GROUP_CONCAT(DISTINCT action) as actions_used
FROM pipeline_state_requirements
WHERE active = 1
GROUP BY state
ORDER BY requirement_count DESC;
```

## API Reference

### Get Checklist Items with State Requirements

**Endpoint**: `GET /api/recruitment/recruits/:recruitId/checklist/items`

**Response**:
```json
{
  "success": true,
  "state": "OH",
  "data": [
    {
      "id": 15,
      "stage_name": "Licensing",
      "item_name": "Complete Pre-Licensing Course",
      "item_description": "40-hour pre-licensing course",
      "is_required": true,
      "item_type": "checkbox",
      "state_modified": false,
      "state_specific": false
    },
    {
      "id": "state_42",
      "stage_name": "Licensing",
      "item_name": "Ohio Ethics Course",
      "item_description": "3-hour state-specific ethics",
      "is_required": true,
      "item_type": "checkbox",
      "state_modified": false,
      "state_specific": true,
      "state_requirement_id": 42
    }
  ]
}
```

## Support

For questions or issues with state requirements:
1. Check console logs for state requirement processing
2. Verify the recruit has a valid state code in the `pipeline` table
3. Confirm state requirements are active in the database
4. Review SQL queries in `/atlas/backend/routes/recruitment.js` around line 834


