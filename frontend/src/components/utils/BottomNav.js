import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { sidebarNavItems } from "../../context/sidebarNavItems";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { AuthContext } from "../../context/AuthContext";
import { useNotificationContext } from '../../context/NotificationContext';
import { FiSettings } from "react-icons/fi";
import Logo from "../Layout/Logo";
import "./BottomNav.css";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamName } = useTeamStyles();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user } = useContext(AuthContext);
  const { unreadCount } = useNotificationContext();
  
  // Check if user is admin
  const isAdmin = user?.isAdmin || false;
  
  // Get teamRole from user object
  const teamRole = user?.teamRole || null;
  
  // Skip license warning for teamRole = "app" users
  const shouldShowLicenseWarning = teamRole !== "app" ? licenseWarning : false;
  
  // Get nav items with warning status
  const allNavItems = getSidebarNavItems(shouldShowLicenseWarning, isAdmin, unreadCount, teamRole, user?.userId);
  
  // Check if settings has a warning (check both "Settings" and "Utilities" names)
  const settingsItem = allNavItems.find(item => item.name === "Settings" || item.name === "Utilities");
  const settingsHasWarning = settingsItem && settingsItem.hasWarning;
  
  // Filter items to show all main navigation items
  // Include items that have a main path, even if they have submenus
  const navItems = allNavItems
    .filter(item => item.path && item.name !== "Settings" && item.name !== "Utilities"); // Include items with paths, exclude settings/utilities since we'll add it separately
  
  // Handle navigation
  const handleNavClick = (path) => {
    navigate(path);
  };
  
  // Check if a nav item is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  
  return (
    <div className="bottom-nav">
      {/* Main navigation items */}
      {navItems.map((item) => (
        <div
          key={item.name}
          className={`bottom-nav-item ${isActive(item.path) ? "active" : ""}`}
          onClick={() => handleNavClick(item.path)}
        >
          <div className="bottom-nav-icon-container">
            {item.icon}
            {item.hasWarning && <span className="bottom-nav-warning-dot"></span>}
          </div>
          <div className="bottom-nav-label">{item.name}</div>
        </div>
      ))}
      
      {/* Always show settings/utilities in the bottom nav */}
      <div
        className={`bottom-nav-item settings-item ${isActive("/settings") || isActive("/team-customization") ? "active" : ""}`}
        onClick={() => handleNavClick("/settings")}
      >
        <div className="bottom-nav-icon-container">
          <FiSettings />
          {settingsHasWarning && <span className="bottom-nav-warning-dot"></span>}
        </div>
        <div className="bottom-nav-label">{user?.Role === 'Admin' && user?.teamRole === 'app' ? "Utilities" : "Settings"}</div>
      </div>
    </div>
  );
};

export default BottomNav; 