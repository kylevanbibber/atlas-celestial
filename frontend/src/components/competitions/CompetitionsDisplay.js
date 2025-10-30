import React from 'react';
import CompetitionBanner from './CompetitionBanner';
import { useUserActiveCompetitions } from '../../hooks/useCompetitions';
import './DashboardCompetitions.css';

const CompetitionsDisplay = ({ user, className = '' }) => {
  const { competitions, loading, error } = useUserActiveCompetitions(user?.id);

  if (loading) {
    return (
      <div className={`competitions-loading ${className}`}>
        <div className="loading-spinner">Loading competitions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`competitions-error ${className}`}>
        <div className="error-message">
          Error loading competitions: {error}
        </div>
      </div>
    );
  }

  if (!competitions || competitions.length === 0) {
    return null; // Don't show anything if no active competitions
  }

  return (
    <div className={`competitions-container ${className}`}>
      {competitions.map(competition => {
        // Find user's participation data
        const userProgress = competition.participants?.find(p => p.user_id === user?.id) || 
                           competition.user_participation;

        return (
          <CompetitionBanner
            key={competition.id}
            competition={competition}
            userProgress={userProgress}
            expandable={true}
            defaultExpanded={false}
          />
        );
      })}
    </div>
  );
};

export default CompetitionsDisplay;
