# Team Leaderboard Component

A modern, expandable leaderboard component for the Atlas team dashboard, inspired by the RNT frontend design.

## Features

✅ **Expandable Rows** - Click any agent to see detailed breakdown
✅ **Beautiful Design** - Modern card-based UI with gradient highlights for top 3
✅ **Detailed Breakdowns** - Shows performance by insurance type, carrier, and lead type
✅ **Recent Policies Table** - View the last 5 policies for each agent
✅ **Responsive** - Fully mobile-optimized with stacked layout on small screens
✅ **Dark Mode Support** - Automatically adapts to theme
✅ **Loading States** - Smooth loading animations
✅ **Trophy Icons** - 🏆 🥈 🥉 for top 3 performers

## Files Created

1. **TeamLeaderboard.js** - Main component
2. **TeamLeaderboard.css** - Comprehensive styling with mobile responsiveness
3. **TeamLeaderboardExample.js** - Integration example and instructions

## Component Props

```javascript
<TeamLeaderboard
  agents={[]}              // Array of agent data (required)
  title="Team Performance" // Leaderboard title
  dateRange={{ start: '', end: '' }} // Date range for display
  loading={false}          // Loading state
  onAgentClick={async (agent) => {}} // Handler for fetching details
  showDetails={true}       // Enable expandable rows
  formatCurrency={(val) => ...} // Custom currency formatter
  formatDate={(str) => ...} // Custom date formatter
/>
```

## Agent Data Format

Each agent object should have:

```javascript
{
  id: number | string,           // Unique identifier
  first_name: string,            // Agent's first name
  last_name: string,             // Agent's last name
  email: string,                 // Agent's email (optional)
  team_name: string | null,      // Team/MGA name
  policy_count: number,          // Number of policies
  total_premium: number,         // Total premium (ALP)
  lagnname: string              // For lookups (optional)
}
```

## Detail Data Format

When an agent is clicked, the `onAgentClick` handler should return:

```javascript
{
  total_policies: number,
  total_premium: number,
  average_premium: number,
  by_type: [
    { type: string, premium: number }
  ],
  by_carrier: [
    { carrier: string, premium: number }
  ],
  by_lead: [
    { lead_type: string, premium: number }
  ],
  recent_policies: [
    {
      type: string,
      carrier: string,
      lead_type: string,
      premium: number,
      date: string (ISO format)
    }
  ]
}
```

## Integration with TeamDashboard

See `TeamLeaderboardExample.js` for a complete integration example.

### Quick Start

1. **Import the component:**
```javascript
import TeamLeaderboard from './TeamLeaderboard';
```

2. **Add state:**
```javascript
const [teamLeaderboardData, setTeamLeaderboardData] = useState([]);
const [leaderboardLoading, setLeaderboardLoading] = useState(false);
```

3. **Fetch data:**
```javascript
const fetchTeamLeaderboard = async () => {
  setLeaderboardLoading(true);
  try {
    // Use existing /alp/getweeklyall or similar endpoint
    const response = await api.get('/alp/getweeklyall', {
      params: { startDate, endDate, report: 'MTD Recap' }
    });
    
    // Transform to match agent format
    const agents = response.data.data.map(item => ({
      id: item.userId || item.lagnname,
      first_name: extractFirstName(item.LagnName),
      last_name: extractLastName(item.LagnName),
      email: item.email || '',
      team_name: item.mga || item.rga,
      policy_count: item.policy_count || 0,
      total_premium: parseFloat(item.LVL_1_NET || 0)
    }));
    
    setTeamLeaderboardData(agents);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLeaderboardLoading(false);
  }
};
```

4. **Add to render:**
```javascript
{(['MGA', 'RGA', 'GA', 'SA'].includes(userRole) && viewScope === 'team') && (
  <div style={{ marginTop: '2rem' }}>
    <TeamLeaderboard
      agents={teamLeaderboardData}
      title="Team Performance Leaderboard"
      dateRange={{ start: startDate, end: endDate }}
      loading={leaderboardLoading}
      onAgentClick={handleAgentDetailClick}
      showDetails={true}
    />
  </div>
)}
```

## Data Sources

You can use existing Atlas API endpoints:

- **Weekly Data**: `/api/alp/getweeklyall` - Weekly Recap data
- **Monthly Data**: `/api/alp/getmonthlyall` - Monthly data
- **YTD Data**: `/api/alp/getweeklyall` with `report: 'YTD Recap'`
- **Team Activity**: `/api/dailyActivity/team-summary`

## Styling

The component uses CSS variables for theming:

- `--card-bg` - Card background
- `--text-primary` - Primary text color
- `--text-secondary` - Secondary text color
- `--border-color` - Border colors
- `--primary-color` - Accent color
- `--shadow-color` - Shadow colors

Dark mode is automatically supported through the ThemeContext.

## Mobile Responsiveness

- **Desktop (>1024px)**: Full table layout with all columns
- **Tablet (768-1024px)**: Adjusted spacing and font sizes
- **Mobile (<768px)**: Stacked card layout with labels

## Future Enhancements

Potential improvements:

1. **Real-time Updates** - WebSocket integration for live data
2. **Sorting Options** - Sort by different metrics
3. **Filtering** - Filter by team, date range, etc.
4. **Export** - Export to CSV/PDF
5. **Comparison View** - Compare multiple time periods
6. **Charts** - Add visual charts to detail view
7. **Search** - Search for specific agents
8. **Pagination** - Handle large datasets

## API Endpoint (Optional)

If you want to create a dedicated endpoint, add to `/backend/routes/alp.js`:

```javascript
// GET /api/alp/team-leaderboard
router.get('/team-leaderboard', async (req, res) => {
  try {
    const { startDate, endDate, lagnName, viewMode } = req.query;
    
    // Query Weekly_ALP or Daily_Activity
    // Aggregate by agent
    // Return formatted data
    
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

## Support

For questions or issues, refer to the existing Leaderboard component (`/components/utils/Leaderboard.js`) which has similar patterns.

---

**Created**: January 2025  
**Inspired by**: RNT Frontend Leaderboard Design  
**Compatible with**: Atlas Frontend v2.0+

