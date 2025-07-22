import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Checklist from './Checklist';
import AgentProgressTable from './AgentProgressTable';
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

  // Admins and Managers get radio buttons to switch between table & checklist
  if (isAdmin || isManager) {
    return (
      <div>
        <div className="tabs">
          <input
            type="radio"
            id="table"
            name="view_type"
            value="table"
            checked={view === 'table'}
            onChange={() => setView('table')}
          />
          <label htmlFor="table">Table</label>

          <input
            type="radio"
            id="checklist"
            name="view_type"
            value="checklist"
            checked={view === 'checklist'}
            onChange={() => setView('checklist')}
          />
          <label htmlFor="checklist">Checklist</label>
        </div>

        {/* Render only the selected view */}
        {view === 'table' ? (
          <AgentProgressTable />
        ) : view === 'checklist' ? (
          <Checklist />
        ) : null}
      </div>
    );
  }

  // Non-admins only see the checklist
  return <Checklist />;
};

export default Release; 