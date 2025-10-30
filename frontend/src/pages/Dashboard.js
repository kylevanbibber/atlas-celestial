/**
 * Refactored Dashboard Page
 * 
 * Routes users to the appropriate dashboard based on their role:
 * - SGA: Uses UnifiedDashboard (original dashboard with all cards)
 * - AGT, SA, GA, MGA, RGA: Uses TeamDashboard (simplified dashboard with competitions and widgets)
 */

import React from "react";
import { useAuth } from "../context/AuthContext";
import UnifiedDashboard from "../components/dashboard/UnifiedDashboard";
import TeamDashboard from "../components/dashboard/TeamDashboard";

const Dashboard = () => {
  const { user } = useAuth();

  // Get current user's clname for role-based rendering
  const userRole = user?.clname;

  console.log(`🔍 [Dashboard] Rendering dashboard for user role: ${userRole}`);

  // If no user or role, show error state
  if (!user) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="error-message">
            <h3>Authentication Error</h3>
            <p>Unable to load user data. Please refresh the page or contact support.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="error-message">
            <h3>Access Error</h3>
            <p>User role not found. Please contact support.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user.lagnname) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="error-message">
            <h3>Configuration Error</h3>
            <p>User agency name not found. Please contact support.</p>
          </div>
        </div>
      </div>
    );
  }

  // Route to appropriate dashboard based on user role
  if (userRole === 'SGA') {
    // SGA users get the UnifiedDashboard
    return <UnifiedDashboard userRole={userRole} user={user} />;
  } else {
    // AGT, SA, GA, MGA, RGA users get the simplified TeamDashboard
    return <TeamDashboard userRole={userRole} user={user} />;
  }
};

export default Dashboard;