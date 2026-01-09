import React from 'react';
import { useUserHierarchy } from '../../hooks/useUserHierarchy';
import ProgressiveLoadingIndicator, { LicenseSkeleton, PnpSkeleton } from './ProgressiveLoadingIndicator';

/**
 * Example Component - Shows how to use progressive loading indicators
 * 
 * This demonstrates 3 patterns:
 * 1. Page-level loading indicator (shows what's loading)
 * 2. Skeleton loaders (placeholder for specific data)
 * 3. Conditional rendering (show/hide based on loading state)
 */
const ProgressiveLoadingExample = () => {
  const { hierarchyData, hierarchyLoading, loadingStages } = useUserHierarchy();

  // Show full-page loader only for initial structure load
  if (hierarchyLoading && loadingStages.structure) {
    return (
      <ProgressiveLoadingIndicator 
        loadingStages={loadingStages} 
        inline={false}
        size="medium"
      />
    );
  }

  return (
    <div className="page-container">
      {/* Pattern 1: Page-level indicator - shows what's still loading */}
      {(loadingStages.licenses || loadingStages.pnp) && (
        <div style={{ marginBottom: '16px' }}>
          <ProgressiveLoadingIndicator 
            loadingStages={loadingStages}
            inline={true}
            size="small"
            showLabels={true}
          />
        </div>
      )}

      <h2>Team Members</h2>
      
      <div className="team-list">
        {hierarchyData?.raw?.map(user => (
          <div key={user.id} className="user-card">
            {/* Basic info - always available (Stage 1) */}
            <div className="user-basic">
              <img src={user.profpic || '/default-avatar.png'} alt={user.lagnname} />
              <div>
                <h3>{user.lagnname}</h3>
                <p>{user.clname}</p>
                <p>{user.email}</p>
              </div>
            </div>

            {/* Pattern 2: License section with skeleton loader */}
            <div className="user-licenses">
              <strong>Licenses:</strong>
              {loadingStages.licenses ? (
                <LicenseSkeleton />
              ) : user.licenses && user.licenses.length > 0 ? (
                <div className="license-badges">
                  {user.licenses.map(license => (
                    <span key={license.id} className="license-badge">
                      {license.state}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="no-data">No licenses</span>
              )}
            </div>

            {/* Pattern 3: PNP section with skeleton loader */}
            <div className="user-pnp">
              <strong>Performance:</strong>
              {loadingStages.pnp ? (
                <PnpSkeleton />
              ) : user.pnp_data ? (
                <div className="pnp-metrics">
                  <div>Rate: {user.pnp_data.curr_mo_4mo_rate || 'N/A'}</div>
                  <div>Proj: {user.pnp_data.proj_plus_1 || 'N/A'}</div>
                </div>
              ) : (
                <span className="no-data">No PNP data</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Simpler pattern - Just show skeletons without full indicator
 */
export const SimpleProgressiveLoadingExample = () => {
  const { hierarchyData, loadingStages } = useUserHierarchy();

  return (
    <div>
      {hierarchyData?.raw?.map(user => (
        <div key={user.id}>
          <h3>{user.lagnname}</h3>
          
          {/* Just show skeleton or data - no indicator */}
          {loadingStages.licenses ? (
            <LicenseSkeleton />
          ) : (
            <div>{user.licenses?.length || 0} licenses</div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Minimal pattern - Just hide sections until loaded
 */
export const MinimalProgressiveLoadingExample = () => {
  const { hierarchyData, loadingStages } = useUserHierarchy();

  return (
    <div>
      {hierarchyData?.raw?.map(user => (
        <div key={user.id}>
          <h3>{user.lagnname}</h3>
          
          {/* Only show when loaded - no skeleton */}
          {!loadingStages.licenses && user.licenses && (
            <div>
              Licenses: {user.licenses.map(l => l.state).join(', ')}
            </div>
          )}

          {!loadingStages.pnp && user.pnp_data && (
            <div>
              Rate: {user.pnp_data.curr_mo_4mo_rate}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProgressiveLoadingExample;

