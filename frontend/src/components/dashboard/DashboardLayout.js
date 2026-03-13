/**
 * Reusable Dashboard Layout Component
 * 
 * Provides consistent structure for Production, Recruiting, and Resources dashboards
 * Uses existing CSS classes from Dashboard.css for consistency
 */

import React from 'react';

const DashboardLayout = ({ 
  title, 
  subtitle,
  headerActions,
  gridColumns = 'repeat(auto-fit, minmax(300px, 1fr))',
  children 
}) => {
  return (
    <div className="dashboard-container padded-content-sm">
      <div className="dashboard-cards-wrapper">
        {/* Header Section */}
        {(title || subtitle || headerActions) && (
          <div className="dashboard-header">
            <div>
              {title && <h2 className="section-title" style={{ marginBottom: subtitle ? '0.5rem' : 0 }}>{title}</h2>}
              {subtitle && <p style={{ margin: 0, color: 'var(--text-secondary, #6c757d)', fontSize: '1rem' }}>{subtitle}</p>}
            </div>
            {headerActions && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {headerActions}
              </div>
            )}
          </div>
        )}

        {/* Content Grid - Uses existing card-container class */}
        <div 
          className="card-container"
          style={{
            gridTemplateColumns: gridColumns,
            gap: '1.5rem'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Dashboard Card Component
 * Wraps content in a consistent card style
 */
export const DashboardCard = ({ 
  title, 
  titleIcon,
  headerActions,
  children,
  gridColumn = 'span 1',
  className = ''
}) => {
  return (
    <div 
      className={`dashboard-card ${className}`}
      style={{ 
        gridColumn,
        padding: '1.5rem',
        backgroundColor: 'var(--card-bg, #fff)',
        border: '1px solid var(--border-color, #e0e0e0)'
      }}
    >
      {(title || headerActions) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-color, #e9ecef)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {titleIcon && <span style={{ fontSize: '1.25rem' }}>{titleIcon}</span>}
            <h3 className="card-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              {title}
            </h3>
          </div>
          {headerActions && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;
