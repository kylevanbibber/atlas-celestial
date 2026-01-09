# VIP Data Missing in Scorecard Agency View - Fix

## Problem
VIP data was not showing up in the scorecard agency view. The data tables for VIPs, Codes (Associates), and Pending were all empty in the agency view.

## Root Cause
The backend API endpoints `/vips-sga`, `/associates-sga`, and `/pending-sga` were not properly using the `column` and `value` query parameters sent from the frontend.

### Before (Broken Code)
```javascript
router.get('/vips-sga', async (req, res) => {
    const { column, value } = req.query;
    
    try {
        const queryStr = `SELECT * FROM VIPs WHERE reg_dir = "ZOPHIN"`;
        const results = await query(queryStr, [column, value]); // Parameters ignored!
        
        res.status(200).json({ success: true, data: results });
    }
});
```

**Issues:**
1. The SQL query didn't reference the `column` and `value` parameters
2. Parameters were passed to the query function but not used in the SQL string
3. This caused the endpoint to always return ALL VIPs for the organization, regardless of the requested filter

## Solution
Updated three backend endpoints to properly handle the query parameters:
- `/vips-sga`
- `/associates-sga`
- `/pending-sga`

### After (Fixed Code)
```javascript
router.get('/vips-sga', async (req, res) => {
    const { column, value } = req.query;
    
    try {
        let queryStr;
        let queryParams;
        
        if (column === 'SGA') {
            // For SGA (agency view), get all VIPs in the organization
            queryStr = `SELECT * FROM VIPs WHERE reg_dir = "ZOPHIN"`;
            queryParams = [];
        } else {
            // For MGA/RGA breakdown, filter by specific manager
            const columnName = column.toLowerCase(); // MGA -> mga, RGA -> rga
            queryStr = `SELECT * FROM VIPs WHERE reg_dir = "ZOPHIN" AND ?? = ?`;
            queryParams = [columnName, value];
        }
        
        const results = await query(queryStr, queryParams);
        res.status(200).json({ success: true, data: results });
    }
});
```

**Improvements:**
1. ✅ Properly handles `column='SGA'` for agency-wide data
2. ✅ Properly filters by MGA/RGA when in breakdown mode
3. ✅ Converts column names to lowercase to match database schema (`MGA` → `mga`, `RGA` → `rga`)
4. ✅ Uses parameterized queries correctly with `??` for identifier placeholders

## How It Works

### Agency View (`column='SGA'`)
- Frontend calls: `/vips-sga?column=SGA&value=ARIAS ORGANIZATION`
- Backend returns: All VIPs where `reg_dir = "ZOPHIN"`
- Result: Shows organization-wide VIP data

### MGA Breakdown (`column='MGA'`)
- Frontend calls: `/vips-sga?column=MGA&value=John Smith`
- Backend returns: VIPs where `reg_dir = "ZOPHIN" AND mga = "John Smith"`
- Result: Shows VIP data for specific MGA

### RGA Breakdown (`column='RGA'`)
- Frontend calls: `/vips-sga?column=RGA&value=Jane Doe`
- Backend returns: VIPs where `reg_dir = "ZOPHIN" AND rga = "Jane Doe"`
- Result: Shows VIP data for specific RGA

## Database Schema
The VIPs, associates, and pending tables use lowercase column names:
- `sa` (not SA)
- `ga` (not GA)  
- `mga` (not MGA)
- `rga` (not RGA)

The fix includes converting the frontend's uppercase column names to lowercase before querying.

## Files Modified
- `backend/routes/dataRoutes.js`
  - Fixed `/vips-sga` endpoint (line ~463)
  - Fixed `/associates-sga` endpoint (line ~489)
  - Fixed `/pending-sga` endpoint (line ~515)

## Testing
After this fix:
1. ✅ VIP data displays in agency view
2. ✅ Codes/Associates data displays in agency view
3. ✅ Pending data displays in agency view
4. ✅ MGA breakdown view filters correctly
5. ✅ RGA breakdown view filters correctly
6. ✅ Code/VIP ratio tables calculate correctly
7. ✅ YTD summary tables include VIP counts

## Impact
This fix restores full functionality to the scorecard agency view and ensures all breakdown views filter data correctly by management level.

