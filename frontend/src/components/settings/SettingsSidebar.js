import React, { useState, useEffect } from 'react';
import { FiChevronRight, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import '../../pages/settings/Settings.css';
import WarningIndicator from '../utils/WarningIndicator';

// Settings navigation sidebar component
const SettingsSidebar = ({ 
  items, 
  activeItem, 
  onItemClick, 
  warningItems = []
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Check if device is mobile on mount and on resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // Only auto-collapse on mobile
      if (mobile) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    
    // Set initial state
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Find the active item
  const activeItemData = items.find(item => item.id === activeItem);

  return (
    <div className={`settings-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="settings-nav">
        {/* When collapsed on mobile, only show active item */}
        {isCollapsed && isMobile ? (
          <div
            key={activeItemData?.id}
            className="settings-nav-item active"
          >
            <div className="settings-nav-icon">{activeItemData?.icon}</div>
            <div className="settings-nav-label">{activeItemData?.label}</div>
            {warningItems.includes(activeItemData?.id) && <WarningIndicator size={14} />}
            <FiChevronRight className="settings-nav-arrow" />
          </div>
        ) : (
          // Show all items when expanded
          items.map((item) => (
            <div
              key={item.id}
              className={`settings-nav-item ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => onItemClick(item.id)}
            >
              <div className="settings-nav-icon">{item.icon}</div>
              <div className="settings-nav-label">{item.label}</div>
              {warningItems.includes(item.id) && <WarningIndicator size={14} />}
              <FiChevronRight className="settings-nav-arrow" />
            </div>
          ))
        )}
      </div>
      
      {/* Toggle bar, only visible on mobile */}
      {isMobile && (
        <div className="settings-sidebar-toggle" onClick={toggleCollapse}>
          {isCollapsed ? 
            <FiChevronUp className="toggle-icon" style={{ transform: 'rotate(0deg)' }} /> : 
            <FiChevronDown className="toggle-icon" style={{ transform: 'rotate(0deg)' }} />
          }
        </div>
      )}
    </div>
  );
};

export default SettingsSidebar; 