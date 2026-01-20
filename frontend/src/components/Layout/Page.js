import React from 'react';
import './Page.css';

/**
 * Page Component - Wrapper for all pages
 * Note: Breadcrumb is now shown in the header, not here
 * @param {React.ReactNode} children - Page content
 * @param {string} className - Additional CSS classes
 */
const Page = ({ children, className = '' }) => {
  return (
    <div className={`page-wrapper ${className}`}>
      <div className="page-inner">
        {children}
      </div>
    </div>
  );
};

export default Page;
