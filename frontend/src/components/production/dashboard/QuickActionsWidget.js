/**
 * Quick Actions Widget
 * 
 * Quick navigation buttons for common production actions.
 * Designed to be used as a standalone grid widget.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';

const QuickActionsWidget = ({ isTeamLevel }) => {
  return (
    <Card className="bg-card border-border" style={{ height: '100%' }}>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <button
          className="btn btn-primary btn-block"
          onClick={() => window.location.href = '/production?section=activity-goals'}
        >
          View Full Report
        </button>
        {isTeamLevel && (
          <button
            className="btn btn-outline-secondary btn-block"
            style={{ marginTop: '0.5rem' }}
            onClick={() => window.location.href = '/production?section=leaderboard'}
          >
            View Leaderboard
          </button>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickActionsWidget;
