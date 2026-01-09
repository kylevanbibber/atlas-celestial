# VIP Data Missing in Scorecard Agency View - Fix (v2)

## Problem
VIP data, Codes (Associates), and Pending data were missing from the scorecard agency view.

## Root Cause
The `-sga` backend endpoints (`/vips-sga`, `/associates-sga`, `/pending-sga`) were filtering data with restrictive conditions that excluded valid records:

### Original Broken Code
```javascript
router.get('/vips-sga', async (req, res) => {
    const queryStr = `SELECT * FROM VIPs WHERE reg_dir = "ZOPHIN"`;
    const results = await query(queryStr);
    // ...
});

router.get('/associates-sga', async (req, res) => {
    const queryStr = `SELECT * FROM associates WHERE DIR = "ZOPHIN"`;
    const results = await query(queryStr);
    // ...
});
```

**Problems:**
1. ❌ The `reg_dir = "ZOPHIN"` filter on VIPs table was too restrictive
2. ❌ The `DIR = "ZOPHIN"` filter on associates/pending was too restrictive
3. ❌ These filters excluded valid production data
4. ❌ The `column` and `value` query parameters weren't being used at all

## Solution
Removed the restrictive filters entirely. The `-sga` endpoints now return all records for agency-wide views:

### Fixed Code
```javascript
router.get('/vips-sga', async (req, res) => {
    // Return all VIPs for agency view
    const queryStr = `SELECT * FROM VIPs`;
    const results = await query(queryStr);
    // ...
});

router.get('/associates-sga', async (req, res) => {
    // Return all associates for agency view
    const queryStr = `SELECT * FROM associates`;
    const results = await query(queryStr);
    // ...
});

router.get('/pending-sga', async (req, res) => {
    // Return all pending for agency view
    const queryStr = `SELECT * FROM pending`;
    const results = await query(queryStr);
    // ...
});
```

## Why This Works

### 1. SGA Endpoints Are For Agency-Wide Data
The `-sga` suffix endpoints are specifically designed to return organization-wide data for the scorecard agency view. They should NOT filter by organizational boundaries.

### 2. Comparison with Other Endpoints
Other VIP endpoints (like `/vips/multiple`) don't use `reg_dir` or `DIR` filters:
```javascript
router.get('/vips/multiple', async (req, res) => {
    const queryStr = `SELECT * FROM VIPs WHERE sa = ? OR ga = ? OR mga = ?`;
    // No reg_dir filter here
});
```

### 3. Frontend Expectations
The frontend in agency view expects to receive ALL production data to:
- Calculate organization-wide VIP totals
- Show Code/VIP ratios
- Display YTD summaries
- Generate management count reports

## What Now Works
✅ VIP data displays in agency view  
✅ Codes/Associates data displays in agency view  
✅ Pending data displays in agency view  
✅ Code/VIP ratio calculations work correctly  
✅ YTD summary tables show accurate VIP counts  
✅ All scorecardtables populate with data  

## Files Modified
- `backend/routes/dataRoutes.js`
  - `/vips-sga` endpoint (line ~463)
  - `/associates-sga` endpoint (line ~489)  
  - `/pending-sga` endpoint (line ~515)

## Technical Notes

### Why Not Use column/value Parameters?
The frontend sends `column=MGA&value=ARIAS ORGANIZATION` for agency view, but:
1. These parameters are meant for breakdown views (MGA/RGA specific)
2. The SGA endpoints should return ALL data regardless
3. Frontend filtering/aggregation happens client-side for the agency view

### Database Schema
- **VIPs table**: Contains `sa`, `ga`, `mga`, `rga` columns (not `reg_dir`)
- **associates table**: Contains `sa`, `ga`, `mga` columns (not `DIR`)  
- **pending table**: Similar structure to associates

The `reg_dir` and `DIR` filters were either legacy code or incorrect assumptions about the schema.

## Testing Checklist
- [x] Agency view shows VIP data
- [x] Agency view shows Codes data
- [x] Agency view shows Pending data
- [x] Ratios calculate correctly (Code/VIP, ALP/Code, Hire/Code)
- [x] YTD summaries include all metrics
- [x] Management count tables populate

## Performance Note
Removing the WHERE clauses means these endpoints now return more data. This is intentional for the agency view. If performance becomes an issue, consider:
- Adding indexes on commonly queried columns
- Implementing pagination
- Using date range filters instead

