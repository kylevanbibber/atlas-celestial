import React, { useState, useEffect } from 'react';
import { NameFormats } from '../../utils/nameFormatter';
import './Widgets.css';

const LeaderboardWidget = ({ 
  limit = 10, 
  onError,
  showMGA = true, // Show MGA field below name
  nameFormat = "FIRST_LAST", // Default name format
  mobileNameFormat = "FIRST_LAST_INITIAL" // Mobile name format
}) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      
      // Mock leaderboard data - replace with actual API calls
      // Updated to include MGA information and use lagnname format
      const mockLeaderboard = [
        { id: 1, name: 'SMITH JOHN A JR', mgaLastName: 'SA WEINBERG', production: 85000, rank: 1, avatar: '👨‍💼' },
        { id: 2, name: 'JOHNSON SARAH M', mgaLastName: 'SA KOZEJ', production: 78000, rank: 2, avatar: '👩‍💼' },
        { id: 3, name: 'DAVIS MICHAEL R', mgaLastName: 'SA RENTNER', production: 72000, rank: 3, avatar: '👨‍💼' },
        { id: 4, name: 'WILSON LISA K', mgaLastName: 'GA RETONE', production: 68000, rank: 4, avatar: '👩‍💼' },
        { id: 5, name: 'BROWN THOMAS L', mgaLastName: 'SA WEINBERG', production: 65000, rank: 5, avatar: '👨‍💼' },
        { id: 6, name: 'GARCIA EMMA S', mgaLastName: 'SA KOZEJ', production: 62000, rank: 6, avatar: '👩‍💼' },
        { id: 7, name: 'LEE DAVID M', mgaLastName: 'SA RENTNER', production: 58000, rank: 7, avatar: '👨‍💼' },
        { id: 8, name: 'KIM RACHEL J', mgaLastName: 'GA RETONE', production: 55000, rank: 8, avatar: '👩‍💼' },
        { id: 9, name: 'TAYLOR JAMES R', mgaLastName: 'SA WEINBERG', production: 52000, rank: 9, avatar: '👨‍💼' },
        { id: 10, name: 'WHITE ASHLEY L', mgaLastName: 'SA KOZEJ', production: 48000, rank: 10, avatar: '👩‍💼' },
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
        {leaderboard.map((person, index) => {
          const rawName = person.name || "Unknown";
          const displayName = NameFormats[nameFormat] ? NameFormats[nameFormat](rawName) : rawName;
          const mobileDisplayName = NameFormats[mobileNameFormat] ? NameFormats[mobileNameFormat](rawName) : displayName;
          
          return (
            <div key={person.id} className={`leaderboard-item rank-${person.rank}`}>
              <div className="rank-indicator">
                {getRankIcon(person.rank)}
              </div>
              <div className="person-avatar">
                {person.avatar}
              </div>
              <div className="person-info">
                <div className="person-name">
                  <span className="desktop-name">{displayName}</span>
                  <span className="mobile-name">{mobileDisplayName}</span>
                </div>
                {showMGA && person.mgaLastName && (
                  <div className="mga-line">
                    <span className="mga-info">{person.mgaLastName}</span>
                  </div>
                )}
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
          );
        })}
      </div>
      
      <div className="leaderboard-footer">
        <small>Updated hourly • Current period</small>
      </div>
    </div>
  );
};

export default LeaderboardWidget;