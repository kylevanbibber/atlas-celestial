import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiActivity, FiBarChart2, FiTarget, FiCheckCircle, FiAward, FiList, FiPercent } from 'react-icons/fi';
import './Production.css';

// Import component files
import ProductionSidebar from '../components/production/ProductionSidebar';
import DailyActivityForm from '../components/production/DailyActivityForm';
import ProductionReports from '../components/production/ProductionReports';
import ProductionGoals from '../components/production/ProductionGoals';
import Verify from '../components/production/Verify';
import Release from '../components/production/Release';
import Scorecard from '../components/production/Scorecard/Scorecard';
import { ProgressProvider } from '../components/production/ProgressContext';
import LeaderboardPage from './LeaderboardPage';

console.log('🏭 Production.js: File is being loaded!');

// Main Production page component
const Production = () => {
  console.log('🏭 Production.js: Production component is rendering');
  console.log('🏭 Production.js: Current URL:', window.location.href);
  
  const [activeSection, setActiveSection] = useState('daily-activity');
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('🏭 Production.js: Initial activeSection:', activeSection);
  console.log('🏭 Production.js: Current location.search:', location.search);
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && ['daily-activity', 'reports', 'scorecard', 'leaderboard', 'goals', 'verification'].includes(section)) {
      setActiveSection(section);
    }
  }, [location]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/production?section=${section}`, { replace: true });
  };
  
  // Production navigation items (alphabetical order)
  const productionItems = [
    { id: 'daily-activity', label: 'Daily Activity', icon: <FiActivity /> },
    { id: 'goals', label: 'Goals', icon: <FiTarget /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <FiAward /> },
    { id: 'reports', label: 'Reports', icon: <FiBarChart2 /> },
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
        console.log('🏭 Production.js: Rendering DailyActivityForm');
        return <DailyActivityForm />;
      case 'reports':
        console.log('🏭 Production.js: About to render ProductionReports component!');
        console.log('🏭 Production.js: ProductionReports component reference:', ProductionReports);
        return <ProductionReports />;

      case 'scorecard':
        console.log('🏭 Production.js: Rendering Scorecard');
        return <Scorecard />;

      case 'leaderboard':
        console.log('🏭 Production.js: Rendering LeaderboardPage');
        return <LeaderboardPage />;
      case 'goals':
        console.log('🏭 Production.js: Rendering ProductionGoals');
        return <ProductionGoals />;
      
      case 'verification':
        console.log('🏭 Production.js: Rendering Verify component');
        return <Verify />;
      default:
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