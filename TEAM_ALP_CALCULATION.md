# Team ALP Calculation for Production Goals

## Overview
Team goals now calculate progress by aggregating actual ALP performance from team members based on the goal type. This provides accurate real-time tracking of team achievement vs. monthly targets.

## How It Works

### Data Sources
- **Team Hierarchy**: Uses `/auth/searchByUserIdLite` to get all team members
- **ALP Data**: Uses `/goals/activity/{userId}` to get each member's monthly ALP
- **Date Range**: Automatically uses current selected month for calculations

### Calculation Logic

#### MGA Team Goal Progress
**For RGA Users**: 
- Includes only MGA-level users (where `mgaName` matches the RGA user's `lagnname`)
- Same user set as "MGA Only" toggle in team view

**For SA/GA/MGA Users**:
- Includes all users in their hierarchy
- Represents their complete team's performance

#### RGA Team Goal Progress
**For RGA Users Only**:
- Includes ALL users in the entire hierarchy
- Represents complete RGA team performance across all MGA groups

### Implementation Details

#### Frontend Loading Process
```javascript
loadGoalData() → loads goal targets
  ↓
loadTeamALPProgress() → calculates actual team performance
  ↓
Updates goal cards with real team ALP vs. targets
```

#### Team ALP Aggregation
```javascript
// Get hierarchy users
const allHierUsers = await api.post('/auth/searchByUserIdLite', { 
  userId: user.userId,
  includeInactive: false 
});

// Load ALP for each team member
const teamALPData = await Promise.all(
  allHierUsers.map(member => 
    api.get(`/goals/activity/${member.id}`)
  )
);

// Calculate aggregated totals
const mgaTeamALP = mgaLevelUsers.reduce((sum, member) => 
  sum + member.totalAlp, 0
);

const rgaTeamALP = teamALPData.reduce((sum, member) => 
  sum + member.totalAlp, 0
);
```

## User Experience

### Goal Cards Display
**MGA Team Goal Card**:
- Shows: `Team ALP: $50,000 / $100,000 (50%) • 5 members`
- Progress calculated from MGA-level team members only

**RGA Team Goal Card** (RGA users only):
- Shows: `Team ALP: $125,000 / $200,000 (63%) • 12 members`
- Progress calculated from all hierarchy members

**Team Goal Card** (SA/GA/MGA users):
- Shows: `Team ALP: $30,000 / $75,000 (40%) • 3 members`
- Progress calculated from their complete team

### Real-Time Updates
- **Automatic Refresh**: Recalculates when month/year changes
- **Live Data**: Always shows current month's actual performance
- **Member Count**: Displays how many team members contributed
- **Percentage**: Shows achievement rate vs. monthly target

## Console Debugging
When team ALP data loads, you'll see:
```
📊 Loading team ALP data for goal progress...
👥 Found 12 users in hierarchy
📈 Team ALP data loaded: [user1, user2, ...]
💰 MGA Team ALP: $50,000 (5 users)
💰 RGA Team ALP: $125,000 (12 users)
```

## Benefits

### Accurate Progress Tracking
- **Real Team Performance**: Uses actual team member ALP data
- **Goal Type Specific**: MGA goals track MGA-level performance, RGA goals track full hierarchy
- **Live Updates**: Always current with latest activity data

### Better Management Insights
- **Team Size Visibility**: Shows how many members contribute to each goal
- **Performance Distribution**: Different goal types show different team levels
- **Achievement Rates**: Clear percentage progress toward targets

### Consistent with Team View
- **MGA Team Goal**: Matches "MGA Only" team view filtering
- **RGA Team Goal**: Matches full team view (all members)
- **Hierarchy Respect**: Uses same user access controls as team views

## Technical Architecture

### API Calls Made
1. `POST /auth/searchByUserIdLite` - Get team hierarchy
2. `GET /goals/activity/{userId}` - Get ALP for each team member (parallel)
3. Frontend aggregation and state updates

### Performance Optimization
- **Parallel Loading**: All team member ALP data loads simultaneously
- **Conditional Loading**: Only loads when team goals exist
- **Error Resilience**: Individual member failures don't break entire calculation

### Data Flow
```
User Sets Team Goal → Goal Saved to Database
↓
loadGoalData() → Loads goal targets
↓
loadTeamALPProgress() → Fetches team hierarchy & ALP data
↓
Aggregates ALP by goal type (MGA vs RGA level)
↓
Updates goal cards with real progress vs. targets
```

## Future Enhancements
- Historical trend data for team performance
- Team goal notifications when targets are reached
- Drill-down views to see individual contributor performance
- Export team goal progress reports
