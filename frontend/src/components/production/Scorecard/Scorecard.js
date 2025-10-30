import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import ScorecardTable from './ScorecardTable';
import ScorecardSGAView from './ScorecardSGAView';
import './Scorecard.css';

const Scorecard = () => {
  // Get user data from auth context
  const { user } = useAuth();
  
  // Check if user is admin with teamRole="app" - treat as SGA
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  // Use SGA role for app admins, otherwise use actual clname
  const userRole = isAppAdmin ? 'SGA' : user?.clname?.toUpperCase();
  
  const allowedRoles = ["MGA", "RGA", "SGA"];
  const showTabs = allowedRoles.includes(userRole);
  
  // Top-level tabs: Individual/Agency vs Breakdown
  const [topView, setTopView] = useState('individual'); // 'individual' or 'breakdown'
  // Sub-tabs for Individual/Agency view (only for RGA and SGA)
  const [view, setView] = useState('mga'); // 'mga' or 'rga'
  
  // Determine top-level tab labels based on role
  const individualLabel = userRole === 'SGA' ? 'Agency' : 'Individual';
  
  // Show MGA/RGA sub-tabs only for RGA and SGA users (not MGA)
  const showSubTabs = userRole === 'RGA' || userRole === 'SGA';
  
  return (
    <div className="scorecard">
      {showTabs && (
        <>
          {/* Top-level tabs */}
          <div className="tabs" style={{ marginBottom: '10px' }}>
            <input
              type="radio"
              id="individual"
              name="top_view_type"
              value="individual"
              checked={topView === 'individual'}
              onChange={() => setTopView('individual')}
            />
            <label htmlFor="individual">{individualLabel}</label>

            <input
              type="radio"
              id="breakdown"
              name="top_view_type"
              value="breakdown"
              checked={topView === 'breakdown'}
              onChange={() => setTopView('breakdown')}
            />
            <label htmlFor="breakdown">Breakdown</label>
          </div>
          
          {/* Sub-tabs for Individual/Agency view - only show for RGA and SGA */}
          {topView === 'individual' && showSubTabs && (
            <div className="tabs">
              <input
                type="radio"
                id="mga"
                name="sub_view_type"
                value="mga"
                checked={view === 'mga'}
                onChange={() => setView('mga')}
              />
              <label htmlFor="mga">MGA</label>

              <input
                type="radio"
                id="rga"
                name="sub_view_type"
                value="rga"
                checked={view === 'rga'}
                onChange={() => setView('rga')}
              />
              <label htmlFor="rga">RGA</label>
            </div>
          )}
        </>
      )}
      
      {showTabs ? (
        topView === 'individual' ? (
          // For MGA users, always show MGA table (no sub-tabs)
          // For RGA/SGA users, respect the sub-tab selection
          (userRole === 'MGA' || view === 'mga') ? (
            <ScorecardTable filterMode="mga" />
          ) : (
            <ScorecardTable filterMode="rga" />
          )
        ) : (
          <ScorecardSGAView />
        )
      ) : (
        <ScorecardTable filterMode="mga" />
      )}
    </div>
  );
};

export default Scorecard;
