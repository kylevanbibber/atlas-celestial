# LoadingSpinner Component Documentation

## Overview
The `LoadingSpinner` component provides a standardized loading animation system for the Atlas frontend. This ensures consistency across all loading states and provides better accessibility support.

## Basic Usage

```jsx
import LoadingSpinner, { 
  ButtonSpinner, 
  PageSpinner, 
  InlineSpinner, 
  OverlaySpinner 
} from '../utils/LoadingSpinner';

// Basic spinner
<LoadingSpinner />

// With custom size and color
<LoadingSpinner size="large" color="primary" />

// With text
<LoadingSpinner size="medium" text="Loading data..." />
```

## Pre-built Components

### 1. ButtonSpinner
Use inside buttons during loading states:
```jsx
<button disabled={isLoading}>
  {isLoading ? <ButtonSpinner /> : 'Save Changes'}
</button>
```

### 2. PageSpinner
Full-screen loading overlay:
```jsx
if (isLoading) {
  return <PageSpinner text="Loading page..." />;
}
```

### 3. InlineSpinner
Small spinner for inline loading states:
```jsx
<div>
  Saving {isSaving && <InlineSpinner />}
</div>
```

### 4. OverlaySpinner
Overlay on top of existing content:
```jsx
<div style={{ position: 'relative' }}>
  <SomeContent />
  {isLoading && <OverlaySpinner text="Processing..." />}
</div>
```

## Props

### LoadingSpinner Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'small' \| 'medium' \| 'large' \| 'xlarge'` | `'medium'` | Size of the spinner |
| `color` | `'primary' \| 'secondary' \| 'muted' \| 'white'` | `'primary'` | Color theme |
| `text` | `string` | `''` | Optional text below spinner |
| `overlay` | `boolean` | `false` | Show as overlay |
| `fullScreen` | `boolean` | `false` | Show as full screen |
| `className` | `string` | `''` | Additional CSS classes |

## Size Reference
- **small**: 14px - For buttons, inline text
- **medium**: 18px - General purpose
- **large**: 24px - Page headers, cards
- **xlarge**: 32px - Full screen loading

## Color Reference
- **primary**: Uses `--accent-color` (blue)
- **secondary**: Uses `--text-secondary` (gray)
- **muted**: Uses `--text-muted` (light gray)
- **white**: Pure white (for dark backgrounds)

## Migration Guide

### Replace Old Patterns

**❌ Old inconsistent patterns:**
```jsx
// Don't do this anymore
<FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
<div className="spinner" />
import './CustomSpinner.css'; // with custom @keyframes
```

**✅ New standardized patterns:**
```jsx
// Use these instead
<InlineSpinner />
<ButtonSpinner />
<PageSpinner text="Loading..." />
```

### Common Migrations

1. **Button Loading States:**
```jsx
// Before
{isLoading ? <FaSpinner className="spinner" /> : 'Save'}

// After  
{isLoading ? <ButtonSpinner /> : 'Save'}
```

2. **Page Loading:**
```jsx
// Before
if (loading) {
  return (
    <div className="loading">
      <FaSpinner style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading...</p>
    </div>
  );
}

// After
if (loading) {
  return <PageSpinner text="Loading..." />;
}
```

3. **Inline Loading:**
```jsx
// Before
<span>
  Saving... <FaSpinner className="spinner" />
</span>

// After
<span>
  Saving... <InlineSpinner />
</span>
```

## Accessibility Features

- **Reduced Motion**: Automatically slows animation for users with `prefers-reduced-motion`
- **High Contrast**: Adjusts colors for high contrast mode
- **Screen Readers**: Proper ARIA labels and semantic structure
- **Focus Management**: Appropriate focus handling for overlay states

## Theme Integration

The LoadingSpinner automatically integrates with the Atlas theme system:
- Uses CSS custom properties for colors
- Supports light/dark mode switching
- Respects user accessibility preferences
- Maintains consistent styling across all themes

## Best Practices

1. **Use the right spinner for the context:**
   - `ButtonSpinner` for buttons
   - `InlineSpinner` for small inline states
   - `PageSpinner` for full page loading
   - `OverlaySpinner` for overlaying content

2. **Always provide meaningful text for longer loading states**

3. **Keep loading text concise and descriptive**

4. **Use overlays sparingly** - prefer replacing content when possible

5. **Test with reduced motion settings** enabled

## Examples

### Form Submission
```jsx
const [isSaving, setIsSaving] = useState(false);

return (
  <form onSubmit={handleSubmit}>
    {/* form content */}
    <button type="submit" disabled={isSaving}>
      {isSaving ? <ButtonSpinner /> : 'Save Changes'}
    </button>
  </form>
);
```

### Data Table Loading
```jsx
const [isLoading, setIsLoading] = useState(true);

if (isLoading) {
  return <PageSpinner text="Loading table data..." />;
}

return <DataTable data={data} />;
```

### Inline Status Updates
```jsx
const [status, setStatus] = useState('idle');

return (
  <div>
    Status: {status} 
    {status === 'saving' && <InlineSpinner />}
  </div>
);
``` 