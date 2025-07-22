# Admin User Switching Feature

## Overview
The Admin User Switching feature allows administrators to view the application from any user's perspective while maintaining their admin privileges. This is useful for:
- Testing user-specific functionality
- Troubleshooting user issues
- Demonstrating features from different user perspectives
- Quality assurance and support

## How It Works

### Backend Implementation
- **New Routes**: Added `/admin/impersonateUser` and `/admin/getUsersForImpersonation` endpoints
- **Admin Protection**: Routes are protected with `verifyToken` and `verifyAdmin` middleware
- **User Data**: Returns complete user profile data (lagnname, Role, clname, esid, email, phone, etc.)

### Frontend Implementation
- **AuthContext Extension**: Added impersonation state management
- **AdminUserSwitcher Component**: Dropdown interface for selecting users
- **Visual Indicators**: Orange banner shows when impersonating
- **Permission Preservation**: Admin permissions maintained during impersonation

## Usage

### For Administrators
1. **Accessing the Feature**: Look for the "Switch User View" button in the header (only visible to admins)
2. **Selecting a User**: Click the button to open the dropdown, then search for and select a user
3. **Viewing as User**: The interface will show an orange banner indicating impersonation mode
4. **Returning to Admin**: Click "Return to Admin" in the orange banner

### User Data Available During Impersonation
- `lagnname` (Agent Name)
- `Role` (User Role)
- `clname` (Classification Name)
- `esid` (Employee/System ID)
- `email` (Email Address)
- `phone` (Phone Number)
- `profpic` (Profile Picture)
- `header_pic` (Header Image)
- `mga`, `agtnum`, `bio` (Additional user fields)

## Technical Details

### Security
- Only users with admin role can access the feature
- Original admin session is preserved
- Admin permissions are maintained for the switching functionality
- No token manipulation - user data is fetched server-side

### State Management
- `isImpersonating`: Boolean indicating if currently impersonating
- `originalAdminUser`: Stores the original admin user data
- `impersonatedUser`: Stores the target user's data
- `user`: Current active user (switches between admin and target)

### API Endpoints

#### POST `/admin/impersonateUser`
- **Purpose**: Switch to viewing as a specific user
- **Body**: `{ targetUserId: number }`
- **Response**: User data for the target user

#### GET `/admin/getUsersForImpersonation`
- **Purpose**: Get list of users available for impersonation
- **Response**: Array of user objects with id, name, clname, email, esid

## Files Modified/Created

### Backend
- `atlas/backend/routes/admin.js` - Added impersonation routes

### Frontend
- `atlas/frontend/src/context/AuthContext.js` - Extended with impersonation state
- `atlas/frontend/src/components/admin/AdminUserSwitcher.js` - New component
- `atlas/frontend/src/components/admin/AdminUserSwitcher.css` - Component styles
- `atlas/frontend/src/components/utils/Header.js` - Integrated switcher component

## Testing
1. Log in as an admin user
2. Look for the "Switch User View" button in the header
3. Click it to open the user selection dropdown
4. Search for and select a user
5. Verify the orange banner appears with user information
6. Navigate around the app to confirm you're seeing the user's data
7. Click "Return to Admin" to switch back

## Troubleshooting
- **Button not visible**: Ensure you're logged in with admin role
- **No users in dropdown**: Check database connection and user permissions
- **Can't switch back**: Use browser refresh as fallback (will return you to admin)
- **Permission errors**: Verify admin routes are properly protected

## Future Enhancements
- Recent users list for quick switching
- Audit logging of impersonation sessions
- Time-limited impersonation sessions
- Bulk user operations while impersonating 