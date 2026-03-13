// Tabs.js
import React, { useState } from 'react';
import './Tabs.css';

const Tabs = ({ 
  tabs, 
  defaultActiveTab, 
  onTabChange, 
  activeTab,
  styleSet = 'default',
  className = '',
  children 
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultActiveTab || tabs[0]?.key);
  
  // Use controlled activeTab if provided, otherwise use internal state
  const currentActiveTab = activeTab !== undefined ? activeTab : internalActiveTab;
  
  const handleTabClick = (tabKey) => {
    if (activeTab === undefined) {
      setInternalActiveTab(tabKey);
    }
    if (onTabChange) {
      onTabChange(tabKey);
    }
  };

  return (
    <div className={`tabs-wrapper ${className}`}>
      <div className={`tabs-container tabs-${styleSet}`}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button tab-button-${styleSet} ${
              currentActiveTab === tab.key ? 'active' : ''
            }`}
            onClick={() => handleTabClick(tab.key)}
            disabled={tab.disabled}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            {tab.label}
            {tab.badge && <span className="tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
      
      <div className={`tab-content tab-content-${styleSet}`}>
        {children}
      </div>
    </div>
  );
};

export default Tabs;
