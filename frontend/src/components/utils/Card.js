import React, { useContext } from "react";
import { FiTrendingUp, FiTrendingDown, FiMinus } from 'react-icons/fi';
import ThemeContext from "../../context/ThemeContext";
import "./Card.css";

const Card = ({
  title = "Card Title",
  value = "0",
  subText = "",
  donut = false,
  percentage = 0,
  donutColor = "#4caf50",
  donutSize = 60,
  circleRadius = 15.915,
  backgroundImage = "",
  backgroundPositionX = "100%", // Use responsive units here
  backgroundPositionY = "5%",
  backgroundSize = "auto 165%",
  // New background icon props
  backgroundIcon: BackgroundIcon,
  backgroundIconSize = 80,
  backgroundIconColor = "rgba(0, 0, 0, 0.05)",
  backgroundIconPosition = "bottom-right", // "bottom-right", "bottom-left", "top-right", "top-left", "center"
  backgroundIconOffsetX = 0, // Horizontal offset in pixels (positive = right, negative = left)
  backgroundIconOffsetY = 0, // Vertical offset in pixels (positive = down, negative = up)
  // New comparison props
  currentValue,
  previousValue,
  rangeType = 'period',
  showIcon = false,
  showPercentage = false,
  comparisonFormat = 'number',
  comparisonLabel,
  showComparison = false
}) => {
  const { theme } = useContext(ThemeContext);
  const textColor = theme === 'dark' ? '#f0f0f0' : '#333333';
  const ringColor = theme === 'dark' ? '#555555' : '#e0e0e0';
  
  const circumference = 2 * Math.PI * circleRadius;
  const calculateStrokeDasharray = (percentageValue) => {
    const filled = ((percentageValue > 100 ? 100 : percentageValue) / 100) * circumference;
    return `${filled} ${circumference}`;
  };

  // Get position styles for background icon
  const getIconPositionStyles = () => {
    const baseStyles = {
      position: "absolute",
      zIndex: 0,
      pointerEvents: "none",
      color: backgroundIconColor || (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
    };

    // Apply offsets to base positioning
    const applyOffsets = (styles) => {
      const offsetStyles = { ...styles };
      
      // Apply horizontal offset
      if (backgroundIconOffsetX !== 0) {
        if (offsetStyles.left !== undefined) {
          offsetStyles.left = `calc(${offsetStyles.left} + ${backgroundIconOffsetX}px)`;
        } else if (offsetStyles.right !== undefined) {
          offsetStyles.right = `calc(${offsetStyles.right} - ${backgroundIconOffsetX}px)`;
        }
      }
      
      // Apply vertical offset
      if (backgroundIconOffsetY !== 0) {
        if (offsetStyles.top !== undefined) {
          offsetStyles.top = `calc(${offsetStyles.top} + ${backgroundIconOffsetY}px)`;
        } else if (offsetStyles.bottom !== undefined) {
          offsetStyles.bottom = `calc(${offsetStyles.bottom} - ${backgroundIconOffsetY}px)`;
        }
      }
      
      return offsetStyles;
    };

    switch (backgroundIconPosition) {
      case "top-left":
        return applyOffsets({ ...baseStyles, top: "10px", left: "10px" });
      case "top-right":
        return applyOffsets({ ...baseStyles, top: "10px", right: "10px" });
      case "bottom-left":
        return applyOffsets({ ...baseStyles, bottom: "10px", left: "10px" });
      case "center":
        return applyOffsets({ 
          ...baseStyles, 
          top: "50%", 
          left: "50%", 
          transform: `translate(calc(-50% + ${backgroundIconOffsetX}px), calc(-50% + ${backgroundIconOffsetY}px))` 
        });
      case "bottom-right":
      default:
        return applyOffsets({ ...baseStyles, bottom: "10px", right: "10px" });
    }
  };

  // Comparison logic - adapted from ComparisonText component
  const generateComparisonText = () => {
    if (!showComparison || previousValue === undefined || previousValue === null || currentValue === undefined || currentValue === null) {
      return null;
    }

    const difference = currentValue - previousValue;
    const percentageChange = previousValue !== 0 ? ((difference / previousValue) * 100) : 0;
    
    // Determine comparison type
    let comparisonType = 'neutral';
    if (difference > 0) comparisonType = 'positive';
    else if (difference < 0) comparisonType = 'negative';

    // Generate label based on range type
    const generateLabel = () => {
      if (comparisonLabel) return comparisonLabel;
      
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
      switch (comparisonFormat) {
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
    const comparisonLabelText = generateLabel();
    
    let displayText = `${sign}${difference === 0 ? '0' : formattedDifference} ${comparisonLabelText}`;
    
    // Add percentage if requested
    if (showPercentage && percentageChange !== 0) {
      const percentSign = percentageChange > 0 ? '+' : '';
      displayText += ` (${percentSign}${percentageChange.toFixed(1)}%)`;
    }

    return (
      <span className={`card-change ${comparisonType}`}>
        {getTrendIcon()}
        {displayText}
      </span>
    );
  };

  // Determine what to show in subText
  const getSubText = () => {
    const comparisonText = generateComparisonText();
    
    // If we have comparison text and no explicit subText, use comparison
    if (comparisonText && !subText) {
      return comparisonText;
    }
    
    // If we have both subText and comparison, show subText (maintains backwards compatibility)
    if (subText) {
      return subText;
    }
    
    // If we have comparison but also subText, show comparison
    if (comparisonText) {
      return comparisonText;
    }
    
    return null;
  };

  return (
    <div className="custom-card" style={{ position: "relative", overflow: "hidden" }}>
      {backgroundImage && (
        <div
          className="background-overlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: backgroundSize,
            backgroundPosition: `${backgroundPositionX} ${backgroundPositionY}`,
            backgroundRepeat: "no-repeat",
            zIndex: 0,
          }}
        />
      )}
      {BackgroundIcon && (
        <div style={getIconPositionStyles()}>
          <BackgroundIcon 
            size={backgroundIconSize}
          />
        </div>
      )}
      <div className="custom-card-content" style={{ position: "relative", zIndex: 1 }}>
        <div className="custom-card-header">
          <h5>{title}</h5>
          {donut && (
            <div className="donut-container" style={{ width: donutSize, height: donutSize }}>
              <svg viewBox="0 0 36 36" className="donut-chart">
                <circle
                  className="donut-ring"
                  cx="18"
                  cy="18"
                  r={circleRadius}
                  fill="transparent"
                  stroke={ringColor}
                  strokeWidth="3"
                />
                <circle
                  className="donut-segment"
                  cx="18"
                  cy="18"
                  r={circleRadius}
                  fill="transparent"
                  stroke={donutColor}
                  strokeWidth="3"
                  strokeDasharray={calculateStrokeDasharray(percentage)}
                  strokeDashoffset="0"
                />
                <text x="18" y="20.35" textAnchor="middle" fontSize="7" fill={textColor}>
                  {percentage}%
                </text>
              </svg>
            </div>
          )}
        </div>
        <div className="custom-card-body">
          <p className="custom-value">{value}</p>
          {getSubText() && <p className="custom-subtext">{getSubText()}</p>}
        </div>
      </div>
    </div>
  );
};

export default Card;
