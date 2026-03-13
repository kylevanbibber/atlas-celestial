/**
 * Leaderboard Filter Menu Component
 * Dropdown filter menu for the TeamLeaderboard component
 */

import React from 'react';

const LeaderboardFilterMenu = ({
  isFilterMenuOpen,
  setIsFilterMenuOpen,
  filterButtonRef,
  showDiscordOnly,
  setShowDiscordOnly,
  loadingDiscordFilter,
  goalFilter,
  setGoalFilter,
  filteredAgentsCount,
  totalAgentsCount
}) => {
  if (!isFilterMenuOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="team-leaderboard-filter-backdrop"
        onClick={() => setIsFilterMenuOpen(false)}
      />
      
      {/* Dropdown Panel */}
      <div
        className="team-leaderboard-filter-menu"
        style={{
          top: filterButtonRef.current ? filterButtonRef.current.getBoundingClientRect().bottom + 8 : 0,
          right: '1rem'
        }}
      >
        <div className="team-leaderboard-filter-menu-content">
          <h3 className="team-leaderboard-filter-title">
            Filter Options
          </h3>

          {/* Discord Sales Filter */}
          <div className="team-leaderboard-filter-options">
            <label className={`team-leaderboard-filter-option ${showDiscordOnly ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={showDiscordOnly}
                onChange={(e) => setShowDiscordOnly(e.target.checked)}
                disabled={loadingDiscordFilter}
              />
              <div className="team-leaderboard-filter-option-text">
                <div className="team-leaderboard-filter-option-title">
                  Discord Sales Only
                </div>
                <div className="team-leaderboard-filter-option-description">
                  Show only agents with Discord sales
                </div>
              </div>
              {loadingDiscordFilter && (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2" 
                     style={{ borderColor: 'var(--primary)' }}
                />
              )}
            </label>
          </div>

          {/* Goal Filter */}
          <div style={{ 
            marginTop: '0.75rem', 
            paddingTop: '0.75rem', 
            borderTop: '1px solid var(--border)' 
          }}>
            <div style={{ 
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--foreground)'
            }}>
              Goal Status
            </div>
            <div className="team-leaderboard-filter-options">
              <label className={`team-leaderboard-filter-option ${goalFilter === 'all' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="goalFilter"
                  checked={goalFilter === 'all'}
                  onChange={() => setGoalFilter('all')}
                />
                <div className="team-leaderboard-filter-option-text">
                  <div className="team-leaderboard-filter-option-title">
                    All Agents
                  </div>
                  <div className="team-leaderboard-filter-option-description">
                    Show all agents regardless of goal status
                  </div>
                </div>
              </label>

              <label className={`team-leaderboard-filter-option ${goalFilter === 'set' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="goalFilter"
                  checked={goalFilter === 'set'}
                  onChange={() => setGoalFilter('set')}
                />
                <div className="team-leaderboard-filter-option-text">
                  <div className="team-leaderboard-filter-option-title">
                    Goal Set
                  </div>
                  <div className="team-leaderboard-filter-option-description">
                    Show only agents with goals set
                  </div>
                </div>
              </label>

              <label className={`team-leaderboard-filter-option ${goalFilter === 'notset' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="goalFilter"
                  checked={goalFilter === 'notset'}
                  onChange={() => setGoalFilter('notset')}
                />
                <div className="team-leaderboard-filter-option-text">
                  <div className="team-leaderboard-filter-option-title">
                    No Goal
                  </div>
                  <div className="team-leaderboard-filter-option-description">
                    Show only agents without goals set
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(showDiscordOnly || goalFilter !== 'all') && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem',
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              textAlign: 'center'
            }}>
              Showing {filteredAgentsCount} of {totalAgentsCount} agents
            </div>
          )}

          {/* Clear All Filters Button */}
          {(showDiscordOnly || goalFilter !== 'all') && (
            <div style={{ 
              marginTop: '0.75rem', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid var(--border)' 
            }}>
              <button
                onClick={() => {
                  setShowDiscordOnly(false);
                  setGoalFilter('all');
                  setIsFilterMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LeaderboardFilterMenu;
