import React, { useEffect, useState } from 'react';
import { useTeamStyles } from '../context/TeamStyleContext';
import Logo from './Layout/Logo';

const Header = ({ pageTitle }) => {
  const { teamName } = useTeamStyles();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Check if device is mobile on mount and on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <div className="header">
      <div className="header-left">
        <Logo size={isMobile ? "xs" : "small"} className="header-logo" />
        <h1 className="header-title">{pageTitle || teamName}</h1>
      </div>
      
      {/* Other header content */}
    </div>
  );
};

export default Header; 