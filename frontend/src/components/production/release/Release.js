import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Checklist from './Checklist';
import AgentProgressTable from './AgentProgressTable';
import { ProgressProvider } from './ProgressContext';
import './Release.css';

const Release = () => {
  // default view is "table"
  const [view, setView] = useState('table');
  const { user } = useAuth();

  // Show loading state if user data is not available
  if (!user) {
    return (
      <div className="loading-state">
        <p>Loading...</p>
      </div>
    );
  }

  // Check if user is Admin or Manager based on clname
  const isAdmin = user?.clname === 'Admin' || user?.Role === 'Admin';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);

  // Combined view: show checklist above table only for AGT; managers/admins see only table
  const isAgent = user?.clname === 'AGT';

  return (
    <ProgressProvider>
      <div className="release">
        {isAgent ? (
          <Checklist />
        ) : (
          <AgentProgressTable />
        )}
      </div>
    </ProgressProvider>
  );
};

export default Release; 