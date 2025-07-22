import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import ScorecardTable from './ScorecardTable';
import ScorecardSGAView from './ScorecardSGAView';
import ScorecardRGAView from './ScorecardRGAView'; // Import the RGA view component
import './Scorecard.css';

const Scorecard = () => {
  // Get user data from auth context
  const { user } = useAuth();
  const userRole = user?.clname?.toUpperCase();
  
  const allowedRoles = ["MGA", "RGA", "SGA"];
  const showTabs = allowedRoles.includes(userRole);
  const [view, setView] = useState('mga'); // Default to MGA view
  
  return (
    <div className="scorecard">
      <h4 style={{ marginLeft: '15px' }}>Scorecard</h4>
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
            id="rga"
            name="view_type"
            value="rga"
            checked={view === 'rga'}
            onChange={() => setView('rga')}
          />
          <label htmlFor="rga">RGA</label>
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
        ) : view === 'rga' ? (
          <ScorecardRGAView /> // Render the RGA view component
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
