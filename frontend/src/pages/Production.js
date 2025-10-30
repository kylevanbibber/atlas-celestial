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

// Main Production page component
const Production = () => {
  const { user } = useAuth();
  
  // Check if user is admin with teamRole="app" to hide daily activity and set default section
  const hideDailyActivity = user?.Role === 'Admin' && user?.teamRole === 'app';
  const isAppTeam = user?.teamRole === 'app';
  const hasProductionTrackerAccess = user?.Role === 'Admin' || user?.teamRole === 'app';
  const defaultSection = hideDailyActivity ? 'production-tracker' : 'daily-activity';
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Define available sections based on user permissions
    let availableSections = hideDailyActivity 
      ? ['production-tracker', 'scorecard', 'leaderboard', 'verification', 'release', 'vips', 'goals']
      : hasProductionTrackerAccess
      ? ['daily-activity', 'production-tracker', 'scorecard', 'leaderboard', 'verification', 'vips', 'goals']
      : ['daily-activity', 'scorecard', 'leaderboard', 'verification', 'vips', 'goals'];
    
    if (section && availableSections.includes(section)) {
      setActiveSection(section);
    } else if (hideDailyActivity && activeSection === 'daily-activity') {
      // If daily activity is hidden and current section is daily-activity, switch to verification
      setActiveSection('verification');
      navigate('/production?section=verification', { replace: true });
    }
  }, [location, hideDailyActivity, activeSection, navigate, isAppTeam, hasProductionTrackerAccess]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/production?section=${section}`, { replace: true });
  };
  
  // Production navigation items (alphabetical order)
  let productionItems = [
    ...(hideDailyActivity ? [] : [{ id: 'daily-activity', label: 'Daily Activity', icon: <FiActivity /> }]),
    { id: 'goals', label: 'Goals', icon: <FiTarget /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <FiAward /> },
    ...(hasProductionTrackerAccess ? [{ id: 'production-tracker', label: 'Production Tracker', icon: <FiTrendingUp /> }] : []),
    ...(hideDailyActivity ? [{ id: 'release', label: 'Release', icon: <FiList /> }] : []),
    { id: 'scorecard', label: 'Scorecard', icon: <FiPercent /> },
    { id: 'verification', label: 'Verification', icon: <FiCheckCircle /> },
  ];
  
  // Add Codes & VIPs section for everyone
  productionItems.push({ id: 'vips', label: 'Codes & VIPs', icon: <FiStar /> });
  
  // Items that need warning indicators (none for now)
  const warningItems = [];
  
  // Render the selected production section
  const renderProductionSection = () => {
    switch (activeSection) {
      case 'daily-activity':
        if (hideDailyActivity) {
          return <Scorecard />;
        }
        return <DailyActivityForm />;
      
      case 'production-tracker':
        return <ProductionTracker />;

      case 'goals':
        return <ProductionGoals />;

      case 'scorecard':
        return <Scorecard />;

      case 'leaderboard':
        return <LeaderboardPage />;
      
      case 'verification':
        return <Verify />;
      
      case 'release':
        return <Release />;
        
      case 'vips':
        return <VIPsPage />;
        
      default:
        if (hideDailyActivity) {
          return <ProductionTracker />;
        }
        return <DailyActivityForm />;
    }
  };
  
  return (
    <div className="settings-container">
      <SecondarySidebar 
        items={productionItems} 
        activeItem={activeSection} 
        onItemClick={handleSectionChange} 
        warningItems={warningItems}
      />
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