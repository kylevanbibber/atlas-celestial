# Team Goals Setup Instructions

## Overview
The Team Goals feature allows users to set separate goals for their personal performance, MGA team, and RGA team. This extends the existing ProductionGoals functionality to support multiple goal types.

## Database Setup

1. **Run the SQL migration to add goal_type column:**
   ```sql
   -- File: backend/migrations/add_goal_type_to_production_goals.sql
   
   -- Add the goal_type column
   ALTER TABLE production_goals 
   ADD COLUMN goal_type ENUM('personal', 'mga', 'rga') DEFAULT 'personal' 
   AFTER monthlyAlpGoal;

   -- Update existing records to have personal goal_type
   UPDATE production_goals SET goal_type = 'personal' WHERE goal_type IS NULL OR goal_type = '';

   -- Update the unique constraint to include goal_type
   ALTER TABLE production_goals DROP INDEX IF EXISTS unique_user_month;
   ALTER TABLE production_goals ADD UNIQUE KEY unique_user_month_type (activeUserId, year, month, goal_type);

   -- Add indexes for better performance
   CREATE INDEX idx_goal_type ON production_goals(goal_type);
   CREATE INDEX idx_user_year_month_type ON production_goals(activeUserId, year, month, goal_type);
   ```

## Default Behavior

**Important: goal_type defaults to 'personal' if null, undefined, or empty string**

- Database column has DEFAULT 'personal' constraint
- Backend API automatically normalizes null/empty goal_type values to 'personal'
- Ensures backward compatibility with existing goals
- Migration scripts handle cleanup of existing null/empty values

## API Endpoints

Updated endpoints now support goal_type parameter:

- `GET /api/goals/:userId/:year/:month?goalType=personal` - Get specific goal type
- `POST /api/goals` - Create/update goal (requires goalType in body)
- `POST /api/goals/batch` - Batch get goals (supports goalType filter)
- `GET /api/goals/:userId` - Get all goals for user (includes goal_type)

### Example API Usage

**Get personal goal:**
```javascript
api.get(`/goals/${userId}/${year}/${month}?goalType=personal`)
```

**Get MGA team goal:**
```javascript
api.get(`/goals/${userId}/${year}/${month}?goalType=mga`)
```

**Save RGA team goal:**
```javascript
api.post('/goals', {
  userId: userId,
  year: year,
  month: month,
  monthlyAlpGoal: 50000,
  goalType: 'rga',
  workingDays: [...],
  rateSource: 'agency'
})
```

**Goal Type Normalization:**
```javascript
// All of these will be treated as 'personal' goal type:
goalType: null         // → 'personal'
goalType: undefined    // → 'personal' 
goalType: ''           // → 'personal'
goalType: '   '        // → 'personal' (empty after trim)

// Valid goal types:
goalType: 'personal'   // → 'personal'
goalType: 'mga'        // → 'mga'
goalType: 'rga'        // → 'rga'
```

## Frontend Features

### Goal Cards
The ProductionGoals component now displays goal cards based on the selected view:

**Personal View:**
1. **Personal Goal Card** (Green theme with target icon)
   - Monthly ALP goal for individual performance
   - Includes progress tracking and breakdown calculations
   - Working days calendar for configuration

**Team View:**
1. **Team Member Goals Table** 
   - Shows each team member's personal ALP goal
   - Displays progress tracking for all team members
   - Uses personal goal data from each user's individual goal setting
   
2. **MGA Team Goal Card** (Blue theme with trending up icon)
   - Monthly ALP goal for MGA team
   - Independent save functionality
   
3. **RGA Team Goal Card** (Yellow theme with bar chart icon)
   - Monthly ALP goal for RGA team
   - Independent save functionality

### User Interface
- **View Switching**: Use Personal/Team buttons to switch between goal types
- **Personal View**: Shows personal goal card, working days calendar, and rate configuration
- **Team View**: Shows MGA and RGA goal cards with info about shared settings
- **Independent Editing**: Each goal type has its own save button when editing
- **Shared Configuration**: Team goals use the same working days and rate settings as personal goal
- **Responsive Design**: Cards automatically adjust for different screen sizes

### State Management
The component now manages separate state for:
- `monthlyAlpGoal` - Personal goal
- `mgaGoal` - MGA team goal  
- `rgaGoal` - RGA team goal
- `goalData`, `mgaGoalData`, `rgaGoalData` - Loaded goal data for each type

## Data Structure

Each goal record now includes:
```javascript
{
  id: 1,
  activeUserId: 92,
  year: 2025,
  month: 1,
  monthlyAlpGoal: 25000,
  goal_type: 'personal', // 'personal', 'mga', or 'rga'
  workingDays: [array of date strings],
  rateSource: 'agency',
  customRates: {...},
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Business Logic

- **Personal Goal**: Individual agent's monthly target
- **MGA Goal**: Monthly target for the MGA team the agent belongs to/manages
- **RGA Goal**: Monthly target for the RGA team the agent belongs to/manages
- Each goal type is saved and loaded independently
- All goal types share the same working days and rate settings from personal goal
- Goals can be set for current and future months only

## Permissions

- All users can set their personal goals
- Users can set MGA/RGA team goals regardless of their role
- Team goals represent the user's target contribution to their respective teams
- No additional permissions required beyond existing ProductionGoals access

## Migration Considerations

1. **Backward Compatibility**: Existing goals are automatically marked as 'personal' type
2. **Database Constraints**: New unique constraint allows multiple goal types per user/month
3. **API Compatibility**: Existing API calls default to 'personal' goal type if not specified
4. **Frontend**: New cards appear automatically without breaking existing functionality

### Cleanup Scripts

**Primary Migration:**
```sql
-- File: backend/migrations/add_goal_type_to_production_goals.sql
-- Adds goal_type column and updates existing data
```

**Optional Cleanup (if needed):**
```sql 
-- File: backend/migrations/cleanup_goal_type_nulls.sql
-- Cleans up any remaining null or empty goal_type values
UPDATE production_goals SET goal_type = 'personal' WHERE goal_type IS NULL OR goal_type = '';
```

### Team View Data Access Fix

**Issue:** After implementing goal_type support, the team view table showed $0 for all members' goals.

**Root Cause:** The batch goals API now returns data with keys formatted as `"userId_goalType"` (e.g., `"123_personal"`), but the team view was still accessing data with just `userId`.

**Solution:** Updated team view to:
1. Specify `goalType: 'personal'` in the batch request
2. Access goals using the correct key format: `goalsByUserId[${member.id}_personal]`

**Code Changes:**
```javascript
// Fixed batch request
const payload = { 
  userIds: finalMembers.map(m => m.id), 
  year: selectedYear, 
  month: selectedMonth,
  goalType: 'personal'  // Specify personal goals for team view
};

// Fixed data access
const goalKey = `${member.id}_personal`;
const goal = goalsByUserId[goalKey] || null;
```

## User Workflow

**Setting Personal Goals:**
1. Navigate to ProductionGoals page
2. Ensure "Personal" view is selected
3. Click Edit to enter goal setting mode
4. Set personal ALP target (e.g., $25,000)
5. Configure working days using the calendar
6. Choose rate settings (Agency or Custom)
7. Save personal goal

**Setting Team Goals:**
1. Switch to "Team" view using the view toggle buttons
2. Click Edit to enter goal setting mode  
3. Set MGA team target (e.g., $15,000)
4. Set RGA team target (e.g., $20,000)
5. Save each team goal individually using their respective save buttons
6. Team goals automatically use the working days and rate settings from your personal goal

**Viewing Progress:**
- Switch between Personal/Team views to see progress on different goal types
- Personal view shows detailed progress tracking and calendar
- Team view focuses on team goal targets and achievement

## Benefits

✅ **Separate Team Targets**: Users can set distinct goals for personal, MGA, and RGA performance
✅ **Independent Tracking**: Each goal type is saved and managed separately
✅ **Clean UI Organization**: Personal and team goals are logically separated into different views
✅ **Shared Configuration**: Team goals inherit working days and rate settings from personal setup
✅ **Flexible Goal Setting**: Users can set any combination of the three goal types
✅ **Team Coordination**: Enables better team goal alignment and tracking
