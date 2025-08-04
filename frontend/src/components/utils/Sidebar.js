// src/components/utils/Sidebar.jsx
import React, { useState, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { sidebarNavItems } from "../../context/sidebarNavItems";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { AuthContext, useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import ContextMenuPortal from "./ContextMenuPortal";
import "./Sidebar.css";
import Logo from "../Layout/Logo";

const Sidebar = ({ isExpanded, setIsExpanded }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamName } = useTeamStyles();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user, hasPermission } = useAuth();
  const { unreadCount } = useNotifications();
  
  // Check if user is admin using the hasPermission function
  const isAdmin = hasPermission('admin');
  
  // Get teamRole from user object (available for admin users)
  const teamRole = user?.teamRole || null;
  
  // Skip license warning for teamRole = "app" users
  const shouldShowLicenseWarning = teamRole !== "app" ? licenseWarning : false;
  
  // Get sidebar items with warning indicators based on license status
  const navItems = getSidebarNavItems(shouldShowLicenseWarning, isAdmin, unreadCount, teamRole);
  
  // Track which item (if any) currently shows its submenu
  const [submenuVisible, setSubmenuVisible] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const sidebarRef = useRef(null);

  const handleItemMouseEnter = (e, item) => {
    if (item.submenu) {
      const rect = e.currentTarget.getBoundingClientRect();
      // Position submenu to the right of the item
      const top = rect.top;
      const left = rect.right;
      setSubmenuPosition({ top, left });
      setSubmenuVisible(item.name);
    }
  };

  // Handle the logo click to navigate to dashboard
  const handleLogoClick = () => {
    navigate("/dashboard");
  };

  // Check if a nav item is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // We remove immediate onMouseLeave so that the submenu can be interacted with.
  // The ContextMenuPortal component will handle its own mouse events to close.

  return (
    <div className={`sidebar ${isExpanded ? "expanded" : "collapsed"}`} ref={sidebarRef}>
      <div className="sidebar-logo-container" onClick={handleLogoClick}>
        <Logo size="small" className="logo-small" />
        {isExpanded && <span className="sidebar-logo-text">{teamName}</span>}
      </div>
      
      <button className="menu-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <span>☰</span>
      </button>

      {navItems.map((item) => (
        <div
          key={item.name}
          className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
          onMouseEnter={(e) => handleItemMouseEnter(e, item)}
          onClick={() => {
            // Always navigate to the item's path when clicked
            navigate(item.path);
          }}
        >
          <div className="sidebar-icon-container">
            {item.icon}
            {/* Show warnings and notification badges */}
            {item.hasWarning && (
              <span className="sidebar-warning">
                <div className="warning-dot"></div>
              </span>
            )}
          </div>
          {isExpanded && <span className="sidebar-text">{item.name}</span>}
          {item.submenu && isExpanded && <span className="submenu-indicator"></span>}
        </div>
      ))}

      {submenuVisible && (
        <ContextMenuPortal
          options={navItems
            .find((item) => item.name === submenuVisible)
            .submenu.map((sub) => ({
              label: sub.name,
              onClick: () => navigate(sub.path),
              icon: sub.icon
            }))}
          onClose={() => setSubmenuVisible(null)}
          onMouseEnter={() => {}}
          onMouseLeave={() => setSubmenuVisible(null)}
          style={{ top: submenuPosition.top, left: submenuPosition.left }}
        />
      )}
    </div>
  );
};

export default Sidebar;
