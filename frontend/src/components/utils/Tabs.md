# Tabs Component Documentation

A flexible, reusable tabs component that supports multiple style sets and configurations.

## Usage

### Basic Usage

```jsx
import Tabs from '../utils/Tabs';

const MyComponent = () => {
  const [activeTab, setActiveTab] = useState('tab1');

  const tabs = [
    { key: 'tab1', label: 'First Tab' },
    { key: 'tab2', label: 'Second Tab' },
    { key: 'tab3', label: 'Third Tab' }
  ];

  return (
    <Tabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'tab1' && <div>First tab content</div>}
      {activeTab === 'tab2' && <div>Second tab content</div>}
      {activeTab === 'tab3' && <div>Third tab content</div>}
    </Tabs>
  );
};
```

### Advanced Usage with Icons and Badges

```jsx
const tabs = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    badge: 3
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️'
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: '📈',
    badge: 12
  },
  {
    key: 'disabled',
    label: 'Disabled',
    icon: '🚫',
    disabled: true
  }
];
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | Array | Required | Array of tab objects (see Tab Object structure below) |
| `activeTab` | String | undefined | Currently active tab key (for controlled component) |
| `defaultActiveTab` | String | tabs[0].key | Initial active tab (for uncontrolled component) |
| `onTabChange` | Function | undefined | Callback function called when tab changes |
| `styleSet` | String | 'default' | Style theme to use ('default', 'modern', 'minimal', 'pills') |
| `className` | String | '' | Additional CSS classes |
| `children` | ReactNode | undefined | Content to display in the tab content area |

### Tab Object Structure

```jsx
{
  key: string,        // Required: Unique identifier for the tab
  label: string,      // Required: Display text for the tab
  icon: ReactNode,    // Optional: Icon to display before the label
  badge: number,      // Optional: Badge number to display after the label
  disabled: boolean   // Optional: Whether the tab is disabled
}
```

## Style Sets

### Default (`styleSet="default"`)
- Traditional tab appearance with borders and background colors
- Active tab has a bottom border highlight
- Best for data-heavy interfaces like tables

### Modern (`styleSet="modern"`)
- Clean, contemporary look with subtle shadows
- Active tab appears elevated above the others
- Good for modern applications

### Minimal (`styleSet="minimal"`)
- Simple underline style with minimal visual elements
- Active tab shows colored underline
- Perfect for content-focused interfaces

### Pills (`styleSet="pills"`)
- Rounded button-style tabs
- Active tab has a different background color
- Great for navigation and settings panels

## Examples

### Controlled Component
```jsx
const [activeTab, setActiveTab] = useState('tab1');

<Tabs
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  styleSet="modern"
>
  {/* Your content based on activeTab */}
</Tabs>
```

### Uncontrolled Component
```jsx
<Tabs
  tabs={tabs}
  defaultActiveTab="tab2"
  styleSet="pills"
  onTabChange={(tabKey) => console.log('Tab changed to:', tabKey)}
>
  {/* Your content */}
</Tabs>
```

### With Custom Styling
```jsx
<Tabs
  tabs={tabs}
  styleSet="minimal"
  className="my-custom-tabs"
>
  {/* Your content */}
</Tabs>
```

## Responsive Design

The component includes responsive breakpoints:
- On mobile devices (≤768px), tabs adapt to smaller screens
- Tab buttons adjust their padding and font sizes
- Some styles may stack vertically on very small screens

## CSS Custom Properties

The component uses CSS custom properties for theming:
- `--sidebar-bg`: Background color for tab containers
- `--card-bg`: Background color for content areas
- `--text-primary`: Primary text color
- `--text-secondary`: Secondary text color
- `--border-color`: Border color
- `--hover-color`: Accent color for highlights
- `--sidebar-hover`: Hover background color

## Accessibility

- Proper ARIA attributes for screen readers
- Keyboard navigation support
- Disabled states properly handled
- Focus indicators for keyboard users

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills for modern CSS features)
- Mobile browsers (iOS Safari, Chrome Mobile) 