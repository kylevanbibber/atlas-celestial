import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { AuthContext } from "../../context/AuthContext";
import { useNotificationContext } from '../../context/NotificationContext';
import { useAgency } from "../../context/AgencyContext";
import ContextMenuPortal from "./ContextMenuPortal";
import GlobalSearch from "./GlobalSearch";
import RightDetails from "./RightDetails";
import ThemeContext from "../../context/ThemeContext";
import AddSaleModal from "../activityFeed/AddSaleModal";
import { FiPlus, FiDollarSign } from "react-icons/fi";
import "./BottomNav.css";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useTeamStyles();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user } = useContext(AuthContext);
  const { unreadCount } = useNotificationContext();
  const { hasPageAccess } = useAgency();
  const { theme, toggleTheme } = useContext(ThemeContext);
  
  // Submenu state
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ left: 0, bottom: 0 });
  const bottomNavRef = useRef(null);
  const submenuRef = useRef(null);
  
  // Agent profile state
  const [agentProfileData, setAgentProfileData] = useState(null);

  // Add sale modal state
  const [showAddSale, setShowAddSale] = useState(false);

  // Plus menu state
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [plusMenuPos, setPlusMenuPos] = useState({ left: 0, bottom: 0 });
  const plusBtnRef = useRef(null);
  const plusMenuRef = useRef(null);
  
  // Check if user is admin
  const isAdmin = user?.isAdmin || false;
  
  // Get teamRole from user object
  const teamRole = user?.teamRole || null;
  
  // Skip license warning for teamRole = "app" users
  const shouldShowLicenseWarning = teamRole !== "app" ? licenseWarning : false;
  
  // Get nav items with warning status
  const allNavItems = getSidebarNavItems(shouldShowLicenseWarning, isAdmin, unreadCount, teamRole, user?.userId, user?.lagnname, user?.clname, hasPageAccess);

  // Get submenu items from the centralized nav item data (sidebarNavItems)
  const getSubmenuItems = (itemName) => {
    const item = allNavItems.find(n => n.name === itemName);
    return item?.submenu || [];
  };
  
  // Filter items to show main navigation items
  const navItems = allNavItems
    .filter(item =>
      item.path &&
      !item.path.startsWith("/utilities") && // Available via account dropdown
      item.name !== "Admin" &&
      item.name !== "1-on-1" &&
      item.name !== "Activity" && // Available via account dropdown on mobile
      item.name !== "Calendar" && // Available via account dropdown on mobile
      item.name !== "Text Campaigns" // Available via account dropdown on mobile
    );

  // Split for centered plus button
  const midIndex = Math.floor(navItems.length / 2);
  const leftNavItems = navItems.slice(0, midIndex);
  const rightNavItems = navItems.slice(midIndex);

  // Close submenu/plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideBottomNav = bottomNavRef.current && bottomNavRef.current.contains(event.target);
      const clickedInsideSubmenu = submenuRef.current && submenuRef.current.contains(event.target);
      const clickedInsidePlusMenu = plusMenuRef.current && plusMenuRef.current.contains(event.target);
      if (!clickedInsideBottomNav && !clickedInsideSubmenu && !clickedInsidePlusMenu) {
        setActiveSubmenu(null);
        setShowPlusMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Close menus when location changes
  useEffect(() => {
    setActiveSubmenu(null);
    setShowPlusMenu(false);
  }, [location.pathname]);

  const handlePlusClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = plusBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setPlusMenuPos({
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + 10,
      });
    }
    setShowPlusMenu(prev => !prev);
    setActiveSubmenu(null);
  };
  
  // Handle navigation with submenu support
  const handleNavClick = (item, event) => {
    const submenuItems = getSubmenuItems(item.name);
    if (submenuItems.length > 0) {
      // Calculate position for submenu popup
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const buttonCenter = buttonRect.left + (buttonRect.width / 2);
      
      setSubmenuPosition({
        left: buttonCenter,
        bottom: window.innerHeight - buttonRect.top + 10
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
  
  return (
    <>
      <div
        className="bottom-nav"
        ref={bottomNavRef}
      >
        {/* Submenu popup positioned above clicked button */}
      {activeSubmenu && (
        <ContextMenuPortal>
          <div 
            className="bottom-nav-submenu-popup"
            ref={submenuRef}
            style={{
              left: submenuPosition.left,
              bottom: submenuPosition.bottom
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

      {/* Main navigation items — left half */}
      {leftNavItems.map((item) => {
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

      {/* Centered plus button */}
      <div className="bottom-nav-plus-item" onClick={handlePlusClick}>
        <div ref={plusBtnRef} className={`bottom-nav-plus-btn${showPlusMenu ? ' open' : ''}`}>
          <FiPlus size={24} />
        </div>
      </div>

      {/* Main navigation items — right half */}
      {rightNavItems.map((item) => {
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

      {/* Plus quick-action menu */}
      {showPlusMenu && (
        <ContextMenuPortal>
          <div
            ref={plusMenuRef}
            className="bottom-nav-plus-menu"
            style={{ left: plusMenuPos.left, bottom: plusMenuPos.bottom }}
          >
            <div
              className="bottom-nav-plus-menu-item"
              onClick={() => { setShowPlusMenu(false); setShowAddSale(true); }}
            >
              <span className="bottom-nav-plus-menu-icon"><FiDollarSign size={18} /></span>
              Log a Close
            </div>
          </div>
        </ContextMenuPortal>
      )}

      {/* Add Sale Modal */}
      {showAddSale && (
        <AddSaleModal onClose={() => setShowAddSale(false)} />
      )}
    </>
  );
};

export default BottomNav; 