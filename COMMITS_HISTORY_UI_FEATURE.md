# Commits History UI Feature

## Overview
Users can now view the complete history of commitment changes directly in the OneOnOne interface. A history button with a clock icon appears next to each metric (Hires, Codes, VIPs) when there are multiple entries for that month.

## UI Components

### History Button
- **Appearance**: Small button with clock icon and count badge
- **Location**: Next to the metric label (e.g., "Hires (MTD)")
- **Visibility**: Only shows when `history.length > 1`
- **Badge**: Shows the number of historical entries

**Example:**
```
Hires (MTD) [🕐 3]
```

### History Modal
- **Trigger**: Click the history button
- **Design**: Centered modal overlay with white background
- **Features**:
  - Timeline view of all changes
  - Most recent entry highlighted as "CURRENT"
  - Shows change delta (+/- from previous)
  - Displays timestamp and user info
  - Scrollable for long histories

## Modal Layout

### Header
- Title: "{Type} Commitment History" (e.g., "Hires Commitment History")
- Close button (×) in top-right
- Entry count: "X total entries"

### Timeline Entries
Each entry shows:
1. **Amount**: Large, bold number
2. **Change Delta**: (+5) or (-3) in green/red
3. **Timestamp**: "Oct 20, 2025, 2:30 PM"
4. **User Info**: Name and role (lagnname • clname)

### Current Entry Styling
- Blue border (2px solid)
- Light blue background (#f0f8ff)
- "CURRENT" badge in top-right corner

### Historical Entries Styling
- Gray border (1px solid #ddd)
- White background
- Chronological order (newest first)

## Example Modal Content

```
╔══════════════════════════════════════════════════════╗
║  Hires Commitment History                         × ║
╠══════════════════════════════════════════════════════╣
║  3 total entries                                     ║
║                                                      ║
║  ┌────────────────────────────────────────────────┐ ║
║  │  20  (+5)                    Oct 20, 2025, 2:30 PM│ ║
║  │  KOZEJ SPENCER G • RGA                         │ ║
║  │                                      [CURRENT]  │ ║
║  └────────────────────────────────────────────────┘ ║
║                                                      ║
║  ┌────────────────────────────────────────────────┐ ║
║  │  15  (+5)                    Oct 10, 2025, 9:15 AM│ ║
║  │  KOZEJ SPENCER G • RGA                         │ ║
║  └────────────────────────────────────────────────┘ ║
║                                                      ║
║  ┌────────────────────────────────────────────────┐ ║
║  │  10                          Oct 1, 2025, 8:00 AM│ ║
║  │  KOZEJ SPENCER G • RGA                         │ ║
║  └────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════╝
```

## User Flow

### Viewing History
1. User navigates to OneOnOne page
2. Switches to appropriate view (MGA/RGA for RGA users)
3. Sees Org Metrics card with Hires, Codes, VIPs
4. If any metric has multiple entries, a history button appears
5. User clicks history button
6. Modal opens showing full timeline
7. User reviews changes
8. User clicks X or outside modal to close

### Setting New Commitment
1. User clicks "Edit Commit" or "Set Commit"
2. Enters new value
3. Clicks "Save"
4. New entry is created in database
5. History button appears (if it wasn't already visible)
6. Badge count increments
7. User can immediately view history to see the new entry

## State Management

### Frontend State
```javascript
const [commits, setCommits] = useState({ hires: null, codes: null, vips: null });
const [commitHistory, setCommitHistory] = useState({ hires: [], codes: [], vips: [] });
const [showHistoryModal, setShowHistoryModal] = useState(false);
const [historyModalType, setHistoryModalType] = useState(null);
```

### Data Flow
1. **Fetch**: `fetchCommits()` retrieves all commits for the month
2. **Filter**: For RGA users, filters by clname (MGA or RGA)
3. **Sort**: Sorts by `created_at` descending (newest first)
4. **Store**: 
   - Current commit: Most recent entry for each type
   - History: All entries for each type
5. **Display**: 
   - Shows current commit value
   - Shows history button if `history.length > 1`

## Code Structure

### History Button Component
```jsx
{hasHistory && (
  <button onClick={() => { setHistoryModalType(type); setShowHistoryModal(true); }}>
    <svg><!-- Clock icon --></svg>
    {history.length}
  </button>
)}
```

### History Modal Component
```jsx
{showHistoryModal && historyModalType && (
  <div className="modal-overlay" onClick={closeModal}>
    <div className="modal-content" onClick={stopPropagation}>
      <Header />
      <Timeline entries={commitHistory[historyModalType]} />
    </div>
  </div>
)}
```

## Styling

### History Button
- Transparent background
- Blue border and text
- Small padding (2px 6px)
- Flex layout with gap for icon and count
- Hover effect (optional, can add)

### Modal Overlay
- Fixed position covering viewport
- Semi-transparent black background (rgba(0, 0, 0, 0.5))
- Centered flex layout
- z-index: 9999

### Modal Content
- White background
- Rounded corners (8px)
- Box shadow for depth
- Max width: 600px
- Max height: 80vh
- Scrollable overflow

### Timeline Entries
- Padding: 1rem
- Border radius: 6px
- Flex layout for content
- Gap between entries: 1rem

## Features

### Change Indicators
- **Positive**: Green color (#28a745) with + prefix
- **Negative**: Red color (#dc3545) with - prefix
- **No change**: Gray color (#666)

### Timestamp Formatting
```javascript
new Date(entry.created_at).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
})
```

Output: "Oct 20, 2025, 2:30 PM"

### User Info Display
```
{entry.lagnname} • {entry.clname}
```

Example: "KOZEJ SPENCER G • RGA"

## Accessibility

### Keyboard Support
- Modal closes on Escape key (can be added)
- Focus trap within modal (can be added)

### Screen Readers
- Add `aria-label` to history button: "View commitment history"
- Add `role="dialog"` to modal
- Add `aria-labelledby` for modal title

### Visual Indicators
- Clear "CURRENT" badge for latest entry
- Color-coded change indicators
- Sufficient contrast ratios

## Performance Considerations

### Data Loading
- History data is fetched once with commits
- No additional API calls needed for modal
- Filtered and sorted on frontend

### Rendering
- Modal only renders when `showHistoryModal === true`
- Uses `map()` for efficient list rendering
- Keys use unique `entry.id`

### Memory
- History arrays stored in state
- Cleared when component unmounts
- Minimal memory footprint (typically < 10 entries)

## Future Enhancements

### Potential Features
1. **Export History**: Download as CSV or PDF
2. **Filter by Date Range**: Show only specific time period
3. **Search**: Find specific commitment values
4. **Compare**: Side-by-side comparison of two entries
5. **Annotations**: Add notes to explain why commitment changed
6. **Notifications**: Alert when someone changes your commitment
7. **Rollback**: Revert to previous commitment value
8. **Audit Trail**: Show who made changes (especially for impersonation)

### Example: Rollback Feature
```jsx
<button onClick={() => rollbackToCommit(entry.id)}>
  Restore this value
</button>
```

## Testing Checklist

- [ ] History button appears when there are 2+ entries
- [ ] History button shows correct count
- [ ] Clicking button opens modal
- [ ] Modal shows all entries in chronological order
- [ ] Current entry is highlighted
- [ ] Change deltas are calculated correctly
- [ ] Timestamps are formatted properly
- [ ] User info is displayed
- [ ] Clicking X closes modal
- [ ] Clicking outside modal closes it
- [ ] Modal scrolls for long histories
- [ ] Works for all three types (Hires, Codes, VIPs)
- [ ] Works for both MGA and RGA views
- [ ] History button disappears when only 1 entry exists

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

All modern browsers support the required features:
- Flexbox
- Fixed positioning
- SVG
- Date.toLocaleString()

## Summary

✅ **Visual Indicator**: Clock icon with count badge  
✅ **Easy Access**: One click to view history  
✅ **Clear Timeline**: Chronological display of changes  
✅ **Change Tracking**: Shows increases/decreases  
✅ **User Context**: Displays who made each change  
✅ **Current Highlight**: Clearly marks active commitment  
✅ **Responsive**: Works on all screen sizes  
✅ **No Extra API Calls**: Uses existing data  


