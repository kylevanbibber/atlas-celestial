import React from 'react';
import { useTeamStyles } from '../../context/TeamStyleContext';
import Logo from './Logo';

/**
 * TeamBranding component that displays the team logo and name
 * Use this component for consistent team branding across the app
 */
const TeamBranding = ({ variant = 'horizontal', className = '' }) => {
  const { teamName, logoUrl } = useTeamStyles();
  
  const variants = {
    horizontal: 'flex items-center space-x-2',
    vertical: 'flex flex-col items-center space-y-2',
    compact: 'flex items-center space-x-1'
  };
  
  const logoSizes = {
    horizontal: 'small',
    vertical: 'medium',
    compact: 'small'
  };
  
  const textSizes = {
    horizontal: 'text-lg',
    vertical: 'text-xl text-center',
    compact: 'text-sm'
  };
  
  const variantClass = variants[variant] || variants.horizontal;
  const logoSize = logoSizes[variant] || 'small';
  const textSize = textSizes[variant] || 'text-lg';
  
  return (
    <div className={`team-branding ${variantClass} ${className}`}>
      <Logo size={logoSize} className="team-branding-logo" />
      <h2 className={`team-branding-name ${textSize} font-semibold`}>
        {teamName || 'Arias Organization'}
      </h2>
    </div>
  );
};

export default TeamBranding; 