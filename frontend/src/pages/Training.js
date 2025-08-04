import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiList } from 'react-icons/fi';
import './Training.css';

// Import component files
import TrainingSidebar from '../components/training/TrainingSidebar';
import Release from '../components/production/release/Release';
import { ProgressProvider } from '../components/production/release/ProgressContext';

console.log('🎓 Training.js: File is being loaded!');

// Main Training page component
const Training = () => {
  console.log('🎓 Training.js: Training component is rendering');
  console.log('🎓 Training.js: Current URL:', window.location.href);
  
  const [activeSection, setActiveSection] = useState('release');
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('🎓 Training.js: Initial activeSection:', activeSection);
  console.log('🎓 Training.js: Current location.search:', location.search);
  
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
    console.log('🎓 Training.js: renderTrainingSection called with activeSection:', activeSection);
    console.log('🎓 Training.js: About to render section:', activeSection);
    
    switch (activeSection) {
      case 'release':
        console.log('🎓 Training.js: Rendering Release component');
        return (
          <ProgressProvider>
            <Release />
          </ProgressProvider>
        );
      default:
        console.log('🎓 Training.js: Default case - rendering Release');
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