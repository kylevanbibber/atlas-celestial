import React from 'react';
import { useTeamStyles } from '../../context/TeamStyleContext';
import defaultLogo from '../../img/globe1.png';

const Logo = ({ size = 'medium', className = '' }) => {
  const { logoUrl } = useTeamStyles();
  
  // Size classes
  const sizeClasses = {
    xs: 'logo-xs', // Extra small for mobile header
    small: 'logo-small',
    medium: 'logo-medium',
    large: 'logo-large'
  };
  
  // Use team logo or default logo
  const src = logoUrl || defaultLogo;
  
  return (
    <img 
      src={src} 
      alt="Logo" 
      className={`${sizeClasses[size] || sizeClasses.medium} ${className}`}
    />
  );
};

export default Logo; 