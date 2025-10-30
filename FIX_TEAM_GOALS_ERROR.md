# Fix Team Goals Database Error

## Problem
Getting `ER_DUP_ENTRY: Duplicate entry '12643-2025-9' for key 'unique_user_month_year'` error when saving team goals.

## Root Cause
The database migration for adding `goal_type` functionality didn't run properly. The old unique constraint `unique_user_month_year` still exists instead of the new `unique_user_month_type` constraint that allows multiple goal types per user/month.

## Quick Fix Options

### Option 1: Run Manual Database Migration
1. Open your MySQL client/phpMyAdmin
2. Select the `atlas` database  
3. Run the SQL script from `backend/migrations/manual_fix_constraints.sql`

This will:
- Remove old conflicting constraints
- Add proper `unique_user_month_type` constraint
- Allow users to have separate personal, MGA, and RGA goals

### Option 2: Backend Workaround (Temporary)
The backend now includes error handling that will:
- Detect duplicate entry errors
- Attempt to update existing goals instead of inserting
- Provide warning messages about needed migration

## Verification
After running the migration, you should be able to:
- Set personal goals (goal_type = 'personal')
- Set MGA team goals (goal_type = 'mga') 
- Set RGA team goals (goal_type = 'rga')
- All for the same user in the same month

## Files Changed
- `backend/routes/goals.js` - Added error handling
- `backend/migrations/manual_fix_constraints.sql` - Database fix script
- `backend/migrations/fix_production_goals_constraints.sql` - Alternative fix script

## Test After Fix
1. Go to Production Goals → Team view
2. Click Edit Goals
3. Set both MGA and RGA team goals (for RGA users)
4. Click Save Goals
5. Should succeed without duplicate entry error
