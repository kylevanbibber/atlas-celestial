# Alternative Scorecard Implementation Summary

## Overview
Created a modified scorecard view (`ScorecardAlt.js`) specifically for non-default SGAs (like SURACE-SMITH-PARTNERS) that displays Agency, MGA, and RGA breakdowns on a single page instead of using tabs.

## What Changed

### Files Modified
1. **`frontend/src/components/production/Scorecard/ScorecardAlt.js`** - Completely rewritten
2. **`SCORECARD_VERSIONS_README.md`** - Updated documentation with new layout details

### Files Unchanged (As Requested)
- ✅ `frontend/src/components/production/Scorecard/Scorecard.js` - Default scorecard remains unchanged
- ✅ `frontend/src/components/production/Scorecard/ScorecardTable.js` - Shared component reused as-is
- ✅ `frontend/src/components/production/Scorecard/ScorecardSGAView.js` - Shared component reused as-is

## Key Features of ScorecardAlt

### 1. Three-Section Layout
Instead of tabs, the page shows three distinct sections vertically:

```
┌─────────────────────────────────┐
│  📊 Agency Overview              │
│  ─────────────────────────────  │
│  [Agency aggregate data]         │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  🏢 MGA Breakdown   [All ▼]      │
│  ─────────────────────────────  │
│  [MGA data with dropdown]        │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  👥 RGA Breakdown   [All ▼]      │
│  ─────────────────────────────  │
│  [RGA data with dropdown]        │
└─────────────────────────────────┘
```

### 2. Independent Dropdowns
- Each MGA and RGA section has its own independent state
- Selecting an agency in one dropdown doesn't affect the other
- State variables: `selectedMGA` and `selectedRGA`

### 3. Conditional Rendering
**For MGA Section:**
- When `selectedMGA === 'All'` → Shows `ScorecardSGAView` (table of all MGAs)
- When `selectedMGA === specific agency` → Shows `ScorecardTable` (detailed view with charts)

**For RGA Section:**
- When `selectedRGA === 'All'` → Shows `ScorecardSGAView` (table of all RGAs)
- When `selectedRGA === specific agency` → Shows `ScorecardTable` (detailed view with charts)

### 4. Responsive Design
- Mobile-friendly with adjusted spacing and font sizes
- Sections stack vertically on all screen sizes
- Includes media queries for tablets and mobile devices

### 5. Styling
Includes inline styles for:
- Section containers with cards and shadows
- Headers with borders
- Responsive breakpoints
- Consistent spacing (30px gap between sections)

## How It Works

### Automatic SGA Detection
The routing in `Production.js` automatically determines which scorecard to show:

```javascript
const { selectedAgency } = useAgency();
const useAltScorecard = selectedAgency && !selectedAgency.is_default;

const renderScorecard = () => useAltScorecard ? <ScorecardAlt /> : <Scorecard />;
```

**Logic:**
- If `is_default === 1` (ARIAS ORGANIZATION) → Use `Scorecard.js` (tabbed layout)
- If `is_default === 0` (SURACE-SMITH-PARTNERS, etc.) → Use `ScorecardAlt.js` (single-page layout)

### Component Reuse Strategy
Rather than duplicating large components, the implementation reuses existing components:

1. **`ScorecardTable`** - Used for both default and alt versions
   - Handles individual agency detail views
   - Shows growth charts and detailed metrics
   - Already supports `activeTab` and `selectedAgency` props

2. **`ScorecardSGAView`** - Used for both default and alt versions
   - Handles "All" views showing multiple agencies
   - Provides dropdown for selecting specific agencies
   - Already supports `activeTab`, `selectedAgency`, and `onSelectAgency` props

3. **No Duplication Needed** - Components were already flexible enough to support both layouts

## Testing the Implementation

### Test Steps

1. **Verify Default Scorecard Still Works:**
   ```
   - Login with ARIAS ORGANIZATION selected
   - Navigate to: Production → Scorecard
   - Verify: Tabs appear (Agency, MGA Breakdown, RGA Breakdown)
   - Verify: Only one section visible at a time
   ```

2. **Test Alternative Scorecard:**
   ```
   - Right-click logo → Select SURACE-SMITH-PARTNERS
   - Navigate to: Production → Scorecard
   - Verify: All three sections visible simultaneously
   - Verify: No tabs present
   ```

3. **Test MGA Dropdown:**
   ```
   - In MGA section, click dropdown
   - Select "All" → Should show table of all MGAs
   - Select specific MGA → Should show detail view with charts
   - Verify: RGA section remains independent
   ```

4. **Test RGA Dropdown:**
   ```
   - In RGA section, click dropdown
   - Select "All" → Should show table of all RGAs
   - Select specific RGA → Should show detail view with charts
   - Verify: MGA section remains independent
   ```

5. **Test Embedded Mode:**
   ```
   - Open: http://localhost:3000/production?section=scorecard&embedded=true
   - Switch to SURACE-SMITH-PARTNERS
   - Verify: Alternative layout shows without header/sidebar
   ```

## User Experience Improvements

### Benefits of Single-Page Layout

1. **Better Overview** - See all data at once without clicking tabs
2. **Easy Comparison** - Compare MGA and RGA performance side-by-side
3. **Less Clicking** - No need to switch between tabs
4. **Independent Analysis** - Drill into different agencies simultaneously
5. **Scrollable** - Natural scroll behavior for large datasets

### When to Use Each Version

**Use Default Scorecard (Tabs) When:**
- Need focused view of one section at a time
- Screen real estate is limited
- User wants minimal scrolling
- Traditional tab-based navigation preferred

**Use Alternative Scorecard (Single-Page) When:**
- Need comprehensive overview of all data
- Comparing multiple sections is important
- Vertical scrolling is acceptable
- Multiple stakeholders viewing simultaneously

## Customization Guide

### Remove a Section

To remove the RGA section entirely:

```javascript
// In ScorecardAlt.js, delete this entire block:
<div className="scorecard-section">
  <div className="scorecard-section-header">
    <h2 className="scorecard-section-title">👥 RGA Breakdown</h2>
  </div>
  <div className="scorecard-section-content">
    {/* ... */}
  </div>
</div>
```

### Change Section Order

Reorder the JSX blocks to change display order:

```javascript
// Show RGA before MGA
<>
  <div className="scorecard-section">{/* Agency */}</div>
  <div className="scorecard-section">{/* RGA */}</div>
  <div className="scorecard-section">{/* MGA */}</div>
</>
```

### Customize Section Titles

```javascript
<h2 className="scorecard-section-title">
  🎯 Custom Title Here
</h2>
```

### Add Horizontal Layout

For side-by-side sections on larger screens:

```css
.scorecard-alt {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 20px;
}
```

### Add Filters or Date Pickers

Add custom controls to section headers:

```javascript
<div className="scorecard-section-header">
  <h2 className="scorecard-section-title">📊 Agency Overview</h2>
  <div>
    <select>{/* Custom filter */}</select>
    <input type="date" />
  </div>
</div>
```

## Technical Details

### Props Flow

**ScorecardAlt → ScorecardTable:**
- `userRole`: User's role (SGA, MGA, RGA)
- `activeTab`: Which view ('agency', 'mga', 'rga')
- `selectedAgency`: Specific agency name or 'All'
- `onSelectAgency`: Callback to update selection

**ScorecardAlt → ScorecardSGAView:**
- `activeTab`: Which view ('mga', 'rga')
- `selectedAgency`: Always 'All' for this view
- `onSelectAgency`: Callback to switch to specific agency

### State Management

```javascript
// Independent state for each breakdown section
const [selectedMGA, setSelectedMGA] = useState('All');
const [selectedRGA, setSelectedRGA] = useState('All');

// Passed to child components as props
onSelectAgency={setSelectedMGA}
onSelectAgency={setSelectedRGA}
```

### Styling Architecture

- Uses inline `<style>` tag for component-specific styles
- Leverages CSS variables for theming: `var(--card-background)`, `var(--text-primary)`
- Mobile-first responsive design with media queries
- Consistent spacing using flexbox gaps

## Performance Considerations

### Potential Issues
1. **Three API Calls:** All sections load data simultaneously
2. **Large Data Sets:** More DOM elements rendered at once
3. **Memory Usage:** Keeping three views in memory

### Optimizations Already in Place
1. **Memoization:** `ScorecardTable` uses `memo()` for re-render optimization
2. **Lazy Loading:** Only selected agency details load when needed
3. **Key Props:** Proper `key` attributes prevent unnecessary re-renders

### Future Optimizations (If Needed)
1. Add lazy loading for sections not in viewport
2. Implement virtual scrolling for large tables
3. Add loading skeletons for better perceived performance
4. Cache API responses to avoid redundant calls

## Database Dependencies

The alternative scorecard relies on:

1. **`sgas` table:** For agency list and `is_default` flag
2. **`sga_page_permissions` table:** For page access control
3. **`user_agencies` table:** For user-agency associations
4. **Production data tables:** For scorecard metrics

## Troubleshooting

### Issue: Alternative layout not showing

**Check:**
1. Verify `is_default = 0` for the SGA in database
2. Ensure agency is properly selected in AgencyContext
3. Clear browser cache (Ctrl+Shift+R)
4. Check console for JavaScript errors

### Issue: Dropdowns not working

**Check:**
1. Verify `onSelectAgency` prop is passed correctly
2. Check state updates in React DevTools
3. Ensure `ScorecardSGAView` is rendering (shows dropdown)
4. Look for console errors related to state updates

### Issue: Data not loading in a section

**Check:**
1. Network tab for failed API calls
2. Backend logs for errors
3. User permissions for accessing that data type
4. Console logs from `ScorecardTable` or `ScorecardSGAView`

## Related Files

- **Main Implementation:** `frontend/src/components/production/Scorecard/ScorecardAlt.js`
- **Routing Logic:** `frontend/src/pages/Production.js`
- **Agency Context:** `frontend/src/context/AgencyContext.js`
- **Shared Components:** 
  - `frontend/src/components/production/Scorecard/ScorecardTable.js`
  - `frontend/src/components/production/Scorecard/ScorecardSGAView.js`
- **Styles:** `frontend/src/components/production/Scorecard/Scorecard.css`
- **Documentation:** `SCORECARD_VERSIONS_README.md`

## Future Enhancements

Potential features to consider:

1. **Collapsible Sections:** Add expand/collapse functionality
2. **Drag-to-Reorder:** Let users customize section order
3. **Export All:** Single button to export all three sections
4. **Print Layout:** Optimized view for printing all sections
5. **Section Toggles:** Show/hide sections based on user preference
6. **Comparison Mode:** Side-by-side comparison of multiple agencies
7. **Dashboard Widgets:** Extract sections as reusable dashboard widgets

## Support

For questions or issues:
1. Check `SCORECARD_VERSIONS_README.md` for general information
2. Review this document for implementation details
3. Check console logs for debugging information
4. Contact development team for assistance

---

**Implementation Date:** January 24, 2026  
**Version:** 1.0  
**Status:** ✅ Complete and Ready for Use

