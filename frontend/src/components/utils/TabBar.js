import React from 'react';
import './TabBar.css';

const TabBar = ({ children }) => {
  return (
    <div className="tab-bar">
      {children}
    </div>
  );
};

export default TabBar; 