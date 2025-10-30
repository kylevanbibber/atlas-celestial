import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiPenTool, FiUsers, FiFileText, FiBell, FiAward, FiBarChart2, FiMail, FiCalendar, FiSend } from 'react-icons/fi';
import './Utilities.css';

// Import component files
import SecondarySidebar from '../../components/utils/SecondarySidebar';
import AccountUtilities from '../../components/utilities/AccountUtilities';
import AdminHierarchySettings from '../../components/admin/AdminHierarchySettings';
import LicenseUtilities from '../../components/utilities/LicenseUtilities';
import AdminLicensing from '../../components/admin/AdminLicensing';
import DateOverrides from '../../components/admin/DateOverrides';
import LeadsUtilities from '../../components/utilities/LeadsUtilities';
import NotificationUtilities from '../../components/utilities/notification/NotificationUtilities';
import TrophyUtilities from '../../components/utilities/TrophyUtilities';
import CompetitionUtilities from '../../components/utilities/CompetitionUtilities';
import OneOnOne from '../OneOnOne';
import Pnp from '../../components/utils/Pnp';
import EmailCampaigns from '../admin/EmailCampaigns';
import Updates from '../../components/training/Updates';
import { useLicenseWarning } from '../../context/LicenseWarningContext';
import { useAuth} from '../../context/AuthContext';

// Main Utilities page component
const Utilities = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  const { user } = useAuth();
  
  // Check if user is admin - differentiate between app admin and full admin
  const isAppAdmin = user?.teamRole === 'app' || user?.clname === 'SGA';
  const isFullAdmin = user?.Role === 'Admin';
  const isAppAdminWithRole = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Default section based on user type
  const defaultSection = isAppAdmin ? 'pnp' : 'account';
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Define valid sections based on user type
    let validSections;
    if (isFullAdmin) {
      // Full admins see ALL sections (email-campaigns only for Role=Admin + teamRole=app)
      validSections = ['account', 'oneonone', 'pnp', 'hierarchy', 'notifications', 'licensing', 'leads', 'date-overrides', 'competitions'];
      if (isAppAdminWithRole) {
        validSections.push('email-campaigns');
      }
    } else if (isAppAdmin) {
      // App admins see only admin-specific sections (email-campaigns only for Role=Admin + teamRole=app)
      validSections = ['pnp', 'hierarchy', 'licensing', 'notifications', 'leads', 'date-overrides', 'competitions'];
      if (isAppAdminWithRole) {
        validSections.push('email-campaigns');
      }
    } else {
      // Regular users
      validSections = ['account', 'oneonone', 'pnp', 'hierarchy', 'notifications'];
    }
    
    if (section && validSections.includes(section)) {
      setActiveSection(section);
    } else if (!section) {
      // Set default section if no section in URL
      setActiveSection(defaultSection);
    }
  }, [location, isAppAdmin, isFullAdmin, isAppAdminWithRole, defaultSection]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/utilities?section=${section}`, { replace: true });
  };
  
  // Settings navigation items (filtered based on user type)
  const allSettingsItems = [
    { id: 'account', label: 'Account', icon: <FiUser /> },
    { id: 'oneonone', label: '1-on-1', icon: <FiUsers /> },
    { id: 'pnp', label: 'P&P', icon: <FiBarChart2 /> },
    { id: 'hierarchy', label: 'Hierarchy', icon: <FiUsers /> },
    { id: 'customize', label: 'Customize', icon: <FiPenTool /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell /> },
    { id: 'licensing', label: 'Licensing', icon: <FiFileText /> },
    { id: 'leads', label: 'Leads', icon: <FiMail /> },
    { id: 'date-overrides', label: 'Date Overrides', icon: <FiCalendar /> },
    { id: 'competitions', label: 'Competitions', icon: <FiAward /> },
    { id: 'email-campaigns', label: 'Email Campaigns', icon: <FiSend /> },
  ];
  
  // Filter items based on user type
  let settingsItems;
  if (isFullAdmin) {
    // Full admins see ALL tabs (exclude customize and email-campaigns unless they have teamRole=app)
    settingsItems = allSettingsItems.filter(item => {
      if (item.id === 'customize') return false;
      if (item.id === 'email-campaigns') return isAppAdminWithRole;
      return true;
    });
  } else if (isAppAdmin) {
    // App admins see only admin-specific tabs (email-campaigns only for Role=Admin + teamRole=app)
    settingsItems = allSettingsItems.filter(item => {
      if (['account', 'customize', 'oneonone'].includes(item.id)) return false;
      if (item.id === 'email-campaigns') return isAppAdminWithRole;
      return true;
    });
  } else {
    // Regular users see user-specific tabs (no email-campaigns)
    settingsItems = allSettingsItems.filter(item => !['customize', 'licensing', 'leads', 'date-overrides', 'competitions', 'email-campaigns'].includes(item.id));
  }
  
  // Items that need warning indicators
  const warningItems = licenseWarning && (isAppAdmin || isFullAdmin) ? ['licensing'] : [];
  
  // Render the selected utilities section
  const renderUtilitiesSection = () => {
    switch (activeSection) {
      case 'account':
        return (
          <>
            <AccountUtilities />
            <div style={{ marginTop: '2rem' }}>
              <TrophyUtilities />
            </div>
          </>
        );
      case 'oneonone':
        return <OneOnOne />;
      case 'pnp':
        return <Pnp />;
      case 'hierarchy':
        return <AdminHierarchySettings />;
      case 'licensing':
        return (isAppAdmin || isFullAdmin) ? <AdminLicensing /> : <LicenseUtilities />;
      case 'notifications':
        return (
          <>
            <NotificationUtilities />
            <div style={{ marginTop: '2rem' }}>
              <Updates />
            </div>
          </>
        );
      case 'leads':
        return <LeadsUtilities />;
      case 'date-overrides':
        return <DateOverrides />;
      case 'competitions':
        return <CompetitionUtilities />;
      case 'email-campaigns':
        return isAppAdminWithRole ? <EmailCampaigns /> : <AccountUtilities />;
      default:
        return (isAppAdmin || isFullAdmin) ? <Pnp /> : <AccountUtilities />;
    }
  };
  
  return (
    <div className="settings-container">
      <SecondarySidebar 
        items={settingsItems} 
        activeItem={activeSection} 
        onItemClick={handleSectionChange} 
        warningItems={warningItems}
      />
      <div className="settings-content">
        <div className="padded-content">
          {renderUtilitiesSection()}
        </div>
      </div>
    </div>
  );
};

export default Utilities; 