# Scorecard Versions Documentation

## Overview

The Atlas application now supports **multiple versions** of the Scorecard component to accommodate different SGA (Super General Agency) requirements.

## File Structure

```
frontend/src/components/production/Scorecard/
├── Scorecard.js          // Default scorecard for ARIAS ORGANIZATION
├── ScorecardAlt.js       // Alternative scorecard for other SGAs
├── ScorecardTable.js     // Shared table component
├── ScorecardSGAView.js   // Shared SGA view component
└── Scorecard.css         // Shared styles
```

## How It Works

### 1. Default Scorecard (`Scorecard.js`)

- **Used by:** ARIAS ORGANIZATION (default SGA with `is_default = 1`)
- **Location:** `/frontend/src/components/production/Scorecard/Scorecard.js`
- **Purpose:** This is the original, full-featured scorecard
- **IMPORTANT:** ⚠️ **DO NOT MODIFY** this file for other SGAs. Keep it exactly as is for the default agency.

### 2. Alternative Scorecard (`ScorecardAlt.js`)

- **Used by:** All other SGAs (e.g., SURACE-SMITH-PARTNERS)
- **Location:** `/frontend/src/components/production/Scorecard/ScorecardAlt.js`
- **Purpose:** Customizable version for agencies with different requirements
- **Layout:** Shows Agency, MGA Breakdown, and RGA Breakdown all on ONE PAGE (no tabs)
- **Features:**
  - Three sections displayed simultaneously vertically
  - Each section has independent dropdown for selecting specific agencies
  - Agency Overview shows aggregate data
  - MGA/RGA sections can toggle between "All" view and specific agency view
- **Customization:** You can safely modify this file to add/remove features for other SGAs

### 3. Conditional Rendering

The `Production.js` page component automatically selects the appropriate scorecard based on the currently selected SGA:

```javascript
// In Production.js
const { selectedAgency } = useAgency();
const useAltScorecard = selectedAgency && !selectedAgency.is_default;

const renderScorecard = () => useAltScorecard ? <ScorecardAlt /> : <Scorecard />;
```

**Logic:**
- If `selectedAgency.is_default === true` → Use `Scorecard.js`
- If `selectedAgency.is_default === false` → Use `ScorecardAlt.js`

## Visual Comparison

### Default Scorecard Layout (Scorecard.js)
```
┌─────────────────────────────────────────┐
│  [Agency] [MGA Breakdown] [RGA Breakdown] │  ← Tabs
├─────────────────────────────────────────┤
│                                         │
│        Selected Tab Content             │
│        (Only one visible at a time)     │
│                                         │
└─────────────────────────────────────────┘
```

### Alternative Scorecard Layout (ScorecardAlt.js)
```
┌─────────────────────────────────────────┐
│  📊 Agency Overview                      │
│  ────────────────────────────────────   │
│  [Agency data table/charts]             │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  🏢 MGA Breakdown     [All ▼]            │
│  ────────────────────────────────────   │
│  [MGA data table/charts or dropdown]    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  👥 RGA Breakdown     [All ▼]            │
│  ────────────────────────────────────   │
│  [RGA data table/charts or dropdown]    │
└─────────────────────────────────────────┘
```

## Usage Scenarios

### Viewing Default Scorecard (ARIAS ORGANIZATION)
1. User logs in or selects ARIAS ORGANIZATION as their agency
2. Navigate to Production → Scorecard
3. `Scorecard.js` is rendered with full functionality

### Viewing Alternative Scorecard (Other SGAs)
1. User right-clicks logo and switches to SURACE-SMITH-PARTNERS (or another SGA)
2. Navigate to Production → Scorecard
3. `ScorecardAlt.js` is rendered with all three sections visible:
   - **Agency Overview:** Shows aggregate agency data (always visible)
   - **MGA Breakdown:** Shows all MGAs or specific MGA based on dropdown selection
   - **RGA Breakdown:** Shows all RGAs or specific RGA based on dropdown selection
4. User can independently select different agencies in each breakdown section using dropdowns
5. Selecting a specific MGA/RGA shows detailed growth charts and data for that agency
6. Selecting "All" shows the overview table with all MGAs/RGAs listed

## Embedded Mode Support

Both scorecard versions support embedded mode for integration with external applications (e.g., PHP apps):

**URL Examples:**
```
http://localhost:3000/production?section=scorecard&embedded=true
http://localhost:3000/production?section=scorecard&embedded=true&mode=iframe
http://localhost:3000/production?section=scorecard&embedded=true&mode=popup
```

The conditional rendering still applies in embedded mode, so the correct scorecard version is shown based on the selected SGA.

## Testing the Implementation

### Test Plan

1. **Test Default Scorecard:**
   ```
   - Login as user with ARIAS ORGANIZATION selected
   - Navigate to: /production?section=scorecard
   - Verify: Default scorecard appears with all tabs (Agency, MGA Breakdown, RGA Breakdown)
   ```

2. **Test Alternative Scorecard:**
   ```
   - Login as user ID 92 (or any user with multiple agencies)
   - Right-click the logo in header
   - Select: SURACE-SMITH-PARTNERS
   - Navigate to: /production?section=scorecard
   - Verify: Alternative scorecard appears (currently identical, but separate file)
   ```

3. **Test Embedded Mode:**
   ```
   - Open: http://localhost:3000/test-embedded.html
   - Click through different tabs
   - Verify: Correct scorecard version shows based on selected agency
   ```

## Making Customizations

### To Customize the Alternative Scorecard:

1. **Open:** `frontend/src/components/production/Scorecard/ScorecardAlt.js`

2. **Example Modifications:**
   - Remove sections (e.g., remove MGA or RGA sections entirely)
   - Reorder sections (e.g., show RGA before MGA)
   - Change section titles or icons
   - Add custom filters or date ranges
   - Modify displayed columns or metrics
   - Add SGA-specific branding
   - Change section styling (background colors, borders, etc.)

3. **Example: Show Only Agency and MGA Sections:**

```javascript
// In ScorecardAlt.js - Remove RGA section
const ScorecardAlt = () => {
  const { user } = useAuth();
  const userRole = user?.clname?.toUpperCase() || 'SGA';
  const [selectedMGA, setSelectedMGA] = useState('All');
  
  return (
    <div className="scorecard scorecard-alt">
      {/* Agency Section */}
      <div className="scorecard-section">
        <div className="scorecard-section-header">
          <h2 className="scorecard-section-title">📊 Agency Overview</h2>
        </div>
        <div className="scorecard-section-content">
          <ScorecardTable userRole={userRole} activeTab="agency" />
        </div>
      </div>
      
      {/* MGA Breakdown Section - RGA section removed */}
      <div className="scorecard-section">
        <div className="scorecard-section-header">
          <h2 className="scorecard-section-title">🏢 MGA Breakdown</h2>
        </div>
        <div className="scorecard-section-content">
          {selectedMGA !== 'All' ? (
            <ScorecardTable 
              userRole={userRole} 
              activeTab="mga"
              selectedAgency={selectedMGA}
              onSelectAgency={setSelectedMGA}
            />
          ) : (
            <ScorecardSGAView 
              activeTab="mga"
              selectedAgency={selectedMGA}
              onSelectAgency={setSelectedMGA}
            />
          )}
        </div>
      </div>
    </div>
  );
};
```

4. **Example: Horizontal Layout Instead of Vertical:**

```javascript
// Add this to the style section in ScorecardAlt.js
.scorecard-alt {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.scorecard-section {
  min-height: 600px;
}
```

## Database Schema Reference

The scorecard version selection is based on the `sgas` table:

```sql
CREATE TABLE sgas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rept_name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  active TINYINT(1) DEFAULT 1,
  hide TINYINT(1) DEFAULT 0,
  is_default TINYINT(1) DEFAULT 0,  -- Key field for scorecard selection
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Important:** Only ONE SGA should have `is_default = 1` (typically ARIAS ORGANIZATION).

## Related Files

- **Context:** `frontend/src/context/AgencyContext.js` - Manages selected agency state
- **Routing:** `frontend/src/pages/Production.js` - Handles scorecard version routing
- **Navigation:** `frontend/src/components/utils/Header.js` - Agency switching menu
- **Backend API:** `backend/routes/sgas.js` - SGA data endpoints

## Troubleshooting

### Issue: Wrong scorecard version is showing

**Check:**
1. Verify the selected agency in AgencyContext
2. Check `is_default` value in database:
   ```sql
   SELECT id, rept_name, is_default FROM sgas;
   ```
3. Ensure only one SGA has `is_default = 1`
4. Clear browser cache and hard refresh (Ctrl+Shift+R)

### Issue: Changes not appearing

**Solution:**
1. Make sure you're editing the correct file (`Scorecard.js` vs `ScorecardAlt.js`)
2. Check which agency is currently selected
3. Restart the development server if needed

## Best Practices

1. ✅ **DO:** Keep `Scorecard.js` unchanged for the default SGA
2. ✅ **DO:** Make all customizations in `ScorecardAlt.js`
3. ✅ **DO:** Test both versions after making changes
4. ✅ **DO:** Document any significant customizations in code comments
5. ❌ **DON'T:** Delete or rename the original `Scorecard.js`
6. ❌ **DON'T:** Hardcode SGA names in conditional logic (use `is_default` flag)

## Future Enhancements

Potential improvements to consider:

1. **Multiple Alternative Versions:** Create `ScorecardAlt2.js`, `ScorecardAlt3.js`, etc., for different SGA categories
2. **Configuration-Based:** Store scorecard feature flags in the database per SGA
3. **Component Library:** Extract common scorecard components for easier reuse
4. **A/B Testing:** Show different versions to different user groups for testing

## Support

For questions or issues with scorecard versions, contact the development team or refer to the main Atlas documentation.

---

**Last Updated:** January 22, 2026  
**Version:** 1.0  
**Maintainer:** Atlas Development Team

