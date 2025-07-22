// src/components/utils/Header.jsx
import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { FiMenu, FiUser, FiLogOut, FiMoon, FiSun, FiUsers, FiChevronRight } from "react-icons/fi";
import { sidebarNavItems } from "../../context/sidebarNavItems";
import ContextMenu from "./ContextMenu";
import Logo from "../Layout/Logo";
import NotificationCenter from "../common/NotificationCenter";
import api from "../../api";
import "./Header.css";

const Header = ({ pageTitle, isExpanded }) => {
  const { 
    user, 
    isImpersonating, 
    originalAdminUser, 
    startImpersonation, 
    stopImpersonation,
    hasPermission 
  } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { teamName } = useTeamStyles();
  const defaultProfilePic = "http://www.gravatar.com/avatar/?d=mp";
  const profilePic = user?.profpic || defaultProfilePic;
  const navigate = useNavigate();
  // State to detect if on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Admin user switching state
  const [users, setUsers] = useState([]);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');

  // Use custom team name or fall back to the page title
  const displayTitle = pageTitle || teamName || "Atlas";

  // Check if device is mobile on mount and on resize
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // State for the profile dropdown menu
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // State for the sidebar menu (hamburger menu)
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const hamburgerRef = useRef(null);
  const [hamburgerMenuPosition, setHamburgerMenuPosition] = useState({ top: 0, left: 0 });

  // Handle profile menu click
  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleHamburgerClick = () => {
    const rect = hamburgerRef.current.getBoundingClientRect();
    // Position the menu down and to the right
    const top = rect.bottom + 5;
    const left = rect.left;
    setHamburgerMenuPosition({ top, left });
    setShowHamburgerMenu(!showHamburgerMenu);
  };

  // Load users for admin switching
  const loadUsers = async () => {
    if (users.length > 0) return; // Already loaded
    
    setLoadingUsers(true);
    try {
      const response = await api.get('/admin/getUsersForImpersonation');
      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Handle user switching
  const handleUserSwitch = async (targetUserId) => {
    try {
      const result = await startImpersonation(targetUserId);
      if (result.success) {
        setShowProfileMenu(false);
        setShowUserSwitcher(false);
      }
    } catch (error) {
      console.error('Error switching user:', error);
    }
  };

  // Handle stop impersonation
  const handleStopImpersonation = () => {
    stopImpersonation();
    setShowProfileMenu(false);
  };

  // Handle showing user switcher
  const handleShowUserSwitcher = () => {
    setShowUserSwitcher(true);
    setUserSearchQuery('');
    setSelectedRoleFilter('');
    loadUsers();
  };

  // Logout function to clear all storage and redirect to login
  const handleLogout = () => {
    // Clear tokens and user data
    localStorage.removeItem("auth_token");
    sessionStorage.clear();
    
    // Redirect to login page
    navigate("/login");
    window.location.reload();
  };

  // Profile menu options
  const profileOptions = [
    {
      label: "Account",
      onClick: () => navigate("/settings?section=account"),
      icon: <FiUser />
    },
    // Admin user switching option
    ...(hasPermission('admin') ? [{
      label: showUserSwitcher ? "← Back" : "Switch User",
      onClick: showUserSwitcher ? () => setShowUserSwitcher(false) : handleShowUserSwitcher,
      icon: <FiUsers />,
      preventClose: true
    }] : []),
    // Show current impersonation status
    ...(isImpersonating ? [{
      label: `Viewing as: ${user?.name || user?.lagnname}`,
      onClick: handleStopImpersonation,
      icon: <FiChevronRight />,
      className: "menu-item-impersonating"
    }] : []),
    {
      label: theme === 'light' ? "Dark Mode" : "Light Mode",
      onClick: toggleTheme,
      icon: theme === 'light' ? <FiMoon /> : <FiSun />
    },
    {
      label: "Logout",
      onClick: handleLogout,
      icon: <FiLogOut />,
      className: "menu-item-logout"
    }
  ];

  // Filter users based on search query and role filter
  const filteredUsers = users.filter(user => {
    // Text search filter
    const matchesSearch = !userSearchQuery || 
      user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.clname.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(userSearchQuery.toLowerCase()));
    
    // Role filter
    const matchesRole = !selectedRoleFilter || user.clname === selectedRoleFilter;
    
    return matchesSearch && matchesRole;
  });

  // Limit display to first 100 users if no search/filter query to improve performance
  const displayUsers = (userSearchQuery || selectedRoleFilter) ? filteredUsers : filteredUsers.slice(0, 100);

  // User switcher options (when in switcher mode)
  let userSwitcherOptions = [];
  
  if (loadingUsers) {
    userSwitcherOptions = [
      {
        label: "Loading users...",
        onClick: () => {},
        icon: <FiUsers />,
        disabled: true
      }
    ];
  } else if (filteredUsers.length === 0 && userSearchQuery) {
    userSwitcherOptions = [
      {
        label: `No users found for "${userSearchQuery}"`,
        onClick: () => {},
        icon: <FiUser />,
        disabled: true
      }
    ];
  } else {
    userSwitcherOptions = displayUsers.map(targetUser => ({
      label: `${targetUser.name} (${targetUser.clname})`,
      onClick: () => handleUserSwitch(targetUser.id),
      icon: <FiUser />,
      disabled: false
    }));
    
    // Add hint if showing limited results
    if (!userSearchQuery && !selectedRoleFilter && users.length > 100) {
      userSwitcherOptions.unshift({
        label: `Showing first 100 of ${users.length} users - search or filter to find specific users`,
        onClick: () => {},
        icon: <FiUsers />,
        disabled: true,
        className: 'menu-item-hint'
      });
    }
  }



  // Hamburger menu options based on sidebar nav items
  const hamburgerOptions = sidebarNavItems.map((item) => ({
    label: item.name,
    onClick: () => navigate(item.submenu ? item.submenu[0].path : item.path),
    icon: item.icon
  }));

  return (
    <div className={`header ${isExpanded ? "expanded" : ""}`}>
      {/* Left section */}
      <div className="header-left-section">
        {/* Hamburger Menu (desktop only) */}
        <div
          className="hamburger-container"
          ref={hamburgerRef}
          onClick={handleHamburgerClick}
        >
          <FiMenu className="hamburger-icon" />
          {showHamburgerMenu && (
            <ContextMenu
              options={hamburgerOptions}
              onClose={() => setShowHamburgerMenu(false)}
              style={{ 
                top: hamburgerMenuPosition.top,
                left: hamburgerMenuPosition.left
              }}
              className="hamburger-menu"
            />
          )}
        </div>
        
        {/* Logo (for mobile) */}
        <div className="header-logo-container">
          <Logo size={isMobile ? "xs" : "small"} className="header-logo" />
        </div>
      </div>
      
      {/* Header Title */}
      {displayTitle && <h4 className={`header-title ${isExpanded ? "expanded" : ""}`}>{displayTitle}</h4>}
      
      {/* Right section - Header actions container */}
      <div className="header-actions">
        {/* Notification Center */}
        <NotificationCenter />
        
        {/* Profile Picture with Dropdown */}
        <div className="profile">
          <img
            src={profilePic}
            alt="Profile"
            className={`profile-pic ${isImpersonating ? 'impersonating' : ''}`}
            onClick={handleProfileClick}
          />
          
          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <ContextMenu
              options={showUserSwitcher ? userSwitcherOptions : profileOptions}
              onClose={() => {
                setShowProfileMenu(false);
                setShowUserSwitcher(false);
                setUserSearchQuery('');
                setSelectedRoleFilter('');
              }}
              className="dropdown"
              searchable={showUserSwitcher}
              searchPlaceholder="Search users..."
              searchValue={userSearchQuery}
              onSearchChange={setUserSearchQuery}
              roleFilter={selectedRoleFilter}
              onRoleFilterChange={setSelectedRoleFilter}
              roleOptions={['AGT', 'SA', 'GA', 'MGA', 'RGA']}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
