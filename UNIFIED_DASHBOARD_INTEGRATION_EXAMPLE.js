// Example integration for UnifiedDashboard.js
// Add this import at the top with other imports:
import CompetitionsDisplay from '../competitions/CompetitionsDisplay';

// Then in the UnifiedDashboard component, add this right after the opening div:
// This would go around line 220-230 after the <div className="dashboard-container">

const UnifiedDashboard = ({ userRole, user }) => {
  // ... existing state and logic ...

  return (
    <div className="dashboard-container">
      {/* Add competitions at the very top */}
      <CompetitionsDisplay 
        user={user} 
        className="dashboard-competitions"
      />
      
      {/* Rest of existing dashboard content */}
      <div className="dashboard-header">
        {/* ... existing header content ... */}
      </div>
      
      {/* ... rest of existing dashboard ... */}
    </div>
  );
};
