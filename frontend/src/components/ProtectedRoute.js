// src/components/ProtectedRoute.js
import React, { useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// Import routePermissions directly to avoid require() inside component function
import { routePermissions } from '../context/permissionsConfig';
import { logRedirect, logAccessDenied } from '../utils/navigationLogger';

/**
 * ProtectedRoute component to guard routes based on authentication and permissions
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Child components to render if access is granted
 * @param {string} [props.requiredPermission] Optional permission required to access the route
 * @returns {React.ReactNode} Route component
 */
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user, loading, isAuthenticated, hasPermission } = useAuth();
  const location = useLocation();

  // Enhanced logging for route monitoring
  console.log(`[Route] Accessing: ${location.pathname}${location.search || ''}`, {
    isAuthenticated,
    requiredPermission,
    routePermission: routePermissions[location.pathname],
    userRole: user?.Role || 'unknown',
    loading
  });

  // Show loading state
  if (loading) {
    console.log(`[Route] Loading auth state for: ${location.pathname}`);
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log(`[Route] User not authenticated, redirecting from: ${location.pathname} to /login`);
    // Store the current path for redirection after login
    localStorage.setItem('intendedPath', location.pathname + (location.search || ''));
    
    // Log the redirect event
    logRedirect(
      location.pathname, 
      '/login', 
      'User not authenticated',
      { userId: user?.userId }
    );
    
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Check for explicit permission passed as prop (takes precedence)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.log(`[Route] Access denied to ${location.pathname}: missing required permission '${requiredPermission}'`, {
      userRole: user?.Role,
      userId: user?.userId
    });
    
    // Log the access denied event
    logAccessDenied(
      location.pathname,
      `Missing required permission: ${requiredPermission}`,
      {
        userRole: user?.Role,
        userId: user?.userId,
        requiredPermission
      }
    );
    
    return (
      <div className="unauthorized-message" role="alert">
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
        <p><small>Required permission: {requiredPermission}</small></p>
        <button 
          className="primary-button" 
          onClick={() => window.history.back()}
          aria-label="Go back to previous page"
        >
          Go Back
        </button>
      </div>
    );
  }
  
  // If no explicit permission was provided, check route-based permission
  const routePermission = routePermissions[location.pathname];
  if (routePermission && !hasPermission(routePermission)) {
    console.log(`[Route] Access denied to ${location.pathname}: missing route permission '${routePermission}'`, {
      userRole: user?.Role,
      userId: user?.userId
    });
    
    // Log the access denied event
    logAccessDenied(
      location.pathname,
      `Missing route permission: ${routePermission}`,
      {
        userRole: user?.Role,
        userId: user?.userId,
        routePermission
      }
    );
    
    return (
      <div className="unauthorized-message" role="alert">
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
        <p><small>Required permission: {routePermission}</small></p>
        <button 
          className="primary-button" 
          onClick={() => window.history.back()}
          aria-label="Go back to previous page"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Log successful access
  console.log(`[Route] Access granted to ${location.pathname}`, {
    userRole: user?.Role,
    userId: user?.userId
  });

  // Render the protected content
  return children;
};

export default ProtectedRoute;
