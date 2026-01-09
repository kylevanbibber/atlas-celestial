// src/config/sidebarNavItems.js
import React from "react";
import { FiHome, FiClipboard, FiSettings, FiBell, FiShield, FiUsers, FiList, FiTrendingUp, FiUserPlus, FiBookOpen, FiEdit3, FiBarChart2, FiUser, FiMessageSquare, FiActivity, FiTarget, FiAward, FiPercent, FiCheckCircle, FiStar, FiPhone, FiFileText, FiMail, FiCalendar, FiSend, FiMonitor, FiPenTool, FiTrello } from "react-icons/fi";

/**
 * Get sidebar navigation items with status indicators
 * @param {boolean} hasLicenseWarning - Whether there are license warnings
 * @param {boolean} isAdmin - Whether the user is an admin
 * @param {number} unreadNotifications - Number of unread notifications
 * @param {string} teamRole - The user's team role (for admin users)
 * @param {number} userId - The user's ID for conditional features
 * @param {string} userLagnname - The user's lagnname for conditional features
 * @param {string} userClname - The user's clname for conditional features
 * @returns {Array} Navigation items with status indicators
 */
const getSidebarNavItems = (hasLicenseWarning = false, isAdmin = false, unreadNotifications = 0, teamRole = null, userId = null, userLagnname = null, userClname = null) => {
  // Check user type for conditional sections
  const isAppAdmin = isAdmin && teamRole === 'app';
  const isSGANonAdmin = ['SA', 'GA', 'MGA', 'RGA'].includes(userClname) && !isAdmin;
  const canSeeTrialToolkit = !['AGT', 'SA', 'GA', 'MGA', 'RGA'].includes(userClname);
  const canViewRefs = isAdmin; // Add your permission check here
  const isKyle = userLagnname?.toUpperCase().includes('VANBIBBER') || userId === 92;
  
  // Build Production submenu based on user permissions
  const productionSubmenu = [];
  const shouldHideDailyActivity = isAppAdmin || isSGANonAdmin;
  const shouldHideGoals = isAppAdmin || isSGANonAdmin;
  const hasProductionTrackerAccess = isAdmin || isAppAdmin;
  const hideVerificationForSGA = isSGANonAdmin;
  
  if (!shouldHideDailyActivity) {
    productionSubmenu.push({ name: "Daily Activity", path: "/production?section=daily-activity", icon: <FiActivity /> });
  }
  if (!shouldHideGoals) {
    productionSubmenu.push({ name: "Goals", path: "/production?section=goals", icon: <FiTarget /> });
  }
  productionSubmenu.push({ name: "Leaderboard", path: "/production?section=leaderboard", icon: <FiAward /> });
  if (hasProductionTrackerAccess) {
    productionSubmenu.push({ name: "Production Tracker", path: "/production?section=production-tracker", icon: <FiTrendingUp /> });
  }
  if (isAppAdmin) {
    productionSubmenu.push({ name: "Release", path: "/production?section=release", icon: <FiList /> });
  }
  productionSubmenu.push({ name: "Scorecard", path: "/production?section=scorecard", icon: <FiPercent /> });
  if (!hideVerificationForSGA) {
    productionSubmenu.push({ name: "Verification", path: "/production?section=verification", icon: <FiCheckCircle /> });
  }
  productionSubmenu.push({ name: "Codes & VIPs", path: "/production?section=vips", icon: <FiStar /> });
  
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
    resourcesSubmenu.push({ name: "Refs", path: "/resources?active=refs", icon: <FiClipboard /> });
  }
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
      { name: "Account", path: "/utilities?section=account", icon: <FiUser /> },
      { name: "1-on-1", path: "/utilities?section=oneonone", icon: <FiUsers /> }
    );
  } else if (isAdmin) {
    utilitiesSubmenu.push(
      { name: "Account", path: "/utilities?section=account", icon: <FiUser /> },
      { name: "1-on-1", path: "/utilities?section=oneonone", icon: <FiUsers /> }
    );
  }
  utilitiesSubmenu.push(
    { name: "P&P", path: "/utilities?section=pnp", icon: <FiBarChart2 /> },
    { name: "Hierarchy", path: "/utilities?section=hierarchy", icon: <FiUsers /> },
    { name: "Notifications", path: "/utilities?section=notifications", icon: <FiBell /> }
  );
  if (isAdmin || isAppAdmin) {
    utilitiesSubmenu.push(
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
  }
  
  // Build Recruiting submenu
  const recruitingSubmenu = [
    { name: "Applicants", path: "/recruiting?section=applicants", icon: <FiUsers /> },
    { name: "Pipeline", path: "/recruiting?section=pipeline", icon: <FiTrello /> },
  ];
  
  const navItems = [
  {
    name: isAdmin && teamRole === 'app' ? "Production" : "Dashboard",
    path: isAdmin && teamRole === 'app' ? "/production" : "/dashboard",
    icon: <FiHome />,
  },
    
    {
      name: "Resources",
      path: "/resources",
      icon: <FiClipboard />,
      submenu: resourcesSubmenu
    },
  ];

  // Add Production only if user is not teamRole="app"
  if (!(isAdmin && teamRole === 'app')) {
    navItems.splice(1, 0, {
      name: "Production",
      path: "/production",
      icon: <FiTrendingUp />,
      submenu: productionSubmenu
    });
  } else {
    // For app admins, Production is the Dashboard, so add submenu to it
    navItems[0].submenu = productionSubmenu;
  }

  // Removed 1-on-1 tab for now

  // Add Promotion Tracking for app users
  if (isAdmin && teamRole === 'app') {
    navItems.push({
      name: "Promotions",
      path: "/promotion-tracking",
      icon: <FiBarChart2 />,
    });
  }

  // Add Ref Entry for app users
  if (isAdmin && teamRole === 'app') {
    navItems.push({
      name: "Ref Entry",
      path: "/ref-entry",
      icon: <FiEdit3 />,
    });
  }

 

  // Training hidden per user request
  // navItems.push({
  //   name: "Training",
  //   path: "/training",
  //   icon: <FiBookOpen />,
  //   submenu: trainingSubmenu
  // });

  // Add Utilities with comprehensive submenu
  navItems.push({
    name: "Utilities",
    path: "/utilities",
    icon: <FiSettings />,
    hasWarning: hasLicenseWarning,
    submenu: utilitiesSubmenu
  });

  // Add Recruiting only if user is not an admin with teamRole="app"
  const hideForAppRole = isAdmin && teamRole === 'app';
  
  if (!hideForAppRole) {
    navItems.push({
      name: "Recruiting",
      path: "/recruiting",
      icon: <FiUserPlus />,
      submenu: recruitingSubmenu
    });
  }
  
  // Admin section removed - admin users don't need the admin badge in sidebar
  // Admin functionality is still accessible via direct URLs:
  // /admin/notifications, /admin/hierarchy, /admin/hierarchy-table
  
  return navItems;
};

// For backwards compatibility, export a default version
export const sidebarNavItems = getSidebarNavItems();

// Export the function for components that need to customize based on state
export default getSidebarNavItems;
