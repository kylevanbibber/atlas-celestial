import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiPenTool, FiUsers, FiFileText, FiBell } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';
import './Settings.css';

// Import component files
import SettingsSidebar from '../../components/settings/SettingsSidebar';
import AccountSettings from '../../components/settings/AccountSettings';
import DiscordSettings from '../../components/settings/discord/DiscordSettings';
import HierarchyViewSelector from '../../components/settings/HierarchyViewSelector';
import LicenseSettings from '../../components/settings/LicenseSettings';
import AdminLicensing from '../../components/admin/AdminLicensing';
import NotificationSettings from '../../components/settings/notification/NotificationSettings';
import { useLicenseWarning } from '../../context/LicenseWarningContext';
import { useAuth } from '../../context/AuthContext';

// Main Settings page component
const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user } = useAuth();
  
  // Check if user is admin with teamRole="app" - hide account and customize options
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Default section based on user type
  const defaultSection = isAppAdmin ? 'hierarchy' : 'account';
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Define valid sections based on user type
    const validSections = isAppAdmin 
      ? ['hierarchy', 'licensing', 'notifications'] // Exclude account, customize, and discord for app admins
      : ['account', 'hierarchy', 'licensing', 'notifications', 'discord']; // Remove customize for all users
    
    if (section && validSections.includes(section)) {
      setActiveSection(section);
    } else if (!section) {
      // Set default section if no section in URL
      setActiveSection(defaultSection);
    }
  }, [location, isAppAdmin, defaultSection]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/settings?section=${section}`, { replace: true });
  };
  
  // Settings navigation items (filtered based on user type)
  const allSettingsItems = [
    { id: 'account', label: 'Account', icon: <FiUser /> },
    { id: 'hierarchy', label: 'Hierarchy', icon: <FiUsers /> },
    { id: 'customize', label: 'Customize', icon: <FiPenTool /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
    { id: 'discord', label: 'Discord', icon: <FaDiscord /> },
    { id: 'licensing', label: 'Licensing', icon: <FiFileText /> },
  ];
  
  // Filter out account, customize, and discord options for app admins
  const settingsItems = isAppAdmin 
    ? allSettingsItems.filter(item => !['account', 'customize', 'discord'].includes(item.id))
    : allSettingsItems.filter(item => item.id !== 'customize'); // Hide customize for all users
  
  // Items that need warning indicators
  const warningItems = licenseWarning ? ['licensing'] : [];
  
  // Render the selected settings section
  const renderSettingsSection = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings />;
      case 'hierarchy':
        return <HierarchyViewSelector />;
      case 'discord':
        return <DiscordSettings />;
      case 'licensing':
        return isAppAdmin ? <AdminLicensing /> : <LicenseSettings />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return isAppAdmin ? <HierarchyViewSelector /> : <AccountSettings />;
    }
  };
  
  return (
    <div className="settings-container">
      <SettingsSidebar 
        items={settingsItems} 
        activeItem={activeSection} 
        onItemClick={handleSectionChange} 
        warningItems={warningItems}
      />
      <div className="settings-content">
        <div className="padded-content">
          {renderSettingsSection()}
        </div>
      </div>
    </div>
  );
};

export default Settings; 