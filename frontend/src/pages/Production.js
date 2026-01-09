import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiActivity, FiCheckCircle, FiAward, FiList, FiPercent, FiStar, FiTarget, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import './Production.css';

// Import component files
import SecondarySidebar from '../components/utils/SecondarySidebar';
import DailyActivityForm from '../components/production/activity/DailyActivityForm';
import ProductionTracker from '../components/production/activity/ProductionTracker';
import ProductionGoals from '../components/production/ProductionGoals';
import Verify from '../components/production/verification/Verify';
import Release from '../components/production/release/Release';
import Scorecard from '../components/production/Scorecard/Scorecard';
import { ProgressProvider } from '../components/production/release/ProgressContext';
import LeaderboardPage from './LeaderboardPage';
import VIPsPage from './vips/page';
import ProductionOverview from './ProductionOverview';

// Main Production page component
const Production = () => {
  const { user } = useAuth();
  
  // Permission checks
  const hideDailyActivity = user?.Role === 'Admin' && user?.teamRole === 'app';
  const isAppTeam = user?.teamRole === 'app';
  const hasProductionTrackerAccess = user?.Role === 'Admin' || user?.teamRole === 'app';
  
  // NEW: Hide Goals tab if teamRole = 'app'
  const hideGoals = user?.teamRole === 'app';
  
  // NEW: Hide Daily Activity, Goals, and Verification for SGA users who are not Admin
  // Use case-insensitive check for clname
  const isSGANonAdmin = String(user?.clname || '').toUpperCase() === 'SGA' && user?.Role !== 'Admin';
  const hideDailyActivityForSGA = isSGANonAdmin;
  const hideGoalsForSGA = isSGANonAdmin;
  const hideVerificationForSGA = isSGANonAdmin;
  
  // Debug logging for SGA permissions
  if (String(user?.clname || '').toUpperCase() === 'SGA') {
    console.log('🔍 Production.js - SGA User Permissions:', {
      clname: user?.clname,
      Role: user?.Role,
      isSGANonAdmin,
      shouldHideDailyActivity: hideDailyActivity || hideDailyActivityForSGA,
      shouldHideGoals: hideGoals || hideGoalsForSGA,
      shouldHideVerification: hideVerificationForSGA
    });
  }
  
  // Combine all daily activity hiding rules
  const shouldHideDailyActivity = hideDailyActivity || hideDailyActivityForSGA;
  
  // Combine all goals hiding rules
  const shouldHideGoals = hideGoals || hideGoalsForSGA;
  
  // Determine default section based on what's available
  let defaultSection = 'scorecard'; // Fallback to scorecard
  if (!shouldHideDailyActivity) {
    defaultSection = 'daily-activity';
  } else if (hasProductionTrackerAccess) {
    defaultSection = 'production-tracker';
  }
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Build available sections dynamically based on permissions
    let availableSections = [];
    
    // Daily Activity
    if (!shouldHideDailyActivity) {
      availableSections.push('daily-activity');
    }
    
    // Production Tracker (Admin or app team only)
    if (hasProductionTrackerAccess) {
      availableSections.push('production-tracker');
    }
    
    // Scorecard (everyone)
    availableSections.push('scorecard');
    
    // Leaderboard (everyone)
    availableSections.push('leaderboard');
    
    // Verification (hide for SGA non-admin)
    if (!hideVerificationForSGA) {
      availableSections.push('verification');
    }
    
    // Release (app team only)
    if (hideDailyActivity) {
      availableSections.push('release');
    }
    
    // VIPs (everyone)
    availableSections.push('vips');
    
    // Goals (hide for app team and SGA non-admin)
    if (!shouldHideGoals) {
      availableSections.push('goals');
    }
    
    if (section && availableSections.includes(section)) {
      setActiveSection(section);
    } else if (!availableSections.includes(activeSection)) {
      // If current section is not available, switch to default
      setActiveSection(defaultSection);
      navigate(`/production?section=${defaultSection}`, { replace: true });
    }
  }, [location, shouldHideDailyActivity, activeSection, navigate, isAppTeam, hasProductionTrackerAccess, shouldHideGoals, hideVerificationForSGA, hideDailyActivity, defaultSection]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/production?section=${section}`, { replace: true });
  };
  
  // Production navigation items - conditionally built based on permissions
  let productionItems = [];
  
  // Daily Activity (hide for app admins and SGA non-admins)
  if (!shouldHideDailyActivity) {
    productionItems.push({ id: 'daily-activity', label: 'Daily Activity', icon: <FiActivity /> });
  }
  
  // Goals (hide for app team and SGA non-admins)
  if (!shouldHideGoals) {
    productionItems.push({ id: 'goals', label: 'Goals', icon: <FiTarget /> });
  }
  
  // Leaderboard (everyone)
  productionItems.push({ id: 'leaderboard', label: 'Leaderboard', icon: <FiAward /> });
  
  // Production Tracker (Admin or app team only)
  if (hasProductionTrackerAccess) {
    productionItems.push({ id: 'production-tracker', label: 'Production Tracker', icon: <FiTrendingUp /> });
  }
  
  // Release (app admins only)
  if (hideDailyActivity) {
    productionItems.push({ id: 'release', label: 'Release', icon: <FiList /> });
  }
  
  // Scorecard (everyone)
  productionItems.push({ id: 'scorecard', label: 'Scorecard', icon: <FiPercent /> });
  
  // Verification (hide for SGA non-admins)
  if (!hideVerificationForSGA) {
    productionItems.push({ id: 'verification', label: 'Verification', icon: <FiCheckCircle /> });
  }
  
  // Add Codes & VIPs section for everyone
  productionItems.push({ id: 'vips', label: 'Codes & VIPs', icon: <FiStar /> });
  
  // Items that need warning indicators (none for now)
  const warningItems = [];
  
  // Render the selected production section
  const renderProductionSection = () => {
    switch (activeSection) {
      case 'daily-activity':
        if (shouldHideDailyActivity) {
          return <Scorecard />;
        }
        return <DailyActivityForm />;
      
      case 'production-tracker':
        return <ProductionTracker />;

      case 'goals':
        if (shouldHideGoals) {
          return <Scorecard />;
        }
        return <ProductionGoals />;

      case 'scorecard':
        return <Scorecard />;

      case 'leaderboard':
        return <LeaderboardPage />;
      
      case 'verification':
        if (hideVerificationForSGA) {
          return <Scorecard />;
        }
        return <Verify />;
      
      case 'release':
        return <Release />;
        
      case 'vips':
        return <VIPsPage />;
        
      default:
        if (shouldHideDailyActivity) {
          if (hasProductionTrackerAccess) {
            return <ProductionTracker />;
          }
          return <Scorecard />;
        }
        return <DailyActivityForm />;
    }
  };
  
  // Check if there's a section parameter
  const params = new URLSearchParams(location.search);
  const hasSection = params.has('section');

  // If no section parameter, show the overview page
  if (!hasSection) {
    return <ProductionOverview />;
  }

  return (
    <div className="settings-container">
      {/* Breadcrumb Navigation now in Header */}
      
      {/* SecondarySidebar removed - navigation now in header dropdown */}
      {/* <SecondarySidebar 
        items={productionItems} 
        activeItem={activeSection} 
        onItemClick={handleSectionChange} 
        warningItems={warningItems}
      /> */}
      <div className="settings-content">
        <div className="padded-content">
          {renderProductionSection()}
        </div>
      </div>
    </div>
  );
};

// Placeholder components for future sections
const ProductionReportsPlaceholder = () => (
  <div>
    <h2>Production Reports</h2>
    <p>This section will contain production reports and analytics.</p>
  </div>
);

export default Production; 