import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiActivity, FiCheckCircle, FiAward, FiList, FiPercent, FiTarget, FiTrendingUp, FiHome, FiUsers, FiBarChart2, FiFileText } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useAgency } from '../context/AgencyContext';
import './Production.css';

// Import component files
import SecondarySidebar from '../components/utils/SecondarySidebar';
import Page from '../components/Layout/Page';
import ProductionDashboard from '../components/dashboard/ProductionDashboard';
import DailyActivityForm from '../components/production/activity/DailyActivityForm';
import ProductionTracker from '../components/production/activity/ProductionTracker';
import ProductionGoals from '../components/production/ProductionGoals';
import Verify from '../components/production/verification/Verify';
import Release from '../components/production/release/Release';
import Scorecard from '../components/production/Scorecard/Scorecard';
import ScorecardAlt from '../components/production/Scorecard/ScorecardAlt';
import { ProgressProvider } from '../components/production/release/ProgressContext';
import LeaderboardPage from './LeaderboardPage';
import OneOnOne from './OneOnOne';
import Pnp from '../components/utils/Pnp';
import ActivityGoalsCombinedPage from '../components/production/ActivityGoalsCombinedPage';
import PayeeWebReport from '../components/production/PayeeWebReport';


// Main Production page component
const Production = () => {
  const { user } = useAuth();
  const { selectedAgency } = useAgency();
  
  // Check if we should use the alternative scorecard for non-default SGAs
  const useAltScorecard = selectedAgency && !selectedAgency.is_default;
  
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
  let defaultSection = 'dashboard'; // Start with dashboard
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Build available sections dynamically based on permissions
    let availableSections = [];
    
    // Dashboard (everyone)
    availableSections.push('dashboard');
    
    // Daily Activity
    if (!shouldHideDailyActivity) {
      availableSections.push('activity-goals');
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
    
    // Goals (hide for app team and SGA non-admin)
    if (!shouldHideGoals) {
      availableSections.push('goals');
    }
    
    // 1-on-1 (hide for app admins and SGA non-admins)
    if (!shouldHideDailyActivity) {
      availableSections.push('oneonone');
    }
    
    // P&P (everyone)
    availableSections.push('pnp');

    // PayeeWeb (all users — backend scopes by hierarchy)
    availableSections.push('payeeweb');

    // If no section parameter, default to dashboard (don't redirect)
    if (!section) {
      setActiveSection(defaultSection);
      return;
    }

    if (availableSections.includes(section)) {
      setActiveSection(section);
    } else if (!availableSections.includes(activeSection)) {
      // If current section is not available, switch to default
      setActiveSection(defaultSection);
      navigate(`/production`, { replace: true });
    }
  }, [location, shouldHideDailyActivity, activeSection, navigate, isAppTeam, hasProductionTrackerAccess, shouldHideGoals, hideVerificationForSGA, hideDailyActivity, defaultSection]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    // Only add section param if it's not dashboard
    if (section === 'dashboard') {
      navigate(`/production`, { replace: true });
    } else {
      navigate(`/production?section=${section}`, { replace: true });
    }
  };
  
  // Production navigation items - conditionally built based on permissions
  let productionItems = [];
  
  // Dashboard (everyone) - always first
  productionItems.push({ id: 'dashboard', label: 'Dashboard', icon: <FiHome /> });
  
  // Daily Activity (hide for app admins and SGA non-admins)
  if (!shouldHideDailyActivity) {
    productionItems.push({ id: 'activity-goals', label: 'Activity & Goals', icon: <FiActivity /> });
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
  
  // 1-on-1 (hide for app admins and SGA non-admins)
  if (!shouldHideDailyActivity) {
    productionItems.push({ id: 'oneonone', label: '1-on-1', icon: <FiUsers /> });
  }
  
  // P&P (everyone)
  productionItems.push({ id: 'pnp', label: 'P&P', icon: <FiBarChart2 /> });

  // PayeeWeb (all users — backend scopes by hierarchy)
  productionItems.push({ id: 'payeeweb', label: 'PayeeWeb', icon: <FiFileText /> });
  
  // Items that need warning indicators (none for now)
  const warningItems = [];
  
  // Render the selected production section
  const renderProductionSection = () => {
    // Helper to render the appropriate scorecard based on selected SGA
    const renderScorecard = () => useAltScorecard ? <ScorecardAlt /> : <Scorecard />;
    
    switch (activeSection) {
      case 'dashboard':
        return <ProductionDashboard user={user} />;
        
      case 'activity-goals':
        if (shouldHideDailyActivity) {
          return renderScorecard();
        }
        return <ActivityGoalsCombinedPage />;
      
      case 'production-tracker':
        return <ProductionTracker />;

      case 'goals':
        if (shouldHideGoals) {
          return renderScorecard();
        }
        return <ProductionGoals />;

      case 'scorecard':
        return renderScorecard();

      case 'leaderboard':
        return <LeaderboardPage />;
      
      case 'verification':
        if (hideVerificationForSGA) {
          return renderScorecard();
        }
        return <Verify />;
      
      case 'release':
        return <Release />;
      
      case 'oneonone':
        return <OneOnOne />;
      
      case 'pnp':
        return <Pnp />;

      case 'payeeweb':
        return <PayeeWebReport />;

      default:
        return <ProductionDashboard user={user} />;
    }
  };
  
  return (
    <Page>
      <div className="settings-container">
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
    </Page>
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