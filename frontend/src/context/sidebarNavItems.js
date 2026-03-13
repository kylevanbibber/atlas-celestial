// src/config/sidebarNavItems.js
import React from "react";
import { FiHome, FiClipboard, FiSettings, FiBell, FiShield, FiUsers, FiList, FiTrendingUp, FiUserPlus, FiBookOpen, FiEdit3, FiBarChart2, FiUser, FiMessageSquare, FiActivity, FiTarget, FiAward, FiPercent, FiCheckCircle, FiStar, FiPhone, FiFileText, FiMail, FiCalendar, FiSend, FiMonitor, FiPenTool, FiTrello, FiLink } from "react-icons/fi";

/**
 * Get sidebar navigation items with status indicators
 * @param {boolean} hasLicenseWarning - Whether there are license warnings
 * @param {boolean} isAdmin - Whether the user is an admin
 * @param {number} unreadNotifications - Number of unread notifications
 * @param {string} teamRole - The user's team role (for admin users)
 * @param {number} userId - The user's ID for conditional features
 * @param {string} userLagnname - The user's lagnname for conditional features
 * @param {string} userClname - The user's clname for conditional features
 * @param {function} hasPageAccess - Function to check if user has access to a page (SGA permissions)
 * @returns {Array} Navigation items with status indicators
 */
const getSidebarNavItems = (hasLicenseWarning = false, isAdmin = false, unreadNotifications = 0, teamRole = null, userId = null, userLagnname = null, userClname = null, hasPageAccess = null) => {
  // Check user type for conditional sections
  const isAppAdmin = teamRole === 'app' || isAdmin;
  const isSGANonAdmin = userClname === 'SGA' && !isAdmin;
  const canSeeTrialToolkit = !['AGT', 'SA', 'GA', 'MGA', 'RGA'].includes(userClname);
  const canViewRefs = isAdmin; // Add your permission check here
  const isKyle = userLagnname?.toUpperCase().includes('VANBIBBER') || userId === 92;
  
  // Build Production submenu based on user permissions
  const productionSubmenu = [];
  const shouldHideDailyActivity = teamRole === 'app' || isSGANonAdmin;
  const shouldHideGoals = teamRole === 'app' || isSGANonAdmin;
  const hasProductionTrackerAccess = userClname === 'SGA' || teamRole === 'app';
  const hideVerificationForSGA = isSGANonAdmin;
  
  // Dashboard - always first for everyone (no section param)
  productionSubmenu.push({ name: "Dashboard", path: "/production", icon: <FiHome /> });
  
  if (!shouldHideDailyActivity) {
    productionSubmenu.push({ name: "Activity & Goals", path: "/production?section=activity-goals", icon: <FiActivity /> });
  }
  productionSubmenu.push({ name: "Leaderboard", path: "/production?section=leaderboard", icon: <FiAward /> });
  if (hasProductionTrackerAccess) {
    productionSubmenu.push({ name: "Production Tracker", path: "/production?section=production-tracker", icon: <FiTrendingUp /> });
  }
  productionSubmenu.push({ name: "Scorecard", path: "/production?section=scorecard", icon: <FiPercent /> });
  if (!hideVerificationForSGA) {
    productionSubmenu.push({ name: "Verification", path: "/production?section=verification", icon: <FiCheckCircle /> });
  }
  if (!shouldHideDailyActivity) {
    productionSubmenu.push({ name: "1-on-1", path: "/production?section=oneonone", icon: <FiUsers /> });
  }
  productionSubmenu.push({ name: "P&P", path: "/production?section=pnp", icon: <FiBarChart2 /> });
  productionSubmenu.push({ name: "PayeeWeb", path: "/production?section=payeeweb", icon: <FiFileText /> });
  
  // Build Training submenu
  const trainingSubmenu = [
    { name: "Release", path: "/training?section=release", icon: <FiList /> },
    { name: "Roleplay Call", path: "/training?section=roleplay", icon: <FiPhone /> },
  ];
  
  // Build Resources submenu based on user type
  const resourcesSubmenu = [
    { name: "Reports", path: "/resources?active=reports", icon: <FiFileText /> }
  ];
  if (canViewRefs) {
    resourcesSubmenu.push({ name: "Refs Collected", path: "/resources?active=refs", icon: <FiClipboard /> });
  }
  resourcesSubmenu.push({ name: "Ref Sales", path: "/resources?active=ref-sales", icon: <FiTrendingUp /> });
  resourcesSubmenu.push({ name: "Release", path: "/resources?active=release", icon: <FiList /> });
    if (canSeeTrialToolkit) {
    resourcesSubmenu.push({ name: "Trial Toolkit", path: "/resources?active=trial-toolkit", icon: <FiActivity /> });
    }
    resourcesSubmenu.push(
    { name: "Leads", path: "/resources?active=leads", icon: <FiMail /> },
    { name: "Licensing", path: "/resources?active=licensing", icon: <FiFileText />, hasWarning: hasLicenseWarning }
  );
  
  // Build Utilities submenu based on user permissions
  const utilitiesSubmenu = [];
  if (!isAppAdmin && !isSGANonAdmin) {
    utilitiesSubmenu.push(
      { name: "Account", path: "/utilities?section=account", icon: <FiUser /> }
    );
  } else if (isAdmin) {
    utilitiesSubmenu.push(
      { name: "Account", path: "/utilities?section=account", icon: <FiUser /> }
    );
  }
  utilitiesSubmenu.push(
    { name: "Hierarchy", path: "/utilities?section=hierarchy", icon: <FiUsers /> },
    { name: "Notifications", path: "/utilities?section=notifications", icon: <FiBell /> },
    { name: "Integrations", path: "/utilities?section=integrations", icon: <FiLink /> }
  );
  if (isAdmin || isAppAdmin) {
    utilitiesSubmenu.push(
      { name: "Calendar Admin", path: "/utilities?section=calendar-admin", icon: <FiCalendar /> },
      { name: "Date Overrides", path: "/utilities?section=date-overrides", icon: <FiCalendar /> },
      { name: "Competitions", path: "/utilities?section=competitions", icon: <FiAward /> }
    );
  }
  if (isKyle) {
    utilitiesSubmenu.push({ name: "Analytics", path: "/utilities?section=analytics", icon: <FiActivity /> });
  }
  if (isAdmin && isAppAdmin) {
    utilitiesSubmenu.push({ name: "Email Campaigns", path: "/utilities?section=email-campaigns", icon: <FiSend /> });
  }
  
  // Add Login Logs to Utilities submenu for Kyle or Admins
  if (isKyle || isAdmin) {
    utilitiesSubmenu.push({ name: "Login Logs", path: "/admin/login-logs", icon: <FiUser /> });
    utilitiesSubmenu.push({ name: "Process Monitor", path: "/utilities?section=process-monitor", icon: <FiMonitor /> });
  }
  
  // Build Recruiting submenu
  const recruitingSubmenu = [
    { name: "Pipeline", path: "/recruiting?section=pipeline", icon: <FiTrello /> },
    { name: "Codes & VIPs", path: "/recruiting?section=vips", icon: <FiStar /> },
    { name: "M.O.R.E", path: "/recruiting?section=more-report", icon: <FiBarChart2 /> },
  ];

  // Add Objectives for MGA/RGA users only
  if (['MGA', 'RGA', 'SGA'].includes(userClname)) {
    recruitingSubmenu.push({ name: "Objectives", path: "/recruiting?section=objectives", icon: <FiTarget /> });
  }
  
  const navItems = [
  {
    name: "Home",
    path: "/dashboard",
    icon: <FiHome />,
  }
  ];

  navItems.push({
    name: "Calendar",
    path: "/calendar",
    icon: <FiCalendar />,
  });

  // For app admins, add their specific navigation items
  if (teamRole === 'app') {
    navItems.push(
      {
        name: "Ref Entry",
        path: "/ref-entry",
        icon: <FiEdit3 />,
      },
      {
        name: "Verification",
        path: "/production?section=verification",
        icon: <FiCheckCircle />,
      },
      {
        name: "Leads",
        path: "/resources?active=leads",
        icon: <FiMail />,
      },
      {
        name: "Promotions",
        path: "/promotion-tracking",
        icon: <FiTrendingUp />,
      },
      {
        name: "Reports",
        path: "/reports",
        icon: <FiFileText />,
      },
      {
        name: "Leaderboard",
        path: "/production?section=leaderboard",
        icon: <FiAward />,
      },
      {
        name: "P&P",
        path: "/production?section=pnp",
        icon: <FiBarChart2 />,
      }
    );
  } else {
    // For regular users, add Production and Resources
    navItems.push(
      {
        name: "Production",
        path: "/production",
        icon: <FiTrendingUp />,
        submenu: productionSubmenu
      },
      {
        name: "Resources",
        path: "/resources?active=leads",
        icon: <FiClipboard />,
        submenu: resourcesSubmenu
      }
    );
  }

 

  // Training hidden per user request
  // navItems.push({
  //   name: "Training",
  //   path: "/training",
  //   icon: <FiBookOpen />,
  //   submenu: trainingSubmenu
  // });

  // Add Account & Utilities (no submenu - direct link to account)
  navItems.push({
    name: "Account & Utilities",
    path: "/utilities?section=account",
    icon: <FiSettings />,
    hasWarning: hasLicenseWarning,
  });

  // Add Recruiting only if user is not an app team role user
  const hideForAppRole = teamRole === 'app';
  
  if (!hideForAppRole) {
    navItems.push({
      name: "Recruiting",
      path: "/recruiting?section=pipeline",
      icon: <FiUserPlus />,
      submenu: recruitingSubmenu
    });
  }
  
  // Text Campaigns - hardcoded user access
  const TEXT_CAMPAIGN_USER_IDS = [92, 24281, 27996];
  if (TEXT_CAMPAIGN_USER_IDS.includes(userId)) {
    navItems.push({
      name: "Text Campaigns",
      path: "/text-campaigns",
      icon: <FiMessageSquare />,
    });
  }

  // Admin section removed - admin users don't need the admin badge in sidebar
  // Admin functionality is still accessible via direct URLs:
  // /admin/notifications, /admin/hierarchy, /admin/hierarchy-table
  
  // Filter navigation items based on SGA page permissions
  // Skip filtering for app team role users - they have a curated nav
  if (hasPageAccess && typeof hasPageAccess === 'function' && teamRole !== 'app') {
    return navItems.filter(item => {
      // Map navigation paths to page_keys
      const pathToPageKey = {
        '/production': 'production',
        '/resources': 'resources',
        '/recruiting': 'recruiting',
        '/utilities': 'utilities',
        '/promotion-tracking': 'production_overview',
        '/ref-entry': 'refs',
      };
      
      // Dashboard, Calendar, and Text Campaigns are always accessible (if shown)
      if (item.path === '/dashboard' || item.path === '/calendar' || item.path === '/text-campaigns') {
        return true;
      }
      
      // Extract the base path without query parameters for matching
      const basePath = item.path ? item.path.split('?')[0] : '';
      
      // Check if this item requires permission
      const pageKey = pathToPageKey[basePath];
      if (pageKey) {
        return hasPageAccess(pageKey);
      }
      
      // If no mapping exists, hide it by default for safety
      // Admin and special pages should be explicitly mapped if needed
      return false;
    });
  }
  
  return navItems;
};

// For backwards compatibility, export a default version
export const sidebarNavItems = getSidebarNavItems();

// Export the function for components that need to customize based on state
export default getSidebarNavItems;
