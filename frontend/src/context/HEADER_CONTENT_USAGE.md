# Header Content Context - Usage Guide

## Overview

The `HeaderContext` allows any page to inject custom content (like toolbars, date selectors, filters, etc.) into the center of the main application header.

## How to Use

### 1. Import the hook

```javascript
import { useHeader } from '../../context/HeaderContext';
```

### 2. Get the setter function

```javascript
const { setHeaderContent } = useHeader();
```

### 3. Set your custom content in a useEffect

```javascript
useEffect(() => {
  // Set custom header content
  setHeaderContent(
    <YourCustomToolbar
      prop1={value1}
      prop2={value2}
      onChange={handleChange}
    />
  );

  // Clean up when component unmounts
  return () => {
    setHeaderContent(null);
  };
}, [/* your dependencies */]);
```

## Example: Team Dashboard Date Range Selector

See `TeamDashboard.js` for a complete example:

```javascript
import { useHeader } from '../../context/HeaderContext';
import DateRangeSelector from './DateRangeSelector';

const TeamDashboard = () => {
  const { setHeaderContent } = useHeader();
  
  useEffect(() => {
    setHeaderContent(
      <DateRangeSelector
        dateRange={dateRangeState}
        onDateRangeChange={handleDateRangeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        // ... other props
      />
    );

    return () => {
      setHeaderContent(null);
    };
  }, [dateRangeState, viewMode, /* other deps */]);

  return (
    <div>
      {/* Your page content */}
    </div>
  );
};
```

## Best Practices

1. **Always clean up**: Return a cleanup function from your useEffect to clear the header content when the component unmounts.

2. **Include all dependencies**: Make sure your useEffect dependency array includes all values used inside the effect.

3. **Conditional rendering**: You can conditionally set header content based on user role, permissions, or other factors.

4. **Multiple pages**: Each page's header content will automatically replace the previous page's content when navigating.

## Use Cases

- **Date range selectors** (Team Dashboard)
- **Filter toolbars** (Reports, Analytics)
- **Search bars** (Recruiting, Production)
- **View toggles** (Kanban vs List view)
- **Action buttons** (Bulk operations)
- **Custom KPI displays**

## Styling

The header center content area has the following CSS:

```css
.header-center-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 1200px;
  margin: 0 auto;
}
```

Your custom component should work within these constraints. Components are automatically centered horizontally and vertically aligned.
