# Admin Dashboard Documentation

## Overview
The Admin Dashboard is a component designed specifically for users with `teamRole = "app"` that provides key metrics and insights from various components across the application. **Currently hidden from navigation - Production page is the main landing page for app team admins.**

## Access Control
- **Role Required**: Admin (`user.Role === 'Admin'`)
- **Team Role Required**: App (`user.teamRole === 'app'`)
- **Route**: `/admin-dashboard` (currently hidden)
- **Default Landing**: App team admins are redirected to `/production` instead of `/admin-dashboard`

## Navigation Changes
- **Sidebar**: "Dashboard" becomes "Production" for app team admins
- **Default Redirect**: App team admins are redirected to `/production` after login
- **Route Protection**: Accessing `/dashboard` redirects app team admins to `/production`
- **Admin Dashboard**: Currently hidden from navigation

## Features

### 1. ALP Metrics Section
Displays key metrics from the ALP (Application Lifecycle Process) component:

- **Previous Month ALP**: Count of ALP applications from the previous month (from `sga_alp` table)
- **Codes**: Total count of active codes
- **Hires**: Total count of active hires  
- **VIPs**: Total count of active VIPs

### 2. Verification Status Section
Shows verification metrics from the verification system:

- **Pending Verification**: Count of applications pending verification
- **Verified**: Count of applications that have been verified
- **Discrepancy**: Count of applications with verification discrepancies

### 3. Ref Validation Section
Displays metrics from the Ref Entry system:

- **Blank True Ref**: Count of refvalidation records where `true_ref` is blank/null

## Backend Endpoints

### ALP Metrics
- **Endpoint**: `GET /api/admin/dashboard/alp-metrics`
- **Response**: 
  ```json
  {
    "success": true,
    "data": {
      "prevMonthCount": 25,
      "codesCount": 150,
      "hiresCount": 75,
      "vipsCount": 30
    }
  }
  ```

### Verification Metrics
- **Endpoint**: `GET /api/admin/dashboard/verification-metrics`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "pending": 10,
      "verified": 45,
      "discrepancy": 3
    }
  }
  ```

### RefValidation Metrics
- **Endpoint**: `GET /api/admin/dashboard/refvalidation-metrics`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "blankTrueRef": 12
    }
  }
  ```

## UI Components

### MetricCard Component
Reusable component for displaying metrics with:
- **Title**: Metric name
- **Value**: Numeric value
- **Subtitle**: Additional context
- **Color**: Visual styling (blue, green, orange, purple, warning, success, danger, info)

### Styling
- Responsive grid layout
- Hover effects on cards
- Color-coded borders for different metric types
- Consistent with existing app design patterns

## Navigation Integration

### Sidebar Changes
- **App Team Admins**: "Dashboard" → "Production" (first item)
- **Regular Users**: "Dashboard" remains unchanged
- **Conditional Display**: Based on `user.Role === 'Admin' && user.teamRole === 'app'`

### Routing Logic
- **Default Redirect**: App team admins redirected to `/production` after login
- **Route Protection**: `/dashboard` redirects app team admins to `/production`
- **Fallback**: Regular users see standard Dashboard at `/dashboard`
- **Admin Dashboard**: Hidden from navigation

### Bottom Navigation
- **Automatic Inclusion**: Production appears in bottom nav for app team admins
- **Consistent Behavior**: Uses same navigation logic as sidebar

## Error Handling
- Graceful fallback to zero values if API calls fail
- Loading states while fetching data
- Error messages for failed requests

## Future Enhancements
- Real-time updates via WebSocket
- Drill-down capabilities for each metric
- Export functionality for reports
- Custom date range filtering
- Additional metrics from other components
- Re-enable admin dashboard when needed 