# Dashboard Layout Components

## Overview

This directory contains reusable dashboard layout components for creating consistent section dashboards (Production, Recruiting, Resources).

## Components Created

### 1. `DashboardLayout.js`

A reusable layout component that provides consistent structure and styling using existing CSS classes from `Dashboard.css`.

**Features:**
- Reuses existing styles (`dashboard-container`, `dashboard-header`, `card-container`)
- Flexible grid system with customizable columns
- Header with title, subtitle, and action buttons
- Responsive design built-in

**Props:**
- `title` (string): Main dashboard title
- `subtitle` (string): Optional subtitle text
- `headerActions` (ReactNode): Optional action buttons in header
- `gridColumns` (string): CSS grid-template-columns value (default: `'repeat(auto-fit, minmax(300px, 1fr))'`)
- `children` (ReactNode): Dashboard cards/content

**Usage:**
```jsx
import DashboardLayout from './DashboardLayout';

<DashboardLayout
  title="Production Dashboard"
  subtitle="Track daily activity and performance"
  headerActions={<button>Export</button>}
  gridColumns="repeat(auto-fit, minmax(280px, 1fr))"
>
  {/* Your content here */}
</DashboardLayout>
```

### 2. `DashboardCard` Component

Exported from `DashboardLayout.js` - wraps content in a consistent card style.

**Props:**
- `title` (string): Card title
- `titleIcon` (ReactNode): Optional icon next to title
- `headerActions` (ReactNode): Optional actions in card header
- `children` (ReactNode): Card content
- `gridColumn` (string): CSS grid-column value (e.g., `'span 2'`, `'1 / -1'`)
- `className` (string): Additional CSS classes

**Usage:**
```jsx
import { DashboardCard } from './DashboardLayout';

<DashboardCard 
  title="Monthly Sales" 
  titleIcon={<FiTrendingUp />}
  gridColumn="span 2"
>
  <div>Your content here</div>
</DashboardCard>
```

### 3. `ProductionDashboard.js`

Example implementation showing how to use the layout components for the Production section.

**Features:**
- Metric cards for key statistics
- Full-width chart section
- Team activity section
- Quick actions panel
- Recent activity feed

## Grid Layout Examples

### Equal Width Columns (Auto-fit)
```jsx
gridColumns="repeat(auto-fit, minmax(300px, 1fr))"
```
Creates responsive columns that are at least 300px wide.

### Fixed Number of Columns
```jsx
gridColumns="repeat(4, 1fr)"  // 4 equal columns
gridColumns="repeat(3, 1fr)"  // 3 equal columns
```

### Mixed Sizes
```jsx
gridColumns="1fr 2fr 1fr"  // Middle column twice as wide
```

## Card Spanning Examples

### Span Multiple Columns
```jsx
<DashboardCard gridColumn="span 2">
  {/* Takes up 2 columns */}
</DashboardCard>
```

### Full Width
```jsx
<DashboardCard gridColumn="1 / -1">
  {/* Takes up entire row */}
</DashboardCard>
```

## Creating New Dashboards

### Example: Recruiting Dashboard

```jsx
import React from 'react';
import DashboardLayout, { DashboardCard } from './DashboardLayout';
import { FiUsers, FiCalendar } from 'react-icons/fi';

const RecruitingDashboard = ({ user }) => {
  return (
    <DashboardLayout
      title="Recruiting Dashboard"
      subtitle="Manage your recruiting pipeline"
      gridColumns="repeat(auto-fit, minmax(280px, 1fr))"
    >
      <DashboardCard 
        title="Active Applicants" 
        titleIcon={<FiUsers />}
      >
        <div className="card-value" style={{ fontSize: '2.5rem', fontWeight: 700 }}>
          42
        </div>
      </DashboardCard>
      
      {/* More cards... */}
      
      <DashboardCard 
        title="Pipeline View"
        gridColumn="1 / -1"
      >
        {/* Full-width pipeline visualization */}
      </DashboardCard>
    </DashboardLayout>
  );
};

export default RecruitingDashboard;
```

## Existing CSS Classes Used

These classes come from existing stylesheets and maintain consistency:

- `.dashboard-container` - Main wrapper
- `.dashboard-cards-wrapper` - Content wrapper
- `.dashboard-header` - Header section
- `.section-title` - Main title styling
- `.card-container` - Grid container
- `.dashboard-card` - Individual card styling
- `.card-value` - Large metric values
- `.card-title` - Card titles
- `.card-subtitle` - Subtitle text

## Responsive Behavior

The layout automatically adjusts based on screen size:
- Desktop: Multiple columns based on `gridColumns` prop
- Tablet (≤ 1200px): Auto-fits to available space
- Mobile (≤ 768px): Single column layout

## Next Steps

To create Recruiting and Resources dashboards:

1. Create new files: `RecruitingDashboard.js` and `ResourcesDashboard.js`
2. Import and use `DashboardLayout` and `DashboardCard`
3. Add them to the respective section pages (similar to how ProductionDashboard was added)
4. Update navigation submenus to include dashboard options

## Integration

The ProductionDashboard has been integrated into the Production page:
- Accessible via `/production?section=dashboard`
- Listed first in the Production submenu
- Set as the default section for most users
