# SGA Management System

## Overview
This system adds support for managing multiple SGAs (Sales General Agencies) with alternative name support. This is important because SGA names may appear differently across various reports and data sources.

## Features
- ✅ Multiple SGA support
- ✅ Alternative names for SGAs (e.g., "ARIAS ORGANIZATION", "Arias Org", "ARIAS ORG")
- ✅ Active/inactive status
- ✅ Hide/show visibility control
- ✅ Default SGA designation (ARIAS ORGANIZATION)
- ✅ Automatic name resolution across all variations

## Database Schema

### `sgas` Table
```sql
- id (INT, PRIMARY KEY)
- rept_name (VARCHAR(255), UNIQUE) - Primary report name
- display_name (VARCHAR(255)) - Optional display name for UI
- active (TINYINT) - 1 = active, 0 = inactive
- hide (TINYINT) - 1 = hidden from lists, 0 = visible
- is_default (TINYINT) - 1 = default SGA, 0 = regular
- created (TIMESTAMP)
- updated (TIMESTAMP)
```

### `sga_alternative_names` Table
```sql
- id (INT, PRIMARY KEY)
- sga_id (INT, FOREIGN KEY to sgas.id)
- alternative_name (VARCHAR(255)) - Alternative name as it appears in reports
- created (TIMESTAMP)
```

## Running the Migration

### Option 1: Using the migration script
```bash
cd backend/migrations
node run_sgas_migration.js
```

### Option 2: Manual SQL execution
```bash
mysql -u your_user -p your_database < 20250122_create_sgas_table.sql
```

## API Endpoints

All endpoints require authentication (verifyToken middleware).

### Get All SGAs
```
GET /api/sgas
Query params: 
  - includeHidden (optional): 'true' to include hidden SGAs
  - includeInactive (optional): 'true' to include inactive SGAs
```

### Get Single SGA
```
GET /api/sgas/:id
```

### Create SGA
```
POST /api/sgas
Body: {
  "rept_name": "NEW ORGANIZATION",
  "display_name": "New Organization",
  "active": 1,
  "hide": 0,
  "alternative_names": ["NEW ORG", "New Org", "NEWORG"]
}
```

### Update SGA
```
PUT /api/sgas/:id
Body: {
  "rept_name": "UPDATED NAME",
  "display_name": "Updated Display Name",
  "active": 1,
  "hide": 0,
  "alternative_names": ["ALT NAME 1", "ALT NAME 2"]
}
```

### Delete SGA
```
DELETE /api/sgas/:id
Note: Cannot delete the default SGA
```

### Get Default SGA
```
GET /api/sgas/default/get
```

### Lookup SGA by Name
```
GET /api/sgas/lookup/:name
Finds an SGA by any of its names (primary, alternative, or display)
```

## Helper Functions

The `utils/sgaHelper.js` file provides utility functions for working with SGAs:

### `resolveSgaName(name)`
Resolves any SGA name (primary, alternative, or display) to the canonical report name.
```javascript
const { resolveSgaName } = require('./utils/sgaHelper');
const canonicalName = await resolveSgaName('ARIAS ORG'); // Returns 'ARIAS ORGANIZATION'
```

### `getDefaultSgaName()`
Gets the default SGA's report name.
```javascript
const { getDefaultSgaName } = require('./utils/sgaHelper');
const defaultSga = await getDefaultSgaName(); // Returns 'ARIAS ORGANIZATION'
```

### `getActiveSgas()`
Gets all active, non-hidden SGAs with their alternative names.
```javascript
const { getActiveSgas } = require('./utils/sgaHelper');
const sgas = await getActiveSgas();
```

### `getSgaWhereClause(columnName, sgaName)`
Builds a SQL WHERE clause that matches any SGA name variation.
```javascript
const { getSgaWhereClause } = require('./utils/sgaHelper');
const { clause, params } = await getSgaWhereClause('MGA', 'ARIAS ORGANIZATION');
// clause: '(MGA = ? OR MGA = ? OR MGA = ?)'
// params: ['ARIAS ORGANIZATION', 'Arias Organization', 'ARIAS ORG', ...]
```

### `isSgaName(name)`
Checks if a name matches any active SGA.
```javascript
const { isSgaName } = require('./utils/sgaHelper');
const isSga = await isSgaName('ARIAS ORG'); // Returns true
```

## Usage Examples

### Example 1: Updating Hardcoded SGA References
**Before:**
```javascript
const query = `SELECT * FROM sub_agent WHERE MGA = 'ARIAS ORGANIZATION'`;
const results = await db.query(query);
```

**After:**
```javascript
const { getSgaWhereClause } = require('./utils/sgaHelper');
const { clause, params } = await getSgaWhereClause('MGA', 'ARIAS ORGANIZATION');
const query = `SELECT * FROM sub_agent WHERE ${clause}`;
const results = await db.query(query, params);
```

### Example 2: Dynamic SGA Filtering
```javascript
const { isSgaName, getSgaWhereClause } = require('./utils/sgaHelper');

// Check if manager is an SGA
const isManagerSga = await isSgaName(manager);
if (isManagerSga) {
  const { clause, params } = await getSgaWhereClause('MGA', manager);
  sqlQuery += ` AND ${clause}`;
  queryParams.push(...params);
}
```

### Example 3: Adding a New SGA via API
```javascript
// POST /api/sgas
const newSga = {
  rept_name: "SMITH AGENCY",
  display_name: "Smith Insurance Agency",
  active: 1,
  hide: 0,
  alternative_names: [
    "SMITH AGENCY",
    "Smith Agency",
    "SMITH INS",
    "Smith Insurance"
  ]
};

const response = await fetch('/api/sgas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newSga)
});
```

## Migration Notes

### Files Modified
1. **Created:**
   - `migrations/20250122_create_sgas_table.sql` - Database schema
   - `routes/sgas.js` - API endpoints
   - `utils/sgaHelper.js` - Helper functions
   - `migrations/run_sgas_migration.js` - Migration runner

2. **Updated:**
   - `app.js` - Registered SGA routes
   - `routes/dataRoutes.js` - Updated `/subagent-alp-sga` endpoint
   - `routes/productionReports.js` - Updated SGA filtering logic

### Default Data
The migration automatically creates:
- Default SGA: "ARIAS ORGANIZATION"
- Alternative names: "ARIAS ORGANIZATION", "Arias Organization", "ARIAS ORG", "Arias Org"

## Future Enhancements
- [ ] Admin UI for managing SGAs
- [ ] Bulk import/export of SGAs
- [ ] SGA-specific configurations
- [ ] Historical tracking of SGA name changes
- [ ] SGA grouping/hierarchies

## Troubleshooting

### Issue: Migration fails with "table already exists"
**Solution:** Tables already exist. You can either drop them first or skip the migration.

### Issue: Queries returning no data after migration
**Solution:** Ensure your data uses one of the registered SGA names. Use the lookup endpoint to verify:
```bash
GET /api/sgas/lookup/YOUR_SGA_NAME
```

### Issue: Cannot delete default SGA
**Solution:** This is by design. The default SGA cannot be deleted or deactivated. You can change which SGA is the default by updating the `is_default` field directly in the database (only one SGA should have `is_default = 1`).

## Support
For questions or issues, refer to the codebase documentation or consult with the development team.

