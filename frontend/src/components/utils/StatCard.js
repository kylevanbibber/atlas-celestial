import React from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import './StatCard.css';

const StatCard = ({ 
  title, 
  subtitle, 
  value, 
  target, 
  progress, 
  trend, 
  trendLabel,
  color = '#3b82f6',
  onClick 
}) => {
  // Calculate circle progress
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progressValue = progress || 0;
  const strokeDashoffset = circumference - (progressValue / 100) * circumference;

  return (
    <div 
      className="stat-card" 
      onClick={onClick}
      style={{ '--stat-color': color }}
    >
      <div className="stat-card-header">
        <div className="stat-card-info">
          <div className="stat-card-title">{title}</div>
          {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
          {trend !== undefined && (
            <div className={`stat-trend ${trend < 0 ? 'negative' : ''}`}>
              {trend >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
              {Math.abs(trend)}% {trendLabel || 'vs last month'}
            </div>
          )}
        </div>

        {progress !== undefined && (
          <div className="stat-progress-circle">
            <svg width="64" height="64">
              <circle
                className="stat-progress-bg"
                cx="32"
                cy="32"
                r={radius}
              />
              <circle
                className="stat-progress-fill"
                cx="32"
                cy="32"
                r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="stat-progress-text">
              <div>{progressValue}%</div>
              <span className="stat-progress-label">on pace</span>
            </div>
          </div>
        )}
      </div>

      <div className="stat-card-values">
        <div className="stat-main-value">
          {value}
          {target && (
            <span className="stat-comparison">
              {' '} / <span className="target">{target}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;

