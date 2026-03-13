import React from 'react';
import { useAuth } from "../../context/AuthContext";
import "./PermissionControl.css";

/**
 * PermissionControl Component
 * 
 * Controls rendering of child components based on user permissions with optional locked state
 * 
 * @param {string} permission - The permission required to view the content normally
 * @param {boolean} showLocked - Whether to show a locked version when the user lacks permission
 * @param {string} lockMessage - Message to display when content is locked
 * @param {string} unlockCriteria - Text explaining how to unlock this feature
 * @param {React.ReactNode} fallback - Content to show when lacking permission (if not showing locked version)
 * @param {React.ReactNode} children - The content to display if permitted
 */
const PermissionControl = ({ 
  permission,
  showLocked = false,
  lockMessage = "This feature is locked",
  unlockCriteria = null,
  fallback = null,
  children 
}) => {
  const { hasPermission } = useAuth();
  
  // If user has permission, render the content normally
  if (hasPermission(permission)) {
    return children;
  }
  
  // If we should show locked version
  if (showLocked) {
    return (
      <div className="permission-locked-container">
        <div className="permission-locked-content">
          {children}
          <div className="permission-locked-overlay">
            <div className="permission-lock-icon">🔒</div>
            <div className="permission-lock-message">{lockMessage}</div>
            {unlockCriteria && (
              <div className="permission-unlock-criteria">
                {unlockCriteria}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Otherwise show fallback or nothing
  return fallback;
};

export default PermissionControl; 