# Pipeline Checklist Items Setup

This document explains the checklist items for each pipeline stage in the recruitment process.

## Database Schema

### `pipeline_checklist_items` Table Structure
- `id` - Auto-increment primary key
- `stage_name` - Links to the stage (e.g., "Overview", "Final Decision")
- `item_name` - Short name of the checklist item
- `item_description` - Detailed description of what needs to be done
- `item_order` - Order of items within the stage (1, 2, 3, etc.)
- `is_required` - Boolean indicating if item must be completed to progress
- `item_type` - Type of input: checkbox, text, date, number, select, textarea
- `item_options` - JSON array for select dropdown options
- `active` - Boolean to enable/disable items
- `team_id` - NULL for default items, or team-specific ID
- `created_by` - User ID who created the item
- `created_at` / `updated_at` - Timestamps

## Setup Instructions

### 1. Run the Migration (if not already done)
```sql
-- Create the tables
source atlas/backend/migrations/create_pipeline_configuration_tables.sql;
```

### 2. Seed the Checklist Items
```sql
-- Populate the checklist items
source atlas/database/seed_pipeline_checklist_items.sql;
```

### 3. Create Attachments Table (for file uploads)
```sql
-- Enable file attachments for checklist items
source atlas/database/create_pipeline_attachments_table.sql;
```

### 4. Verify the Data
```sql
-- View all checklist items by stage
SELECT 
    stage_name,
    item_name,
    item_description,
    item_order,
    is_required,
    item_type
FROM pipeline_checklist_items
WHERE team_id IS NULL
ORDER BY 
    FIELD(stage_name, 'Overview', 'Final Decision', 'Licensing', 'On-boarding', 'Training', 'Release', 'SA Contract'),
    item_order;
```

## Checklist Items by Stage

### Overview Stage (2 items)
Initial contact and interest qualification
1. **Watch/Attend Overview** (checkbox, required)
   - Candidate has watched or attended the company overview presentation
2. **Submit Survey** (checkbox, required)
   - Candidate has submitted the initial interest survey

### Final Decision Stage (2 items)
Decision on whether to proceed with candidate
1. **Decision Status** (select dropdown, required)
   - Options: "Pending Review", "Approved", "Denied"
   - Final decision on candidate application
2. **Enroll in Pre-Licensing** (textarea, required)
   - Candidate has been enrolled in pre-licensing course
   - Use textarea to attach proof/confirmation details

### Licensing Stage (6 items)
Complete all licensing requirements
1. **Pre-Licensing Course** (checkbox, required)
   - Candidate has completed pre-licensing course requirements
2. **Schedule Licensing Test** (textarea, required)
   - Licensing exam has been scheduled
   - Attach proof/confirmation in textarea
3. **Pass Licensing Test** (textarea, required)
   - Candidate has passed the licensing exam
   - Attach proof/score in textarea
4. **Background Check** (checkbox, required)
   - Background check has been completed and approved
5. **Purchase License** (textarea, required)
   - License has been purchased
   - Attach proof/receipt in textarea
6. **Receive License Approval** (textarea, required)
   - License approval received from state regulatory body
   - Attach approval document details in textarea

### On-boarding Stage (4 items)
System setup and compliance documentation
1. **Complete AOB** (textarea, required)
   - Agent of Record (AOR) documentation completed
   - Attach proof/signed documents in textarea
2. **Complete Steps 1-4** (checkbox, required)
   - Initial onboarding steps 1 through 4 have been completed
3. **Receive Agent Number** (text input, required)
   - Agent number has been assigned and received
   - Enter the agent number in text field
4. **Activate Agent Number** (checkbox, required)
   - Agent number has been activated in the system

### Training Stage (5 items)
Field training and release preparation
1. **Receive First Lead Pack** (checkbox, required)
   - Agent has received their first lead pack
2. **Attend Training** (checkbox, required)
   - Agent has attended all required training sessions
3. **Complete Release Checklist** (checkbox, required)
   - All release checklist items have been completed
4. **Attend and Pass Release Call** (checkbox, required)
   - Agent has attended and successfully passed the release call
5. **Receive Release Pack** (checkbox, required)
   - Agent has received the release pack with field materials

### SA Contract Stage (1 item)
Promotion criteria for Senior Associate
1. **Write 5K ALP or 16K Net** (checkbox, required)
   - Agent has written 5K ALP for 2 consecutive months OR 16K net over 2 months

## Item Types Explained

### checkbox
Simple true/false completion indicator. Most common for straightforward tasks.

### text
Short text input field. Used for entering specific values like agent numbers.

### textarea
Multi-line text field. Used when attaching proof, notes, or detailed information.

### select
Dropdown menu with predefined options stored in `item_options` as JSON array.
Example: `["Pending Review", "Approved", "Denied"]`

### date
Date picker for scheduling or deadline tracking.

### number
Numeric input for quantities, scores, or measurements.

## Customization

### Adding Team-Specific Items
To add checklist items for a specific team:
```sql
INSERT INTO pipeline_checklist_items 
(stage_name, item_name, item_description, item_order, is_required, item_type, team_id)
VALUES
('Licensing', 'Custom Team Requirement', 'Team-specific requirement', 7, 1, 'checkbox', 123);
```

### Disabling Items
To temporarily disable an item without deleting:
```sql
UPDATE pipeline_checklist_items 
SET active = 0 
WHERE id = <item_id>;
```

### Reordering Items
Update the `item_order` field:
```sql
UPDATE pipeline_checklist_items 
SET item_order = 2 
WHERE id = <item_id>;
```

## Progress Tracking

Checklist completion is tracked in `pipeline_checklist_progress`:
- Links recruit_id to checklist_item_id
- Stores completion status, values, and notes
- Tracks who completed it and when
- Uses unique constraint to prevent duplicate progress records

## Terminal Stages

The following stages typically don't require checklist items:
- **Not Interested** - Candidate withdrew
- **Disqualified** - Candidate failed requirements
- **Release** - Final stage after successful training

## File Attachments

Many checklist items require "attach proof" functionality. The attachment system allows users to upload files directly to checklist items.

### Features
- Upload PDF, Word, Excel, Images (up to 10MB)
- Link files to specific checklist items
- Download/view uploaded proof documents
- Track who uploaded and when

### Complete Guide
See **`PIPELINE_ATTACHMENTS_GUIDE.md`** for:
- API endpoints
- Frontend implementation examples
- Upload/download/delete functionality
- Security considerations

### Quick Setup
```sql
-- Enable file attachments
source atlas/database/create_pipeline_attachments_table.sql;
```

Backend routes are already registered in `app.js` at:
```
/api/pipeline-attachments/*
```

## Notes

- All checklist items with `team_id = NULL` are **default items** visible to all teams
- Items marked `is_required = 1` must be completed before moving to next stage
- The `item_order` determines display sequence within each stage
- Use textarea type for any items requiring "attach proof" functionality
- The `item_options` field stores JSON for select dropdowns
- Files can be attached to textarea items for proof documentation

## Support

For questions or modifications to the checklist structure, consult with the development team or reference:
- `atlas/backend/migrations/create_pipeline_configuration_tables.sql`
- `atlas/backend/routes/recruitment.js`

