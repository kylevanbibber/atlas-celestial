# Agency Switching Feature

## Overview
This feature allows users with access to multiple SGAs to switch between them by right-clicking on the logo in the header. The system automatically filters all data based on the selected agency.

## Features
- ✅ Multiple agency access per user
- ✅ Right-click logo to switch agencies
- ✅ Visual indicator showing current agency
- ✅ Persistent agency selection across sessions
- ✅ Automatic data filtering based on selected agency
- ✅ Primary/secondary agency designation

## Database Schema

### `user_agencies` Table
Associates users with the agencies they can access.

```sql
- id (INT, PRIMARY KEY)
- user_id (INT, FOREIGN KEY to activeusers.id)
- sga_id (INT, FOREIGN KEY to sgas.id)
- is_primary (TINYINT) - 1 = primary, 0 = secondary
- created (TIMESTAMP)
```

### `user_selected_agency` Table
Stores each user's currently selected agency.

```sql
- user_id (INT, PRIMARY KEY, FOREIGN KEY to activeusers.id)
- sga_id (INT, FOREIGN KEY to sgas.id)
- updated (TIMESTAMP)
```

## Setup Instructions

### 1. Run the SGA Tables Migration (if not already done)
```bash
cd backend/migrations
node run_sgas_migration.js
```

### 2. Run the User Agencies Migration
```bash
node run_user_agencies_migration.js
```

This will:
- Add the "SURACE-SMITH-PARTNERS" SGA with alternative names
- Create `user_agencies` and `user_selected_agency` tables
- Give user ID 92 access to both ARIAS ORGANIZATION and SURACE-SMITH-PARTNERS
- Set user 92's default selection to ARIAS ORGANIZATION

## Usage

### For Users
1. **Right-click the logo** in the header
2. A context menu appears showing all agencies you have access to
3. Click on an agency to switch to it
4. The page will reload with data filtered for the selected agency
5. A checkmark (✓) indicates your currently selected agency

**Note:** The right-click menu only appears if you have access to multiple agencies.

### For Administrators

#### Give a User Access to Multiple Agencies

```javascript
// Via API
POST /api/sgas/user/:userId/agencies
Body: {
  "sgaId": 2,  // ID of the SGA
  "isPrimary": false
}
```

```sql
-- Via SQL
INSERT INTO user_agencies (user_id, sga_id, is_primary) 
VALUES (userId, sgaId, 0);
```

#### Remove User's Agency Access

```javascript
// Via API
DELETE /api/sgas/user/:userId/agencies/:sgaId
```

```sql
-- Via SQL
DELETE FROM user_agencies WHERE user_id = ? AND sga_id = ?;
```

#### Check User's Agencies

```javascript
// Via API
GET /api/sgas/user/:userId/agencies

// Returns:
[
  {
    "id": 1,
    "rept_name": "ARIAS ORGANIZATION",
    "display_name": "Arias Organization",
    "is_default": 1,
    "is_primary": 1,
    "alternative_names": ["ARIAS ORGANIZATION", "Arias Org", ...]
  },
  {
    "id": 2,
    "rept_name": "SURACE-SMITH-PARTNERS",
    "display_name": "Surace Smith Partners",
    "is_default": 0,
    "is_primary": 0,
    "alternative_names": ["SURACE-SMITH-PARTNERS", "SSP", ...]
  }
]
```

## API Endpoints

### Get User's Agencies
```
GET /api/sgas/user/:userId/agencies
Returns all agencies the user has access to.
```

### Get User's Selected Agency
```
GET /api/sgas/user/:userId/selected
Returns the user's currently selected agency.
```

### Switch Agency
```
POST /api/sgas/user/:userId/selected
Body: { "sgaId": 2 }
Changes the user's selected agency.
```

### Add Agency Access
```
POST /api/sgas/user/:userId/agencies
Body: { "sgaId": 2, "isPrimary": false }
Gives a user access to an agency.
```

### Remove Agency Access
```
DELETE /api/sgas/user/:userId/agencies/:sgaId
Removes a user's access to an agency.
```

## Frontend Integration

### AgencyContext
The `AgencyContext` provides agency data throughout the app:

```javascript
import { useAgency } from '../context/AgencyContext';

function MyComponent() {
  const { 
    selectedAgency,      // Currently selected agency
    userAgencies,        // All agencies user can access
    hasMultipleAgencies, // Boolean: user has > 1 agency
    switchAgency,        // Function to switch agency
    loading              // Loading state
  } = useAgency();

  // Use selectedAgency to filter data
  const agencyName = selectedAgency?.rept_name;
}
```

### Using in Data Queries
```javascript
import { useAgency } from '../context/AgencyContext';
import api from '../api';

function fetchData() {
  const { selectedAgency } = useAgency();
  
  // Use the selected agency in your queries
  const response = await api.get('/api/data/something', {
    params: {
      agency: selectedAgency?.rept_name
    }
  });
}
```

## Files Modified/Created

### Backend
1. **Created:**
   - `migrations/20250122_add_user_agencies.sql` - Database schema
   - `migrations/run_user_agencies_migration.js` - Migration runner
   - Updated `routes/sgas.js` - Added user agency endpoints

2. **Updated:**
   - `routes/sgas.js` - Added 5 new endpoints for user agencies

### Frontend
1. **Created:**
   - `context/AgencyContext.js` - Agency state management

2. **Updated:**
   - `components/utils/Header.js` - Added right-click menu
   - `App.js` - Added AgencyProvider

## Configuration for User 92

User ID 92 has been configured with access to:

1. **ARIAS ORGANIZATION** (Primary)
   - `rept_name`: "ARIAS ORGANIZATION"
   - `display_name`: "Arias Organization"
   - Alternative names: "ARIAS ORGANIZATION", "Arias Organization", "ARIAS ORG", "Arias Org"

2. **SURACE-SMITH-PARTNERS** (Secondary)
   - `rept_name`: "SURACE-SMITH-PARTNERS"
   - `display_name`: "Surace Smith Partners"
   - Alternative names: "SURACE-SMITH-PARTNERS", "Surace-Smith-Partners", "SURACE SMITH PARTNERS", "Surace Smith Partners", "SSP"

## Testing

### Manual Testing Steps
1. Log in as user ID 92
2. Right-click the logo in the header
3. Verify both agencies appear in the menu
4. Click "Surace Smith Partners"
5. Verify the page reloads
6. Verify a checkmark appears next to the selected agency
7. Test switching back to "Arias Organization"
8. Verify data is filtered correctly for each agency

### SQL Testing
```sql
-- Check user's agencies
SELECT 
  u.id as user_id,
  u.lagnname,
  s.rept_name,
  s.display_name,
  ua.is_primary
FROM user_agencies ua
JOIN activeusers u ON ua.user_id = u.id
JOIN sgas s ON ua.sga_id = s.id
WHERE u.id = 92;

-- Check user's selected agency
SELECT 
  u.id as user_id,
  u.lagnname,
  s.rept_name as selected_agency
FROM user_selected_agency usa
JOIN activeusers u ON usa.user_id = u.id
JOIN sgas s ON usa.sga_id = s.id
WHERE u.id = 92;
```

## Future Enhancements
- [ ] Agency-specific permissions
- [ ] Agency-specific branding/logos
- [ ] Bulk assign users to agencies
- [ ] Agency groups/hierarchies
- [ ] Admin UI for managing user agency access

## Troubleshooting

### Issue: Right-click menu doesn't appear
**Solution:** Verify the user has access to multiple agencies:
```sql
SELECT COUNT(*) as agency_count 
FROM user_agencies 
WHERE user_id = 92;
```

### Issue: "Access denied" when switching agencies
**Solution:** Ensure the user has access to the target agency:
```sql
SELECT * FROM user_agencies 
WHERE user_id = 92 AND sga_id = [target_sga_id];
```

### Issue: Agency selection not persisting
**Solution:** Check the user_selected_agency table:
```sql
SELECT * FROM user_selected_agency WHERE user_id = 92;
```

## Security Notes
- Agency switching uses the existing auth middleware
- Users can only switch to agencies they have been granted access to
- Agency access is validated on both frontend and backend
- All agency-related queries use proper foreign key constraints

## Support
For questions or issues, refer to the main SGA documentation in `README_SGAS.md` or consult with the development team.

