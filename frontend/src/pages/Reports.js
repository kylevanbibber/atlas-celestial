import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ProductionReports from '../components/production/ProductionReports';
import Release from '../components/production/release/Release';
import LeadsUtilities from '../components/utilities/LeadsUtilities';
import LicenseUtilities from '../components/utilities/LicenseUtilities';
import AdminLicensing from '../components/admin/AdminLicensing';
import RefsPage from './refs/page';
import { FiFileText, FiMail, FiClipboard, FiList } from 'react-icons/fi';
import '../pages/utilities/Utilities.css';
import SecondarySidebar from '../components/utils/SecondarySidebar';
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
  
  // Default section - for non-app users show reports first
  const [active, setActive] = useState('reports');
  
  // Parse the active section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const activeParam = params.get('active');
    
    // Define valid sections based on user type
    let validSections = ['reports', 'release'];
    
    // Add refs if user has permission
    if (canViewRefs) {
      validSections.push('refs');
    }
    
    // Add leads and licensing for non-app users
    if (!isAppAdmin) {
      validSections.push('leads', 'licensing');
    }
    
    if (activeParam && validSections.includes(activeParam)) {
      setActive(activeParam);
    }
  }, [location, isAppAdmin, canViewRefs]);

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
    { id: 'refs', label: 'Refs', icon: <FiClipboard /> }
  ] : [];
  
  // Add release
  const releaseItem = [
    { id: 'release', label: 'Release', icon: <FiList /> }
  ];
  
  // Add leads and licensing for non-app users
  const additionalItems = !isAppAdmin ? [
    { id: 'leads', label: 'Leads', icon: <FiMail /> },
    { id: 'licensing', label: 'Licensing', icon: <FiFileText /> }
  ] : [];
  
  const items = [...baseItems, ...refsItems, ...releaseItem, ...additionalItems];
  
  // Items that need warning indicators
  const warningItems = licenseWarning && !isAppAdmin ? ['licensing'] : [];

  return (
    <div className="settings-container">
      <SecondarySidebar
        items={items}
        activeItem={active}
        onItemClick={handleSectionChange}
        warningItems={warningItems}
      />
      <div className="settings-content">
        <div className="padded-content">
          {active === 'reports' && <ProductionReports />}
          {active === 'release' && <Release />}
          {active === 'refs' && canViewRefs && <RefsPage />}
          {active === 'leads' && !isAppAdmin && <LeadsUtilities />}
          {active === 'licensing' && !isAppAdmin && (
            <>
              {/* All non-app users get their personal license utilities */}
              <LicenseUtilities />
              
              {/* SA/GA/MGA/RGA users also get admin licensing for their hierarchy */}
              {canSeeAdminLicensing && (
                <div style={{ marginTop: '2rem' }}>
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