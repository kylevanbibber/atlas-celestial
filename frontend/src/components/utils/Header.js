// src/components/utils/Header.jsx
import React, { useContext, useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import { useTeamStyles } from "../../context/TeamStyleContext";
import { useAgency } from "../../context/AgencyContext";
import { FiMenu, FiUser, FiLogOut, FiMoon, FiSun, FiUsers, FiChevronRight, FiPhone, FiMonitor, FiExternalLink, FiChevronDown, FiMessageSquare, FiHome, FiClipboard, FiUserPlus, FiSettings, FiTrendingUp, FiBookOpen, FiCheck, FiTv, FiX, FiActivity, FiPlus, FiDollarSign } from "react-icons/fi";
import getSidebarNavItems from "../../context/sidebarNavItems";
import { useLicenseWarning } from "../../context/LicenseWarningContext";
import { useNotificationContext } from "../../context/NotificationContext";
import ContextMenu from "./ContextMenu";
import Logo from "../Layout/Logo";
import NotificationCenter from "../common/NotificationCenter";
import GlobalSearch from "./GlobalSearch";
import UpcomingMeetingBanner from "../calendar/UpcomingMeetingBanner";
import RightDetails from "./RightDetails";
import AgentLookup from "./AgentLookup";
import AgentLookupOverlay from "./AgentLookupOverlay";
import api from "../../api";
import { usePresentationWindow } from "../../hooks/usePresentationWindow";
import { useHeader } from "../../context/HeaderContext";
import AddSaleModal from "../activityFeed/AddSaleModal";
import QuickDailyActivityModal from "../quickActions/QuickDailyActivityModal";
import QuickMoreReportModal from "../quickActions/QuickMoreReportModal";
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
  const { unreadCount, pushEnabled } = useNotificationContext();
  const location = useLocation();
  const defaultProfilePic = "http://www.gravatar.com/avatar/?d=mp";
  const profilePic = user?.profpic || defaultProfilePic;
  
  // Calculate profile completion for progress ring (6 items: profpic, header_pic, bio, discord_id, home screen, push notifications)
  // Skip for app team role users
  const isAppTeamRole = user?.teamRole === 'app';
  const isAddedToHomeScreen = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator?.standalone || localStorage.getItem('homescreenAdded') === 'true');
  const PROFILE_COMPLETION_TOTAL = 6;
  const profileCompletionCount = isAppTeamRole ? PROFILE_COMPLETION_TOTAL : [
    user?.profpic,
    user?.headerPic || user?.header_pic,
    user?.bio,
    user?.discord_id,
    isAddedToHomeScreen,
    pushEnabled
  ].filter(Boolean).length;
  const profileCompletionPercent = (profileCompletionCount / PROFILE_COMPLETION_TOTAL) * 100;

  // Floating nudge for incomplete profile — show once every 2 days
  const [showProfileNudge, setShowProfileNudge] = useState(false);

  useEffect(() => {
    if (isAppTeamRole || profileCompletionPercent >= 100) {
      setShowProfileNudge(false);
      return;
    }
    try {
      const dismissed = localStorage.getItem('profileNudgeDismissedAt');
      if (dismissed) {
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
        if (Date.now() - Number(dismissed) < twoDaysMs) {
          return; // Still within cooldown
        }
      }
      // Show after a short delay so the page has settled
      const timer = setTimeout(() => setShowProfileNudge(true), 1200);
      return () => clearTimeout(timer);
    } catch (_) { /* localStorage unavailable */ }
  }, [profileCompletionPercent]);

  const dismissProfileNudge = () => {
    setShowProfileNudge(false);
    try {
      localStorage.setItem('profileNudgeDismissedAt', String(Date.now()));
    } catch (_) { /* ignore */ }
  };

  const navigate = useNavigate();
  
  // Agency switching state - must be before navigation items
  const { selectedAgency, userAgencies, hasMultipleAgencies, switchAgency, hasPageAccess } = useAgency();
  
  // Check if user is admin
  const isAdmin = hasPermission('admin');
  const teamRole = user?.teamRole || null;
  const shouldShowLicenseWarning = teamRole !== "app" ? licenseWarning : false;
  
  // Get navigation items (previously from sidebar)
  const navItems = onboardingMode 
    ? [{ name: 'Onboarding Home', path: '/onboarding/home', icon: <FiMenu /> }]
    : getSidebarNavItems(shouldShowLicenseWarning, isAdmin, unreadCount, teamRole, user?.userId, user?.lagnname, user?.clname, hasPageAccess) || [];
  
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

  // Agent lookup overlay state
  const [agentLookupAgent, setAgentLookupAgent] = useState(null);

  // Presentation Setup window (new for VANBIBBER KYLE A)
  const { openWindow: openPresentationSetup, isOpen: isPresentationSetupOpen } = usePresentationWindow();

  // Check if user is VANBIBBER KYLE A
  const isPresentationUser = user?.lagnname === 'VANBIBBER KYLE A';
  
  // Presentation menu state
  const [showPresentationMenu, setShowPresentationMenu] = useState(false);

  // Quick Actions modals
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [showDailyActivityModal, setShowDailyActivityModal] = useState(false);
  const [showMoreReportModal, setShowMoreReportModal] = useState(false);

  // Quick Actions onboarding tooltip
  const [showQuickActionsTip, setShowQuickActionsTip] = useState(false);

  useEffect(() => {
    if (onboardingMode || isMobile) return;
    try {
      if (!localStorage.getItem('quickActionsTipSeen')) {
        const timer = setTimeout(() => setShowQuickActionsTip(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch (_) { /* localStorage unavailable */ }
  }, [onboardingMode, isMobile]);

  const dismissQuickActionsTip = () => {
    setShowQuickActionsTip(false);
    try { localStorage.setItem('quickActionsTipSeen', '1'); } catch (_) { /* ignore */ }
  };

  // Agency menu state
  const [showAgencyMenu, setShowAgencyMenu] = useState(false);
  const [agencyMenuPosition, setAgencyMenuPosition] = useState({ x: 0, y: 0 });
  const agencyMenuRef = useRef(null);

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
  const hamburgerContainerRef = useRef(null);
  
  // State for hamburger menu
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null);

  // Close hamburger menu when clicking outside of it
  useEffect(() => {
    if (!isHamburgerOpen) return;

    const handleClickOutside = (e) => {
      const container = hamburgerContainerRef.current;
      if (container && !container.contains(e.target)) {
        setIsHamburgerOpen(false);
        setActiveSubmenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHamburgerOpen]);

  // Close hamburger and profile menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isHamburgerOpen) {
          setIsHamburgerOpen(false);
          setActiveSubmenu(null);
        }
        if (showProfileMenu) {
          setShowProfileMenu(false);
          setShowUserSwitcher(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHamburgerOpen, showProfileMenu]);

  // Close hamburger menu on route changes
  useEffect(() => {
    setIsHamburgerOpen(false);
    setActiveSubmenu(null);
  }, [location.pathname, location.search]);

  // Agency menu click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAgencyMenu && agencyMenuRef.current && !agencyMenuRef.current.contains(event.target)) {
        setShowAgencyMenu(false);
      }
    };

    if (showAgencyMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAgencyMenu]);

  // Handle logo right-click for agency switching
  const handleLogoContextMenu = (e) => {
    // Only show menu if user has multiple agencies
    if (!hasMultipleAgencies || userAgencies.length <= 1) return;

    e.preventDefault();
    e.stopPropagation();
    
    setAgencyMenuPosition({ x: e.clientX, y: e.clientY });
    setShowAgencyMenu(true);
  };

  // Handle agency selection
  const handleAgencySwitch = async (agency) => {
    setShowAgencyMenu(false);
    if (agency.id === selectedAgency?.id) return;

    try {
      await switchAgency(agency.id);
    } catch (error) {
      console.error('Error switching agency:', error);
      alert('Failed to switch agency. Please try again.');
    }
  };

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
    // Build default URL if none provided
    const userId = user?.userId;
    const userToken = localStorage.getItem('auth_token');
    const presUrl = presFile || `https://ariaslife.com/temp/agent_tools/presentation/pres_setup.html?a=${userToken}&b=${userId}`;

    // For mobile devices, open directly in new tab
    if (isMobile) {
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

  // Get main navigation items (excluding Account & Utilities, Calendar) - declare before profileOptions
  const mainNavItems = navItems.filter(item => !['Account & Utilities', 'Calendar'].includes(item.name));
  const utilitiesItem = navItems.find(item => item.name === 'Account & Utilities');
  const calendarItem = navItems.find(item => item.name === 'Calendar');

  // Profile menu options
  const baseProfileOptions = [
    {
      label: profileCompletionPercent < 100
        ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            Account & Utilities
            <span style={{
              marginLeft: 'auto',
              fontSize: '11px',
              fontWeight: 600,
              color: profileCompletionPercent >= 75 ? '#16a34a' : profileCompletionPercent >= 50 ? '#ca8a04' : '#dc2626',
              background: profileCompletionPercent >= 75 ? '#dcfce7' : profileCompletionPercent >= 50 ? '#fef9c3' : '#fee2e2',
              padding: '2px 6px',
              borderRadius: '10px',
              lineHeight: '1.2'
            }}>
              {profileCompletionCount}/{PROFILE_COMPLETION_TOTAL}
            </span>
          </span>
        : "Account & Utilities",
      onClick: () => navigate("/utilities?section=account"),
      icon: <FiSettings />
    },
    // Calendar (moved from main nav)
    ...(calendarItem ? [{
      label: "Calendar",
      onClick: () => navigate("/calendar"),
      icon: calendarItem.icon
    }] : []),
    {
      label: "Feedback & Updates",
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
    ? baseProfileOptions.filter(opt => ["Account & Utilities", "Dark Mode", "Light Mode", "Logout"].includes(opt.label))
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
  // strict=false (default): match pathname only (for main nav items like "Production")
  // strict=true: also match query params (for submenu items like "Daily Activity")
  const isNavItemActive = (path, strict = false) => {
    if (!path) return false;

    const [pathPathname, pathQueryString] = path.split('?');

    // Pathname must match
    const pathnameMatches = location.pathname === pathPathname || location.pathname.startsWith(`${pathPathname}/`);
    if (!pathnameMatches) return false;

    // Non-strict: pathname match is enough (for main nav items)
    if (!strict) return true;

    // Strict: if the item path has query params, require them to match
    if (pathQueryString) {
      const pathParams = new URLSearchParams(pathQueryString);
      const currentParams = new URLSearchParams(location.search);
      for (const [key, value] of pathParams) {
        if (currentParams.get(key) !== value) return false;
      }
      return true;
    }

    // Strict + no query params in item path: only active when current URL also has no section/active params
    const currentParams = new URLSearchParams(location.search);
    return !currentParams.has('section') && !currentParams.has('active');
  };

  // Get the icon for the current page (main page icon, NOT section icon)
  const getCurrentPageIcon = () => {
    const currentPath = location.pathname;
    
    // Check main nav items - return the MAIN page icon, not submenu
    for (const item of mainNavItems) {
      // Extract pathname from item.path (remove query params for comparison)
      const itemPathname = item.path.split('?')[0];
      
      if (currentPath === itemPathname || currentPath.startsWith(`${itemPathname}/`)) {
        return item.icon;
      }
    }
    
    // Check calendar (moved to profile dropdown)
    if (calendarItem && currentPath === '/calendar') return calendarItem.icon;

    // Check utilities
    if (utilitiesItem) {
      const utilitiesPathname = utilitiesItem.path.split('?')[0];

      if (currentPath === utilitiesPathname || currentPath.startsWith(`${utilitiesPathname}/`)) {
        return utilitiesItem.icon;
      }
    }

    // Default to home icon
    return <FiHome />;
  };

  // Get the main path for the current section (for clicking the icon)
  const getCurrentPagePath = () => {
    const currentPath = location.pathname;

    for (const item of mainNavItems) {
      const itemPathname = item.path.split('?')[0];
      if (currentPath === itemPathname || currentPath.startsWith(`${itemPathname}/`)) {
        return item.path;
      }
    }

    if (calendarItem && currentPath === '/calendar') return '/calendar';

    if (utilitiesItem) {
      const utilitiesPathname = utilitiesItem.path.split('?')[0];
      if (currentPath === utilitiesPathname || currentPath.startsWith(`${utilitiesPathname}/`)) {
        return utilitiesItem.path;
      }
    }

    return '/dashboard';
  };

  // Get the current page name and subpage for breadcrumb
  const getCurrentPageInfo = () => {
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const currentSection = searchParams.get('section') || searchParams.get('active');
    
    // Check main nav items
    for (const item of mainNavItems) {
      // Extract pathname from item.path (remove query params for comparison)
      const itemPathname = item.path.split('?')[0];
      
      if (currentPath === itemPathname || currentPath.startsWith(`${itemPathname}/`)) {
        const pageInfo = { icon: item.icon, name: item.name, path: item.path };
        
        // Check for subpage by matching pathname AND query params
        if (item.submenu && currentSection) {
          for (const subItem of item.submenu) {
            const subItemPathname = subItem.path.split('?')[0];
            const subItemSearch = subItem.path.includes('?') ? subItem.path.split('?')[1] : '';
            const subItemParams = new URLSearchParams(subItemSearch);
            const subItemSection = subItemParams.get('section') || subItemParams.get('active');
            
            // Match if pathname matches AND section/active param matches
            if ((currentPath === subItemPathname || currentPath.startsWith(`${subItemPathname}/`)) 
                && subItemSection === currentSection) {
              pageInfo.subIcon = subItem.icon;
              pageInfo.subName = subItem.name;
              pageInfo.subPath = subItem.path;
              break;
            }
          }
        }
        
        // If no submenu match found, use the query param directly
        if (currentSection && !pageInfo.subName) {
          const sectionLabel = currentSection.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          pageInfo.subName = sectionLabel;
        }
        
        return pageInfo;
      }
    }
    
    // Check calendar (moved to profile dropdown)
    if (calendarItem && currentPath === '/calendar') {
      return { icon: calendarItem.icon, name: 'Calendar', path: '/calendar' };
    }

    // Check utilities
    if (utilitiesItem) {
      const utilitiesPathname = utilitiesItem.path.split('?')[0];

      if (currentPath === utilitiesPathname || currentPath.startsWith(`${utilitiesPathname}/`)) {
        const pageInfo = { icon: utilitiesItem.icon, name: utilitiesItem.name, path: utilitiesItem.path };
        
        // Check for subpage by matching pathname AND query params
        if (utilitiesItem.submenu && currentSection) {
          for (const subItem of utilitiesItem.submenu) {
            const subItemPathname = subItem.path.split('?')[0];
            const subItemSearch = subItem.path.includes('?') ? subItem.path.split('?')[1] : '';
            const subItemParams = new URLSearchParams(subItemSearch);
            const subItemSection = subItemParams.get('section') || subItemParams.get('active');
            
            // Match if pathname matches AND section/active param matches
            if ((currentPath === subItemPathname || currentPath.startsWith(`${subItemPathname}/`)) 
                && subItemSection === currentSection) {
              pageInfo.subIcon = subItem.icon;
              pageInfo.subName = subItem.name;
              pageInfo.subPath = subItem.path;
              break;
            }
          }
        }
        
        // If no submenu match found, use the query param directly
        if (currentSection && !pageInfo.subName) {
          const sectionLabel = currentSection.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          pageInfo.subName = sectionLabel;
        }
        
        return pageInfo;
      }
    }
    
    return null;
  };

  const pageInfo = getCurrentPageInfo();
  const isOnDashboard = location.pathname === '/dashboard' || location.pathname === '/';

  // Determine if user is on their "home" page (no breadcrumb needed)
  const isAppAdmin = isAdmin && teamRole === 'app';
  const isOnHomePage = isOnDashboard;

  return (
    <>
      <div className="modern-header">
        {/* Left section - Logo and Hamburger Menu */}
        <div className="header-left">
          {!isMobile && (
            <>
              <div
                className="header-logo-container"
                onClick={() => navigate('/dashboard')}
                onContextMenu={handleLogoContextMenu}
                style={{ cursor: 'pointer' }}
                title={hasMultipleAgencies ? 'Right-click to switch agencies' : 'Go to dashboard'}
              >
                <div className="logo-icon-default">
                  <Logo size="small" className="header-logo" />
                </div>
                <div className="logo-icon-hover">
                  <FiHome className="home-icon" />
                </div>
              </div>
              
              {/* Separator between logo and hamburger when not on home page */}
              {!isOnHomePage && (
                <FiChevronRight className="logo-hamburger-separator" />
              )}
              
              {/* Hamburger Menu with Slide-out Nav */}
              {!onboardingMode && (
        <div
          className="hamburger-container"
                  ref={hamburgerContainerRef}
                  onMouseEnter={() => {
                    setIsHamburgerOpen(true);
                  }}
                >
                  <button
                    className={`hamburger-menu-btn ${isHamburgerOpen ? 'active' : ''}`}
                    aria-label="Navigation menu"
                    onClick={() => {
                      if (isHamburgerOpen) {
                        setIsHamburgerOpen(false);
                        setActiveSubmenu(null);
                      } else {
                        setIsHamburgerOpen(true);
                      }
                    }}
                  >
                    <span className="hamburger-icon-default">{getCurrentPageIcon()}</span>
                  </button>
                  
                  {/* Dropdown Navigation - Opens below header */}
                  <div
                    className={`hamburger-nav-slideout ${isHamburgerOpen ? 'open' : ''}`}
                    onMouseEnter={() => {
                      if (submenuTimeoutRef.current) {
                        clearTimeout(submenuTimeoutRef.current);
                        submenuTimeoutRef.current = null;
                      }
                    }}
                  >
                    {mainNavItems.map((item) => (
                      <div
                        key={item.name}
                        className="hamburger-nav-group"
                        onMouseEnter={() => {
                          // Clear any pending timeout
                          if (submenuTimeoutRef.current) {
                            clearTimeout(submenuTimeoutRef.current);
                            submenuTimeoutRef.current = null;
                          }

                          // Switch submenu immediately to whichever item is hovered
                          if (item.submenu && item.submenu.length > 0) {
                            setActiveSubmenu(item.name);
                          } else {
                            setActiveSubmenu(null);
                          }
                        }}
                        onMouseLeave={() => {
                          // No auto-close — submenu stays open until user
                          // hovers a different primary item, clicks a page,
                          // or clicks outside the menu.
                        }}
                      >
                        <div
                          className={`hamburger-slide-nav-item ${isNavItemActive(item.path) ? 'active' : ''}`}
                          onClick={() => {
                            navigate(item.path);
                            setIsHamburgerOpen(false);
                            setActiveSubmenu(null);
                          }}
                        >
                          {item.icon && <span className="hamburger-nav-icon">{item.icon}</span>}
                          <span>{item.name}</span>
                          {item.hasWarning && <span className="hamburger-warning-dot"></span>}
                          {item.submenu && item.submenu.length > 0 && <FiChevronRight className="hamburger-submenu-indicator" />}
                        </div>
                        
                        {/* Submenu Items - always rendered, visibility toggled via CSS class */}
                        {item.submenu && item.submenu.length > 0 && (
                          <div
                            className={`hamburger-slide-submenu ${activeSubmenu === item.name ? 'visible' : ''}`}
                            onMouseEnter={() => {
                              // Clear submenu timeout to keep it open
                              if (submenuTimeoutRef.current) {
                                clearTimeout(submenuTimeoutRef.current);
                                submenuTimeoutRef.current = null;
                              }
                            }}
                            onMouseLeave={() => {
                              // No auto-close — submenu stays open until user
                              // hovers a different primary item, clicks a page,
                              // or clicks outside the menu.
                            }}
                          >
                            {item.submenu.map((subItem) => (
                              <div
                                key={subItem.name}
                                className={`hamburger-slide-submenu-item ${isNavItemActive(subItem.path, true) ? 'active' : ''}`}
                                onClick={() => {
                                  navigate(subItem.path);
                                  setIsHamburgerOpen(false);
                                  setActiveSubmenu(null);
                                }}
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
              {pageInfo && pageInfo.subName && (
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
          {/* Upcoming Meetings Banner */}
          {!onboardingMode && <UpcomingMeetingBanner />}

          {/* Global Search */}
          {!isMobile && !onboardingMode && (
            <GlobalSearch theme={theme} toggleTheme={toggleTheme} onOpenAgentProfile={setAgentProfileData} />
        )}


        {/* Quick Actions + button (desktop only) */}
        {!onboardingMode && !isMobile && (
          <div className={`header-quick-actions-wrapper${showQuickActionsTip ? ' tip-active' : ''}`}>
            <button
              className={`header-icon-btn header-quick-actions-btn${showQuickActionsTip ? ' highlighted' : ''}`}
              title="Quick Actions"
            >
              <FiPlus />
            </button>
            <div className={`header-quick-actions-menu${showQuickActionsTip ? ' force-visible' : ''}`}>
              <div className="header-quick-actions-item" onClick={() => { dismissQuickActionsTip(); openPres('https://salebase.ai/presentation/presentation.php'); }}>
                <FiMonitor />
                <span>Start Presentation</span>
              </div>
              <div className="header-quick-actions-item" onClick={() => { dismissQuickActionsTip(); setShowAddSaleModal(true); }}>
                <FiDollarSign />
                <span>Add Sale</span>
              </div>
              <div className="header-quick-actions-item" onClick={() => { dismissQuickActionsTip(); setShowDailyActivityModal(true); }}>
                <FiActivity />
                <span>Report Daily Activity</span>
              </div>
              {['MGA', 'RGA'].includes(user?.clname) && (
                <div className="header-quick-actions-item" onClick={() => { dismissQuickActionsTip(); setShowMoreReportModal(true); }}>
                  <FiTrendingUp />
                  <span>Report M.O.R.E</span>
                </div>
              )}
            </div>
            {showQuickActionsTip && (
              <>
                <div className="quick-actions-tip-backdrop" onClick={dismissQuickActionsTip} />
                <div className="quick-actions-tip-bubble">
                  <div className="quick-actions-tip-arrow" />
                  <strong>Quick Actions</strong>
                  <p>Start presentations, log sales, and report activity — all from one spot.</p>
                  <button className="quick-actions-tip-dismiss" onClick={dismissQuickActionsTip}>Got it</button>
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Agent Lookup */}
        {!onboardingMode && (
          <AgentLookup
            onSelectAgent={setAgentLookupAgent}
            selectedAgent={agentLookupAgent}
            onClearAgent={() => setAgentLookupAgent(null)}
          />
        )}

        {/* Notification Center */}
        {!onboardingMode && <NotificationCenter />}
        
        {/* Profile Picture with Dropdown */}
        <div className="profile">
          <div className="profile-ring-wrapper" onClick={handleProfileClick}>
            {profileCompletionPercent < 100 && (
              <svg className="profile-progress-ring" viewBox="0 0 48 48">
                {/* Background track */}
                <circle
                  className="profile-progress-track"
                  cx="24" cy="24" r="22"
                  fill="none"
                  strokeWidth="2.5"
                />
                {/* Progress arc */}
                <circle
                  className="profile-progress-bar"
                  cx="24" cy="24" r="22"
                  fill="none"
                  strokeWidth="2.5"
                  strokeDasharray={`${(profileCompletionPercent / 100) * 2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                />
              </svg>
            )}
            <img
              src={profilePic}
              alt="Profile"
              className={`profile-pic ${isImpersonating ? 'impersonating' : ''}`}
            />
          </div>

          {/* Floating nudge tooltip pointing at profile icon */}
          {showProfileNudge && !showProfileMenu && (
            <div className="profile-nudge">
              <button className="profile-nudge-close" onClick={(e) => { e.stopPropagation(); dismissProfileNudge(); }} aria-label="Dismiss">
                <FiX size={14} />
              </button>
              <div className="profile-nudge-content" onClick={() => { dismissProfileNudge(); navigate('/utilities?section=account'); }}>
                <span className="profile-nudge-emoji">👋</span>
                <div className="profile-nudge-text">
                  <strong>Complete your profile!</strong>
                  <span>{profileCompletionCount}/{PROFILE_COMPLETION_TOTAL} steps done — click to finish up.</span>
                </div>
              </div>
              <div className="profile-nudge-arrow" />
            </div>
          )}
          
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

      {/* Agent Lookup Overlay */}
      {agentLookupAgent && (
        <AgentLookupOverlay
          agentData={agentLookupAgent}
          onClose={() => setAgentLookupAgent(null)}
        />
      )}

      {/* Quick Action Modals */}
      {showAddSaleModal && (
        <AddSaleModal
          onClose={() => setShowAddSaleModal(false)}
          onSaleAdded={() => setShowAddSaleModal(false)}
        />
      )}
      {showDailyActivityModal && (
        <QuickDailyActivityModal onClose={() => setShowDailyActivityModal(false)} />
      )}
      {showMoreReportModal && (
        <QuickMoreReportModal onClose={() => setShowMoreReportModal(false)} user={user} />
      )}

      {/* Agency Switcher Context Menu */}
      {showAgencyMenu && hasMultipleAgencies && (
        <div
          ref={agencyMenuRef}
          className="agency-context-menu"
          style={{
            position: 'fixed',
            top: agencyMenuPosition.y,
            left: agencyMenuPosition.x,
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: '8px 0',
            minWidth: '220px',
            zIndex: 10000,
          }}
        >
          <div style={{ 
            padding: '8px 16px', 
            fontSize: '12px', 
            fontWeight: '600', 
            color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '4px'
          }}>
            Switch Agency
          </div>
          {userAgencies.map((agency) => (
            <div
              key={agency.id}
              onClick={() => handleAgencySwitch(agency)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '14px',
                color: 'var(--text-primary)',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span>{agency.display_name || agency.rept_name}</span>
              {selectedAgency?.id === agency.id && (
                <FiCheck style={{ color: 'var(--primary-color)', fontSize: '16px' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Header;


