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
  const [view, setView] = useState('mga'); // Default to MGA view
  
  return (
    <div className="scorecard">
      {showTabs && (
        <div className="tabs">
          <input
            type="radio"
            id="mga"
            name="view_type"
            value="mga"
            checked={view === 'mga'}
            onChange={() => setView('mga')}
          />
          <label htmlFor="mga">MGA</label>

          <input
            type="radio"
            id="breakdown"
            name="view_type"
            value="breakdown"
            checked={view === 'breakdown'}
            onChange={() => setView('breakdown')}
          />
          <label htmlFor="breakdown">Breakdown</label>
        </div>
      )}
      {showTabs ? (
        view === 'mga' ? (
          <ScorecardTable />

        ) : (
          <ScorecardSGAView />
        )
      ) : (
        <ScorecardTable />
      )}
    </div>
  );
};

export default Scorecard;
