import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiList, FiPhone } from 'react-icons/fi';
import './Training.css';

// Import component files
// import SecondarySidebar from '../components/utils/SecondarySidebar';
import Release from '../components/production/release/Release';
import { ProgressProvider } from '../components/production/release/ProgressContext';
import RoleplayCall from '../components/training/RoleplayCall';
import Page from '../components/Layout/Page';

// Main Training page component
const Training = () => {
  const [activeSection, setActiveSection] = useState('release');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && ['release', 'roleplay'].includes(section)) {
      setActiveSection(section);
    }
  }, [location]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/training?section=${section}`, { replace: true });
  };
  
  // Training navigation items
  const trainingItems = [
    { id: 'release', label: 'Release', icon: <FiList /> },
    { id: 'roleplay', label: 'Roleplay Call', icon: <FiPhone /> },
  ];
  
  // Items that need warning indicators (none for now)
  const warningItems = [];
  
  // Render the selected training section
  const renderTrainingSection = () => {
    switch (activeSection) {
      case 'release':
        return (
          <ProgressProvider>
            <Release />
          </ProgressProvider>
        );
      case 'roleplay':
        return <RoleplayCall />;
      default:
        return (
          <ProgressProvider>
            <Release />
          </ProgressProvider>
        );
    }
  };
  
  return (
    <Page>
      <div className="training-container">
        {/* <SecondarySidebar 
          items={trainingItems} 
          activeItem={activeSection} 
          onItemClick={handleSectionChange} 
          warningItems={warningItems}
        /> */}
        <div className="training-content">
          <div className="padded-content">
            {renderTrainingSection()}
          </div>
        </div>
      </div>
    </Page>
  );
};

export default Training; 