# RGA First-Year MGA Rollup Feature

## Business Rule

**An MGA's numbers count for their direct RGA for their first full year as an MGA, even if they're multiple levels removed in the hierarchy.**

## Example Hierarchy

```
KOZEJ SPENCER G (RGA)
  └── FEOLA EVANGELOS N (MGA)
        └── SILVA MATHEUS A (MGA, started 08/12/2025)
```

### Traditional Rollup (After First Year):
- Matheus's numbers → Count for Evangelos (MGA)
- Evangelos's numbers → Count for Spencer (RGA)
- Matheus's numbers → **DO NOT** directly count for Spencer (RGA)

### First-Year Rollup (08/12/2025 - 08/11/2026):
- Matheus's numbers → Count for Evangelos (MGA)
- Evangelos's numbers → Count for Spencer (RGA)
- Matheus's numbers → **ALSO** count for Spencer (RGA) ✅

## Why This Matters

When Spencer (RGA) views his RGA team numbers on the Org Metrics card, he should see:
- All direct MGAs under him (Evangelos)
- All first-year MGAs who roll up through his direct MGAs (Matheus)

This ensures proper credit and tracking during an MGA's critical first year.

## Implementation

### Backend Endpoint

**Route**: `GET /api/mga-hierarchy/rga-rollup/:rgaLagnname`

**Logic**:
1. Get all MGAs from the `MGAs` table with `start` dates
2. Find direct MGAs where `MGAs.rga = rgaLagnname`
3. For each MGA, check if they're in their first year:
   - `now >= start_date` AND `now < start_date + 1 year`
4. If first-year MGA's `rga` matches any direct MGA's `lagnname`, include them
5. Return combined list of direct + first-year MGAs

**Response**:
```json
{
  "success": true,
  "data": {
    "rgaLagnname": "KOZEJ SPENCER G",
    "totalMGAs": 2,
    "directMGAs": 1,
    "firstYearMGAs": 1,
    "mgas": [
      {
        "lagnname": "FEOLA EVANGELOS N",
        "rga": "KOZEJ SPENCER G",
        "start": "2024-01-15",
        "isFirstYear": false,
        "rollupReason": "direct"
      },
      {
        "lagnname": "SILVA MATHEUS A",
        "rga": "FEOLA EVANGELOS N",
        "start": "2025-08-12",
        "isFirstYear": true,
        "rollupReason": "first_year_indirect"
      }
    ]
  }
}
```

### Frontend Integration

**File**: `frontend/src/pages/OneOnOne.js`

**Function**: `fetchOrgMetrics()`

**Change**: When RGA views RGA scope, use new endpoint instead of simple filter:

```javascript
// Old approach:
const mgas = allMGAs.filter(m => m.rga === user.lagnname);

// New approach:
const rollupRes = await api.get(`/mga-hierarchy/rga-rollup/${user.lagnname}`);
const mgas = rollupRes.data.data.mgas;
```

**Console Log**:
```javascript
[OrgMetrics] RGA rollup for KOZEJ SPENCER G: {
  total: 2,
  direct: 1,
  firstYear: 1,
  names: ["FEOLA EVANGELOS N", "SILVA MATHEUS A"]
}
```

## Database Schema

### MGAs Table

Required columns:
- `lagnname` (VARCHAR): MGA's name
- `rga` (VARCHAR): Their direct RGA's name
- `start` (DATE): When they became an MGA
- `Active` (ENUM): 'y' or 'n'

**Example Data**:
```sql
lagnname              | rga                  | start      | Active
--------------------- | -------------------- | ---------- | ------
FEOLA EVANGELOS N     | KOZEJ SPENCER G      | 2024-01-15 | y
SILVA MATHEUS A       | FEOLA EVANGELOS N    | 2025-08-12 | y
```

## Timeline Example

### Matheus's Journey:

**08/12/2025**: Becomes MGA
- First year starts
- Numbers count for Evangelos (direct upline)
- Numbers count for Spencer (RGA, via first-year rule)

**01/01/2026**: Mid first-year
- Still in first year (08/12/2025 - 08/11/2026)
- Numbers still count for both Evangelos and Spencer

**08/12/2026**: First year ends
- No longer first-year MGA
- Numbers count for Evangelos only
- Numbers **no longer** directly count for Spencer

## Edge Cases

### Case 1: MGA Starts Mid-Month
- **Start**: 08/15/2025
- **First Year**: 08/15/2025 - 08/14/2026
- **Behavior**: Counts for RGA starting 08/15/2025

### Case 2: Multiple Levels Deep
```
RGA (Spencer)
  └── MGA 1 (Evangelos)
        └── MGA 2 (Matheus, first-year)
              └── MGA 3 (John, first-year)
```

- **Matheus** (first-year, under Evangelos): Counts for Spencer ✅
- **John** (first-year, under Matheus): Does NOT count for Spencer ❌
  - Only rolls up through direct MGAs, not through other first-year MGAs

### Case 3: MGA Changes RGA
If Matheus moves to a different RGA mid-first-year:
- Use current `MGAs.rga` value
- First-year period remains based on original `start` date

## Testing

### Test Scenario 1: Direct MGA
```
Given: Spencer is RGA
  And: Evangelos is MGA under Spencer
  And: Evangelos started 01/15/2024 (not first-year)
When: Spencer views RGA scope
Then: Evangelos should be included
  And: rollupReason = "direct"
```

### Test Scenario 2: First-Year MGA
```
Given: Spencer is RGA
  And: Evangelos is MGA under Spencer
  And: Matheus is MGA under Evangelos
  And: Matheus started 08/12/2025 (first-year)
  And: Current date is 10/07/2025
When: Spencer views RGA scope
Then: Both Evangelos and Matheus should be included
  And: Evangelos rollupReason = "direct"
  And: Matheus rollupReason = "first_year_indirect"
```

### Test Scenario 3: After First Year
```
Given: Same as Scenario 2
  And: Current date is 08/13/2026 (after first year)
When: Spencer views RGA scope
Then: Only Evangelos should be included
  And: Matheus should NOT be included
```

## Console Verification

When testing, check the browser console for:

```javascript
[OrgMetrics] RGA rollup for KOZEJ SPENCER G: {
  total: 2,        // Total MGAs counting
  direct: 1,       // Direct MGAs
  firstYear: 1,    // First-year MGAs
  names: ["FEOLA EVANGELOS N", "SILVA MATHEUS A"]
}
```

## Benefits

✅ **Accurate Tracking**: RGAs see correct numbers during critical first year  
✅ **Proper Credit**: First-year MGAs' efforts count for their RGA  
✅ **Automatic**: No manual tracking needed  
✅ **Time-Based**: Automatically stops after first year  
✅ **Scalable**: Works for any depth of hierarchy  

## Future Enhancements

1. **Visual Indicator**: Show which MGAs are first-year in the UI
2. **Countdown**: Display days remaining in first year
3. **Historical View**: See how numbers changed after first year ended
4. **Notifications**: Alert RGA when MGA's first year is ending
5. **Reports**: Generate first-year performance reports


