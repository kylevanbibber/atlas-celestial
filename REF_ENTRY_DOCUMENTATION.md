# Ref Entry Feature Documentation

## Overview
A new **Ref Entry** page has been created specifically for users with `teamRole = "app"` (app users). This page provides a comprehensive DataTable interface for managing the `refvalidation` table with full CRUD operations.

## Access Requirements
- **User Role**: Admin
- **Team Role**: app
- **Navigation**: The "Ref Entry" menu item appears in the sidebar only for qualifying users

## Features

### 1. Data Display
- **DataTable**: Displays all refvalidation records in a sortable, searchable table
- **Filtering**: 
  - By `created_at` date (YYYY-MM format)
  - By `true_ref` field (All, Blank, Y, N)
  - Global search across multiple fields
- **Sorting**: Click any column header to sort data
- **Tabs**: Data is split into tabs based on `admin_name` field

### 2. CRUD Operations
- **Create**: Add new refvalidation records
- **Read**: View all record data with proper formatting
- **Update**: Edit existing records inline
- **Delete**: Remove records with confirmation

### 3. User Interface Features
- **Responsive Design**: Works on desktop and mobile
- **Color Coding**: 
  - Green background for `true_ref = "Y"`
  - Red background for `true_ref = "N"`
  - Orange background for rows being edited
- **Copy Functionality**: Copy client first name + zip code to clipboard
- **Date Restrictions**: Can only add new records for current or previous month

## Database Structure
The `refvalidation` table includes these key fields:
- `id` (Primary Key, Auto-increment)
- `uuid` (Unique identifier for tracking)
- `true_ref` (ENUM: 'Y', 'N')
- `ref_detail` (VARCHAR 255)
- `lagnname` (VARCHAR 255 - Agent name)
- `agent_id` (INT - References agent)
- `client_name` (VARCHAR 255)
- `zip_code` (CHAR 5)
- `existing_policy` (ENUM: 'Y', 'N')
- `trial` (ENUM: 'Y', 'N')
- `date_app_checked` (VARCHAR 10)
- `notes` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `admin_name` (VARCHAR 255)
- `admin_id` (INT)
- `sa`, `ga`, `mga`, `rga`, `clname` (VARCHAR 255)

## API Endpoints
New backend routes under `/api/refvalidation/`:
- `GET /all` - Fetch filtered refvalidation records
- `POST /save` - Create/update refvalidation records
- `DELETE /delete/:id` - Delete a refvalidation record
- `GET /month-options` - Get available months for filtering
- `GET /admin-tabs` - Get unique admin names for tabs
- `GET /agent` - Get records for specific agent
- `GET /active-users` - Get active users for agent dropdown

## Files Created/Modified

### Frontend
- `frontend/src/components/refvalidation/RefEntry.js` - Main component
- `frontend/src/App.js` - Added routing
- `frontend/src/context/sidebarNavItems.js` - Added navigation

### Backend
- `backend/routes/refvalidation.js` - API endpoints
- `backend/app.js` - Registered new routes

## Usage Instructions

1. **Login** as an Admin user with `teamRole = "app"`
2. **Navigate** to "Ref Entry" in the sidebar
3. **Filter** data using the month and true_ref dropdowns
4. **Search** using the search bar to find specific records
5. **Add Records**: Click "Add Row" (only available for current/previous month)
6. **Edit Records**: Click on any row to enter edit mode
7. **Save Changes**: Click "Save Changes" when editing
8. **Delete Records**: Click the trash icon and confirm deletion
9. **Copy Data**: Click the copy icon to copy client name + zip to clipboard

## Security Notes
- Access is restricted to Admin users with `teamRole = "app"`
- All API endpoints require authentication via `verifyToken` middleware
- User permissions are checked both on frontend and backend

## Business Logic
- When `trial = "Y"`, `true_ref` is automatically set to "N"
- Records are filtered by month using `created_at` field
- Tab system allows organization by `admin_name`
- UUID system ensures unique record tracking