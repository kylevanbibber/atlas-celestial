/**
 * Reusable Dashboard Section Component
 * 
 * This component renders a dashboard section with configurable cards.
 */

import React from 'react';
import Card from '../utils/Card';

const DashboardSection = ({ 
  title, 
  cards, 
  data, 
  formatCurrency, 
  formatDateRange, 
  selectedDateRange,
  setSelectedDateRange,
  showDateSelector = false,
  onClick = null
}) => {
  
  /**
   * Get the value for a card from the data object
   */
  const getCardValue = (card, data) => {
    const value = data[card.dataKey] || 0;
    
    if (card.format === 'currency') {
      return formatCurrency(value);
    } else {
      return value.toString();
    }
  };

  /**
   * Get comparison data for a card
   */
  const getComparisonData = (card, data) => {
    if (!card.showComparison) return {};

    let currentValue, previousValue, comparisonLabel;

    if (card.comparisonType === 'year') {
      currentValue = data[card.dataKey] || 0;
      previousValue = data[`previousYear${card.dataKey.charAt(0).toUpperCase() + card.dataKey.slice(1)}`] || 0;
      comparisonLabel = 'vs same period last year';
    } else if (card.comparisonType === 'month') {
      currentValue = data[card.dataKey] || 0;
      previousValue = data[`previous${card.dataKey.charAt(0).toUpperCase() + card.dataKey.slice(1)}`] || 0;
      comparisonLabel = `from ${data.comparisonMonth || 'previous month'}`;
    }

    return {
      showComparison: true,
      currentValue,
      previousValue,
      rangeType: card.comparisonType,
      showIcon: true,
      showPercentage: true,
      comparisonFormat: card.format,
      comparisonLabel
    };
  };

  /**
   * Get sub text for activity cards
   */
  const getSubText = (card, data) => {
    if (card.showDateRange && card.showAgentCount) {
      const dateRangeText = formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate);
      const agentCount = data.agentCount || 0;
      return `${dateRangeText} | ${agentCount} agents`;
    } else if (card.showDateRange) {
      return formatDateRange(selectedDateRange.startDate, selectedDateRange.endDate);
    } else if (card.showAgentCount) {
      const agentCount = data.agentCount || 0;
      return `${agentCount} agents`;
    }
    
    return card.subText || '';
  };

  return (
    <div 
      className={`dashboard-section ${onClick ? 'clickable-section' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      <div className="section-header-with-controls">
        <h3 className="section-title">{title}</h3>
        {showDateSelector && (
          <div className="date-range-selector">
            <label>
              From: 
              <input 
                type="date" 
                value={selectedDateRange.startDate}
                onChange={(e) => setSelectedDateRange(prev => ({
                  ...prev,
                  startDate: e.target.value
                }))}
              />
            </label>
            <label>
              To: 
              <input 
                type="date" 
                value={selectedDateRange.endDate}
                onChange={(e) => setSelectedDateRange(prev => ({
                  ...prev,
                  endDate: e.target.value
                }))}
              />
            </label>
          </div>
        )}
      </div>
      <hr className="section-divider" />
      <div className="card-container">
        {cards.map((card, index) => {
          const IconComponent = card.icon;
          const comparisonData = getComparisonData(card, data);
          
          // Handle dynamic titles (functions that take month name)
          const cardTitle = typeof card.title === 'function' 
            ? card.title(data.reportingMonth || 'Monthly')
            : card.title;
          
          return (
            <Card
              key={index}
              title={cardTitle}
              value={getCardValue(card, data)}
              backgroundIcon={IconComponent}
              backgroundIconSize={60}
              backgroundIconPosition="bottom-right"
              backgroundIconColor={card.iconColor}
              subText={getSubText(card, data)}
              className="dashboard-card"
              {...comparisonData}
            />
          );
        })}
      </div>
    </div>
  );
};

export default DashboardSection;