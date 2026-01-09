import React, { useContext, useState } from "react";
import { FiTrendingUp, FiTrendingDown, FiMinus, FiExternalLink } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import ThemeContext from "../../context/ThemeContext";
import "./WidgetCard.css";

const WidgetCard = ({
  title,
  value,
  icon: Icon,
  color = "#4caf50",
  loading = false,
  onClick,
  subText,
  // Donut/Progress props
  showProgress = false,
  currentValue,
  goalValue,
  // Action button
  actionButton,
  // Top right action (e.g., edit icon)
  topRightAction,
  // Link props
  linkTo, // URL to navigate to when clicking the icon
  // Comparison props
  showComparison = false,
  comparisonValue,
  comparisonLabel,
  comparisonFormat = 'number', // 'number', 'currency', 'percentage'
  showComparisonPercentage = false,
  onComparisonClick, // Callback when comparison is clicked
  // Additional content
  children
}) => {
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  
  // Calculate progress percentage
  const progressPercentage = showProgress && goalValue && goalValue > 0 
    ? Math.min(100, Math.round((currentValue / goalValue) * 100))
    : 0;

  // Calculate comparison display (matching Card.js style)
  const getComparisonDisplay = () => {
    if (!showComparison || comparisonValue === undefined || comparisonValue === null) {
      // Return invisible placeholder to maintain consistent spacing
      return <div style={{ height: '24px', visibility: 'hidden' }}>.</div>;
    }
    
    const difference = comparisonValue;
    const isPositive = difference > 0;
    const isNegative = difference < 0;
    
    // Determine comparison type
    let comparisonType = 'neutral';
    if (difference > 0) comparisonType = 'positive';
    else if (difference < 0) comparisonType = 'negative';
    
    // Format value based on format type
    const formatValue = (value) => {
      const absValue = Math.abs(value);
      switch (comparisonFormat) {
        case 'currency':
          return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: 'USD',
            minimumFractionDigits: 0
          }).format(absValue);
        case 'percentage':
          return `${absValue}%`;
        default:
          return absValue.toLocaleString();
      }
    };
    
    // Get trend icon
    const getTrendIcon = () => {
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
    const formattedDifference = formatValue(difference);
    
    let displayText = `${sign}${difference === 0 ? '0' : formattedDifference}`;
    
    // Add label if provided
    if (comparisonLabel) {
      displayText += ` ${comparisonLabel}`;
    }
    
    // Add percentage if requested and we have current value
    if (showComparisonPercentage && currentValue !== undefined && currentValue !== null && currentValue !== 0) {
      const percentageChange = (difference / currentValue) * 100;
      const percentSign = percentageChange > 0 ? '+' : '';
      displayText += ` (${percentSign}${percentageChange.toFixed(1)}%)`;
    }
    
    return (
      <div 
        className={`widget-card-comparison card-change ${comparisonType}`}
        onClick={onComparisonClick ? (e) => { e.stopPropagation(); onComparisonClick(e); } : undefined}
        style={{ 
          cursor: onComparisonClick ? 'pointer' : 'default'
        }}
      >
        {getTrendIcon()}
        {displayText}
      </div>
    );
  };

  const handleLinkClick = (e) => {
    if (linkTo) {
      e.stopPropagation();
      navigate(linkTo);
    }
  };

  return (
    <div 
      className={`widget-card ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {/* Top right action button */}
      {topRightAction && (
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 10
        }}>
          {topRightAction}
        </div>
      )}

      {/* Header with icon and title */}
      <div className="widget-card-header">
        {Icon && (
          <div 
            className="widget-card-icon"
            style={{ 
              backgroundColor: `${color}20`, 
              color: color,
              position: 'relative',
              cursor: linkTo ? 'pointer' : 'default'
            }}
            onClick={linkTo ? handleLinkClick : undefined}
          >
            <Icon size={20} style={{ 
              opacity: isHovered && linkTo ? 0.3 : 1,
              transition: 'opacity 0.2s'
            }} />
            {linkTo && isHovered && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FiExternalLink size={20} style={{ color: color }} />
              </div>
            )}
          </div>
        )}
        <div className="widget-card-title-section">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            <h4 className="widget-card-title">{title}</h4>
            {/* Sub text (e.g., "As of" date) in header */}
            <div className="widget-card-subtext-header">
              {subText || <span style={{ visibility: 'hidden' }}>.</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="widget-card-body">
        {loading ? (
          <div className="widget-card-loading">
            <span className="spinner"></span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', minHeight: '42px' }}>
              <div className="widget-card-value-section">
                <div className="widget-card-main-value">{value}</div>
                {showProgress && goalValue && (
                  <div className="widget-card-goal">
                    / {typeof goalValue === 'number' ? goalValue.toLocaleString() : goalValue}
                  </div>
                )}
              </div>
              
              {/* Action button (e.g., History) - or invisible spacer */}
              <div className="widget-card-action-inline" style={{ minWidth: actionButton ? 'auto' : '0' }}>
                {actionButton || <span style={{ visibility: 'hidden' }}>.</span>}
              </div>
            </div>

            {/* Progress bar or spacer */}
            {showProgress && goalValue ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <div className="widget-card-progress-bar" style={{ flex: 1 }}>
                  <div 
                    className="widget-card-progress-fill"
                    style={{ 
                      width: `${progressPercentage}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
                <span className="widget-card-progress-text">
                  {progressPercentage}%
                </span>
              </div>
            ) : (
              <div style={{ height: '26px' }} /> // Reserve space for progress bar area
            )}

            {/* Children content */}
            {children}

            {/* Comparison display - moved to bottom */}
            {getComparisonDisplay()}
          </>
        )}
      </div>
    </div>
  );
};

export default WidgetCard;


