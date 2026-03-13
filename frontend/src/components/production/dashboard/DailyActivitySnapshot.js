/**
 * Daily Activity Snapshot Component
 * 
 * Shows a snapshot of daily activity data based on user role:
 * - AGT: Shows personal activity (from DailyActivityForm data)
 * - SA/GA/MGA/RGA: Shows team activity (from MGADataTable)
 */

import React, { useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import ActivitySnapshotSummary from './ActivitySnapshotSummary';
import './DailyActivitySnapshot.css';

const DailyActivitySnapshot = ({ dateRange, viewScope, userRole: propUserRole, user: propUser }) => {
  const { user: contextUser } = useContext(AuthContext);
  const user = propUser || contextUser;
  
  // Determine if user is team-level (SA/GA/MGA/RGA) or personal (AGT)
  const userRole = (propUserRole || user?.clname)?.toUpperCase();
  
  // Determine what to show based on viewScope
  // If viewScope is 'personal', always show personal view
  // If viewScope is 'team', 'mga', or 'rga', show team view
  const showPersonalView = viewScope === 'personal' || userRole === 'AGT';

  if (!user) {
    return <div className="daily-activity-snapshot loading">Loading user data...</div>;
  }

  return (
    <div className="daily-activity-snapshot">
      {/* Activity Summary Cards */}
      <ActivitySnapshotSummary 
        dateRange={dateRange}
        viewScope={viewScope}
        userRole={userRole}
        user={user}
      />
    </div>
  );
};

export default DailyActivitySnapshot;