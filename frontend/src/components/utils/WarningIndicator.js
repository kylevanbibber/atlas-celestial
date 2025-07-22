import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

const WarningIndicator = ({ size = 16 }) => {
  return (
    <div className="warning-indicator">
      <FiAlertCircle size={size} color="#f2c94c" />
    </div>
  );
};

export default WarningIndicator; 