// src/config/sidebarNavItems.js
import React from "react";
import { FiHome, FiClipboard, FiSettings, FiBell, FiShield, FiUsers, FiList, FiTrendingUp, FiUserPlus, FiBookOpen, FiEdit3, FiBarChart2, FiUser } from "react-icons/fi";

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
      name: "Reports",
      path: "/reports",
      icon: <FiClipboard />,
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

 

  // Add Settings/Utilities with conditional Login Logs submenu
  const settingsItem = {
    name: teamRole === 'app' ? "Utilities" : "Settings",
    path: "/settings",
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

  // Add Training and Recruiting only if user is not an admin with teamRole="app"
  const hideForAppRole = isAdmin && teamRole === 'app';
  
  if (!hideForAppRole) {
    // Insert Training after Reports (index 2)
    navItems.splice(3, 0, {
      name: "Training",
      path: "/training",
      icon: <FiBookOpen />,
      submenu: [
        {
          name: "Release",
          path: "/training?section=release",
          icon: <FiList />,
        }
      ]
    });
    
    // Insert Recruiting after Training (index 4)
    navItems.splice(4, 0, {
      name: "Recruiting",
      path: "/recruiting",
      icon: <FiUserPlus />,
    });
  }
  
  // Add admin section if user is admin
  if (isAdmin) {
    navItems.push({
      name: "Admin",
      icon: <FiShield />,
      submenu: [
        {
          name: "Notifications",
          path: "/admin/notifications",
          icon: <FiBell />,
        },
        {
          name: "Hierarchy",
          path: "/admin/hierarchy",
          icon: <FiUsers />,
        },
        {
          name: "Hierarchy Table",
          path: "/admin/hierarchy-table",
          icon: <FiList />,
        }
      ]
    });
  }
  
  return navItems;
};

// For backwards compatibility, export a default version
export const sidebarNavItems = getSidebarNavItems();

// Export the function for components that need to customize based on state
export default getSidebarNavItems;
