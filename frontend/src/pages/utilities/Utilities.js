import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiPenTool, FiUsers, FiFileText, FiBell, FiAward, FiBarChart2, FiMail, FiCalendar, FiSend, FiActivity, FiMonitor } from 'react-icons/fi';
import './Utilities.css';

// Import component files
// import SecondarySidebar from '../../components/utils/SecondarySidebar';
import UtilitiesOverview from '../UtilitiesOverview';
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
import AnalyticsDashboard from '../admin/AnalyticsDashboard';
import PresentationBuilder from '../../components/utilities/PresentationBuilder';
import { useAuth} from '../../context/AuthContext';

// Main Utilities page component
const Utilities = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Check if user is admin - differentiate between app admin and full admin
  const isAppAdmin = user?.teamRole === 'app' || user?.clname === 'SGA';
  const isFullAdmin = user?.Role === 'Admin';
  const isAppAdminWithRole = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // NEW: Check if user is SGA non-admin (hide licensing, leads, date-overrides, competitions)
  const isSGANonAdmin = user?.clname === 'SGA' && user?.Role !== 'Admin';
  
  // Check if user is Kyle VanBibber for Analytics access and Presentation Builder
  const isKyle = user?.lagnname?.toUpperCase().includes('VANBIBBER') || user?.userId === 92;
  const isPresentationUser = false; // Hidden: user?.lagnname === 'VANBIBBER KYLE A'
  
  // Default section based on user type
  // Full admins and regular users should see Account first if they have access to it
  const defaultSection = (isFullAdmin || (!isAppAdmin && !isSGANonAdmin)) ? 'account' : 'pnp';
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Define valid sections based on user type
    let validSections;
    if (isFullAdmin) {
      // Full admins see ALL sections (email-campaigns only for Role=Admin + teamRole=app) - licensing and leads moved to Resources
      validSections = ['account', 'oneonone', 'pnp', 'hierarchy', 'notifications', 'date-overrides', 'competitions'];
      if (isAppAdminWithRole) {
        validSections.push('email-campaigns');
      }
      if (isKyle) {
        validSections.push('analytics');
      }
      if (isPresentationUser) {
        validSections.push('presentation-builder');
      }
    } else if (isSGANonAdmin) {
      // SGA non-admins see limited sections (no licensing, leads, date-overrides, competitions)
      validSections = ['pnp', 'hierarchy', 'notifications'];
    } else if (isAppAdmin) {
      // App admins (teamRole=app) see admin-specific sections - licensing and leads moved to Resources
      validSections = ['pnp', 'hierarchy', 'notifications', 'date-overrides', 'competitions'];
      if (isAppAdminWithRole) {
        validSections.push('email-campaigns');
      }
      if (isKyle) {
        validSections.push('analytics');
      }
      if (isPresentationUser) {
        validSections.push('presentation-builder');
      }
    } else {
      // Regular users
      validSections = ['account', 'oneonone', 'pnp', 'hierarchy', 'notifications'];
      if (isKyle) {
        validSections.push('analytics');
      }
      if (isPresentationUser) {
        validSections.push('presentation-builder');
      }
    }
    
    if (section && validSections.includes(section)) {
      setActiveSection(section);
    } else if (!section || !validSections.includes(activeSection)) {
      // Set default section if no section in URL or current section is invalid
      setActiveSection(defaultSection);
    }
  }, [location, isAppAdmin, isFullAdmin, isAppAdminWithRole, isSGANonAdmin, isKyle, isPresentationUser, defaultSection, activeSection]);
  
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
    { id: 'analytics', label: 'Analytics', icon: <FiActivity /> },
    { id: 'email-campaigns', label: 'Email Campaigns', icon: <FiSend /> },
    { id: 'presentation-builder', label: 'Presentation Builder', icon: <FiMonitor /> },
  ];
  
  // Filter items based on user type
  let settingsItems;
  if (isFullAdmin) {
    // Full admins see ALL tabs (exclude customize, licensing, leads, and email-campaigns unless they have teamRole=app)
    settingsItems = allSettingsItems.filter(item => {
      if (item.id === 'customize') return false;
      if (item.id === 'licensing') return false; // Moved to Resources
      if (item.id === 'leads') return false; // Moved to Resources
      if (item.id === 'email-campaigns') return isAppAdminWithRole;
      if (item.id === 'analytics') return isKyle;
      if (item.id === 'presentation-builder') return isPresentationUser;
      return true;
    });
  } else if (isSGANonAdmin) {
    // SGA non-admins see limited tabs (no account, customize, oneonone, licensing, leads, date-overrides, competitions, email-campaigns, analytics, presentation-builder)
    settingsItems = allSettingsItems.filter(item => {
      if (['account', 'customize', 'oneonone', 'licensing', 'leads', 'date-overrides', 'competitions', 'email-campaigns', 'analytics', 'presentation-builder'].includes(item.id)) return false;
      return true;
    });
  } else if (isAppAdmin) {
    // App admins (teamRole=app) see only admin-specific tabs (exclude licensing and leads - moved to Resources)
    settingsItems = allSettingsItems.filter(item => {
      if (['account', 'customize', 'oneonone', 'licensing', 'leads'].includes(item.id)) return false;
      if (item.id === 'email-campaigns') return isAppAdminWithRole;
      if (item.id === 'analytics') return isKyle;
      if (item.id === 'presentation-builder') return isPresentationUser;
      return true;
    });
  } else {
    // Regular users see user-specific tabs (no email-campaigns, analytics, presentation-builder)
    settingsItems = allSettingsItems.filter(item => {
      if (['customize', 'licensing', 'leads', 'date-overrides', 'competitions', 'email-campaigns', 'analytics'].includes(item.id)) return false;
      if (item.id === 'analytics') return isKyle;
      if (item.id === 'presentation-builder') return isPresentationUser;
      return true;
    });
  }
  
  // Items that need warning indicators (licensing moved to Resources, so no warnings needed here)
  const warningItems = [];
  
  // Render the selected utilities section
  const renderUtilitiesSection = () => {
    switch (activeSection) {
      case 'account':
        if (isSGANonAdmin) return <Pnp />;
        return (
          <>
            <AccountUtilities />
            <div style={{ marginTop: '2rem' }}>
              <TrophyUtilities />
            </div>
          </>
        );
      case 'oneonone':
        if (isSGANonAdmin) return <Pnp />;
        return <OneOnOne />;
      case 'pnp':
        return <Pnp />;
      case 'hierarchy':
        return <AdminHierarchySettings />;
      case 'licensing':
        if (isSGANonAdmin) return <Pnp />;
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
        if (isSGANonAdmin) return <Pnp />;
        return <LeadsUtilities />;
      case 'date-overrides':
        if (isSGANonAdmin) return <Pnp />;
        return <DateOverrides />;
      case 'competitions':
        if (isSGANonAdmin) return <Pnp />;
        return <CompetitionUtilities />;
      case 'analytics':
        return isKyle ? <AnalyticsDashboard /> : <AccountUtilities />;
      case 'email-campaigns':
        return isAppAdminWithRole ? <EmailCampaigns /> : <AccountUtilities />;
      case 'presentation-builder':
        return (user?.lagnname === 'VANBIBBER KYLE A') ? <PresentationBuilder /> : <AccountUtilities />;
      default:
        return (isAppAdmin || isFullAdmin) ? <Pnp /> : <AccountUtilities />;
    }
  };
  
  // Check if there's a section parameter
  const params = new URLSearchParams(location.search);
  const hasSection = params.has('section');

  // If no section parameter, show the overview page
  if (!hasSection) {
    return <UtilitiesOverview />;
  }
  
  return (
    <div className="settings-container">
      {/* Breadcrumb Navigation now in Header */}
      
      {/* <SecondarySidebar 
        items={settingsItems} 
        activeItem={activeSection} 
        onItemClick={handleSectionChange} 
        warningItems={warningItems}
      /> */}
      <div className="settings-content">
        <div className="padded-content">
          {renderUtilitiesSection()}
        </div>
      </div>
    </div>
  );
};

export default Utilities; 