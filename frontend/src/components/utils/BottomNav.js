import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { sidebarNavItems } from "../../context/sidebarNavItems";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { AuthContext } from "../../context/AuthContext";
import { useNotificationContext } from '../../context/NotificationContext';
import { useAgency } from "../../context/AgencyContext";
import { FiSettings, FiChevronUp, FiActivity, FiAward, FiList, FiPercent, FiCheckCircle, FiStar, FiTarget, FiFileText, FiMessageSquare, FiUser, FiPenTool, FiUsers, FiBell, FiMail, FiClipboard, FiBarChart2, FiSearch } from "react-icons/fi";
import Logo from "../Layout/Logo";
import ContextMenuPortal from "./ContextMenuPortal";
import GlobalSearch from "./GlobalSearch";
import RightDetails from "./RightDetails";
import ThemeContext from "../../context/ThemeContext";
import "./BottomNav.css";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamName } = useTeamStyles();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user, hasPermission } = useContext(AuthContext);
  const { unreadCount } = useNotificationContext();
  const { hasPageAccess } = useAgency();
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  // Submenu state
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ left: 0, top: 0 });
  const bottomNavRef = useRef(null);
  const submenuRef = useRef(null);
  
  // Agent profile state
  const [agentProfileData, setAgentProfileData] = useState(null);
  
  // Check if user is admin
  const isAdmin = user?.isAdmin || false;
  
  // Get teamRole from user object
  const teamRole = user?.teamRole || null;
  
  // Skip license warning for teamRole = "app" users
  const shouldShowLicenseWarning = teamRole !== "app" ? licenseWarning : false;
  
  // Get nav items with warning status
  const allNavItems = getSidebarNavItems(shouldShowLicenseWarning, isAdmin, unreadCount, teamRole, user?.userId, user?.lagnname, user?.clname, hasPageAccess);

  // Helper function to get production submenu items
  const getProductionItems = () => {
    const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
    const hideDailyActivity = isAppAdmin;
    
    // Hide Daily Activity, Goals, and Verification for SGA users who are not Admin
    // Use case-insensitive check for clname
    const isSGANonAdmin = String(user?.clname || '').toUpperCase() === 'SGA' && user?.Role !== 'Admin';
    const shouldHideDailyActivity = hideDailyActivity || isSGANonAdmin;
    const shouldHideGoals = user?.teamRole === 'app' || isSGANonAdmin;
    const shouldHideVerification = isSGANonAdmin;
    
    let items = [
      ...(shouldHideDailyActivity ? [] : [{ id: 'daily-activity', name: 'Daily Activity', path: '/production?section=daily-activity', icon: <FiActivity /> }]),
      ...(shouldHideGoals ? [] : [{ id: 'goals', name: 'Goals', path: '/production?section=goals', icon: <FiTarget /> }]),
      { id: 'leaderboard', name: 'Leaderboard', path: '/production?section=leaderboard', icon: <FiAward /> },
      ...(hideDailyActivity ? [{ id: 'release', name: 'Release', path: '/production?section=release', icon: <FiList /> }] : []),
      { id: 'scorecard', name: 'Scorecard', path: '/production?section=scorecard', icon: <FiPercent /> },
      ...(shouldHideVerification ? [] : [{ id: 'verification', name: 'Verification', path: '/production?section=verification', icon: <FiCheckCircle /> }]),
      { id: 'vips', name: 'Codes and VIPs', path: '/production?section=vips', icon: <FiStar /> },
    ];
    
    return items;
  };

  // Helper function to get resources submenu items
  const getResourcesItems = () => {
    const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
    const canViewRefs = hasPermission('view_refs');
    
    const baseItems = [
      { id: 'reports', name: 'Reports', path: '/resources?active=reports', icon: <FiFileText /> }
    ];
    
    // Add refs if user has permission
    const refsItems = canViewRefs ? [
      { id: 'refs', name: 'Refs', path: '/resources?active=refs', icon: <FiClipboard /> },
    ] : [];
    
    // Add release
    const releaseItem = [
      { id: 'release', name: 'Release', path: '/resources?active=release', icon: <FiList /> },
    ];
    
    // Add leads and licensing for non-app users
    const additionalItems = !isAppAdmin ? [
      { id: 'leads', name: 'Leads', path: '/resources?active=leads', icon: <FiMail /> },
      { id: 'licensing', name: 'Licensing', path: '/resources?active=licensing', icon: <FiFileText /> },
    ] : [];
    
    return [...baseItems, ...refsItems, ...releaseItem, ...additionalItems];
  };

  // Helper function to get settings submenu items
  const getSettingsItems = () => {
    const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
    
    const allItems = [
      { id: 'account', name: 'Account', path: '/utilities?section=account', icon: <FiUser /> },
      { id: 'hierarchy', name: 'Hierarchy', path: '/utilities?section=hierarchy', icon: <FiUsers /> },
      { id: 'notifications', name: 'Notifications', path: '/utilities?section=notifications', icon: <FiBell /> },
      { id: 'pnp', name: 'P&P', path: '/utilities?section=pnp', icon: <FiBarChart2 /> },
      // Licensing and Leads removed from utilities - they're now only in Resources
    ];
    
    // Filter items based on user type
    const filteredItems = isAppAdmin 
      ? allItems.filter(item => !['account'].includes(item.id)) // App admins get pnp, hierarchy, and notifications in utilities
      : allItems; // Non-app users see account, hierarchy, notifications, and pnp
    
    return filteredItems;
  };

  // Helper function to get submenu items for a navigation item
  const getSubmenuItems = (itemName) => {
    switch (itemName) {
      case 'Production':
        return getProductionItems();
      case 'Resources':
        return getResourcesItems();
      case 'Recruiting':
        return []; // Simple page with no subsections
      case 'Settings':
      case 'Utilities':
        return getSettingsItems();
      default:
        return [];
    }
  };
  
  // Check if utilities has a warning
  const settingsItem = allNavItems.find(item => item.path === "/utilities");
  const settingsHasWarning = settingsItem && settingsItem.hasWarning;
  
  // Filter items to show main navigation items, excluding admin and settings/utilities  
  const navItems = allNavItems
    .filter(item => 
      item.path && // Only items with paths
      item.path !== "/utilities" && // Remove utilities item
      item.name !== "Admin" &&
      item.name !== "1-on-1" // Remove 1-on-1 from bottom nav
    );

  // Close submenu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideBottomNav = bottomNavRef.current && bottomNavRef.current.contains(event.target);
      const clickedInsideSubmenu = submenuRef.current && submenuRef.current.contains(event.target);
      if (!clickedInsideBottomNav && !clickedInsideSubmenu) {
        setActiveSubmenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Close submenu when location changes
  useEffect(() => {
    setActiveSubmenu(null);
  }, [location.pathname]);
  
  // Handle navigation with submenu support
  const handleNavClick = (item, event) => {
    const submenuItems = getSubmenuItems(item.name);
    if (submenuItems.length > 0) {
      // Calculate position for submenu popup
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const buttonCenter = buttonRect.left + (buttonRect.width / 2);
      
      setSubmenuPosition({
        left: buttonCenter,
        top: buttonRect.top
      });
      
      // Toggle submenu if item has submenu
      setActiveSubmenu(activeSubmenu === item.name ? null : item.name);
    } else {
      // Navigate normally if no submenu
      navigate(item.path);
      setActiveSubmenu(null);
    }
  };

  // Handle submenu item click
  const handleSubmenuClick = (submenuItem) => {
    // Delay closing to ensure iOS registers the click
    navigate(submenuItem.path);
    setTimeout(() => setActiveSubmenu(null), 50);
  };
  
  // Check if a nav item is active (including URL parameters)
  const isActive = (path) => {
    if (!path) return false;
    
    // Parse the path to separate pathname and query parameters
    const [targetPathname, targetQuery] = path.split('?');
    
    // Check if the pathname matches
    const pathnameMatches = location.pathname === targetPathname || location.pathname.startsWith(`${targetPathname}/`);
    
    // If no query parameters in target path, just check pathname
    if (!targetQuery) {
      return pathnameMatches;
    }
    
    // If there are query parameters, check if they match too
    if (pathnameMatches) {
      const currentParams = new URLSearchParams(location.search);
      const targetParams = new URLSearchParams(targetQuery);
      
      // Check if all target parameters match current parameters
      for (let [key, value] of targetParams) {
        if (currentParams.get(key) !== value) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  };

  // Check if a nav item or any of its submenu items are active
  const isItemActive = (item) => {
    // Check if the main item path is active (if it has one)
    if (item.path && isActive(item.path)) {
      return true;
    }
    // Check if any submenu items are active using the helper function
    const submenuItems = getSubmenuItems(item.name);
    if (submenuItems.length > 0) {
      return submenuItems.some(subItem => isActive(subItem.path));
    }
    return false;
  };
  
  // Calculate active tab index for sliding indicator
  const allTabs = [...navItems, settingsItem].filter(Boolean);
  const activeIndex = allTabs.findIndex(item => isItemActive(item));
  
  return (
    <>
      <div 
        className="bottom-nav" 
        ref={bottomNavRef}
        style={{
          '--tab-count': allTabs.length,
          '--active-tab': activeIndex >= 0 ? activeIndex : 0
        }}
      >
        {/* Submenu popup positioned above clicked button */}
      {activeSubmenu && (
        <ContextMenuPortal>
          <div 
            className="bottom-nav-submenu-popup"
            ref={submenuRef}
            style={{
              left: submenuPosition.left,
              top: submenuPosition.top - 10, // 10px gap above button
              transform: 'translateX(-50%) translateY(-100%)'
            }}
          >
            <div className="bottom-nav-submenu-items">
              {getSubmenuItems(activeSubmenu).map((submenuItem) => (
                <div
                  key={submenuItem.name}
                  className={`bottom-nav-submenu-item ${isActive(submenuItem.path) ? "active" : ""}`}
                  onClick={() => handleSubmenuClick(submenuItem)}
                >
                  <div className="bottom-nav-submenu-icon">
                    {submenuItem.icon}
                  </div>
                  <div className="bottom-nav-submenu-label">{submenuItem.name}</div>
                </div>
              ))}
            </div>
          </div>
        </ContextMenuPortal>
      )}

      {/* Main navigation items */}
      {navItems.map((item) => {
        const hasSubmenu = getSubmenuItems(item.name).length > 0;
        return (
          <div
            key={item.name}
            className={`bottom-nav-item ${isItemActive(item) ? "active" : ""} ${hasSubmenu ? "has-submenu" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNavClick(item, e);
            }}
          >
            <div className="bottom-nav-icon-container">
              {item.icon}
              {item.hasWarning && <span className="bottom-nav-warning-dot"></span>}
              {hasSubmenu && <span className="bottom-nav-submenu-indicator">⋯</span>}
            </div>
            <div className="bottom-nav-label">{item.name}</div>
          </div>
        );
      })}
      
      {/* Always show settings/utilities in the bottom nav */}
      {settingsItem && (() => {
        const hasSettingsSubmenu = getSubmenuItems(settingsItem.name).length > 0;
        return (
          <div
            className={`bottom-nav-item settings-item ${isItemActive(settingsItem) ? "active" : ""} ${hasSettingsSubmenu ? "has-submenu" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNavClick(settingsItem, e);
            }}
          >
            <div className="bottom-nav-icon-container">
              <FiSettings />
              {settingsHasWarning && <span className="bottom-nav-warning-dot"></span>}
              {hasSettingsSubmenu && <span className="bottom-nav-submenu-indicator">⋯</span>}
            </div>
            <div className="bottom-nav-label">{settingsItem.name}</div>
          </div>
        );
      })()}
      </div>
      
      {/* Floating Search Button - Mobile Only */}
      <div className="bottom-nav-search-fab">
        <GlobalSearch theme={theme} toggleTheme={toggleTheme} onOpenAgentProfile={setAgentProfileData} />
      </div>

      {/* Agent Profile Panel */}
      {agentProfileData && (
        <RightDetails
          data={agentProfileData}
          fromPage="Agent"
          onClose={() => setAgentProfileData(null)}
        />
      )}
    </>
  );
};

export default BottomNav; 