# Competition System Integration Guide

## Overview
The competition system provides a comprehensive solution for creating and displaying competitions with user progress tracking. This guide shows how to integrate the competitions into existing pages.

## Components

### CompetitionBanner
The main display component for competitions that shows:
- Contest title and description
- Prize information
- Rules
- User progress (if participating)
- Competition status and dates

### CompetitionsDisplay
A container component that fetches and displays all active competitions for a user.

## Integration Examples

### 1. Dashboard Integration

Add to your dashboard components to show competitions at the top:

```javascript
// In your dashboard component (e.g., UnifiedDashboard.js)
import CompetitionsDisplay from '../components/competitions/CompetitionsDisplay';

const YourDashboard = ({ user }) => {
  return (
    <div className="dashboard">
      {/* Show competitions at the top */}
      <CompetitionsDisplay 
        user={user} 
        className="dashboard-competitions"
      />
      
      {/* Rest of your dashboard content */}
      <div className="dashboard-content">
        {/* Your existing dashboard sections */}
      </div>
    </div>
  );
};
```

### 2. Individual Page Integration

Add to specific pages where competitions are relevant:

```javascript
// In pages like ProductionGoals.js or any other page
import CompetitionBanner from '../components/competitions/CompetitionBanner';
import { useCompetitions } from '../hooks/useCompetitions';

const YourPage = ({ user }) => {
  const { competitions, loading } = useCompetitions({
    activeOnly: true,
    userCompetitions: true
  });

  return (
    <div className="page-container">
      {/* Show relevant competitions */}
      {competitions.filter(comp => comp.metric_type === 'alp').map(competition => (
        <CompetitionBanner
          key={competition.id}
          competition={competition}
          userProgress={competition.user_participation}
        />
      ))}
      
      {/* Your page content */}
      <div className="page-content">
        {/* Your existing page content */}
      </div>
    </div>
  );
};
```

### 3. Layout Component Integration

Add to a layout component to show competitions globally:

```javascript
// In your main layout component
import CompetitionsDisplay from '../components/competitions/CompetitionsDisplay';

const Layout = ({ user, children }) => {
  return (
    <div className="app-layout">
      <Header />
      
      {/* Global competitions display */}
      <CompetitionsDisplay 
        user={user}
        className="global-competitions"
      />
      
      <main className="main-content">
        {children}
      </main>
      
      <Footer />
    </div>
  );
};
```

## Usage Patterns

### Basic Competition Display
```javascript
import CompetitionBanner from '../components/competitions/CompetitionBanner';

<CompetitionBanner
  competition={competitionData}
  userProgress={userProgressData}
  expandable={true}
  defaultExpanded={false}
/>
```

### Fetch User's Active Competitions
```javascript
import { useUserActiveCompetitions } from '../hooks/useCompetitions';

const { competitions, loading, error } = useUserActiveCompetitions(user.id);
```

### Join/Leave Competitions
```javascript
import { useCompetitions } from '../hooks/useCompetitions';

const { joinCompetition, leaveCompetition } = useCompetitions();

const handleJoin = async (competitionId) => {
  const result = await joinCompetition(competitionId);
  if (result.success) {
    console.log('Successfully joined competition');
  } else {
    console.error('Failed to join:', result.error);
  }
};
```

## Database Migration

Run the migration to create the necessary tables:

```bash
# The migration file is located at:
# backend/migrations/20250203_create_competitions_table.js

# Add it to your migration runner or run manually
```

## API Endpoints

The following endpoints are available:

- `GET /api/competitions` - Get all competitions
- `GET /api/competitions/:id` - Get specific competition
- `POST /api/competitions` - Create competition (admin)
- `PUT /api/competitions/:id` - Update competition (admin)
- `POST /api/competitions/:id/join` - Join competition
- `DELETE /api/competitions/:id/leave` - Leave competition
- `GET /api/competitions/:id/leaderboard` - Get leaderboard
- `POST /api/competitions/:id/update-progress` - Update progress
- `GET /api/competitions/user/:userId/active` - Get user's active competitions

## Styling

The CompetitionBanner component uses CSS custom properties that should align with your existing theme:

- `--background-primary`
- `--background-secondary`
- `--text-primary`
- `--text-secondary`
- `--border-color`
- `--primary-color`
- `--success-color`
- `--warning-color`
- `--error-color`

## Competition Types

The system supports:

### Metric Types
- `alp` - ALP (Annual Life Premium)
- `calls` - Phone calls
- `appointments` - Appointments set
- `sales` - Sales made
- `codes` - Code submissions
- `hires` - New hires
- `refs` - Referrals
- `custom` - Custom metrics

### Competition Types
- `individual` - Individual competition
- `team` - Team-based competition
- `group` - Group competition

### Status Types
- `draft` - Not yet active
- `active` - Currently running
- `completed` - Finished with results
- `cancelled` - Cancelled competition

## Best Practices

1. **Performance**: Use `useUserActiveCompetitions` for dashboard/global displays
2. **Filtering**: Use competition filters to show relevant competitions per page
3. **Responsive**: The component is fully responsive and works on mobile
4. **Expandable**: Set `expandable={false}` for always-expanded display
5. **Error Handling**: Always handle loading and error states
6. **User Permissions**: Check user permissions before showing admin features
