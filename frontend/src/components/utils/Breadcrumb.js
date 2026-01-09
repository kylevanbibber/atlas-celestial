import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiChevronRight, FiHome } from 'react-icons/fi';
import './Breadcrumb.css';

const Breadcrumb = ({ items = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // If no items provided, generate from current location
  const breadcrumbItems = items.length > 0 ? items : generateBreadcrumbs(location);

  return (
    <nav className="breadcrumb-nav">
      <div className="breadcrumb-container">
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <FiChevronRight className="breadcrumb-separator" />}
            {index === breadcrumbItems.length - 1 ? (
              <span className="breadcrumb-item current">{item.label}</span>
            ) : (
              <button
                className="breadcrumb-item clickable"
                onClick={() => item.path && navigate(item.path)}
              >
                {index === 0 && item.icon ? item.icon : item.label}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
};

// Helper function to generate breadcrumbs from location
const generateBreadcrumbs = (location) => {
  const pathParts = location.pathname.split('/').filter(Boolean);
  const searchParams = new URLSearchParams(location.search);
  
  const breadcrumbs = [
    { label: 'Home', path: '/dashboard', icon: <FiHome /> }
  ];

  if (pathParts.length > 0) {
    const mainPath = pathParts[0];
    const capitalizedPath = mainPath.charAt(0).toUpperCase() + mainPath.slice(1);
    
    breadcrumbs.push({
      label: capitalizedPath,
      path: `/${mainPath}`
    });

    // Add section/subsection if present
    const section = searchParams.get('section') || searchParams.get('active');
    if (section) {
      const sectionLabel = section.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      breadcrumbs.push({
        label: sectionLabel
      });
    }
  }

  return breadcrumbs;
};

export default Breadcrumb;

