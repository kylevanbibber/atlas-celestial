import React from 'react';
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';

/**
 * Reusable component for displaying period-over-period comparison
 * @param {number} currentValue - Current period value
 * @param {number} previousValue - Previous period value
 * @param {string} label - Optional custom label (default: "from last period")
 * @param {string} rangeType - Type of comparison period ('week', 'month', 'year', 'custom')
 * @param {boolean} showIcon - Whether to show trend icon (default: false)
 * @param {boolean} showPercentage - Whether to show percentage change (default: false)
 * @param {string} format - Value format ('number', 'currency', 'percentage') (default: 'number')
 * @param {string} className - Additional CSS classes
 */
const ComparisonText = ({ 
  currentValue = 0, 
  previousValue, 
  label, 
  rangeType = 'period',
  showIcon = false,
  showPercentage = false,
  format = 'number',
  className = ''
}) => {
  // Handle cases where previous value is undefined or null
  if (previousValue === undefined || previousValue === null) {
    return (
      <span className={`comparison-text-change neutral ${className}`}>
        No comparison data
      </span>
    );
  }

  const difference = currentValue - previousValue;
  const percentageChange = previousValue !== 0 ? ((difference / previousValue) * 100) : 0;
  
  // Determine comparison type
  let comparisonType = 'neutral';
  if (difference > 0) comparisonType = 'positive';
  else if (difference < 0) comparisonType = 'negative';

  // Generate label based on range type
  const generateLabel = () => {
    if (label) return label;
    
    switch (rangeType) {
      case 'week':
        return 'from last week';
      case 'month':
        return 'from last month';
      case 'year':
        return 'from last year';
      case 'custom':
        return 'from previous period';
      default:
        return 'from last period';
    }
  };

  // Format value based on format type
  const formatValue = (value) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  // Generate trend icon
  const getTrendIcon = () => {
    if (!showIcon) return null;
    
    const iconProps = { size: 14, style: { marginRight: '4px' } };
    
    switch (comparisonType) {
      case 'positive':
        return <FiTrendingUp {...iconProps} />;
      case 'negative':
        return <FiTrendingDown {...iconProps} />;
      default:
        return <FiMinus {...iconProps} />;
    }
  };

  // Build comparison text
  const sign = difference > 0 ? '+' : '';
  const formattedDifference = formatValue(Math.abs(difference));
  const comparisonLabel = generateLabel();
  
  let displayText = `${sign}${difference === 0 ? '0' : formattedDifference} ${comparisonLabel}`;
  
  // Add percentage if requested
  if (showPercentage && percentageChange !== 0) {
    const percentSign = percentageChange > 0 ? '+' : '';
    displayText += ` (${percentSign}${percentageChange.toFixed(1)}%)`;
  }

  return (
    <span className={`comparison-text-change ${comparisonType} ${className}`}>
      {getTrendIcon()}
      {displayText}
    </span>
  );
};

export default ComparisonText; 