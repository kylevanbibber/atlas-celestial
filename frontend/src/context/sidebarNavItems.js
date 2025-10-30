// src/config/sidebarNavItems.js
import React from "react";
import { FiHome, FiClipboard, FiSettings, FiBell, FiShield, FiUsers, FiList, FiTrendingUp, FiUserPlus, FiBookOpen, FiEdit3, FiBarChart2, FiUser, FiMessageSquare } from "react-icons/fi";

/**
 * Get sidebar navigation items with status indicators
 * @param {boolean} hasLicenseWarning - Whether there are license warnings
 * @param {boolean} isAdmin - Whether the user is an admin
 * @param {number} unreadNotifications - Number of unread notifications
 * @param {string} teamRole - The user's team role (for admin users)
 * @param {number} userId - The user's ID for conditional features
 * @returns {Array} Navigation items with status indicators
 */
const getSidebarNavItems = (hasLicenseWarning = false, isAdmin = false, unreadNotifications = 0, teamRole = null, userId = null) => {
  const navItems = [
  {
    name: isAdmin && teamRole === 'app' ? "Production" : "Dashboard",
    path: isAdmin && teamRole === 'app' ? "/production" : "/dashboard",
    icon: <FiHome />,
  },
    // {
    //   name: "Refs",
    //   path: "/refs",
    //   icon: <FiClipboard />,
    // }
    
    {
      name: "Resources",
      path: "/resources",
      icon: <FiClipboard />,
      submenu: [
        {
          name: "Release",
          path: "/resources?active=release",
          icon: <FiList />,
        }
      ]
    },
  ];

  // Add Production only if user is not teamRole="app"
  if (!(isAdmin && teamRole === 'app')) {
    navItems.splice(1, 0, {
      name: "Production",
      path: "/production",
      icon: <FiTrendingUp />,
    });
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

 

  // Add Utilities with conditional Login Logs submenu
  const settingsItem = {
    name: "Utilities",
    path: "/utilities",
    icon: <FiSettings />,
    hasWarning: hasLicenseWarning, // Add warning indicator flag
  };

  // Add submenu for user ID 92 with Login Logs
  if (userId === 92) {
    settingsItem.submenu = [
      {
        name: "Login Logs",
        path: "/admin/login-logs",
        icon: <FiUser />,
      }
    ];
  }

  navItems.push(settingsItem);

  // Add Recruiting only if user is not an admin with teamRole="app"
  const hideForAppRole = isAdmin && teamRole === 'app';
  
  if (!hideForAppRole) {
    // Insert Recruiting after Resources (index 3)
    navItems.splice(3, 0, {
      name: "Recruiting",
      path: "/recruiting",
      icon: <FiUserPlus />,
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
