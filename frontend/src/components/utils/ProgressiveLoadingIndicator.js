import React from 'react';
import './ProgressiveLoadingIndicator.css';

/**
 * Progressive Loading Indicator Component
 * Shows which stages of data are loading in a progressive loading scenario
 * 
 * @param {object} loadingStages - { structure: bool, licenses: bool, pnp: bool }
 * @param {string} size - 'small' | 'medium' | 'large'
 * @param {boolean} inline - If true, displays inline. If false, displays as overlay
 */
const ProgressiveLoadingIndicator = ({ 
  loadingStages = {}, 
  size = 'small',
  inline = true,
  showLabels = true
}) => {
  // Don't show if nothing is loading
  if (!loadingStages.structure && !loadingStages.licenses && !loadingStages.pnp) {
    return null;
  }

  const stages = [
    { 
      key: 'structure', 
      label: 'Structure', 
      icon: '👥',
      loading: loadingStages.structure 
    },
    { 
      key: 'licenses', 
      label: 'Licenses', 
      icon: '📜',
      loading: loadingStages.licenses 
    },
    { 
      key: 'pnp', 
      label: 'Metrics', 
      icon: '📊',
      loading: loadingStages.pnp 
    }
  ];

  if (inline) {
    return (
      <div className={`progressive-loading-indicator inline ${size}`}>
        {stages.map(stage => (
          <div 
            key={stage.key} 
            className={`stage ${stage.loading ? 'loading' : 'complete'}`}
            title={stage.loading ? `Loading ${stage.label}...` : `${stage.label} loaded`}
          >
            <span className="icon">{stage.icon}</span>
            {showLabels && (
              <span className="label">
                {stage.loading ? (
                  <>
                    <span className="spinner"></span>
                    {stage.label}...
                  </>
                ) : (
                  <>✓ {stage.label}</>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Overlay mode for full-page loading
  return (
    <div className={`progressive-loading-indicator overlay ${size}`}>
      <div className="loading-card">
        <h3>Loading Data</h3>
        <div className="stages-list">
          {stages.map(stage => (
            <div 
              key={stage.key} 
              className={`stage-item ${stage.loading ? 'loading' : 'complete'}`}
            >
              <span className="icon">{stage.icon}</span>
              <span className="label">{stage.label}</span>
              {stage.loading ? (
                <span className="spinner-small"></span>
              ) : (
                <span className="checkmark">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Simple skeleton loader for data sections
 */
export const DataSkeleton = ({ width = '100%', height = '20px', borderRadius = '4px' }) => {
  return (
    <div 
      className="data-skeleton" 
      style={{ width, height, borderRadius }}
    />
  );
};

/**
 * Skeleton for license badges
 */
export const LicenseSkeleton = () => {
  return (
    <div className="license-skeleton-container">
      <DataSkeleton width="40px" height="24px" borderRadius="12px" />
      <DataSkeleton width="40px" height="24px" borderRadius="12px" />
      <DataSkeleton width="40px" height="24px" borderRadius="12px" />
    </div>
  );
};

/**
 * Skeleton for PNP metrics
 */
export const PnpSkeleton = () => {
  return (
    <div className="pnp-skeleton-container">
      <DataSkeleton width="80px" height="16px" />
      <DataSkeleton width="60px" height="14px" />
    </div>
  );
};

export default ProgressiveLoadingIndicator;

