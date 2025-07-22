import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiPenTool, FiUsers, FiFileText, FiBell } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';
import './Settings.css';

// Import component files
import SettingsSidebar from '../../components/settings/SettingsSidebar';
import AccountSettings from '../../components/settings/AccountSettings';
import CustomizeSettings from '../../components/settings/CustomizeSettings';
import DiscordSettings from '../../components/settings/DiscordSettings';
import HierarchyViewSelector from '../../components/settings/HierarchyViewSelector';
import LicenseSettings from '../../components/settings/LicenseSettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import { useLicenseWarning } from '../../context/LicenseWarningContext';

// Main Settings page component
const Settings = () => {
  const [activeSection, setActiveSection] = useState('account');
  const navigate = useNavigate();
  const location = useLocation();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && ['account', 'customize', 'hierarchy', 'licensing', 'notifications', 'discord'].includes(section)) {
      setActiveSection(section);
    }
  }, [location]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/settings?section=${section}`, { replace: true });
  };
  
  // Settings navigation items
  const settingsItems = [
    { id: 'account', label: 'Account', icon: <FiUser /> },
    { id: 'hierarchy', label: 'Hierarchy', icon: <FiUsers /> },
    { id: 'customize', label: 'Customize', icon: <FiPenTool /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
    { id: 'discord', label: 'Discord', icon: <FaDiscord /> },
    { id: 'licensing', label: 'Licensing', icon: <FiFileText /> },
  ];
  
  // Items that need warning indicators
  const warningItems = licenseWarning ? ['licensing'] : [];
  
  // Render the selected settings section
  const renderSettingsSection = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings />;
      case 'hierarchy':
        return <HierarchyViewSelector />;
      case 'customize':
        return <CustomizeSettings />;
      case 'discord':
        return <DiscordSettings />;
      case 'licensing':
        return <LicenseSettings />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return <AccountSettings />;
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