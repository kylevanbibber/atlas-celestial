import React, { useContext } from 'react';
import WidgetCard from '../utils/WidgetCard';
import ThemeContext from '../../context/ThemeContext';
import { FiUsers, FiUserCheck, FiAward, FiDollarSign, FiEdit2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

const CommitsWidget = ({
  viewingUserClname,
  viewScope,
  orgMetrics,
  orgMetricsLoading,
  alpAsOfDate,
  commits,
  commitHistory,
  editingCommit,
  setEditingCommit,
  commitInput,
  setCommitInput,
  saveCommit,
  saveAlpGoal,
  setShowHistoryModal,
  setHistoryModalType,
  setShowBreakdownModal,
  fetchRefSalesBreakdown, // Function to fetch ref sales agent breakdown
  formatCurrency,
  formatNumber,
  userClname,
  timePeriod,
  viewMode,
  // Historical data for comparison
  orgMetricsHistory,
  // Display options
  showSectionBackground = true, // Whether to show the oneonone-section background
  // MGA/RGA Official ALP toggle props
  mgaAlpMode,
  setMgaAlpMode,
  rgaAlpMode,
  setRgaAlpMode,
  mgaOfficialAlp,
  rgaOfficialAlp,
  hasMgaOfficialAlpData,
  hasRgaOfficialAlpData
}) => {
  const { theme } = useContext(ThemeContext);
  const [comparisonPopover, setComparisonPopover] = React.useState(null); // { data, position }
  
  // Close popover when clicking outside
  React.useEffect(() => {
    if (!comparisonPopover) return;
    
    const handleClickOutside = () => setComparisonPopover(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [comparisonPopover]);

  const showOrgMetrics = (
    (viewingUserClname === 'MGA' && viewScope === 'team') || 
    (viewingUserClname === 'RGA' && (viewScope === 'mga' || viewScope === 'rga')) ||
    (viewingUserClname === 'GA' && viewScope === 'team') ||
    (viewingUserClname === 'SA' && viewScope === 'team')
  );

  // Get time period label
  const getPeriodLabel = () => {
    if (!timePeriod) return 'MTD'; // Default for OneOnOne compatibility
    
    switch (timePeriod) {
      case 'thisMonth':
        return 'MTD';
      case 'lastMonth': {
        // Get the previous month's name
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return lastMonth.toLocaleString('en-US', { month: 'long' });
      }
      case 'ytd':
        return 'YTD';
      default:
        return 'MTD';
    }
  };

  const periodLabel = getPeriodLabel();

  // Only allow editing commits/goals for "This Month" and "YTD" periods (not for lastMonth)
  const canEditCommits = !timePeriod || timePeriod === 'thisMonth' || timePeriod === 'ytd';

  // Calculate comparison data
  const getComparison = (type, currentValue) => {
    if (!orgMetricsHistory) return { value: null, label: '', format: 'number' };
    
    const lastYearValue = orgMetricsHistory[`${type}LastYear`];
    const prevMonthValue = orgMetricsHistory[`${type}PrevMonth`];
    
    // Determine format based on type
    const format = type === 'alp' ? 'currency' : 'number';
    
    // Prefer same month last year if available
    if (lastYearValue !== undefined && lastYearValue !== null) {
      return {
        value: currentValue - lastYearValue,
        label: 'vs last year',
        format
      };
    }
    
    // Fall back to previous month
    if (prevMonthValue !== undefined && prevMonthValue !== null) {
      return {
        value: currentValue - prevMonthValue,
        label: 'vs prev month',
        format
      };
    }
    
    return { value: null, label: '', format };
  };

  if (!showOrgMetrics) {
    return null;
  }

  // Get icon and color for each metric type
  const getMetricConfig = (type) => {
    switch (type) {
      case 'hires':
        return { icon: FiUsers, color: '#4caf50', title: 'Hires' };
      case 'codes':
        return { icon: FiUserCheck, color: '#2196f3', title: 'Codes' };
      case 'vips':
        return { icon: FiAward, color: '#ff9800', title: 'VIPs' };
      case 'alp':
        return { icon: FiDollarSign, color: '#9c27b0', title: 'ALP' };
      case 'refSales':
        return { icon: FiUserCheck, color: '#00bcd4', title: 'Ref Sales' };
      default:
        return { icon: FiDollarSign, color: '#666', title: type };
    }
  };

  // Handle comparison click - show popover
  const handleComparisonClick = (type, currentValue, comparison, event) => {
    if (!comparison.value) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const now = new Date();
    
    // Determine current period label based on timePeriod
    let currentPeriod;
    if (timePeriod === 'ytd') {
      currentPeriod = `YTD ${now.getFullYear()}`;
    } else {
      currentPeriod = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    
    // Determine the comparison period
    let comparisonPeriod;
    if (timePeriod === 'ytd' && comparison.label === 'vs last year') {
      // For YTD mode: Only ALP uses full year, all others use same month range
      if (type === 'alp') {
        comparisonPeriod = `Full Year ${now.getFullYear() - 1}`;
      } else {
        // Hires, Codes, VIPs, Ref Sales compare same month range (up to last completed month)
        const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthName = lastCompletedMonth.toLocaleString('en-US', { month: 'long' });
        comparisonPeriod = `Jan-${lastMonthName} ${now.getFullYear() - 1}`;
      }
    } else if (comparison.label === 'vs last year') {
      const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      comparisonPeriod = lastYear.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } else if (comparison.label === 'vs prev month') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      comparisonPeriod = prevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    
    const isAlp = type === 'alp';
    const formatValue = (val) => isAlp ? formatCurrency(val) : formatNumber(val);
    const previousValue = currentValue - comparison.value;
    
    setComparisonPopover({
      data: {
        type,
        currentPeriod,
        comparisonPeriod,
        currentValue,
        previousValue,
        difference: comparison.value,
        formatValue
      },
      position: {
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX
      }
    });
  };

  const wrapperStyle = showSectionBackground 
    ? { gridColumn: '1 / 4' }
    : {};

  return (
    <div className={showSectionBackground ? "oneonone-section" : ""} style={wrapperStyle}>
      {showSectionBackground && (
        <div className="section-header">
          <h2>Org Metrics</h2>
        </div>
      )}
      <div className="metric-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Media query handled in CSS */}
        <style>{`
          @media (max-width: 768px) {
            .metric-row { grid-template-columns: 1fr !important; }
          }
        `}</style>
        {['hires', 'codes', 'vips', 'refSales', 'alp']
          .filter(type => {
            // Hide hires card for SA and GA users
            if (type === 'hires' && (viewingUserClname === 'GA' || viewingUserClname === 'SA')) {
              return false;
            }
            return true;
          })
          .map((type) => {
          const isAlp = type === 'alp';
          
          // Determine ALP mode and value for MGA/RGA views
          let alpMode = 'reported';
          let hasOfficialData = false;
          if (isAlp) {
            if (viewScope === 'mga') {
              alpMode = mgaAlpMode || 'reported';
              hasOfficialData = hasMgaOfficialAlpData;
            } else if (viewScope === 'rga') {
              alpMode = rgaAlpMode || 'reported';
              hasOfficialData = hasRgaOfficialAlpData;
            }
          }
          
          // Get the value to display
          let value = orgMetrics?.[`${type}MTD`] || 0;
          if (isAlp && alpMode === 'official') {
            if (viewScope === 'mga') {
              value = mgaOfficialAlp || 0;
            } else if (viewScope === 'rga') {
              value = rgaOfficialAlp || 0;
            }
          }
          
          const commit = commits[type];
          const isEditing = editingCommit === type;
          const history = commitHistory[type] || [];
          const hasHistory = history.length > 1;
          const isHires = type === 'hires';
          const isGA = userClname === 'GA';
          const isSA = userClname === 'SA';
          const showComingSoon = isHires && (isGA || isSA);
          const config = getMetricConfig(type);
          
          // Calculate percentage for donut (current value / commit)
          const percentage = commit && commit > 0 ? Math.min(100, Math.round((value / commit) * 100)) : 0;
          
          // Get comparison data
          const comparison = getComparison(type, value);
          
          // Get link for each card type
          const getCardLink = (cardType) => {
            switch (cardType) {
              case 'hires':
                return '/resources?report=m-o-r-e';
              case 'codes':
                return '/production?section=vips';
              case 'vips':
                return '/production?section=vips';
              case 'alp':
                return '/production?section=scorecard';
              case 'refSales':
                return '/resources?active=reports&report=ref-sales';
              default:
                return undefined;
            }
          };
          
          return (
            <WidgetCard
              key={type}
              title={`${config.title} - ${periodLabel}`}
              topRightAction={
                canEditCommits && !orgMetricsLoading && !showComingSoon && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Toggle between reported and official ALP for MGA/RGA views */}
                    {isAlp && hasOfficialData && (viewScope === 'mga' || viewScope === 'rga') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (viewScope === 'mga') {
                            setMgaAlpMode(mgaAlpMode === 'reported' ? 'official' : 'reported');
                          } else if (viewScope === 'rga') {
                            setRgaAlpMode(rgaAlpMode === 'reported' ? 'official' : 'reported');
                          }
                        }}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          background: 'transparent',
                          color: '#06b6d4',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#06b6d420'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title={`Switch to ${alpMode === 'reported' ? 'official' : 'reported'} ALP`}
                      >
                        {alpMode === 'reported' ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                      </button>
                    )}
                    {/* Edit button */}
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingCommit(type); 
                      setCommitInput(commit !== null ? String(commit) : ''); 
                    }}
                    style={{ 
                      padding: '6px', 
                      borderRadius: '6px', 
                      background: 'transparent', 
                      color: config.color, 
                      border: 'none', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = `${config.color}20`}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    title={commit !== null ? (isAlp ? 'Edit Goal' : 'Edit Commit') : (isAlp ? 'Set Goal' : 'Set Commit')}
                  >
                    <FiEdit2 size={18} />
                  </button>
                  </div>
                )
              }
              value={
                orgMetricsLoading ? (
                  <span className="spinner"></span>
                ) : showComingSoon ? (
                  'Coming Soon'
                ) : (
                  isAlp ? formatCurrency(value) : formatNumber(value)
                )
              }
              icon={config.icon}
              color={config.color}
              loading={orgMetricsLoading}
              onClick={
                !isAlp && !orgMetricsLoading && !showComingSoon ? 
                  (type === 'refSales' ? 
                    async () => { 
                      if (fetchRefSalesBreakdown) await fetchRefSalesBreakdown(); 
                      setShowBreakdownModal(true); 
                    } : 
                    () => setShowBreakdownModal(true)
                  ) : 
                  undefined
              }
              linkTo={getCardLink(type)}
              // Week view should NOT show goal/progress on the ALP card (personal/MGA/RGA).
              showProgress={
                (isAlp ? viewMode !== 'week' : true) &&
                commit !== null &&
                commit > 0 &&
                !showComingSoon
              }
              currentValue={value}
              goalValue={commit}
              showComparison={!orgMetricsLoading && !showComingSoon && comparison.value !== null}
              comparisonValue={comparison.value}
              comparisonLabel={comparison.label}
              comparisonFormat={comparison.format}
              showComparisonPercentage={false}
              onComparisonClick={(e) => handleComparisonClick(type, value, comparison, e)}
              subText={
                isAlp && !orgMetricsLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                    {/* Mode label for MGA/RGA views */}
                    {(viewScope === 'mga' || viewScope === 'rga') && (
                      <div style={{
                        display: 'inline-block',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        background: alpMode === 'official' ? '#06b6d420' : '#8b5cf620',
                        color: alpMode === 'official' ? '#06b6d4' : '#8b5cf6',
                        alignSelf: 'flex-start'
                      }}>
                        {alpMode === 'official' ? 'Official' : 'Reported'}
                      </div>
                    )}
                    {alpAsOfDate && (
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    As of {alpAsOfDate}
                  </span>
                    )}
                  </div>
                ) : null
              }
              actionButton={
                <>
                  {/* History button */}
                  {hasHistory && !isAlp && !orgMetricsLoading && (
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setHistoryModalType(type); 
                        setShowHistoryModal(true); 
                      }}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '0.75rem', 
                        borderRadius: '6px', 
                        background: 'transparent', 
                        color: config.color, 
                        border: `1px solid ${config.color}`, 
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginBottom: '0.5rem'
                      }}
                      title={`View ${history.length} changes`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      History ({history.length})
                    </button>
                  )}
                  
                  {/* Edit input fields - only shown when editing */}
                  {canEditCommits && !orgMetricsLoading && !showComingSoon && isEditing && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <input
                        type="number"
                        value={commitInput}
                        onChange={(e) => setCommitInput(e.target.value)}
                        placeholder={isAlp ? "Goal" : "Commit"}
                        style={{ 
                          flex: 1, 
                          padding: '8px', 
                          fontSize: '0.875rem', 
                          borderRadius: '6px', 
                          border: '1px solid #ddd',
                          background: 'var(--input-bg, #fff)',
                          color: 'var(--text-primary, #000)'
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          isAlp ? saveAlpGoal() : saveCommit(type); 
                        }}
                        style={{ 
                          padding: '8px 12px', 
                          fontSize: '0.75rem', 
                          borderRadius: '6px', 
                          background: config.color, 
                          color: '#fff', 
                          border: 'none', 
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingCommit(null); 
                          setCommitInput(''); 
                        }}
                        style={{ 
                          padding: '8px 12px', 
                          fontSize: '0.75rem', 
                          borderRadius: '6px', 
                          background: '#6c757d', 
                          color: '#fff', 
                          border: 'none', 
                          cursor: 'pointer' 
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      {/* Comparison Popover Menu */}
      {comparisonPopover && (
        <div 
          style={{
            position: 'fixed',
            top: `${comparisonPopover.position.top}px`,
            left: `${comparisonPopover.position.left}px`,
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#f0f0f0' : '#000',
            borderRadius: '8px',
            padding: '0.5rem',
            minWidth: '200px',
            boxShadow: theme === 'dark' 
              ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
              : '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 10000,
            border: theme === 'dark' ? '1px solid #444' : '1px solid #e0e0e0'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Current Period */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px'
          }}>
            <span style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#aaa' : '#666' }}>
              {comparisonPopover.data.currentPeriod}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', marginLeft: '1rem' }}>
              {comparisonPopover.data.formatValue(comparisonPopover.data.currentValue)}
            </span>
          </div>
          
          {/* Comparison Period */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px'
          }}>
            <span style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#aaa' : '#666' }}>
              {comparisonPopover.data.comparisonPeriod}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', marginLeft: '1rem' }}>
              {comparisonPopover.data.formatValue(comparisonPopover.data.previousValue)}
            </span>
          </div>
          
          {/* Separator */}
          <div style={{ 
            borderTop: theme === 'dark' ? '1px solid #444' : '1px solid #e0e0e0', 
            margin: '0.25rem 0' 
          }} />
          
          {/* Difference */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px'
          }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
              Difference
            </span>
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: 'bold',
              marginLeft: '1rem',
              color: comparisonPopover.data.difference > 0 
                ? '#4caf50' 
                : comparisonPopover.data.difference < 0 
                  ? '#f44336' 
                  : (theme === 'dark' ? '#f0f0f0' : '#000')
            }}>
              {comparisonPopover.data.difference > 0 ? '+' : ''}{comparisonPopover.data.formatValue(comparisonPopover.data.difference)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitsWidget;

