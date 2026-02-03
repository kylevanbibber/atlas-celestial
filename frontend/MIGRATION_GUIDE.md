# Migration Guide: Applying the Refactored Components

This guide shows exactly how to update the original `TeamDashboard.js` to use the new components.

## Step 1: Update Imports in TeamDashboard.js

### Add New Imports

Add these imports at the top of `TeamDashboard.js` (after existing imports):

```javascript
// New component imports
import PersonalMetricsCards from './PersonalMetricsCards';
import CommitHistoryModal from './CommitHistoryModal';
import OrgMetricsBreakdownModal from './OrgMetricsBreakdownModal';

// Utility function imports
import {
  formatToMMDDYYYY,
  getMondayOfWeek,
  getSundayOfWeek,
  calculateDateRange,
  calculatePlusMinus3Range,
  pickReportDateForWeek,
  pickReportDateForYear,
  formatAgentName,
  getMgaLastName,
  formatCurrency as formatCurrencyHelper,
  formatNumber as formatNumberHelper,
  groupByMonthAndYear
} from '../../utils/dashboardHelpers';
```

## Step 2: Remove Duplicate Utility Functions

### Delete Lines 2000-2085 (Date Helper Functions)

Remove these function definitions (they're now imported from `dashboardHelpers.js`):

```javascript
// DELETE THIS BLOCK (lines ~2000-2085):
const formatToMMDDYYYY = (dateObj) => { ... };
const getMondayOfWeek = (date) => { ... };
const getSundayOfWeek = (date) => { ... };
const calculateDateRange = (mondayDateStr) => { ... };
const calculatePlusMinus3Range = (reportDateIso) => { ... };
const pickReportDateForWeek = (reportDatesIso = [], weekStartDate, weekEndDate) => { ... };
const pickReportDateForYear = (reportDatesIso = [], year) => { ... };
```

### Update Lines 279-291 (Format Helper Functions)

Replace the existing `formatCurrency` and `formatNumber` with simpler versions that use the imported helpers:

```javascript
// REPLACE (lines 279-291):
const formatCurrency = (value) => formatCurrencyHelper(value);
const formatNumber = (value) => formatNumberHelper(value);
```

### Delete Lines 1161-1181 (groupByMonthAndYear Function)

Remove this function (it's now imported):

```javascript
// DELETE THIS BLOCK (lines ~1161-1181):
const groupByMonthAndYear = (data, dateField) => { ... };
```

## Step 3: Replace Personal Metrics Cards Section

### Find and Replace Lines 3068-3299

**FIND** this entire block (lines 3068-3299):

```javascript
{(userRole === 'AGT' || viewScope === 'personal') && (
  <>
    <div style={{ marginTop: '1rem' }}>
      <div className="metric-row" style={{ ... }}>
        <WidgetCard title="Calls" ... />
        <WidgetCard title="Appointments" ... />
        <WidgetCard title="Sits" ... />
        <WidgetCard title="Sales" ... />
        <WidgetCard title="ALP" ...>
          {/* 100+ lines of ALP card with goal editing */}
        </WidgetCard>
        <WidgetCard title="Refs" ... />
      </div>
    </div>
  </>
)}
```

**REPLACE WITH**:

```javascript
{(userRole === 'AGT' || viewScope === 'personal') && (
  <PersonalMetricsCards
    activityData={activityData}
    activityLoading={activityLoading}
    statsData={statsData}
    statsLoading={statsLoading}
    personalComparison={personalComparison}
    personalAlpMode={personalAlpMode}
    setPersonalAlpMode={setPersonalAlpMode}
    hasOfficialAlpData={hasOfficialAlpData}
    personalOfficialAlp={personalOfficialAlp}
    personalGoal={personalGoal}
    editingPersonalGoal={editingPersonalGoal}
    setEditingPersonalGoal={setEditingPersonalGoal}
    personalGoalInput={personalGoalInput}
    setPersonalGoalInput={setPersonalGoalInput}
    savePersonalAlpGoal={savePersonalAlpGoal}
    viewMode={viewMode}
  />
)}
```

## Step 4: Replace Commit History Modal

### Find and Replace Lines 3341-3485

**FIND** this block:

```javascript
{/* History Modal */}
{showHistoryModal && historyModalType && (
  <div style={{ position: 'fixed', ... }}>
    {/* 150 lines of modal content */}
  </div>
)}
```

**REPLACE WITH**:

```javascript
{/* History Modal */}
<CommitHistoryModal
  showHistoryModal={showHistoryModal}
  setShowHistoryModal={setShowHistoryModal}
  historyModalType={historyModalType}
  commitHistory={commitHistory}
/>
```

## Step 5: Replace Org Metrics Breakdown Modal

### Find and Replace Lines 3487-3773

**FIND** this block:

```javascript
{/* Org Metrics Breakdown Modal */}
{showBreakdownModal && (
  <div style={{ position: 'fixed', ... }}>
    {/* 300 lines of modal content with tables */}
  </div>
)}
```

**REPLACE WITH**:

```javascript
{/* Org Metrics Breakdown Modal */}
<OrgMetricsBreakdownModal
  showBreakdownModal={showBreakdownModal}
  setShowBreakdownModal={setShowBreakdownModal}
  breakdownData={breakdownData}
  refSalesBreakdown={refSalesBreakdown}
  timePeriod={timePeriod}
/>
```

## Step 6: Update TeamLeaderboard.js

### Option A: Complete Replacement (Recommended)

```bash
# Backup the original
cd atlas/frontend/src/components/dashboard
cp TeamLeaderboard.js TeamLeaderboard.backup.js

# Replace with optimized version
cp TeamLeaderboard.optimized.js TeamLeaderboard.js
```

### Option B: Manual Updates

If you prefer to update the existing file:

1. **Add new imports** at the top:
   ```javascript
   import LeaderboardFilterMenu from './LeaderboardFilterMenu';
   import DiscordSalesSummary from './DiscordSalesSummary';
   import { formatCurrency } from '../../utils/dashboardHelpers';
   ```

2. **Replace Filter Menu** (lines 809-973):
   Find the filter menu JSX and replace with:
   ```javascript
   <LeaderboardFilterMenu
     isFilterMenuOpen={isFilterMenuOpen}
     setIsFilterMenuOpen={setIsFilterMenuOpen}
     filterButtonRef={filterButtonRef}
     showDiscordOnly={showDiscordOnly}
     setShowDiscordOnly={setShowDiscordOnly}
     loadingDiscordFilter={loadingDiscordFilter}
     goalFilter={goalFilter}
     setGoalFilter={setGoalFilter}
     filteredAgentsCount={filteredAgents.length}
     totalAgentsCount={agents.length}
   />
   ```

3. **Replace Discord Sales Summary** (lines 662-773):
   Find the discord sales rendering logic and replace with:
   ```javascript
   <DiscordSalesSummary 
     discordSalesData={discordSalesData} 
     agentKey={agentKey} 
   />
   ```

## Step 7: Test Your Changes

After making the changes, test these scenarios:

### Critical Tests
```bash
# Start the development server
npm start

# Test in browser:
# 1. Login as each role (AGT, SA, GA, MGA, RGA)
# 2. Switch between personal/team/mga/rga views
# 3. Change date ranges (week, month, year)
# 4. Test filters (Discord sales, goal status)
# 5. Expand agent rows to see details
# 6. Open modals (commit history, org breakdown)
# 7. Edit personal goals
# 8. Toggle Official/Reported ALP
```

### Expected Results
- ✅ No console errors
- ✅ All data displays correctly
- ✅ Modals open and close properly
- ✅ Filters work as before
- ✅ Sorting works correctly
- ✅ Pagination/infinite scroll works
- ✅ Mobile layout looks good
- ✅ Dark mode works

## Step 8: Clean Up (After Testing)

Once everything works:

1. **Remove backup files**:
   ```bash
   rm TeamLeaderboard.backup.js
   rm TeamLeaderboard.optimized.js
   ```

2. **Remove old commented code**: Search for `// DELETE THIS BLOCK` comments

3. **Run linter**:
   ```bash
   npm run lint
   ```

4. **Commit changes**:
   ```bash
   git add .
   git commit -m "refactor: break TeamDashboard and TeamLeaderboard into smaller components"
   ```

## Troubleshooting

### Issue: Components not rendering

**Check**: Imports are correct
```javascript
// Make sure paths are correct
import PersonalMetricsCards from './PersonalMetricsCards';
// NOT: import PersonalMetricsCards from '../PersonalMetricsCards';
```

### Issue: Missing props errors

**Check**: All required props are passed
```javascript
// Compare props in component file with what you're passing
// Missing props will show in console
```

### Issue: Styling looks different

**Check**: CSS imports are present
```javascript
// Make sure these are still at the top of TeamDashboard.js
import '../../pages/Dashboard.css';
import '../../pages/OneOnOne.css';
import './TeamDashboard.css';
```

### Issue: Modals not appearing

**Check**: State is correctly passed
```javascript
// These state variables must exist in parent:
const [showHistoryModal, setShowHistoryModal] = useState(false);
const [showBreakdownModal, setShowBreakdownModal] = useState(false);
```

## Rollback Plan

If something goes wrong:

```bash
# Restore original files from git
git checkout HEAD -- atlas/frontend/src/components/dashboard/TeamDashboard.js
git checkout HEAD -- atlas/frontend/src/components/dashboard/TeamLeaderboard.js

# Or use backups
cp TeamDashboard.backup.js TeamDashboard.js
cp TeamLeaderboard.backup.js TeamLeaderboard.js
```

## Performance Notes

After refactoring, you should see:
- Faster initial page load (better code splitting)
- Smoother renders (smaller component trees)
- Easier debugging (clearer component hierarchy in React DevTools)

## Next Steps After Migration

1. **Add PropTypes or TypeScript**: Define prop interfaces for type safety
2. **Add Tests**: Write unit tests for each new component
3. **Optimize Renders**: Add React.memo to expensive components
4. **Code Splitting**: Lazy load modals for better performance
5. **Extract More**: Continue breaking down large fetch functions into hooks

## Questions?

If you encounter issues:
1. Check the console for errors
2. Review the REFACTORING_SUMMARY.md file
3. Compare your code with the original backup
4. Test in incognito mode (rule out caching issues)
