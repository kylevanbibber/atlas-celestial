import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUsers, FiTrello } from 'react-icons/fi';
import { Applicants } from '../components/recruiting';
import Pipeline from '../components/recruiting/Pipeline/Pipeline';
// import SecondarySidebar from '../components/utils/SecondarySidebar';
import RecruitingOverview from './RecruitingOverview';
import '../pages/utilities/Utilities.css'; // Reuse utilities styling

const Recruiting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('applicants');
  
  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    
    const validSections = ['applicants', 'pipeline'];
    
    if (section && validSections.includes(section)) {
      setActiveSection(section);
    } else if (!section) {
      // Set default section if no section in URL
      setActiveSection('applicants');
    }
  }, [location]);
  
  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/recruiting?section=${section}`, { replace: true });
  };
  
  // Recruiting navigation items
  const recruitingItems = [
    { id: 'applicants', label: 'Applicants', icon: <FiUsers /> },
    { id: 'pipeline', label: 'Pipeline', icon: <FiTrello /> }
  ];
  
  // Render the selected recruiting section
  const renderRecruitingSection = () => {
    switch (activeSection) {
      case 'applicants':
        return <Applicants />;
      case 'pipeline':
        return <Pipeline />;
      default:
        return <Applicants />;
    }
  };
  
  // Check if there's a section parameter
  const params = new URLSearchParams(location.search);
  const hasSection = params.has('section');

  // If no section parameter, show the overview page
  if (!hasSection) {
    return <RecruitingOverview />;
  }
  
  return (
    <div className="settings-container">
      {/* Breadcrumb Navigation now in Header */}
      
      {/* <SecondarySidebar
        items={recruitingItems}
        activeItem={activeSection}
        onItemClick={handleSectionChange}
        warningItems={[]}
      /> */}
      <div className="settings-content">
        <div className="padded-content">
          {renderRecruitingSection()}
        </div>
      </div>
    </div>
  );
};

export default Recruiting; 