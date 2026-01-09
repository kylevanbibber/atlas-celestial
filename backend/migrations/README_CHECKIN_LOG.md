# Pipeline Check-In Log Migration

This migration creates the `pipeline_checkin_log` table to track both automated and manual check-ins with recruits.

## What This Adds

### Database Changes
- New `pipeline_checkin_log` table with:
  - Track automated check-ins (from automated text messages)
  - Track manual check-ins (logged by users through the UI)
  - Link check-ins to the checklist item the recruit was working on at the time
  - Record who performed the check-in (for manual check-ins)
  - Store optional notes

### API Endpoints Added
1. `POST /api/check-in-texts/manual/:recruitId` - Log a manual check-in
2. `GET /api/check-in-texts/history/:recruitId` - Get check-in history for a recruit
3. `GET /api/check-in-texts/last/:recruitId` - Get the last check-in for a recruit

### Frontend Updates
- Kanban cards now show:
  - **Current Task**: The next checklist item the recruit needs to complete
  - **Last Check-In**: When the last check-in occurred (automated or manual)
  - **Check-In Button**: Click to log a manual check-in with optional notes

## Running the Migration

```bash
# Connect to your MySQL database
mysql -u your_user -p atlas

# Run the migration
source backend/migrations/create_pipeline_checkin_log.sql
```

Or use your migration runner:
```bash
node backend/scripts/run_migrations.js
```

## How It Works

### Automated Check-Ins
When the automated check-in system sends a text to a recruit, it automatically logs an entry in `pipeline_checkin_log` with:
- `checkin_type` = 'automated'
- `checkin_by` = NULL (no user)
- The current stage and checklist item they were working on

### Manual Check-Ins
Users can click the check-in button on a kanban card to log a manual check-in:
- `checkin_type` = 'manual'
- `checkin_by` = logged-in user's ID
- Optional notes about the check-in
- Automatically captures the current stage and checklist item

## Features
- See at a glance when a recruit was last contacted
- Know whether it was an automated text or personal outreach
- Track which checklist item they were on at the time
- Quick access to log new check-ins directly from the kanban board

