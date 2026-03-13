import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiTrello, FiBarChart2, FiStar, FiTarget } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import Pipeline from '../components/recruiting/Pipeline/Pipeline';
import MoreReport from '../components/production/reports/MoreReport';
import Objectives from '../components/recruiting/Objectives';
import VIPsPage from './vips/page';
// import SecondarySidebar from '../components/utils/SecondarySidebar';
import Page from '../components/Layout/Page';
import '../pages/utilities/Utilities.css'; // Reuse utilities styling

const Recruiting = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canSeeObjectives = ['MGA', 'RGA', 'SGA'].includes(user?.clname);
  const [activeSection, setActiveSection] = useState('pipeline');

  // Parse the section from URL if available
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');

    // Redirect old applicants URL to pipeline
    if (section === 'applicants') {
      navigate('/recruiting?section=pipeline', { replace: true });
      return;
    }

    const validSections = ['pipeline', 'more-report', 'vips', ...(canSeeObjectives ? ['objectives'] : [])];

    if (section && validSections.includes(section)) {
      setActiveSection(section);
      return;
    }

    const fallbackSection = 'pipeline';
    setActiveSection(fallbackSection);
    navigate(`/recruiting?section=${fallbackSection}`, { replace: true });
  }, [location, navigate]);

  // Update URL when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    navigate(`/recruiting?section=${section}`, { replace: true });
  };

  // Recruiting navigation items
  const recruitingItems = [
    { id: 'vips', label: 'Codes & VIPs', icon: <FiStar /> },
    { id: 'pipeline', label: 'Pipeline', icon: <FiTrello /> },
    { id: 'more-report', label: 'M.O.R.E', icon: <FiBarChart2 /> },
    ...(canSeeObjectives ? [{ id: 'objectives', label: 'Objectives', icon: <FiTarget /> }] : [])
  ];

  // Render the selected recruiting section
  const renderRecruitingSection = () => {
    switch (activeSection) {
      case 'pipeline':
        return <Pipeline />;
      case 'more-report':
        return <MoreReport />;
      case 'vips':
        return <VIPsPage />;
      case 'objectives':
        return <Objectives />;
      default:
        return <Pipeline />;
    }
  };
  
  // Check if there's a section parameter
  const params = new URLSearchParams(location.search);
  const hasSection = params.has('section');

  // If no section parameter, the effect above will redirect to a default section
  if (!hasSection) {
    return null;
  }
  
  return (
    <Page>
      <div className="settings-container">
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
    </Page>
  );
};

export default Recruiting; 