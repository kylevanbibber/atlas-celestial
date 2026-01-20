// src/components/utils/Header.jsx
import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { FiMenu, FiUser, FiLogOut, FiMoon, FiSun, FiUsers, FiChevronRight, FiPhone, FiMonitor, FiExternalLink, FiChevronDown, FiMessageSquare, FiHome, FiClipboard, FiUserPlus, FiSettings, FiTrendingUp, FiX, FiBookOpen } from "react-icons/fi";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { useNotificationContext } from "../../context/NotificationContext";
import ContextMenu from "./ContextMenu";
import Logo from "../Layout/Logo";
import NotificationCenter from "../common/NotificationCenter";
import GlobalSearch from "./GlobalSearch";
import RightDetails from "./RightDetails";
import api from "../../api";
import { usePresentationWindow } from "../../hooks/usePresentationWindow";
import { useHeader } from "../../context/HeaderContext";
import "./Header.css";

const Header = ({ pageTitle, onboardingMode = false, headerContent: propHeaderContent = null }) => {
  const { headerContent: contextHeaderContent } = useHeader();
  const { 
    user, 
    isImpersonating, 
    originalAdminUser, 
    startImpersonation, 
    stopImpersonation,
    hasPermission 
  } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { teamName } = useTeamStyles();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { unreadCount } = useNotificationContext();
  const location = useLocation();
  const defaultProfilePic = "http://www.gravatar.com/avatar/?d=mp";
  const profilePic = user?.profpic || defaultProfilePic;
  const navigate = useNavigate();
  
  // Check if user is admin
  const isAdmin = hasPermission('admin');
  const teamRole = user?.teamRole || null;
  const shouldShowLicenseWarning = teamRole !== "app" ? licenseWarning : false;
  
  // Get navigation items (previously from sidebar)
  const navItems = onboardingMode 
    ? [{ name: 'Onboarding Home', path: '/onboarding/home', icon: <FiMenu /> }]
    : getSidebarNavItems(shouldShowLicenseWarning, isAdmin, unreadCount, teamRole, user?.userId, user?.lagnname, user?.clname) || [];
  
  // State to detect if on mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // State removed - now using horizontal tabs instead of dropdown
  
  // Admin user switching state
  const [users, setUsers] = useState([]);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');

  // Phone Scripts and Presentation state
  const [isPhoneOpen, setIsPhoneOpen] = useState(false);
  const [isPresOpen, setIsPresOpen] = useState(false);
  const phoneWindowRef = useRef(null);
  const presWindowRef = useRef(null);

  // Agent profile state
  const [agentProfileData, setAgentProfileData] = useState(null);

  // Presentation Setup window (new for VANBIBBER KYLE A)
  const { openWindow: openPresentationSetup, isOpen: isPresentationSetupOpen } = usePresentationWindow();

  // Check if user is VANBIBBER KYLE A
  const isPresentationUser = user?.lagnname === 'VANBIBBER KYLE A';
  
  // Presentation menu state
  const [showPresentationMenu, setShowPresentationMenu] = useState(false);

  // Use custom team name or fall back to the page title
  const displayTitle = pageTitle || teamName || "Atlas";
  const [hasRecentUpdate, setHasRecentUpdate] = useState(false);


  // Detect recent page-specific updates (last 7 days) by matching current path
  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/training/updates');
        if (res.data?.success) {
          const updates = res.data.data || [];
          const now = new Date();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          const path = window.location.pathname;
          const recent = updates.some(u => {
            const created = new Date(u.createdAt);
            const within7 = now - created <= sevenDaysMs;
            const matches = (u.pageUrl && path.startsWith(u.pageUrl)) || (u.tutorialUrl && path.startsWith(u.tutorialUrl));
            return within7 && matches;
          });
          setHasRecentUpdate(recent);
        }
      } catch (e) {
        // ignore
      }
    };
    run();
  }, [displayTitle]);

  // Check window status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (phoneWindowRef.current && phoneWindowRef.current.closed) {
        setIsPhoneOpen(false);
        phoneWindowRef.current = null;
      }
      if (presWindowRef.current && presWindowRef.current.closed) {
        setIsPresOpen(false);
        presWindowRef.current = null;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (submenuTimeoutRef.current) {
        clearTimeout(submenuTimeoutRef.current);
      }
      if (hamburgerTimeoutRef.current) {
        clearTimeout(hamburgerTimeoutRef.current);
      }
    };
  }, []);

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
  
  // Refs for timeouts - declared early to avoid TDZ issues
  const submenuTimeoutRef = useRef(null);
  const hamburgerTimeoutRef = useRef(null);
  const hamburgerContainerRef = useRef(null);
  
  // State for hamburger menu
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null);

  // Keep hamburger open while pointer is anywhere within the hamburger container DOM.
  // This avoids geometry-based mouseleave quirks when submenu is positioned outside the container.
  useEffect(() => {
    if (!isHamburgerOpen) return;

    const handlePointerMove = (e) => {
      const target = e.target;
      const container = hamburgerContainerRef.current;
      const isInside = !!(container && target && container.contains(target));

      if (isInside) {
        if (hamburgerTimeoutRef.current) {
          clearTimeout(hamburgerTimeoutRef.current);
          hamburgerTimeoutRef.current = null;
        }
        return;
      }

      // Delay close slightly to allow moving between menu + submenu without flicker
      if (!hamburgerTimeoutRef.current) {
        hamburgerTimeoutRef.current = setTimeout(() => {
          setIsHamburgerOpen(false);
          setActiveSubmenu(null);
          hamburgerTimeoutRef.current = null;
        }, 250);
      }
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      if (hamburgerTimeoutRef.current) {
        clearTimeout(hamburgerTimeoutRef.current);
        hamburgerTimeoutRef.current = null;
      }
    };
  }, [isHamburgerOpen]);

  // Phone Scripts window function
  const openPhone = (phoneFile) => {
    // For mobile devices, open directly in new tab
    if (isMobile) {
      const phoneUrl = 'https://ariaslife.com/temp/agent_tools/phone_scripts/phone_scripts.html';
      window.open(phoneUrl, '_blank');
      return;
    }

    // Desktop behavior - check if a phone window is already open and not closed
    if (phoneWindowRef.current && !phoneWindowRef.current.closed) {
      phoneWindowRef.current.focus();
      return;
    }

    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;

    // Set width to half of the screen width
    const width = Math.round(screenWidth / 2);

    // Full height
    const height = screenHeight;

    // Position the window on the right half of the screen
    const left = screenWidth - width; // Start from the middle of the screen
    const top = 0; // Align to the top of the screen

    const phoneUrl = 'https://ariaslife.com/temp/agent_tools/phone_scripts/phone_scripts.html';
    phoneWindowRef.current = window.open(
      phoneUrl,
      '_blank',
      `toolbar=no,scrollbars=no,resizable=yes,top=${top},left=${left},width=${width},height=${height},alwaysRaised=true`
    );

    if (phoneWindowRef.current) {
      setIsPhoneOpen(true);
      phoneWindowRef.current.focus();

      // Listen for window close event
      phoneWindowRef.current.onbeforeunload = () => {
        setIsPhoneOpen(false);
        phoneWindowRef.current = null;
      };
    } else {
      alert('Failed to open phone scripts window. Please allow pop-ups for this site.');
    }
  };

  // Presentation window function
  const openPres = async (presFile) => {
    // For mobile devices, open directly in new tab
    if (isMobile) {
      const userId = user?.userId;
      const userToken = localStorage.getItem('auth_token');
      const presUrl = `https://ariaslife.com/temp/agent_tools/presentation/pres_setup.html?a=${userToken}&b=${userId}`;
      window.open(presUrl, '_blank');
      return;
    }

    // Desktop behavior - check if a presentation window is already open and not closed
    if (presWindowRef.current && !presWindowRef.current.closed) {
      presWindowRef.current.focus();
      return;
    }

    // Determine available screen dimensions
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;

    // Check for ultrawide (32:9 aspect ratio or similar)
    const isUltrawide = screenWidth / screenHeight > 2;

    // Calculate dimensions
    let width = Math.round(screenWidth * 0.71);
    let height = Math.round(width * (9 / 16));

    if (height > screenHeight) {
      height = screenHeight;
      width = Math.round(height * (16 / 9));
    }

    let left, top;

    if (isUltrawide) {
      // Calculate a centered virtual 16:9 screen in the middle of the 32:9 monitor
      const virtualWidth = screenHeight * (16 / 9); // Virtual 16:9 width based on screen height
      const virtualLeft = (screenWidth - virtualWidth) / 2; // Centered 16:9 viewport

      // Align to the left side of the virtual 16:9 screen
      left = Math.round(virtualLeft); // Align left of the virtual viewport
      width = Math.round(virtualWidth * 0.71); // 70% of virtual 16:9 width
      height = Math.round(width * (9 / 16)); // Maintain 16:9 aspect ratio
    } else {
      // Standard positioning for non-ultrawide screens
      left = window.screen.availLeft !== undefined ? window.screen.availLeft : 0;
    }

    top = screenHeight - height; // Align to bottom

    // Use the same URL as handleLaunchPresentation for consistency
    const userId = user?.userId;
    const userToken = localStorage.getItem('auth_token');
    const presUrl = `https://ariaslife.com/temp/agent_tools/presentation/pres_setup.html?a=${userToken}&b=${userId}`;

    // Open the presentation window
    presWindowRef.current = window.open(
      presUrl,
      '_blank',
      `toolbar=no,scrollbars=no,resizable=yes,top=${top},left=${left},width=${width},height=${height},alwaysRaised=true`
    );

    if (presWindowRef.current) {
      try {
        presWindowRef.current.moveTo(left, top);
        presWindowRef.current.resizeTo(width, height);
      } catch (e) {
        console.warn('Window positioning not fully supported in this browser.');
      }

      presWindowRef.current.focus();
      setIsPresOpen(true);

      // Listen for window close event
      presWindowRef.current.onbeforeunload = () => {
        setIsPresOpen(false);
        presWindowRef.current = null;
      };
    } else {
      alert('Failed to open presentation window. Please allow pop-ups for this site.');
    }
  };

  const handleLaunchPresentation = () => {
    const userId = user?.userId;
    const userToken = localStorage.getItem('auth_token');
    const presUrl = `https://ariaslife.com/temp/agent_tools/presentation/pres_setup.html?a=${userToken}&b=${userId}`;
    openPres(presUrl);
  };

  // Handle profile menu click
  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
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
      // Silently handle errors
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
      // Silently handle errors
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

  // Get main navigation items (excluding Utilities) - declare before profileOptions
  const mainNavItems = navItems.filter(item => item.name !== 'Utilities');
  const utilitiesItem = navItems.find(item => item.name === 'Utilities');

  // Profile menu options
  const baseProfileOptions = [
    {
      label: "Account",
      onClick: () => navigate("/utilities?section=account"),
      icon: <FiUser />
    },
    // Utilities with submenu
    {
      label: "Utilities",
      onClick: () => navigate("/utilities"),
      icon: <FiSettings />,
      submenu: utilitiesItem?.submenu?.map(subItem => ({
        label: subItem.name,
        onClick: () => {
          navigate(subItem.path);
          setShowProfileMenu(false);
        },
        icon: subItem.icon
      }))
    },
    {
      label: "Feedback",
      onClick: () => navigate("/resources?active=feedback"),
      icon: <FiMessageSquare />
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
    // Mobile-only options
    ...(isMobile ? [
      {
        label: "Phone Scripts",
        onClick: () => openPhone('scripts'),
        icon: <FiPhone />
      },
      {
        label: "Presentation",
        onClick: () => openPres(),
        icon: <FiMonitor />
      }
    ] : []),
    // Agent Sites with submenu
    {
      label: "Agent Sites",
      onClick: () => {}, // Handled by submenu
      icon: <FiExternalLink />,
      submenu: [
        {
          label: "Impact Mobile",
          onClick: () => window.open("https://login.ailife.com/ImpactMobile/", "_blank"),
          icon: <FiExternalLink />
        },
        {
          label: "Impact AWS",
          onClick: () => window.open("https://login.ailife.com/ImpactPortal/", "_blank"),
          icon: <FiExternalLink />
        },
        {
          label: "ICM",
          onClick: () => window.open("https://payeeweb.ailicm.globelifeinc.com/payeewebv2/login?nextPathname=%2F", "_blank"),
          icon: <FiExternalLink />
        },
        {
          label: "Option Builder",
          onClick: () => window.open("http://salebase.ai/option_builder/option_builder_solo_arias.php", "_blank"),
          icon: <FiExternalLink />
        },
        {
          label: "Career Track",
          onClick: () => window.open("/pdfs/careertrack.pdf", "_blank"),
          icon: <FiExternalLink />
        },
        {
          label: "Spanish Scripts",
          onClick: () => {}, // Handled by submenu
          icon: <FiExternalLink />,
          submenu: [
            {
              label: "CSK Phone Script",
              onClick: () => window.open("https://ariaslife.com/uploads/defaultFolder/Spanish CSK Script.pdf", "_blank"),
              icon: <FiExternalLink />
            },
            {
              label: "Will Kit Phone Script",
              onClick: () => window.open("https://ariaslife.com/uploads/defaultFolder/Spanish Will Kit Phone Script.docx", "_blank"),
              icon: <FiExternalLink />
            }
          ]
        },
        {
          label: "AD&D Signing",
          onClick: () => navigate("/document-signing"),
          icon: <FiUser />
        },
        {
          label: "PR Directory",
          onClick: () => window.open("https://aagencies-my.sharepoint.com/:w:/g/personal/kvanbibber_ariasagencies_com/EaPhjMWWMNtEmxutLriHI2kBRPryI_Y0ot6BFb0PWxc8dQ?e=cRFzCI", "_blank"),
          icon: <FiExternalLink />
        },
        {
          label: "2026 Awards Guide",
          onClick: () => window.open("/pdfs/Arias_Awards_2026.jpg", "_blank"),
          icon: <FiExternalLink />
        },
      ]
    },
    {
      label: "Logout",
      onClick: handleLogout,
      icon: <FiLogOut />,
      className: "menu-item-logout"
    }
  ];

  const profileOptions = onboardingMode
    ? baseProfileOptions.filter(opt => ["Account", "Dark Mode", "Light Mode", "Logout"].includes(opt.label))
    : baseProfileOptions;

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

  // Helper function to check if nav item is active
  const isNavItemActive = (path) => {
    if (!path) return false;
    
    // Check for exact match including query parameters
    const currentFullPath = location.pathname + location.search;
    if (currentFullPath === path) return true;
    
    // Check for pathname match or starts with for nested routes
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Get the icon for the current page
  const getCurrentPageIcon = () => {
    const currentPath = location.pathname;
    
    // Check main nav items
    for (const item of mainNavItems) {
      if (currentPath === item.path || currentPath.startsWith(`${item.path}/`)) {
        return item.icon;
      }
      // Check submenu items
      if (item.submenu) {
        for (const subItem of item.submenu) {
          if (currentPath === subItem.path || currentPath.startsWith(`${subItem.path}/`)) {
            return subItem.icon;
          }
        }
      }
    }
    
    // Check utilities
    if (utilitiesItem) {
      if (currentPath === utilitiesItem.path || currentPath.startsWith(`${utilitiesItem.path}/`)) {
        return utilitiesItem.icon;
      }
      if (utilitiesItem.submenu) {
        for (const subItem of utilitiesItem.submenu) {
          if (currentPath === subItem.path || currentPath.startsWith(`${subItem.path}/`)) {
            return subItem.icon;
          }
        }
      }
    }
    
    // Default to home icon
    return <FiHome />;
  };

  // Get the current page name and subpage for breadcrumb
  const getCurrentPageInfo = () => {
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    
    // Check main nav items
    for (const item of mainNavItems) {
      if (currentPath === item.path || currentPath.startsWith(`${item.path}/`)) {
        const pageInfo = { icon: item.icon, name: item.name, path: item.path };
        
        // Check for subpage
        if (item.submenu) {
          for (const subItem of item.submenu) {
            if (currentPath === subItem.path || currentPath.startsWith(`${subItem.path}/`)) {
              pageInfo.subIcon = subItem.icon;
              pageInfo.subName = subItem.name;
              pageInfo.subPath = subItem.path;
              break;
            }
          }
        }
        
        // Check for query param sections
        const section = searchParams.get('section') || searchParams.get('active');
        if (section && !pageInfo.subName) {
          const sectionLabel = section.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          pageInfo.subName = sectionLabel;
        }
        
        return pageInfo;
      }
    }
    
    // Check utilities
    if (utilitiesItem) {
      if (currentPath === utilitiesItem.path || currentPath.startsWith(`${utilitiesItem.path}/`)) {
        const pageInfo = { icon: utilitiesItem.icon, name: utilitiesItem.name, path: utilitiesItem.path };
        
        if (utilitiesItem.submenu) {
          for (const subItem of utilitiesItem.submenu) {
            if (currentPath === subItem.path || currentPath.startsWith(`${subItem.path}/`)) {
              pageInfo.subIcon = subItem.icon;
              pageInfo.subName = subItem.name;
              pageInfo.subPath = subItem.path;
              break;
            }
          }
        }
        
        return pageInfo;
      }
    }
    
    return null;
  };

  const pageInfo = getCurrentPageInfo();
  const isOnDashboard = location.pathname === '/dashboard' || location.pathname === '/';

  return (
    <>
      <div className="modern-header">
        {/* Left section - Logo and Hamburger Menu */}
        <div className="header-left">
          {!isMobile && (
            <>
              <div className="header-logo-container" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
                <div className="logo-icon-default">
                  <Logo size="small" className="header-logo" />
                </div>
                <div className="logo-icon-hover">
                  <FiHome className="home-icon" />
                </div>
              </div>
              
              {/* Separator between logo and hamburger when not on dashboard */}
              {!isOnDashboard && (
                <FiChevronRight className="logo-hamburger-separator" />
              )}
              
              {/* Hamburger Menu with Slide-out Nav */}
              {!onboardingMode && (
        <div
          className="hamburger-container"
                  ref={hamburgerContainerRef}
                  onMouseEnter={() => {
                    if (hamburgerTimeoutRef.current) {
                      clearTimeout(hamburgerTimeoutRef.current);
                      hamburgerTimeoutRef.current = null;
                    }
                    setIsHamburgerOpen(true);
                  }}
                >
                  <button 
                    className={`hamburger-menu-btn ${isHamburgerOpen ? 'active' : ''}`}
                    aria-label="Navigation menu"
                  >
                    <span className="hamburger-icon-default">{getCurrentPageIcon()}</span>
                    <span className="hamburger-icon-hover"><FiX /></span>
                  </button>
                  
                  {/* Slide-out Navigation */}
                  <div 
                    className={`hamburger-nav-slideout ${isHamburgerOpen ? 'open' : ''}`}
                    onMouseEnter={() => {
                      if (hamburgerTimeoutRef.current) {
                        clearTimeout(hamburgerTimeoutRef.current);
                        hamburgerTimeoutRef.current = null;
                      }
                    }}
                  >
                    {mainNavItems.map((item) => (
                      <div 
                        key={item.name} 
                        className="hamburger-nav-group"
                        onMouseEnter={(e) => {
                          // Clear all timeouts when entering a nav group
                          if (submenuTimeoutRef.current) {
                            clearTimeout(submenuTimeoutRef.current);
                          }
                          if (hamburgerTimeoutRef.current) {
                            clearTimeout(hamburgerTimeoutRef.current);
                          }
                          if (item.submenu && item.submenu.length > 0) {
                            setActiveSubmenu(item.name);
                          }
                        }}
                        onMouseLeave={() => {
                          // Delay submenu close slightly to allow moving into the submenu
                          submenuTimeoutRef.current = setTimeout(() => {
                            setActiveSubmenu(null);
                          }, 500);
                        }}
                      >
                        <div
                          className={`hamburger-slide-nav-item ${isNavItemActive(item.path) ? 'active' : ''}`}
                          onClick={() => navigate(item.path)}
                        >
                          <span>{item.name}</span>
                          {item.hasWarning && <span className="hamburger-warning-dot"></span>}
                        </div>
                        
                        {/* Submenu Items */}
                        {item.submenu && item.submenu.length > 0 && activeSubmenu === item.name && (
                          <div 
                            className="hamburger-slide-submenu"
                            onMouseEnter={() => {
                              // Clear both timeouts to keep everything open
                              if (submenuTimeoutRef.current) {
                                clearTimeout(submenuTimeoutRef.current);
                                submenuTimeoutRef.current = null;
                              }
                              if (hamburgerTimeoutRef.current) {
                                clearTimeout(hamburgerTimeoutRef.current);
                                hamburgerTimeoutRef.current = null;
                              }
                              // Explicitly keep hamburger menu open
                              setIsHamburgerOpen(true);
                            }}
                            onMouseLeave={() => {
                              // Close submenu after delay (hamburger close handled by pointer guard)
                              submenuTimeoutRef.current = setTimeout(() => {
                                setActiveSubmenu(null);
                              }, 300);
                            }}
                          >
                            {item.submenu.map((subItem) => (
                              <div
                                key={subItem.name}
                                className={`hamburger-slide-submenu-item ${isNavItemActive(subItem.path) ? 'active' : ''}`}
                                onClick={() => navigate(subItem.path)}
                              >
                                {subItem.icon}
                                <span>{subItem.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Breadcrumb - Show subpage/section after hamburger */}
              {!isOnDashboard && pageInfo && pageInfo.subName && (
                <div className="header-breadcrumb">
                  <FiChevronRight className="breadcrumb-separator" />
                  <span className="breadcrumb-subpage">{pageInfo.subName}</span>
                </div>
              )}
            </>
          )}
          
          {/* Mobile - Just show logo */}
          {isMobile && (
            <div className="mobile-logo-container header-logo-container" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
              <div className="logo-icon-default">
                <Logo size="xs" className="header-logo" />
              </div>
              <div className="logo-icon-hover">
                <FiHome className="home-icon mobile-home-icon" />
              </div>
            </div>
          )}
        </div>
        
        {/* Center section - Custom header content (e.g., dashboard KPIs, date range selector) */}
        {(contextHeaderContent || propHeaderContent) && (
          <div className="header-center-content">
            {contextHeaderContent || propHeaderContent}
          </div>
        )}
        
        {/* Right section - Actions */}
        <div className="header-right">
          {/* Global Search */}
          {!isMobile && !onboardingMode && (
            <GlobalSearch theme={theme} toggleTheme={toggleTheme} onOpenAgentProfile={setAgentProfileData} />
        )}
        
        {/* Notification Center */}
        {!onboardingMode && <NotificationCenter />}
        
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
      
      {/* Mobile navigation handled by BottomNav component in App.js */}

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

export default Header;
