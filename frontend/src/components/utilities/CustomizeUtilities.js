import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiArrowRight } from 'react-icons/fi';
import ThemeContext from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { PermissionControl } from '../common';
import { PERMISSIONS } from '../../context/permissionsConfig';
import '../../pages/settings/Settings.css';

// Customize settings component
const CustomizeSettings = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Toggle styles based on device width
  const toggleStyles = {
    container: {
      display: 'flex',
      alignItems: 'center',
      maxWidth: isMobile ? '100px' : '120px',
      marginLeft: isMobile ? 'auto' : '0'
    },
    switch: {
      position: 'relative',
      display: 'inline-block',
      width: isMobile ? '46px' : '51px',
      height: isMobile ? '28px' : '31px',
      marginRight: '10px',
      flexShrink: 0
    },
    label: {
      fontSize: '14px',
      whiteSpace: 'nowrap',
      marginLeft: isMobile ? '2px' : '0'
    }
  };
  
  // Check for mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div className="settings-section">
      <h1 className="settings-section-title">Customize</h1>
      
      {/* Personal Theme Settings */}
      <div className="settings-card">
        <h2 className="settings-card-title">Theme</h2>
        
        <div className="settings-row theme-settings-row">
          <label htmlFor="darkmode-toggle">Dark Mode</label>
          <div className="switch-container" style={toggleStyles.container}>
            <label className="switch" style={toggleStyles.switch}>
              <input 
                type="checkbox" 
                id="darkmode-toggle"
                checked={theme === 'dark'} 
                onChange={toggleTheme} 
              />
              <span className="slider"></span>
            </label>
            <span className="switch-label" style={toggleStyles.label}>
              {theme === 'dark' ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Team Customization Card - Using permission control system */}
      <PermissionControl 
        permission={PERMISSIONS.EDIT_TEAM}
        showLocked={true}
        lockMessage="Team Customization Locked"
        unlockCriteria="Available to MGA level and above"
      >
        <div className="settings-card team-custom-card">
          <h2 className="settings-card-title">
            <FiUsers className="settings-card-icon" />
            Team Customization
          </h2>
          
          <p className="settings-card-description">
            Customize the appearance of the application for all users in your team.
            Set custom colors, upload your team logo, and more.
          </p>
          
          <Link to="/team-customization" className="team-custom-link">
            Manage Team Appearance
            <FiArrowRight className="arrow-icon" />
          </Link>
        </div>
      </PermissionControl>

    </div>
  );
};

export default CustomizeSettings; 