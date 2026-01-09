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
  
  // Top-level tabs: Agency, MGA Breakdown, RGA Breakdown
  const [activeTab, setActiveTab] = useState('agency'); // 'agency', 'mga', 'rga'
  const [selectedAgency, setSelectedAgency] = useState('All'); // Track selected MGA/RGA in breakdown tabs
  
  return (
    <div className="scorecard">
      {showTabs && (
        <>
          {/* Top-level tabs */}
          <div className="tabs" style={{ marginBottom: '10px' }}>
            <input
              type="radio"
              id="agency"
              name="scorecard_view_type"
              value="agency"
              checked={activeTab === 'agency'}
              onChange={() => {
                setActiveTab('agency');
                setSelectedAgency('All');
              }}
            />
            <label htmlFor="agency">Agency</label>

            <input
              type="radio"
              id="mga"
              name="scorecard_view_type"
              value="mga"
              checked={activeTab === 'mga'}
              onChange={() => {
                setActiveTab('mga');
                setSelectedAgency('All');
              }}
            />
            <label htmlFor="mga">MGA Breakdown</label>

            <input
              type="radio"
              id="rga"
              name="scorecard_view_type"
              value="rga"
              checked={activeTab === 'rga'}
              onChange={() => {
                setActiveTab('rga');
                setSelectedAgency('All');
              }}
            />
            <label htmlFor="rga">RGA Breakdown</label>
          </div>
        </>
      )}
      
      {showTabs ? (
        activeTab === 'agency' ? (
          <ScorecardTable userRole={userRole} activeTab="agency" />
        ) : selectedAgency !== 'All' ? (
          // Show ScorecardTable for specific MGA/RGA with dropdown still visible
          <ScorecardTable 
            key={`${activeTab}-${selectedAgency}`}
            userRole={userRole} 
            activeTab={activeTab}
            selectedAgency={selectedAgency}
            onSelectAgency={setSelectedAgency}
          />
        ) : (
          // Show ScorecardSGAView for "All" view
          <ScorecardSGAView 
            key={`${activeTab}-all`}
            activeTab={activeTab}
            selectedAgency={selectedAgency}
            onSelectAgency={setSelectedAgency}
          />
        )
      ) : (
        <ScorecardTable userRole={userRole} activeTab="agency" />
      )}
    </div>
  );
};

export default Scorecard;
