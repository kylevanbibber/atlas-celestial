import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ProductionReports from '../components/production/ProductionReports';
import Release from '../components/production/release/Release';
import LeadsUtilities from '../components/utilities/LeadsUtilities';
import LicenseUtilities from '../components/utilities/LicenseUtilities';
import AdminLicensing from '../components/admin/AdminLicensing';
import RefsPage from './refs/page';
import Feedback from '../components/feedback/Feedback';
import Updates from '../components/training/Updates';
import MedicationSearch from '../components/medication/MedicationSearch';
import { FiFileText, FiMail, FiClipboard, FiList, FiActivity, FiTrendingUp } from 'react-icons/fi';
import RefSales from '../components/refvalidation/RefSales';
import '../pages/utilities/Utilities.css';
// import SecondarySidebar from '../components/utils/SecondarySidebar';
import { useAuth } from '../context/AuthContext';
import { useLicenseWarning } from '../context/LicenseWarningContext';

const Reports = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const { hasWarning: licenseWarning } = useLicenseWarning();
  
  // Check if user is admin with teamRole="app"
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Check if user should see AdminLicensing (app admins OR hierarchy managers)
  const canSeeAdminLicensing = isAppAdmin || ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  
  // Check if user can view refs
  const canViewRefs = hasPermission('view_refs');
  
  // Check if user should see Trial Toolkit (exclude AGT, SA, GA, MGA, RGA)
  const canSeeTrialToolkit = !['AGT', 'SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  
  // Default section - land users on Leads when no section is selected
  const [active, setActive] = useState('leads');
  
  // Parse the active section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const activeParam = params.get('active');
    
    // Define valid sections based on user type
    let validSections = ['reports', 'release', 'feedback', 'trial-toolkit', 'leads', 'licensing', 'ref-sales'];
    
    // Add refs if user has permission
    if (canViewRefs) {
      validSections.push('refs');
    }
    
    if (activeParam && validSections.includes(activeParam)) {
      setActive(activeParam);
      return;
    }

    const fallbackActive = 'leads';
    setActive(fallbackActive);
    navigate(`/resources?active=${fallbackActive}`, { replace: true });
  }, [location, isAppAdmin, canViewRefs, navigate]);

  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActive(section);
    navigate(`/resources?active=${section}`, { replace: true });
  };

  // Define navigation items based on user type
  const baseItems = [
    { id: 'reports', label: 'Reports', icon: <FiFileText /> }
  ];
  
  // Add refs if user has permission
  const refsItems = canViewRefs ? [
    { id: 'refs', label: 'Refs Collected', icon: <FiClipboard /> }
  ] : [];
  
  // Add ref sales
  const refSalesItem = [
    { id: 'ref-sales', label: 'Ref Sales', icon: <FiTrendingUp /> }
  ];
  
  // Add release
  const releaseItem = [
    { id: 'release', label: 'Release', icon: <FiList /> }
  ];
  
  // Add trial toolkit (only if user is allowed to see it)
  const trialToolkitItem = canSeeTrialToolkit ? [
    { id: 'trial-toolkit', label: 'Trial Toolkit', icon: <FiActivity /> }
  ] : [];
  
  // Add leads and licensing (available to all users)
  const additionalItems = [
    { id: 'leads', label: 'Leads', icon: <FiMail /> },
    { id: 'licensing', label: 'Licensing', icon: <FiFileText /> }
  ];
  
  const items = [...baseItems, ...refsItems, ...refSalesItem, ...releaseItem, ...trialToolkitItem, ...additionalItems];
  
  // Items that need warning indicators
  const warningItems = licenseWarning ? ['licensing'] : [];

  // Check if there's an active parameter
  const params = new URLSearchParams(location.search);
  const hasActive = params.has('active');

  // If no active parameter, the effect above will redirect to a default section
  if (!hasActive) {
    return null;
  }

  return (
    <div className="settings-container">
      {/* Breadcrumb Navigation now in Header */}
      
      {/* <SecondarySidebar
        items={items}
        activeItem={active}
        onItemClick={handleSectionChange}
        warningItems={warningItems}
      /> */}
      <div className="settings-content">
        <div className="padded-content">
          {active === 'reports' && <ProductionReports />}
          {active === 'release' && <Release />}
          {active === 'feedback' && (
            <>
              <Feedback />
              <div style={{ marginTop: '2rem' }}>
                <Updates />
              </div>
            </>
          )}
          {active === 'trial-toolkit' && <MedicationSearch />}
          {active === 'refs' && canViewRefs && <RefsPage />}
          {active === 'ref-sales' && <RefSales />}
          {active === 'leads' && <LeadsUtilities />}
          {active === 'licensing' && (
            <>
              {/* Non-app users get their personal license utilities */}
              {!isAppAdmin && <LicenseUtilities />}
              
              {/* App admins and hierarchy managers get admin licensing */}
              {canSeeAdminLicensing && (
                <div style={{ marginTop: isAppAdmin ? '0' : '2rem' }}>
                  <AdminLicensing />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports; 