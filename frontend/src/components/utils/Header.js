// src/components/utils/Header.jsx
import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { FiMenu, FiUser, FiLogOut, FiMoon, FiSun, FiUsers, FiChevronRight, FiPhone, FiMonitor, FiExternalLink, FiChevronDown, FiMessageSquare, FiHome, FiClipboard, FiUserPlus, FiSettings, FiTrendingUp } from "react-icons/fi";
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
import "./Header.css";

const Header = ({ pageTitle, onboardingMode = false }) => {
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
  
  // State for nav tab dropdowns
  const [activeNavDropdown, setActiveNavDropdown] = useState(null);
  const navDropdownTimeoutRef = useRef(null);

  // Cleanup nav dropdown timeout on unmount
  useEffect(() => {
    return () => {
      if (navDropdownTimeoutRef.current) {
        clearTimeout(navDropdownTimeoutRef.current);
      }
    };
  }, []);

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
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
      <div className="modern-header">
        {/* Left section - Logo */}
        <div className="header-left">
          {!isMobile && (
            <div className="header-logo-container" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
              <Logo size="small" className="header-logo" />
            </div>
          )}
          
          {/* Mobile - Just show logo */}
          {isMobile && (
            <div className="mobile-logo-container" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
              <Logo size="xs" className="header-logo" />
            </div>
          )}
        </div>
        
        {/* Center section - Main Navigation Tabs */}
        {!isMobile && !onboardingMode && (
          <div className="header-center-nav">
            {mainNavItems.map((item, index) => (
              <React.Fragment key={item.name}>
                <div
                  className="nav-tab-container"
                  onMouseEnter={() => {
                    if (navDropdownTimeoutRef.current) {
                      clearTimeout(navDropdownTimeoutRef.current);
                    }
                    if (item.submenu && item.submenu.length > 0) {
                      setActiveNavDropdown(item.name);
                    }
                  }}
                  onMouseLeave={() => {
                    navDropdownTimeoutRef.current = setTimeout(() => {
                      setActiveNavDropdown(null);
                    }, 200);
                  }}
                >
                  <div
                    className={`nav-tab ${isNavItemActive(item.path) ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <span>{item.name}</span>
                    {item.hasWarning && <span className="nav-tab-warning-dot"></span>}
                  </div>
                  
                  {/* Submenu Dropdown */}
                  {activeNavDropdown === item.name && item.submenu && (
                    <div className="nav-tab-dropdown">
                      {item.submenu.map((subItem) => (
                        <div
                          key={subItem.name}
                          className={`nav-dropdown-item ${isNavItemActive(subItem.path) ? 'active' : ''}`}
                      onClick={() => {
                            navigate(subItem.path);
                            setActiveNavDropdown(null);
                      }}
                    >
                          {subItem.icon}
                          <span>{subItem.name}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
                {/* Add separator between items, but not after the last one */}
                {index < mainNavItems.length - 1 && (
                  <span className="nav-separator">|</span>
            )}
              </React.Fragment>
            ))}
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
