import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAgency } from '../../context/AgencyContext';

/**
 * ProtectedRoute Component
 * 
 * Wraps routes that require specific SGA page permissions
 * If user doesn't have access, redirects to dashboard
 */
const ProtectedRoute = ({ children, pageKey }) => {
  const { hasPageAccess, loading } = useAgency();

  // While loading, show nothing (or you could show a loading spinner)
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        Loading...
      </div>
    );
  }

  // Check if user has access to this page
  if (!hasPageAccess(pageKey)) {
    // Redirect to dashboard if no access
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;

