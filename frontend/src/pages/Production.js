import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiActivity, FiCheckCircle, FiAward, FiList, FiPercent } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import './Production.css';

// Import component files
import ProductionSidebar from '../components/production/ProductionSidebar';
import DailyActivityForm from '../components/production/activity/DailyActivityForm';

import Verify from '../components/production/verification/Verify';
import Release from '../components/production/release/Release';
import Scorecard from '../components/production/Scorecard/Scorecard';
import { ProgressProvider } from '../components/production/release/ProgressContext';
import LeaderboardPage from './LeaderboardPage';

console.log('🏭 Production.js: File is being loaded!');

// Main Production page component
const Production = () => {
  console.log('🏭 Production.js: Production component is rendering');
  console.log('🏭 Production.js: Current URL:', window.location.href);
  
  const { user } = useAuth();
  
  // Check if user is admin with teamRole="app" to hide daily activity and set default section
  const hideDailyActivity = user?.Role === 'Admin' && user?.teamRole === 'app';
  const defaultSection = hideDailyActivity ? 'verification' : 'daily-activity';
  
  const [activeSection, setActiveSection] = useState(defaultSection);
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('🏭 Production.js: Initial activeSection:', activeSection);
  console.log('🏭 Production.js: Current location.search:', location.search);
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    // Define available sections based on user permissions
    const availableSections = hideDailyActivity 
      ? ['scorecard', 'leaderboard', 'verification', 'release']
      : ['daily-activity', 'scorecard', 'leaderboard', 'verification'];
    
    if (section && availableSections.includes(section)) {
      setActiveSection(section);
    } else if (hideDailyActivity && activeSection === 'daily-activity') {
      // If daily activity is hidden and current section is daily-activity, switch to verification
      setActiveSection('verification');
      navigate('/production?section=verification', { replace: true });
    }
  }, [location, hideDailyActivity, activeSection, navigate]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/production?section=${section}`, { replace: true });
  };
  
  // Production navigation items (alphabetical order)
  const productionItems = [
    ...(hideDailyActivity ? [] : [{ id: 'daily-activity', label: 'Daily Activity', icon: <FiActivity /> }]),
    { id: 'leaderboard', label: 'Leaderboard', icon: <FiAward /> },
    ...(hideDailyActivity ? [{ id: 'release', label: 'Release', icon: <FiList /> }] : []),
    { id: 'scorecard', label: 'Scorecard', icon: <FiPercent /> },
    { id: 'verification', label: 'Verification', icon: <FiCheckCircle /> },
  ];
  
  // Items that need warning indicators (none for now)
  const warningItems = [];
  
  // Render the selected production section
  const renderProductionSection = () => {
    console.log('🏭 Production.js: renderProductionSection called with activeSection:', activeSection);
    console.log('🏭 Production.js: About to render section:', activeSection);
    
    switch (activeSection) {
      case 'daily-activity':
        if (hideDailyActivity) {
          console.log('🏭 Production.js: Daily Activity is hidden for this user, redirecting to scorecard');
          return <Scorecard />;
        }
        console.log('🏭 Production.js: Rendering DailyActivityForm');
        return <DailyActivityForm />;

      case 'scorecard':
        console.log('🏭 Production.js: Rendering Scorecard');
        return <Scorecard />;

      case 'leaderboard':
        console.log('🏭 Production.js: Rendering LeaderboardPage');
        return <LeaderboardPage />;
      
      case 'verification':
        console.log('🏭 Production.js: Rendering Verify component');
        return <Verify />;
      
      case 'release':
        console.log('🏭 Production.js: Rendering Release component');
        return <Release />;
        
      default:
        if (hideDailyActivity) {
          console.log('🏭 Production.js: Default case - Daily Activity hidden, rendering Verify');
          return <Verify />;
        }
        console.log('🏭 Production.js: Default case - rendering DailyActivityForm');
        return <DailyActivityForm />;
    }
  };
  
  return (
    <div className="settings-container">
      <ProductionSidebar 
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

const ProductionGoalsPlaceholder = () => (
  <div>
    <h2>Production Goals</h2>
    <p>This section will contain goal setting and tracking features.</p>
  </div>
);



export default Production; 