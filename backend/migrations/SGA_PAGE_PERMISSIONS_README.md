# SGA Page Permissions System

This document describes the SGA (Super General Agency) page permissions system that allows controlling which pages each agency can access.

## Overview

The system allows administrators to:
- Control which pages each SGA can access
- Users see only the pages their selected agency has access to
- Simple approach: if a permission row exists, the SGA has access to that page
- No need to maintain a full list of pages in the database

## Database Table

### `sga_page_permissions`
Simple permissions table - if a row exists, the SGA has access to that page.

**Columns:**
- `id`: Primary key
- `sga_id`: Foreign key to `sgas` table
- `page_key`: Page identifier (e.g., 'production', 'recruiting', 'admin')
- `created`: Timestamp

**Constraints:**
- Unique constraint on `(sga_id, page_key)`
- Foreign key to `sgas` table cascades on delete

## How It Works

1. **Pages are defined in the frontend code**, not the database
2. **Permissions are stored as simple rows**: If a row exists with `sga_id` + `page_key`, that SGA can access the page
3. **Default SGA gets all permissions** on initial setup
4. **No access = no row** in the database

## Available Pages (Defined in Frontend)

### Production
- `production` - Production (/production)
- `production_overview` - Production Overview (/production-overview)
- `reports` - Reports (/reports)
- `scorecard` - Scorecard (/scorecard)

### Recruiting
- `recruiting` - Recruiting (/recruiting)
- `recruiting_overview` - Recruiting Overview (/recruiting-overview)

### Training
- `training` - Training (/training)
- `resources` - Resources (/resources-overview)

### Tools
- `utilities` - Utilities (/utilities)
- `one_on_one` - One on One (/one-on-one)
- `refs` - Refs (/refs)

### Admin
- `admin_notifications` - Admin Notifications (/admin/notifications)
- `admin_email_campaigns` - Email Campaigns (/admin/email-campaigns)
- `admin_hierarchy` - Hierarchy Settings (/admin/hierarchy-settings)
- `admin_analytics` - Analytics Dashboard (/admin/analytics)
- `team_customization` - Team Customization (/utilities/team-customization)

## API Endpoints

### Get Page Permissions for an SGA
```
GET /api/sgas/:sgaId/permissions
```
Returns array of page keys the SGA has access to: `['production', 'recruiting', ...]`

### Update Page Permissions
```
PUT /api/sgas/:sgaId/permissions
Body: {
  page_keys: ['production', 'recruiting', 'training', ...]
}
```
Replaces all permissions for an SGA with the provided list.

### Check Page Access
```
GET /api/sgas/check-access/:pageKey
```
Checks if the current user's selected agency has access to the specified page.

### Get User Agencies (with permissions)
```
GET /api/sgas/user/:userId/agencies
```
Returns agencies for a user, including their `allowed_pages` array.

## Frontend Integration

### 1. AgencyContext
The `AgencyContext` provides:
- `allowedPages`: Array of page keys the user can access
- `hasPageAccess(pageKey)`: Function to check if user has access to a page

### 2. ProtectedRoute Component
Use this component to protect routes:

```jsx
import ProtectedRoute from './components/utils/ProtectedRoute';

<Route 
  path="/production" 
  element={
    <ProtectedRoute pageKey="production">
      <ProductionPage />
    </ProtectedRoute>
  } 
/>
```

### 3. Admin Component
The `SGAPermissions` component (`/components/admin/SGAPermissions.js`) provides a UI to manage page permissions for each SGA.

## Installation

1. Run the `MANUAL_SETUP_AGENCIES.sql` migration script on your database:
   ```sql
   mysql -u your_user -p your_database < backend/migrations/MANUAL_SETUP_AGENCIES.sql
   ```

2. The script will:
   - Create `sga_pages` table
   - Create `sga_page_permissions` table
   - Insert default pages
   - Set up initial permissions for existing SGAs

## Default Configuration

### ARIAS ORGANIZATION (Default SGA)
- Has access to **all pages** (Production, Recruiting, Training, Tools, Admin)

### SURACE-SMITH-PARTNERS
- Has access to: Production, Training, and Tools
- Does **not** have access to: Recruiting and Admin pages

## Adding New Pages

To add a new page to the permission system:

1. **Add to frontend page definitions** in `SGAPermissions.js`:
   ```javascript
   const AVAILABLE_PAGES = [
     // ... existing pages
     { key: 'new_page', name: 'New Page', path: '/new-page', category: 'Category' },
   ];
   ```

2. **Grant permissions to desired SGAs**:
   ```sql
   INSERT INTO sga_page_permissions (sga_id, page_key)
   VALUES (1, 'new_page');  -- Grant to SGA with id=1
   ```

3. **Protect the route** in your App.js:
   ```jsx
   <Route 
     path="/new-page" 
     element={
       <ProtectedRoute pageKey="new_page">
         <NewPage />
       </ProtectedRoute>
     } 
   />
   ```

## Navigation Menu Integration

To hide navigation menu items based on permissions:

```jsx
import { useAgency } from './context/AgencyContext';

const Navigation = () => {
  const { hasPageAccess } = useAgency();

  return (
    <nav>
      {hasPageAccess('production') && (
        <NavLink to="/production">Production</NavLink>
      )}
      {hasPageAccess('recruiting') && (
        <NavLink to="/recruiting">Recruiting</NavLink>
      )}
      {/* ... other menu items */}
    </nav>
  );
};
```

## Security Notes

1. **No Permission = No Access**: If a row doesn't exist in the permissions table, the page is not accessible to that SGA.

2. **Backend Enforcement**: While the frontend hides inaccessible pages, backend routes should also check permissions for security using the `/sgas/check-access/:pageKey` endpoint.

3. **Default SGA**: The default SGA (ARIAS ORGANIZATION) should have all page permissions set on initial setup.

## Troubleshooting

### Users can't see any pages
- Check that page permission rows exist in `sga_page_permissions` for their SGA
- Verify the user has an active agency in `user_agencies`
- Check that the agency is not hidden (`hide = 0`) or inactive (`active = 0`)

### Permissions not updating after changing agencies
- Clear browser cache
- Check that `AgencyContext` is properly wrapped around the app
- Verify the `/sgas/user/:userId/agencies` endpoint returns `allowed_pages` array

### Admin panel not showing correct permissions
- Ensure page definitions in `SGAPermissions.js` match your actual routes
- Check database connection and that queries are returning data

## Future Enhancements

Potential improvements:
- Role-based permissions (different permissions for different user roles within an SGA)
- Time-based access (temporary access to pages)
- Page-level feature flags (enable/disable specific features within a page)
- Audit logging for permission changes
- Bulk permission updates

