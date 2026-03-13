import React, { useEffect } from 'react';
import { useUserHierarchy } from '../../hooks/useUserHierarchy';
import ProgressiveLoadingIndicator, { LicenseSkeleton, PnpSkeleton } from './ProgressiveLoadingIndicator';
import './ProgressiveLoadingDebug.css';

/**
 * Debug Component - Add this temporarily to any page to see progressive loading in action
 * 
 * Usage:
 * import ProgressiveLoadingDebug from '../components/utils/ProgressiveLoadingDebug';
 * 
 * function MyPage() {
 *   return (
 *     <div>
 *       <ProgressiveLoadingDebug />
 *       ... rest of your page
 *     </div>
 *   );
 * }
 */
const ProgressiveLoadingDebug = () => {
  const { hierarchyData, hierarchyLoading, loadingStages } = useUserHierarchy();

  // Log whenever loading stages change
  useEffect(() => {
    console.log('🔍 [DEBUG] Loading stages changed:', loadingStages);
  }, [loadingStages]);

  // Log whenever hierarchy data changes
  useEffect(() => {
    if (hierarchyData) {
      console.log('🔍 [DEBUG] Hierarchy data updated:', {
        totalUsers: hierarchyData.raw?.length,
        licensesLoaded: hierarchyData.licensesLoaded,
        pnpLoaded: hierarchyData.pnpLoaded,
        sampleUser: hierarchyData.raw?.[0],
        allIds: hierarchyData.allIds
      });
    }
  }, [hierarchyData]);

  return (
    <div className="progressive-loading-debug">
      <div className="debug-header">
        <h3>🔍 Progressive Loading Debug Panel</h3>
        <span className="debug-badge">Remove this component in production</span>
      </div>

      {/* Loading Stage Indicator */}
      <div className="debug-section">
        <h4>Current Loading State:</h4>
        {(loadingStages.structure || loadingStages.licenses || loadingStages.pnp) ? (
          <ProgressiveLoadingIndicator 
            loadingStages={loadingStages}
            inline={true}
            size="medium"
            showLabels={true}
          />
        ) : (
          <div className="all-loaded">✅ All data loaded!</div>
        )}
      </div>

      {/* Loading Flags */}
      <div className="debug-section">
        <h4>Loading Flags:</h4>
        <div className="debug-flags">
          <div className={`flag ${loadingStages.structure ? 'active' : ''}`}>
            Structure: {loadingStages.structure ? '⏳ Loading' : '✅ Done'}
          </div>
          <div className={`flag ${loadingStages.licenses ? 'active' : ''}`}>
            Licenses: {loadingStages.licenses ? '⏳ Loading' : '✅ Done'}
          </div>
          <div className={`flag ${loadingStages.pnp ? 'active' : ''}`}>
            PNP: {loadingStages.pnp ? '⏳ Loading' : '✅ Done'}
          </div>
        </div>
      </div>

      {/* Hierarchy Data Status */}
      <div className="debug-section">
        <h4>Hierarchy Data:</h4>
        {hierarchyData ? (
          <div className="data-status">
            <div>Total Users: <strong>{hierarchyData.raw?.length || 0}</strong></div>
            <div>Licenses Loaded: <strong>{hierarchyData.licensesLoaded ? '✅ Yes' : '❌ No'}</strong></div>
            <div>PNP Loaded: <strong>{hierarchyData.pnpLoaded ? '✅ Yes' : '❌ No'}</strong></div>
            <div>Cache Age: <strong>{Math.round((Date.now() - hierarchyData.lastFetched) / 1000)}s</strong></div>
          </div>
        ) : (
          <div className="no-data">No hierarchy data</div>
        )}
      </div>

      {/* Sample User Data */}
      {hierarchyData?.raw?.[0] && (
        <div className="debug-section">
          <h4>Sample User (First in List):</h4>
          <div className="sample-user-card">
            <div><strong>Name:</strong> {hierarchyData.raw[0].lagnname}</div>
            <div><strong>ID:</strong> {hierarchyData.raw[0].id}</div>
            <div><strong>Role:</strong> {hierarchyData.raw[0].clname}</div>
            <div><strong>Email:</strong> {hierarchyData.raw[0].email || 'N/A'}</div>
            
            <div className="divider"></div>
            
            <div>
              <strong>Licenses:</strong>
              {loadingStages.licenses ? (
                <LicenseSkeleton />
              ) : hierarchyData.raw[0].licenses ? (
                <span className="success"> ✅ {hierarchyData.raw[0].licenses.length} licenses loaded</span>
              ) : (
                <span className="warning"> ⚠️ No licenses</span>
              )}
            </div>
            
            <div>
              <strong>PNP Data:</strong>
              {loadingStages.pnp ? (
                <PnpSkeleton />
              ) : hierarchyData.raw[0].pnp_data ? (
                <span className="success"> ✅ PNP data loaded (Rate: {hierarchyData.raw[0].pnp_data.curr_mo_4mo_rate})</span>
              ) : (
                <span className="warning"> ⚠️ No PNP data</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="debug-section">
        <h4>Debug Actions:</h4>
        <div className="debug-actions">
          <button 
            onClick={() => {
              console.log('=== FULL DEBUG DUMP ===');
              console.log('hierarchyData:', hierarchyData);
              console.log('loadingStages:', loadingStages);
              console.log('hierarchyLoading:', hierarchyLoading);
              window.__USER_HIERARCHY_DEBUG__?.logCacheStatus();
            }}
            className="debug-btn"
          >
            📋 Log Full State
          </button>
          
          <button 
            onClick={() => {
              window.__USER_HIERARCHY_DEBUG__?.clearCache();
              window.location.reload();
            }}
            className="debug-btn"
          >
            🗑️ Clear Cache & Reload
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="debug-instructions">
        <strong>📖 Instructions:</strong>
        <ul>
          <li>Watch this panel as the page loads</li>
          <li>Check browser console for detailed logs</li>
          <li>Verify all 3 stages complete</li>
          <li>Check that licenses and PNP data appear</li>
          <li><strong>Remove this component before deploying to production!</strong></li>
        </ul>
      </div>
    </div>
  );
};

export default ProgressiveLoadingDebug;

