/**
 * Refactored Dashboard Page
 * 
 * This replaces the 2658-line Dashboard.js with a clean, maintainable implementation
 * that uses configuration-driven components to handle all user roles.
 */

import React from "react";
import { useAuth } from "../context/AuthContext";
import UnifiedDashboard from "../components/dashboard/UnifiedDashboard";

const Dashboard = () => {
  const { user } = useAuth();

  // Get current user's clname for role-based rendering
  const userRole = user?.clname;

  console.log(`🔍 [Dashboard] Rendering dashboard for user role: ${userRole}`);

  // If no user or role, show loading/error state
  if (!user) {
      return (
        <div className="dashboard-container padded-content-sm">
            <div className="dashboard-cards-wrapper">
          <div className="loading-message">Loading user data...</div>
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

  // Render the unified dashboard
  return <UnifiedDashboard userRole={userRole} user={user} />;
};

export default Dashboard;