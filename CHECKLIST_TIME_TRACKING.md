# Pipeline Checklist Item Time Tracking

## Overview

The pipeline system now tracks the time it takes for recruits to complete each checklist item. This allows for performance analytics, bottleneck identification, and process optimization.

## Database Schema

### Table: `pipeline_checklist_progress`

**New Column:**
- `started_at` (DATETIME, NULL) - Timestamp when work first began on this checklist item

**Existing Columns Used:**
- `completed_at` (DATETIME, NULL) - Timestamp when the item was marked complete
- `completed` (TINYINT) - Boolean flag (0 = incomplete, 1 = complete)

**Time Calculation:**
```sql
-- Calculate time to complete (in hours)
SELECT 
    checklist_item_id,
    TIMESTAMPDIFF(HOUR, started_at, completed_at) as hours_to_complete
FROM pipeline_checklist_progress
WHERE completed = 1 AND started_at IS NOT NULL;

-- Calculate average time per checklist item
SELECT 
    pci.item_name,
    AVG(TIMESTAMPDIFF(HOUR, pcp.started_at, pcp.completed_at)) as avg_hours,
    COUNT(*) as completions
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE pcp.completed = 1 AND pcp.started_at IS NOT NULL
GROUP BY pci.id, pci.item_name;
```

## How It Works

### When `started_at` is Set

1. **New Progress Record Created:**
   - When a recruit first interacts with a checklist item (opening it, adding notes, etc.)
   - `started_at` is set to `NOW()`

2. **Existing Record Updated:**
   - If `started_at` is NULL and any field is updated (value, notes, etc.)
   - `started_at` is automatically set to `NOW()`

3. **Item Completed:**
   - If completing an item and `started_at` is still NULL
   - Both `started_at` and `completed_at` are set to `NOW()`
   - (This handles instant completions or system-controlled items)

4. **Auto-Completion:**
   - When prior stage items are auto-completed
   - Both `started_at` and `completed_at` are set to the same timestamp
   - Uses `COALESCE(started_at, NOW())` to preserve existing started_at if present

### Backend Implementation

**Endpoints Modified:**
- `PUT /recruitment/recruits/:recruitId/checklist/progress` - Single item update
- `POST /recruitment/recruits/:recruitId/checklist/bulk` - Bulk update
- Auto-completion function for prior stage items

**Logic Flow:**
```javascript
if (creating_new_record) {
  // Set started_at to NOW when first creating
  started_at = NOW();
} else if (updating_existing) {
  if (!current_record.started_at) {
    // Set started_at if not already set
    started_at = NOW();
  }
  if (marking_complete && !current_record.started_at) {
    // Ensure started_at is set before completing
    started_at = NOW();
  }
}
```

## Use Cases

### 1. Identify Bottlenecks
Find checklist items that take the longest to complete:
```sql
SELECT 
    pci.stage_name,
    pci.item_name,
    AVG(TIMESTAMPDIFF(DAY, pcp.started_at, pcp.completed_at)) as avg_days,
    MAX(TIMESTAMPDIFF(DAY, pcp.started_at, pcp.completed_at)) as max_days
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE pcp.completed = 1 AND pcp.started_at IS NOT NULL
GROUP BY pci.id
ORDER BY avg_days DESC
LIMIT 10;
```

### 2. Track Individual Recruit Progress
See how long each item took for a specific recruit:
```sql
SELECT 
    pci.item_name,
    pcp.started_at,
    pcp.completed_at,
    TIMESTAMPDIFF(HOUR, pcp.started_at, pcp.completed_at) as hours_taken
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
WHERE pcp.recruit_id = ? 
    AND pcp.completed = 1 
    AND pcp.started_at IS NOT NULL
ORDER BY pcp.started_at;
```

### 3. Team Performance Comparison
Compare average completion times across recruiting agents:
```sql
SELECT 
    u.lagnname as recruiting_agent,
    pci.item_name,
    AVG(TIMESTAMPDIFF(HOUR, pcp.started_at, pcp.completed_at)) as avg_hours,
    COUNT(*) as completions
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
JOIN pipeline p ON pcp.recruit_id = p.id
JOIN activeusers u ON p.recruiting_agent = u.id
WHERE pcp.completed = 1 AND pcp.started_at IS NOT NULL
GROUP BY u.id, pci.id
ORDER BY u.lagnname, avg_hours DESC;
```

### 4. Current In-Progress Items
Find items that have been started but not completed (potential stuck items):
```sql
SELECT 
    p.recruit_first,
    p.recruit_last,
    pci.item_name,
    pcp.started_at,
    TIMESTAMPDIFF(DAY, pcp.started_at, NOW()) as days_in_progress
FROM pipeline_checklist_progress pcp
JOIN pipeline_checklist_items pci ON pcp.checklist_item_id = pci.id
JOIN pipeline p ON pcp.recruit_id = p.id
WHERE pcp.completed = 0 
    AND pcp.started_at IS NOT NULL
    AND TIMESTAMPDIFF(DAY, pcp.started_at, NOW()) > 7
ORDER BY days_in_progress DESC;
```

## Migration

**File:** `atlas/database/add_started_at_to_checklist_progress.sql`

To apply the migration:
```sql
SOURCE atlas/database/add_started_at_to_checklist_progress.sql;
```

This will:
1. Add the `started_at` column
2. Backfill completed items with `started_at = completed_at`
3. Add performance indexes

## Future Enhancements

- Dashboard widget showing average completion times per stage
- Alerts for items stuck in progress beyond threshold
- Recruiter performance metrics based on completion times
- Predictive analytics for stage completion estimates
- Time-based reporting and charts

