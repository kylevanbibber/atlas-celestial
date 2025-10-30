/**
 * Reusable Dashboard Section Component
 * 
 * This component renders a dashboard section with configurable cards.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../utils/Card';

const DashboardSection = ({ 
  title, 
  cards, 
  data, 
  formatCurrency, 
  formatDateRange
}) => {
  const navigate = useNavigate();
  
  /**
   * Handle card click navigation
   */
  const handleCardClick = (navigateTo) => {
    if (navigateTo) {
      navigate(navigateTo);
    }
  };

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

    // Handle custom comparison data (e.g., Weekly ALP vs Daily Activity)
    if (card.comparisonDataKey && card.comparisonLabel) {
      currentValue = data[card.dataKey] || 0;
      previousValue = data[card.comparisonDataKey] || 0;
      comparisonLabel = `vs ${card.comparisonLabel}`;
    } else if (card.comparisonType === 'year') {
      currentValue = data[card.dataKey] || 0;
      previousValue = data[`previousYear${card.dataKey.charAt(0).toUpperCase() + card.dataKey.slice(1)}`] || 0;
      comparisonLabel = 'vs same period last year';
    } else if (card.comparisonType === 'month') {
      currentValue = data[card.dataKey] || 0;
      // Fix the previous value key for month comparisons
      let previousKey;
      if (card.dataKey === 'currentMonthAlp') {
        previousKey = 'previousMonthAlp';
      } else if (card.dataKey === 'currentMonthCodes') {
        previousKey = 'previousMonthCodes';
      } else if (card.dataKey === 'currentMonthHires') {
        previousKey = 'previousMonthHires';
      } else if (card.dataKey === 'totalRefSales') {
        previousKey = 'previousMonthRefSales';
      } else {
        previousKey = `previous${card.dataKey.charAt(0).toUpperCase() + card.dataKey.slice(1)}`;
      }
      previousValue = data[previousKey] || 0;
      comparisonLabel = `from ${data.comparisonMonth || 'previous month'}`;
    }

    console.log(`🔍 [DashboardSection] Card: ${card.title}, DataKey: ${card.dataKey}, CurrentValue: ${currentValue}, PreviousValue: ${previousValue}`);

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
    if (card.showAgentCount) {
      const agentCount = data.agentCount || 0;
      return `${agentCount} agents`;
    }
    
    return card.subText || '';
  };

    return (
    <div 
      className={`dashboard-section`}
    >
      {title && (
        <>
          <h3 className="section-title">{title}</h3>
          <hr className="section-divider" />
        </>
      )}
      <div className="card-container">
        {cards.map((card, index) => {
          const IconComponent = card.icon;
          const comparisonData = getComparisonData(card, data);
          
          // Handle dynamic titles (functions that take month name)
          const cardTitle = typeof card.title === 'function' 
            ? card.title(data.reportingMonth || 'Monthly')
            : card.title;
          
          // Check if this card uses daily activity data and if it's loading
          const isDailyActivityCard = ['totalAlp', 'totalRefAlp', 'totalRefs'].includes(card.dataKey);
          const isLoading = isDailyActivityCard && data.dailyActivityLoading;
          
          // Generate date range for weekly and monthly cards - define function first
          const getDateRange = (cardType) => {
            switch (cardType) {
              case 'weekly_alp':
                if (data.weekStart && data.weekEnd) {
                  const startDate = new Date(data.weekStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.weekEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  return `${startDate} - ${endDate}`;
                }
                return '';
              case 'weekly_hires':
                if (data.hiresMaxDate) {
                  const date = new Date(data.hiresMaxDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                  return date;
                }
                return '';
              case 'weekly_codes':
                if (data.codesWeekStart && data.codesWeekEnd) {
                  const startDate = new Date(data.codesWeekStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.codesWeekEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  return `${startDate} - ${endDate}`;
                }
                return '';
              case 'weekly_ref_sales':
                if (data.refSalesWeekStart && data.refSalesWeekEnd) {
                  const startDate = new Date(data.refSalesWeekStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.refSalesWeekEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  return `${startDate} - ${endDate}`;
                }
                return '';
              // Monthly card date ranges
              case 'monthly_alp':
                console.log('📊 [Monthly ALP Card] Date formatting:', {
                  maxReportDate: data.maxReportDate,
                  monthStart: data.monthStart,
                  monthEnd: data.monthEnd,
                  cardType: 'monthly_alp'
                });
                
                if (data.maxReportDate) {
                  // Parse the maxReportDate (format: mm/dd/yyyy) and format it nicely
                  const dateParts = data.maxReportDate.split('/');
                  if (dateParts.length === 3) {
                    const [month, day, year] = dateParts;
                    const reportDate = new Date(year, month - 1, day);
                    const formattedDate = reportDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    });
                    const asOfText = `as of ${formattedDate}`;
                    console.log('📊 [Monthly ALP Card] Using maxReportDate format:', asOfText);
                    return asOfText;
                  }
                }
                // Fallback to month range if no maxReportDate
                if (data.monthStart && data.monthEnd) {
                  const startDate = new Date(data.monthStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.monthEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const fallbackText = `${startDate} - ${endDate}`;
                  console.log('📊 [Monthly ALP Card] Using fallback month range:', fallbackText);
                  return fallbackText;
                }
                console.log('📊 [Monthly ALP Card] No date data available');
                return '';
              case 'monthly_hires':
                if (data.hiresMonthStart && data.hiresMonthEnd) {
                  const startDate = new Date(data.hiresMonthStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.hiresMonthEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  return `${startDate} - ${endDate}`;
                }
                return '';
              case 'monthly_codes':
                if (data.codesMonthStart && data.codesMonthEnd) {
                  const startDate = new Date(data.codesMonthStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.codesMonthEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  return `${startDate} - ${endDate}`;
                }
                return '';
              case 'monthly_ref_sales':
                if (data.refSalesMonthStart && data.refSalesMonthEnd) {
                  const startDate = new Date(data.refSalesMonthStart).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  const endDate = new Date(data.refSalesMonthEnd).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  return `${startDate} - ${endDate}`;
                }
                return '';
              // Daily activity cards (no specific date ranges needed)
              case 'daily_alp':
              case 'daily_ref_alp':
                return ''; // Daily activity cards don't need date ranges
              default:
                return '';
            }
          };

          // Log ALP card data specifically - after getDateRange is defined
          if (card.type === 'weekly_alp') {
            console.log(`📊 [Card Render] Weekly ALP card data:`, {
              cardTitle: cardTitle,
              cardValue: getCardValue(card, data),
              dataKey: card.dataKey,
              rawDataValue: data[card.dataKey],
              comparisonDataKey: card.comparisonDataKey,
              comparisonValue: data[card.comparisonDataKey],
              comparisonData: getComparisonData(card, data),
              fullData: data
            });
          } else if (card.type === 'monthly_alp') {
            console.log(`🎯 [Card Render] Monthly ALP card data:`, {
              cardTitle: cardTitle,
              cardType: card.type,
              cardValue: getCardValue(card, data),
              dataKey: card.dataKey,
              rawMonthlyAlp: data[card.dataKey],
              comparisonDataKey: card.comparisonDataKey,
              comparisonValue: data[card.comparisonDataKey],
              dateRange: getDateRange(card.type),
              maxReportDate: data.maxReportDate || 'No max report date',
              formattedAsOf: data.maxReportDate ? (() => {
                const dateParts = data.maxReportDate.split('/');
                if (dateParts.length === 3) {
                  const [month, day, year] = dateParts;
                  const reportDate = new Date(year, month - 1, day);
                  return `as of ${reportDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                }
                return 'Invalid date format';
              })() : 'No formatted date',
              comparisonData: getComparisonData(card, data),
              isZeroValue: (data[card.dataKey] || 0) === 0,
              allRelevantData: {
                monthlyAlp: data.monthlyAlp,
                comparisonAlp: data.comparisonAlp,
                monthStart: data.monthStart,
                monthEnd: data.monthEnd,
                maxReportDate: data.maxReportDate
              },
              renderTime: new Date().toISOString()
            });
            
            if ((data[card.dataKey] || 0) === 0) {
              console.warn(`⚠️ [Monthly ALP Card] Zero value detected - check backend data filtering for AGT users`);
            }
          } else if (card.type === 'daily_alp' || card.type === 'daily_ref_alp') {
            const sectionType = title || 'Unknown Section';
            console.log(`📊 [Card Render] ${sectionType} Daily Activity card data:`, {
              cardTitle: cardTitle,
              cardType: card.type,
              cardValue: getCardValue(card, data),
              dataKey: card.dataKey,
              rawValue: data[card.dataKey],
              isLoading: isDailyActivityCard && data.dailyActivityLoading,
              allDailyActivityData: {
                totalAlp: data.totalAlp,
                totalRefAlp: data.totalRefAlp,
                totalRefs: data.totalRefs,
                agentCount: data.agentCount
              },
              renderTime: new Date().toISOString()
            });
          }
          
          return (
            <div
              key={index}
              onClick={() => handleCardClick(card.navigateTo)}
              style={{ 
                cursor: card.navigateTo ? 'pointer' : 'default',
                width: '100%',
                opacity: isLoading ? 0.6 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              <Card
                title={cardTitle}
                value={getCardValue(card, data)}
                backgroundIcon={IconComponent}
                backgroundIconSize={60}
                backgroundIconPosition="bottom-right"
                backgroundIconColor={card.iconColor}
                subText={getSubText(card, data)}
                dateRange={getDateRange(card.type)}
                className={`dashboard-card ${isLoading ? 'loading' : ''}`}
                {...comparisonData}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardSection;