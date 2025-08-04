# Admin Licensing Documentation

## Overview
The Admin Licensing component provides a comprehensive interface for `teamRole = "app"` admin users to manage `licensed_states` data. This component offers full CRUD (Create, Read, Update, Delete) capabilities with inline editing and export functionality.

## Access Control
- **Role Required**: Admin (`user.Role === 'Admin'`)
- **Team Role Required**: App (`user.teamRole === 'app'`)
- **Location**: Settings page → Licensing section
- **Route**: Integrated into `/settings` page

## License Warning Behavior
- **App Team Admins**: License warnings are **disabled** in the sidebar and bottom navigation
- **Regular Users**: License warnings continue to show for expiring licenses and missing resident licenses
- **Implementation**: Both `Sidebar.js` and `BottomNav.js` check `teamRole !== "app"` before showing license warnings

## Features

### DataTable Integration
- **Full CRUD Operations**: Add, edit, delete license records
- **Inline Editing**: Click any cell to edit directly
- **Export Functionality**: Export data to CSV/Excel
- **Sorting & Filtering**: Built-in table sorting and search
- **Pagination**: Handle large datasets efficiently

### License Fields
- **ID**: Unique identifier (auto-generated)
- **User ID**: Associated user identifier
- **License Name**: Name of the license holder
- **State**: State where license is valid
- **Expiry Date**: License expiration date (formatted as MM/DD/YYYY)
- **Resident State**: Whether user is resident of the licensed state (Yes/No)
- **License Number**: Official license number

## Backend Endpoints

### Get All Licenses
- **Endpoint**: `GET /api/admin/licensing/all`
- **Response**: Array of all license records
- **Fields**: `id`, `userId`, `lagnname`, `state`, `expiry_date`, `resident_state`, `license_number`

### Save License
- **Endpoint**: `POST /api/admin/licensing/save`
- **Purpose**: Create new or update existing license
- **Logic**: Uses `id` to determine INSERT vs UPDATE
- **Date Handling**: Converts MM/DD/YYYY to YYYY-MM-DD for database storage

### Delete License
- **Endpoint**: `DELETE /api/admin/licensing/delete/:id`
- **Purpose**: Remove license record by ID
- **Validation**: Ensures record exists before deletion

## Database Schema
```sql
CREATE TABLE licensed_states (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId VARCHAR(255),
  lagnname VARCHAR(255),
  state VARCHAR(255),
  expiry_date DATE,
  resident_state ENUM('Yes', 'No'),
  license_number VARCHAR(255)
);
```

## UI Features

### DataTable Configuration
- **Columns**: All license fields with appropriate formatting
- **Date Display**: `expiry_date` formatted for user-friendly display
- **Resident State**: Displayed as "Yes" or "No"
- **Actions**: Edit and delete buttons for each row

### Styling
- **Consistent Design**: Matches existing app styling patterns
- **Responsive Layout**: Works on desktop and mobile devices
- **Hover Effects**: Visual feedback for interactive elements
- **Color Coding**: Different colors for different data types

## Integration

### Settings Page Integration
- **Conditional Rendering**: Shows `AdminLicensing` for app team admins
- **Fallback**: Shows `LicenseSettings` for regular users
- **Access Control**: Only visible to `teamRole = "app"` admins

### Navigation Integration
- **Sidebar**: Appears in settings section for app team admins
- **Bottom Navigation**: Included in mobile navigation
- **Warning Indicators**: Disabled for app team admins

## Error Handling
- **Database Errors**: Graceful error messages for failed operations
- **Validation**: Client-side validation for required fields
- **Network Issues**: Retry mechanisms for failed API calls
- **User Feedback**: Loading states and success/error notifications

## Future Enhancements
- **Bulk Operations**: Import/export multiple licenses
- **Advanced Filtering**: Filter by state, expiry date, etc.
- **License Templates**: Pre-defined license configurations
- **Audit Trail**: Track changes to license records
- **Expiry Alerts**: Highlight licenses expiring soon 