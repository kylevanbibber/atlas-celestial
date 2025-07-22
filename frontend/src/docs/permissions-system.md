# Atlas Permissions System

This document outlines how to use the enhanced permissions system in the Atlas application.

## Overview

The permissions system controls:
- Which roles can access specific pages
- Which UI components are visible/hidden based on user role
- Support for showing "locked" UI elements with visual styling

## Permission Configuration

All permissions are defined in `src/context/permissionsConfig.js`:

```javascript
// Key permission constants
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_REFS: 'view_refs',
  VIEW_SETTINGS: 'view_settings',
  
  // Dashboard components
  VIEW_DASHBOARD_ANALYTICS: 'view_dashboard_analytics',
  VIEW_DASHBOARD_USERS: 'view_dashboard_users',
  // ...more permissions
};

// Role permission mapping
export const ROLE_PERMISSIONS = {
  Admin: [
    // All permissions
    ...Object.values(PERMISSIONS),
  ],
  SGA: [
    PERMISSIONS.VIEW_DASHBOARD,
    // ...specific SGA permissions
  ],
  // ...other roles
};
```

## Page-Level Protection

Protect routes in your app using the `ProtectedRoute` component:

```jsx
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute requiredPermission="view_dashboard">
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

You can also use automatic route protection mapping:

```jsx
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>  {/* No explicit permission needed */}
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

## Component-Level Permission Control

### Basic Usage (Hide/Show)

Use the `PermissionControl` component to control visibility of UI elements:

```jsx
import { PermissionControl } from '../components/common';
import { PERMISSIONS } from '../context/permissionsConfig';

function SomeComponent() {
  return (
    <div>
      {/* Basic content everyone can see */}
      <h1>Dashboard</h1>
      
      {/* Only users with view_dashboard_analytics permission can see this */}
      <PermissionControl permission={PERMISSIONS.VIEW_DASHBOARD_ANALYTICS}>
        <AnalyticsComponent />
      </PermissionControl>
      
      {/* Admin-only section with custom fallback */}
      <PermissionControl 
        permission={PERMISSIONS.ADMIN_SETTINGS}
        fallback={<p>Admin only settings</p>}
      >
        <AdminSettings />
      </PermissionControl>
    </div>
  );
}
```

### Locked UI Components

Show UI elements in a "locked" state:

```jsx
<PermissionControl 
  permission={PERMISSIONS.CREATE_REFS}
  showLocked={true}
  lockMessage="Feature Locked" 
  unlockCriteria="Available to Agent level and above"
>
  <AdvancedFeature />
</PermissionControl>
```

This will render the component with a blur effect and lock overlay.

## Direct Permission Checks

Use the `hasPermission` method directly:

```jsx
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../context/permissionsConfig';

function SomeComponent() {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {/* Conditionally render based on permission */}
      {hasPermission(PERMISSIONS.EDIT_REFS) && (
        <button>Edit</button>
      )}
      
      {/* Conditional classes based on permissions */}
      <div className={`feature ${hasPermission(PERMISSIONS.VIEW_DASHBOARD_ANALYTICS) ? 'enabled' : 'disabled'}`}>
        Feature Content
      </div>
    </div>
  );
}
```

## Example: Dashboard with Mixed Permission Controls

```jsx
import React from 'react';
import { PermissionControl } from '../components/common';
import { PERMISSIONS } from '../context/permissionsConfig';

function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      {/* Basic stats everyone can see */}
      <div className="dashboard-stats">
        <StatsCard title="Overview" />
      </div>
      
      {/* Analytics only for higher roles */}
      <PermissionControl 
        permission={PERMISSIONS.VIEW_DASHBOARD_ANALYTICS}
        showLocked={true}
        lockMessage="Analytics Locked"
        unlockCriteria="Available to MGA level and above"
      >
        <div className="dashboard-analytics">
          <h2>Analytics</h2>
          <AnalyticsChart />
        </div>
      </PermissionControl>
      
      {/* Admin controls - completely hidden if no permission */}
      <PermissionControl permission={PERMISSIONS.ADMIN_SETTINGS}>
        <div className="admin-controls">
          <h2>Admin Controls</h2>
          <AdminPanel />
        </div>
      </PermissionControl>
    </div>
  );
}
```

## For Developers: Adding New Permissions

1. Add a new permission constant in `permissionsConfig.js`
2. Update the role permissions mapping
3. Use the permission in your components

For any questions, contact the Atlas development team. 