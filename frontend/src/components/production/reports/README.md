# Modular Reports System

This directory contains the modular reports system that allows you to create reusable, in-app report components that are automatically integrated with the Production Reports page.

## Directory Structure

```
/reports/
├── Reports.js          # Base report wrapper component
├── Reports.css         # Styling for the base component
├── RefReport.js        # Example REF report component
├── RefReport.css       # Styling for REF report
├── index.js           # Exports and report registry
└── README.md          # This documentation
```

## How It Works

1. **Base Component**: `Reports.js` provides a consistent layout, header, actions, and functionality for all reports
2. **Individual Reports**: Each report (like `RefReport.js`) uses the base component and focuses on its specific content
3. **Registry System**: `index.js` contains a registry of all available reports that automatically integrates with ProductionReports
4. **Automatic Integration**: Reports are automatically displayed in ProductionReports alongside home office reports

## Creating a New Report

### 1. Create the Report Component

Create a new file like `MyReport.js`:

```javascript
import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiDownload } from 'react-icons/fi';
import Reports from './Reports';
import './MyReport.css';

const MyReport = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Report configuration
  const reportConfig = {
    title: 'My Custom Report',
    description: 'Description of what this report shows',
    version: '1.0',
    category: 'Sales', // or 'Referrals', 'Production', etc.
    frequency: 'Monthly'
  };

  // Load data when component mounts
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Your data loading logic here
      // const response = await api.get('/my-report-data');
      // setData(response.data);
      
      // Simulate loading for demo
      await new Promise(resolve => setTimeout(resolve, 1000));
      setData({ sampleData: true });
    } catch (err) {
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Your export logic here
    console.log('Exporting report...');
  };

  // Custom actions for this report
  const reportActions = [
    {
      label: 'Export',
      icon: <FiDownload size={16} />,
      onClick: handleExport,
      variant: 'primary',
      title: 'Export report data'
    }
  ];

  return (
    <Reports
      reportConfig={reportConfig}
      onBack={onBack}
      title={reportConfig.title}
      description={reportConfig.description}
      actions={reportActions}
      metadata={{
        category: reportConfig.category,
        frequency: reportConfig.frequency,
        lastUpdated: new Date()
      }}
      loading={loading}
      error={error}
      onRefresh={loadData}
      fullScreenCapable={true}
    >
      {data && (
        <div className="my-report-content">
          {/* Your report content goes here */}
          <h3>My Report Content</h3>
          <p>This is where your charts, tables, and data visualizations go.</p>
        </div>
      )}
    </Reports>
  );
};

export default MyReport;
```

### 2. Create the CSS File

Create `MyReport.css` with your custom styling:

```css
.my-report-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Add your custom styles here */
```

### 3. Register the Report

Update `index.js` to include your new report:

```javascript
// Add your import
export { default as MyReport } from './MyReport';

// Add to the reportRegistry
export const reportRegistry = {
  'my-report': {
    id: 'my-report',
    title: 'My Custom Report',
    description: 'Description of what this report shows',
    component: 'MyReport',
    category: 'Sales',
    icon: 'FiBarChart2', // Choose from available icons
    frequency: 'Monthly',
    tags: ['sales', 'custom'],
    isActive: true,
    version: '1.0'
  },
  // ... existing reports
};
```

### 4. Update ProductionReports Component Map

In `ProductionReports.js`, add your component to the `componentMap`:

```javascript
const componentMap = {
  'RefReport': RefReport,
  'MyReport': MyReport  // Add this line
};
```

That's it! Your report will now appear in the Production Reports page.

## Available Icons

The system supports these icon names in the registry:
- `FiActivity`
- `FiTrendingUp`
- `FiUsers`
- `FiBarChart2`
- `FiCalendar`
- `FiFolder`

## Report Configuration Options

### reportConfig
- `title`: Display name of the report
- `description`: Brief description shown in cards and headers
- `version`: Version number for tracking
- `category`: Used for filtering (Sales, Referrals, Production, etc.)
- `frequency`: How often the report is generated

### Reports Component Props
- `reportConfig`: Configuration object
- `onBack`: Function to return to reports list
- `title`: Override title
- `description`: Override description
- `actions`: Array of custom action buttons
- `metadata`: Additional metadata to display
- `loading`: Loading state
- `error`: Error message to display
- `onRefresh`: Function to refresh data
- `fullScreenCapable`: Whether to show fullscreen toggle

### Action Button Format
```javascript
{
  label: 'Button Text',
  icon: <FiIcon size={16} />,
  onClick: () => handleAction(),
  variant: 'primary' | 'secondary',
  title: 'Tooltip text',
  disabled: false
}
```

## Best Practices

1. **Consistent Styling**: Use the existing CSS variables for colors and spacing
2. **Loading States**: Always implement loading and error states
3. **Responsive Design**: Make your reports mobile-friendly
4. **Data Refresh**: Implement refresh functionality where appropriate
5. **Export Options**: Provide export functionality for data reports
6. **Accessibility**: Use proper ARIA labels and semantic HTML

## Integration with ProductionReports

Reports created in this system will automatically:
- Appear in the reports grid/list
- Be filterable by category
- Have consistent styling with other reports
- Support the back navigation
- Be searchable by title and description

## Example Use Cases

- **REF Report**: Referral tracking and metrics (already implemented)
- **Sales Report**: Sales performance and pipeline data
- **Production Report**: Production metrics and KPIs
- **Agent Report**: Individual agent performance
- **Commission Report**: Commission calculations and summaries

## Future Enhancements

Potential improvements to consider:
- Report scheduling and automation
- Email/PDF export options
- Real-time data updates
- Report sharing and collaboration
- Dashboard widgets from reports
- Advanced filtering and sorting
- Report templates and builders 