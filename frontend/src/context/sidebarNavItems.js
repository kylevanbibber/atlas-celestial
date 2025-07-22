// src/config/sidebarNavItems.js
import React from "react";
import { FiHome, FiClipboard, FiSettings, FiBell, FiShield, FiUsers, FiList, FiTrendingUp, FiUserPlus, FiBookOpen } from "react-icons/fi";

/**
 * Get sidebar navigation items with status indicators
 * @param {boolean} hasLicenseWarning - Whether there are license warnings
 * @param {boolean} isAdmin - Whether the user is an admin
 * @param {number} unreadNotifications - Number of unread notifications
 * @returns {Array} Navigation items with status indicators
 */
const getSidebarNavItems = (hasLicenseWarning = false, isAdmin = false, unreadNotifications = 0) => {
  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <FiHome />,
    },
    // {
    //   name: "Refs",
    //   path: "/refs",
    //   icon: <FiClipboard />,
    // },
    {
      name: "Production",
      path: "/production",
      icon: <FiTrendingUp />,
    },
    {
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
    },
    {
      name: "Recruiting",
      path: "/recruiting",
      icon: <FiUserPlus />,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <FiSettings />,
      hasWarning: hasLicenseWarning, // Add warning indicator flag
    },
  ];
  
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
