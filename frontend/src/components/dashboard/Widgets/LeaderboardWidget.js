import React, { useState, useEffect } from 'react';
import './Widgets.css';

const LeaderboardWidget = ({ limit = 10, onError }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      
      // Mock leaderboard data - replace with actual API calls
      const mockLeaderboard = [
        { id: 1, name: 'John Smith', production: 85000, rank: 1, avatar: '👨‍💼' },
        { id: 2, name: 'Sarah Johnson', production: 78000, rank: 2, avatar: '👩‍💼' },
        { id: 3, name: 'Mike Davis', production: 72000, rank: 3, avatar: '👨‍💼' },
        { id: 4, name: 'Lisa Wilson', production: 68000, rank: 4, avatar: '👩‍💼' },
        { id: 5, name: 'Tom Brown', production: 65000, rank: 5, avatar: '👨‍💼' },
        { id: 6, name: 'Emma Garcia', production: 62000, rank: 6, avatar: '👩‍💼' },
        { id: 7, name: 'David Lee', production: 58000, rank: 7, avatar: '👨‍💼' },
        { id: 8, name: 'Rachel Kim', production: 55000, rank: 8, avatar: '👩‍💼' },
        { id: 9, name: 'James Taylor', production: 52000, rank: 9, avatar: '👨‍💼' },
        { id: 10, name: 'Ashley White', production: 48000, rank: 10, avatar: '👩‍💼' },
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 350));
      
      setLeaderboard(mockLeaderboard.slice(0, limit));
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return rank;
    }
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading leaderboard...</span>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="leaderboard-empty">
        <div className="empty-icon">🏆</div>
        <p>No leaderboard data available</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-widget">
      <div className="leaderboard-list">
        {leaderboard.map((person, index) => (
          <div key={person.id} className={`leaderboard-item rank-${person.rank}`}>
            <div className="rank-indicator">
              {getRankIcon(person.rank)}
            </div>
            <div className="person-avatar">
              {person.avatar}
            </div>
            <div className="person-info">
              <div className="person-name">{person.name}</div>
              <div className="person-production">
                {formatCurrency(person.production)}
              </div>
            </div>
            {person.rank <= 3 && (
              <div className="trophy-indicator">
                <span className="trophy">🏆</span>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="leaderboard-footer">
        <small>Updated hourly • Current period</small>
      </div>
    </div>
  );
};

export default LeaderboardWidget;