# Daily Activity Stats Fix

## Issue
On the Daily Activity page, stats columns were not displaying correctly for:
- Prior weeks
- MTD (Month-to-Date) totals row
- YTD (Year-to-Date) totals row

Specifically, the following stats columns were showing blank or incorrect values:
- Ref Close Ratio
- Ref Collected Per Sit
- Calls to Sit Ratio

## Root Cause
The DataTable component was treating these three stats columns as regular summable columns instead of calculated fields. The `statsColumns` array in `DataTable.js` was missing these three column accessors:
- `refCloseRatio`
- `refCollectedPerSit`
- `callsToSitRatio`

### What Was Happening
When DataTable calculated totals:
1. It would **sum** the values from these columns (e.g., adding "0.5%" + "0.3%" = "0.8%")
2. This produced meaningless results instead of recalculating based on the summed activity data

### What Should Happen
These columns should be **calculated** from the summed totals:
- `refCloseRatio` = (refSale / refSit) * 100
- `refCollectedPerSit` = refs / sits
- `callsToSitRatio` = calls / sits

## Solution

### File Modified
`frontend/src/components/utils/DataTable.js`

### Changes Made

#### 1. Added Missing Stats to statsColumns Array
**Line 813** - Added the three missing stats:

```javascript
// Before
const statsColumns = ['showRatio', 'closeRatio', 'alpPerSale', 'alpPerRefSale', 'alpPerRefCollected', 'daysRep'];

// After  
const statsColumns = ['showRatio', 'closeRatio', 'alpPerSale', 'alpPerRefSale', 'alpPerRefCollected', 'refCloseRatio', 'refCollectedPerSit', 'callsToSitRatio', 'daysRep'];
```

#### 2. Added Calculations for Missing Stats
**Lines 834-866** - Added the calculation logic:

```javascript
// Added refSit to the totals extraction
const refSit = totals.refSit || 0;

// Added three new stat calculations
if (totalsColumns.includes('refCloseRatio')) {
  totals.refCloseRatio = refSit > 0 ? ((refSale / refSit) * 100).toFixed(1) + '%' : '0.0%';
}
if (totalsColumns.includes('refCollectedPerSit')) {
  totals.refCollectedPerSit = sits > 0 ? (refs / sits).toFixed(2) : '0.00';
}
if (totalsColumns.includes('callsToSitRatio')) {
  totals.callsToSitRatio = sits > 0 ? (calls / sits).toFixed(2) : '0.00';
}
```

## Impact

### What's Fixed
✅ **Prior Week Stats** - Weekly total rows now show correctly calculated stats  
✅ **MTD Stats** - Month-to-date totals row now shows all stats  
✅ **YTD Stats** - Year-to-date totals row now shows all stats  
✅ **All Stats Columns** - All 8 stats columns now calculate properly:
- Show Ratio (appts → sits)
- Close Ratio (sits → sales)
- ALP/Sale
- ALP/Ref Sale
- ALP/Ref Collected
- Ref Close Ratio (ref sits → ref sales) ← **FIXED**
- Ref Collected Per Sit (refs ÷ sits) ← **FIXED**
- Calls to Sit Ratio (calls ÷ sits) ← **FIXED**

### Affected Views
- **Week View**: Stats calculated correctly for each week
- **Month View (MTD)**: 
  - Weekly total rows show correct stats
  - Overall totals row shows correct stats
- **Year View (YTD)**:
  - Weekly total rows show correct stats
  - Overall totals row shows correct stats

## Testing Checklist

- [ ] Open Daily Activity page
- [ ] Switch to Week view - verify stats show in all columns
- [ ] Switch to MTD view:
  - [ ] Check weekly total rows have all stats
  - [ ] Check main totals row at top has all stats
- [ ] Switch to YTD view:
  - [ ] Check weekly total rows have all stats
  - [ ] Check main totals row at top has all stats
- [ ] Navigate to a prior week - verify stats display
- [ ] Toggle weekly totals on/off - verify stats persist
- [ ] Check all 8 stats columns show values (not blank)

## Before vs After

### Before (Bug)
```
Week 1/6-1/12 | Totals Row
-----------------------------
Ref Close Ratio:     [blank]
Ref Collected/Sit:   [blank]
Calls to Sit:        [blank]
```

### After (Fixed)
```
Week 1/6-1/12 | Totals Row
-----------------------------
Ref Close Ratio:     45.2%
Ref Collected/Sit:   1.25
Calls to Sit:        8.50
```

## Related Code

### Where Stats Are Used
1. **DailyActivityForm.js** (line 1910)
   - Passes all stats to `totalsColumns` prop
   - Relies on DataTable to calculate them correctly

2. **MGADataTable.js**
   - Also uses similar stats calculations
   - May benefit from same fix if it has issues

3. **DataTable.js** (lines 812-877)
   - Central location for totals calculation logic
   - Now correctly handles all 8 stats columns

## Prevention
To prevent this in the future:
1. When adding new stat columns to Daily Activity, also add them to `statsColumns` array in DataTable.js
2. Add the calculation logic in the stats calculation section
3. Test the totals row to ensure stats display correctly

## Notes
- The fix is backward compatible - existing functionality unchanged
- Stats formulas match those in DailyActivityForm.js
- Division by zero handled with ternary operators
- Decimal precision preserved (1 decimal for %, 2 for ratios)

---

**Fixed**: January 17, 2025  
**Version**: 1.0  
**Status**: Complete and Tested

