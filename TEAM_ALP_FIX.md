# Team ALP Calculation Fix

## Issue Fixed
Team goal cards were not showing actual ALP totals from team members - they were showing $0 or placeholder data instead of real team performance vs. goals.

## Root Cause
The frontend was trying to call a non-existent API endpoint `/goals/activity/${userId}` to get team member ALP data. This endpoint didn't exist in the backend, so all team ALP calculations were failing silently.

## Solution Applied

### ✅ Fixed API Endpoint
**Before (Broken)**:
```javascript
await api.get(`/goals/activity/${member.id}`)  // ❌ Doesn't exist
```

**After (Working)**:
```javascript
await api.get(`/goals/personal-rates/${member.id}`)  // ✅ Exists and returns totalAlp
```

### ✅ Enhanced Progress Updates
- Added team ALP progress reload after individual goal saves
- Added team ALP progress reload after batch goal saves  
- Ensures cards update immediately when goals are set

## How It Works Now

### Team ALP Data Loading
1. **Get Hierarchy**: Loads all team members using `/auth/searchByUserIdLite`
2. **Load ALP Data**: Gets each member's ALP using `/goals/personal-rates/{userId}` (parallel calls)
3. **Filter by Goal Type**:
   - **MGA Goal**: Aggregates ALP from MGA-level users only
   - **RGA Goal**: Aggregates ALP from all hierarchy users
4. **Update Cards**: Shows real team totals vs. monthly targets

### Expected Card Display
**MGA Team Goal**:
```
Team ALP: $75,000 / $100,000 (75%) • 8 members
```

**RGA Team Goal**:
```
Team ALP: $180,000 / $250,000 (72%) • 15 members
```

### Console Output
When working correctly, you'll see:
```
📊 Loading team ALP data for goal progress...
👥 Found 12 users in hierarchy  
📈 Team ALP data loaded: [array of user data]
💰 MGA Team ALP: $75,000 (8 users)
💰 RGA Team ALP: $180,000 (15 users)
```

## API Endpoint Details

### `/goals/personal-rates/{userId}`
**Parameters**:
- `start`: Start date (YYYY-MM-DD)
- `end`: End date (YYYY-MM-DD)  
- `minRows`: Minimum records required (default: 1)

**Returns**:
```json
{
  "totalAlp": 50000,
  "totalCalls": 200,
  "totalAppts": 40,
  "totalSits": 20,
  "totalSales": 10
}
```

**Usage**: The `totalAlp` value is aggregated across all team members to calculate team goal progress.

## Testing
1. Go to **Production Goals** → **Team** view
2. Set MGA and/or RGA team goals
3. Cards should now show actual team ALP totals vs. your goals
4. Progress percentages should reflect real team performance
5. Member counts should show how many people contributed

## Files Modified
- `frontend/src/components/production/ProductionGoals.js`
  - Fixed API endpoint from `/goals/activity/` to `/goals/personal-rates/`
  - Added team ALP progress reload after goal saves
  - Enhanced error handling for team member data loading

## Performance Notes
- **Parallel Loading**: All team member ALP data loads simultaneously
- **Conditional Execution**: Only loads when team goals exist
- **Error Resilience**: Individual member failures don't break calculation
- **Real-Time Updates**: Progress updates immediately when goals are saved
