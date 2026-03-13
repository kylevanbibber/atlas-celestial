import React from 'react';
import { useLocation } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';
import './SecondaryHeader.css';

/**
 * SecondaryHeader - A flexible container that sits between the main header and page content
 * 
 * Props:
 * - breadcrumbs: Optional custom breadcrumb items
 * - showBreadcrumbs: Boolean to show/hide breadcrumbs (default: true)
 * - leftContent: Custom content for the left side (overrides breadcrumbs)
 * - rightContent: Custom content for the right side (filters, actions, etc.)
 * - className: Additional CSS classes
 */
const SecondaryHeader = ({ 
  breadcrumbs,
  showBreadcrumbs = true,
  leftContent,
  rightContent,
  children,
  className = ''
}) => {
  const location = useLocation();
  
  // Don't show on dashboard
  if (location.pathname === '/dashboard') {
    return null;
  }

  const hasContent = leftContent || rightContent || children || showBreadcrumbs;
  
  if (!hasContent) {
    return null;
  }

  return (
    <div className={`secondary-header ${className}`}>
      <div className="secondary-header-container">
        {/* Left Section - Breadcrumbs or custom content */}
        <div className="secondary-header-left">
          {leftContent || (showBreadcrumbs && <Breadcrumb items={breadcrumbs} />)}
        </div>

        {/* Right Section - Filters, actions, etc. */}
        {rightContent && (
          <div className="secondary-header-right">
            {rightContent}
          </div>
        )}

        {/* Custom children content (full width if no left/right) */}
        {children && (
          <div className="secondary-header-content">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default SecondaryHeader;
