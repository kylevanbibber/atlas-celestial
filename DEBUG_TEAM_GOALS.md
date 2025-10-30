# Debug Team Goals Issue - Step by Step

## Current Problem
RGA team goal is replacing MGA team goal instead of creating separate entries.

## Enhanced Debugging Added

### Backend Improvements
1. **Added detailed logging** - Now shows all existing goals for user/month
2. **Better error detection** - Specifically checks for `unique_user_month_year` constraint
3. **Clear error messages** - Tells exactly what SQL to run to fix the constraint

### Frontend Improvements  
1. **Enhanced error handling** - Shows constraint error details to user
2. **SQL solution display** - Provides exact SQL needed to fix the issue

## Next Steps to Debug

### 1. Try Setting Both Goals Again
1. Go to Production Goals → Team view
2. Set MGA goal (e.g., $100,000) 
3. Set RGA goal (e.g., $200,000)
4. Check browser console and server logs

### 2. Expected Debug Output

**If constraint is the issue, you'll see:**
```
🔍 Current goals for user 12643 (2025-9): mga(123)
🎯 Existing rga goal: None
❌ ER_DUP_ENTRY: Duplicate entry '12643-2025-9' for key 'unique_user_month_year'
```

**If constraint is fixed, you'll see:**
```
🔍 Current goals for user 12643 (2025-9): mga(123)
🎯 Existing rga goal: None
📝 Creating new goal
✅ Goal created successfully
```

### 3. Quick Database Check

Run this in your database to see current constraints:
```sql
SELECT 
    CONSTRAINT_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'atlas' 
    AND TABLE_NAME = 'production_goals'
    AND CONSTRAINT_NAME LIKE '%unique%'
ORDER BY CONSTRAINT_NAME;
```

Should show:
- ✅ `unique_user_month_type` with columns: activeUserId, year, month, goal_type
- ❌ Should NOT show `unique_user_month_year`

### 4. If Constraint Still Wrong

The error message will now show you the exact SQL to run:
```sql
ALTER TABLE production_goals DROP INDEX unique_user_month_year;
ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);
```

## Test Results

After you try setting both goals, please share:
1. Any error messages that appear
2. What the server console shows  
3. Whether both goals are visible after refresh

This will help identify exactly what's happening!
