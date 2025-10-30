import React, { useState } from 'react';
import { FiAward, FiCalendar, FiTarget, FiChevronDown, FiChevronUp, FiClock } from 'react-icons/fi';
import './CompetitionBanner.css';

const CompetitionBanner = ({ 
  competition, 
  userProgress, 
  className = '',
  expandable = true,
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!competition) return null;

  const {
    title,
    description,
    prize,
    rules,
    start_date,
    end_date,
    computed_status,
    target_value,
    metric_type,
    competition_type
  } = competition;

  const {
    current_progress = 0,
    rank_position,
    is_participating = false
  } = userProgress || {};

  // Calculate progress percentage
  const progressPercentage = target_value ? Math.min((current_progress / target_value) * 100, 100) : 0;

  // Format dates
  const startDate = new Date(start_date).toLocaleDateString();
  const endDate = new Date(end_date).toLocaleDateString();
  const isActive = computed_status === 'active';
  const isUpcoming = computed_status === 'upcoming';
  const isEnded = computed_status === 'ended';

  // Format metric type for display
  const formatMetricType = (type) => {
    const metrics = {
      'alp': 'ALP',
      'calls': 'Calls',
      'appointments': 'Appointments',
      'sales': 'Sales',
      'codes': 'Codes',
      'hires': 'Hires',
      'refs': 'Referrals',
      'custom': 'Points'
    };
    return metrics[type] || type;
  };

  // Format currency if metric is ALP
  const formatValue = (value) => {
    if (metric_type === 'alp') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value?.toLocaleString() || '0';
  };

  const getStatusColor = () => {
    if (isActive) return 'var(--success-color)';
    if (isUpcoming) return 'var(--warning-color)';
    if (isEnded) return 'var(--error-color)';
    return 'var(--text-secondary)';
  };

  const getStatusIcon = () => {
    if (isActive) return <FiTarget />;
    if (isUpcoming) return <FiClock />;
    if (isEnded) return <FiAward />;
    return <FiCalendar />;
  };

  return (
    <div className={`competition-banner ${computed_status} ${className}`}>
      {/* Header Section */}
      <div className="competition-header" onClick={() => expandable && setIsExpanded(!isExpanded)}>
        <div className="competition-title-section">
          <div className="competition-icon">
            <FiAward />
          </div>
          <div className="competition-info">
            <h3 className="competition-title">{title}</h3>
            <div className="competition-meta">
              <span className="competition-dates">
                {startDate} - {endDate}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Progress Display */}
        {is_participating && (
          <div className="quick-progress">
            <div className="progress-value">
              {formatValue(current_progress)}
              {target_value && ` / ${formatValue(target_value)}`}
            </div>
            {rank_position && (
              <div className="rank-display">
                Rank #{rank_position}
              </div>
            )}
          </div>
        )}

        {expandable && (
          <div className="expand-icon">
            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {(isExpanded || !expandable) && (
        <div className="competition-details">
          {/* Description */}
          {description && (
            <div className="competition-section">
              <p className="competition-description">{description}</p>
            </div>
          )}

          {/* Prize Information */}
          <div className="competition-section">
            <h4 className="section-title">
              <FiAward />
              What's at Stake
            </h4>
            <div className="prize-display">
              {prize}
            </div>
          </div>

          {/* Removed metric/type/participants per requirements */}

          {/* User Progress Section */}
          {is_participating && (
            <div className="competition-section">
              <h4 className="section-title">
                <FiTarget />
                Your Progress
              </h4>
              <div className="progress-section">
                <div className="progress-stats">
                  <div className="stat-item">
                    <label>Current:</label>
                    <span className="stat-value">{formatValue(current_progress)}</span>
                  </div>
                  {target_value && (
                    <div className="stat-item">
                      <label>Target:</label>
                      <span className="stat-value">{formatValue(target_value)}</span>
                    </div>
                  )}
                  {rank_position && (
                    <div className="stat-item">
                      <label>Rank:</label>
                      <span className="stat-value">#{rank_position}</span>
                    </div>
                  )}
                </div>
                
                {target_value && (
                  <div className="progress-bar-container">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <div className="progress-percentage">
                      {progressPercentage.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rules Section */}
          <div className="competition-section">
            <h4 className="section-title">Rules</h4>
            <div className="rules-content">
              {rules.split('\n').map((rule, index) => (
                <p key={index}>{rule}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitionBanner;
