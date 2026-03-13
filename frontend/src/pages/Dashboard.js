/**
 * Refactored Dashboard Page
 * 
 * Routes users to the appropriate dashboard based on their role:
 * - SGA: Uses UnifiedDashboard (original dashboard with all cards)
 * - AGT, SA, GA, MGA, RGA: Uses TeamDashboard (simplified dashboard with competitions and widgets)
 */

import React from "react";
import { useAuth } from "../context/AuthContext";
import TeamDashboard from "../components/dashboard/TeamDashboard";
import AdminHome from "./AdminHome";

const Dashboard = () => {
  const { user } = useAuth();

  // Get current user's clname for role-based rendering
  const userRole = user?.clname;

  // Check if user is app admin (admins with teamRole='app' don't have clname)
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';

  console.log(`🔍 [Dashboard] Rendering dashboard for user role: ${userRole}`, {
    isAppAdmin,
    Role: user?.Role,
    teamRole: user?.teamRole
  });

  // If no user, show error state
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

  // App admins see the AdminHome component
  if (isAppAdmin) {
    console.log('[Dashboard] App admin detected, rendering AdminHome');
    return <AdminHome />;
  }

  // Regular users need clname
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

  // All roles use TeamDashboard (SGA, MGA, RGA, SA, GA, AGT)
  return <TeamDashboard userRole={userRole} user={user} />;
};

export default Dashboard;