import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiList } from 'react-icons/fi';
import './Training.css';

// Import component files
import TrainingSidebar from '../components/training/TrainingSidebar';
import Release from '../components/production/release/Release';
import { ProgressProvider } from '../components/production/release/ProgressContext';

// Main Training page component
const Training = () => {
  const [activeSection, setActiveSection] = useState('release');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && ['release'].includes(section)) {
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
      default:
        return (
          <ProgressProvider>
            <Release />
          </ProgressProvider>
        );
    }
  };
  
  return (
    <div className="training-container">
      <TrainingSidebar 
        items={trainingItems} 
        activeItem={activeSection} 
        onItemClick={handleSectionChange} 
        warningItems={warningItems}
      />
      <div className="training-content">
        <div className="padded-content">
          {renderTrainingSection()}
        </div>
      </div>
    </div>
  );
};

export default Training; 