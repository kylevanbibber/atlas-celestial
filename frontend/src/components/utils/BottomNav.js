import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { sidebarNavItems } from "../../context/sidebarNavItems";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { AuthContext } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { FiSettings } from "react-icons/fi";
import Logo from "../Layout/Logo";
import "./BottomNav.css";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamName } = useTeamStyles();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user } = useContext(AuthContext);
  const { unreadCount } = useNotifications();
  
  // Check if user is admin
  const isAdmin = user?.isAdmin || false;
  
  // Get nav items with warning status
  const allNavItems = getSidebarNavItems(licenseWarning, isAdmin, unreadCount);
  
  // Check if settings has a warning
  const settingsItem = allNavItems.find(item => item.name === "Settings");
  const settingsHasWarning = settingsItem && settingsItem.hasWarning;
  
  // Filter items to only show main navigation items (max 4 for mobile)
  // Include items that have a main path, even if they have submenus
  const navItems = allNavItems
    .filter(item => item.path && item.name !== "Settings") // Include items with paths, exclude settings since we'll add it separately
    .slice(0, 4);
  
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
      
      {/* Always show settings in the bottom nav */}
      <div
        className={`bottom-nav-item settings-item ${isActive("/settings") || isActive("/team-customization") ? "active" : ""}`}
        onClick={() => handleNavClick("/settings")}
      >
        <div className="bottom-nav-icon-container">
          <FiSettings />
          {settingsHasWarning && <span className="bottom-nav-warning-dot"></span>}
        </div>
        <div className="bottom-nav-label">Settings</div>
      </div>
    </div>
  );
};

export default BottomNav; 