import React, { useState, useEffect } from 'react';
import './Widgets.css';

const ScorecardWidget = ({ view = 'summary', onError }) => {
  const [scorecardData, setScorecardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScorecardData();
  }, [view]);

  const fetchScorecardData = async () => {
    try {
      setLoading(true);
      
      // Mock scorecard data - replace with actual API calls
      const mockScorecardData = {
        summary: {
          currentMonth: {
            production: 45000,
            target: 50000,
            percentage: 90
          },
          ytd: {
            production: 420000,
            target: 500000,
            percentage: 84
          },
          metrics: [
            { label: 'Cases Sold', value: 12, target: 15, unit: '' },
            { label: 'Revenue', value: 45000, target: 50000, unit: '$' },
            { label: 'Activities', value: 89, target: 100, unit: '' }
          ]
        },
        detailed: {
          // More detailed scorecard data would go here
        }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setScorecardData(mockScorecardData[view] || mockScorecardData.summary);
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

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 70) return 'warning';
    return 'danger';
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading scorecard...</span>
      </div>
    );
  }

  if (!scorecardData) {
    return (
      <div className="widget-error">
        Unable to load scorecard data
      </div>
    );
  }

  return (
    <div className="scorecard-widget">
      {/* Monthly Progress */}
      <div className="scorecard-section">
        <h4>This Month</h4>
        <div className="progress-summary">
          <div className="progress-header">
            <span className="progress-value">
              {formatCurrency(scorecardData.currentMonth.production)}
            </span>
            <span className="progress-target">
              of {formatCurrency(scorecardData.currentMonth.target)}
            </span>
          </div>
          <div className="progress-bar-container">
            <div 
              className={`progress-bar ${getProgressColor(scorecardData.currentMonth.percentage)}`}
              style={{ width: `${Math.min(scorecardData.currentMonth.percentage, 100)}%` }}
            ></div>
          </div>
          <div className="progress-percentage">
            {scorecardData.currentMonth.percentage}% Complete
          </div>
        </div>
      </div>

      {/* YTD Progress */}
      <div className="scorecard-section">
        <h4>Year to Date</h4>
        <div className="progress-summary">
          <div className="progress-header">
            <span className="progress-value">
              {formatCurrency(scorecardData.ytd.production)}
            </span>
            <span className="progress-target">
              of {formatCurrency(scorecardData.ytd.target)}
            </span>
          </div>
          <div className="progress-bar-container">
            <div 
              className={`progress-bar ${getProgressColor(scorecardData.ytd.percentage)}`}
              style={{ width: `${Math.min(scorecardData.ytd.percentage, 100)}%` }}
            ></div>
          </div>
          <div className="progress-percentage">
            {scorecardData.ytd.percentage}% Complete
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="scorecard-section">
        <h4>Key Metrics</h4>
        <div className="metrics-grid">
          {scorecardData.metrics.map((metric, index) => (
            <div key={index} className="metric-item">
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">
                {metric.unit === '$' ? formatCurrency(metric.value) : `${metric.value}${metric.unit}`}
              </div>
              <div className="metric-progress">
                <div 
                  className="metric-progress-bar"
                  style={{ 
                    width: `${Math.min((metric.value / metric.target) * 100, 100)}%`,
                  }}
                ></div>
              </div>
              <div className="metric-target">
                Target: {metric.unit === '$' ? formatCurrency(metric.target) : `${metric.target}${metric.unit}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScorecardWidget;