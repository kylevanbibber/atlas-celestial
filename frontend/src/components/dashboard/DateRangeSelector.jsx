import React, { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiFilter } from 'react-icons/fi';
import { 
  formatLocalDate, 
  getMondayOfWeek, 
  getSundayOfWeek,
  calculateDateRange,
  parseLocalDate as parseDate,
  formatDateRangeDisplay 
} from '../../utils/dateRangeUtils';
import './DateRangeSelector.css';

const DateRangeSelector = ({
  dateRange,
  onDateRangeChange,
  viewMode: externalViewMode,
  onViewModeChange,
  // View scope props (Personal/MGA/RGA)
  viewScope,
  onViewScopeChange,
  userRole,
  // Stats timeframe props
  statsTimeframe,
  onStatsTimeframeChange,
  // As of date
  asOfDate,
}) => {
  const [internalViewMode, setInternalViewMode] = useState('month');
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const calendarButtonRef = useRef(null);
  const [isStatsDropdownOpen, setIsStatsDropdownOpen] = useState(false);
  const statsButtonRef = useRef(null);
  const [calendarDropdownStyle, setCalendarDropdownStyle] = useState(null);
  const [statsDropdownStyle, setStatsDropdownStyle] = useState(null);

  // Position dropdown below its trigger so it doesn't get clipped by the header
  const getAnchoredDropdownStyle = (buttonEl, { align = 'left' } = {}) => {
    if (!buttonEl) return null;

    const rect = buttonEl.getBoundingClientRect();
    const margin = 8;
    const dropdownWidth = 320; // matches CSS (20rem)

    const top = rect.bottom + margin;
    let left = rect.left;
    if (align === 'right') {
      left = rect.right - dropdownWidth;
    }

    // Clamp within viewport
    left = Math.max(margin, Math.min(left, window.innerWidth - dropdownWidth - margin));
    const maxHeight = Math.max(160, window.innerHeight - top - margin);

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      transform: 'none',
      maxHeight: `${maxHeight}px`,
      overflowY: 'auto',
    };
  };

  // Date utilities are now imported from centralized dateRangeUtils

  // Update date range based on view mode
  const updateDateRange = (date, mode) => {
    let start;
    let end;

    switch (mode) {
      case 'week':
        start = getMondayOfWeek(date);
        end = getSundayOfWeek(date);
        break;
      case 'month':
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        break;
      case 'year':
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31);
        break;
      default:
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    }

    onDateRangeChange({
      start: formatLocalDate(start),
      end: formatLocalDate(end),
    });
  };

  // Navigate to previous period
  const navigatePrevious = () => {
    let newDate;
    
    switch (viewMode) {
      case 'week':
        newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() - 7);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        break;
      case 'year':
        newDate = new Date(currentDate.getFullYear() - 1, 0, 1);
        break;
      default:
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    }
    
    setCurrentDate(newDate);
    updateDateRange(newDate, viewMode);
  };

  // Navigate to next period
  const navigateNext = () => {
    let newDate;
    
    switch (viewMode) {
      case 'week':
        newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + 7);
        break;
      case 'month':
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        break;
      case 'year':
        newDate = new Date(currentDate.getFullYear() + 1, 0, 1);
        break;
      default:
        newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }
    
    setCurrentDate(newDate);
    updateDateRange(newDate, viewMode);
  };

  // Change view mode
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    updateDateRange(currentDate, mode);
  };

  // Apply custom date range
  const applyCustomRange = () => {
    if (customStart && customEnd) {
      onDateRangeChange({
        start: customStart,
        end: customEnd,
      });
      // Keep the navigation/display anchored to the selected range
      const nextCurrent = parseDate(customStart);
      if (nextCurrent) setCurrentDate(nextCurrent);
      setIsCalendarOpen(false);
    }
  };

  // Keep internal currentDate in sync with external dateRange (important for custom ranges)
  useEffect(() => {
    if (!dateRange?.start) return;
    const next = parseDate(dateRange.start);
    if (next) setCurrentDate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.start]);

  // Format display text
  const getDisplayText = () => {
    const start = parseDate(dateRange.start);
    const end = parseDate(dateRange.end);

    // If the selected range doesn't match the standard period window,
    // show the actual custom range in the center display.
    try {
      const expected = (viewMode === 'week' || viewMode === 'month' || viewMode === 'year')
        ? calculateDateRange(viewMode, start)
        : null;

      if (expected && expected.startDate && expected.endDate) {
        const isCustom = expected.startDate !== dateRange.start || expected.endDate !== dateRange.end;
        if (isCustom) {
          const fmt = (d) =>
            d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
          return `${fmt(start)} - ${fmt(end)}`;
        }
      }
    } catch {
      // fall back to standard formatting below
    }

    switch (viewMode) {
      case 'week':
        return formatDateRangeDisplay('week', start, end);
      case 'month':
        return formatDateRangeDisplay('month', start, end);
      case 'year':
        return formatDateRangeDisplay('year', start, end);
      default:
        return formatDateRangeDisplay('month', start, end);
    }
  };

  // Render view scope buttons based on user role
  const renderViewScopeButtons = () => {
    if (!onViewScopeChange || !userRole) return null;

    if (userRole === 'RGA') {
      return (
        <>
          <button
            onClick={() => onViewScopeChange('personal')}
            className={`view-mode-button ${viewScope === 'personal' ? 'active' : ''}`}
          >
            Personal
          </button>
          <button
            onClick={() => onViewScopeChange('mga')}
            className={`view-mode-button ${viewScope === 'mga' ? 'active' : ''}`}
          >
            MGA
          </button>
          <button
            onClick={() => onViewScopeChange('rga')}
            className={`view-mode-button ${viewScope === 'rga' ? 'active' : ''}`}
          >
            RGA
          </button>
        </>
      );
    }

    if (['SA', 'GA', 'MGA'].includes(userRole)) {
      return (
        <>
          <button
            onClick={() => onViewScopeChange('personal')}
            className={`view-mode-button ${viewScope === 'personal' ? 'active' : ''}`}
          >
            Personal
          </button>
          <button
            onClick={() => onViewScopeChange('team')}
            className={`view-mode-button ${viewScope === 'team' ? 'active' : ''}`}
          >
            Team
          </button>
        </>
      );
    }

    return null;
  };

  return (
    <>
      <div className="date-range-selector-wrapper">
        <div className="date-range-selector">
          {/* Calendar Button - LEFT SIDE */}
          <button
            ref={calendarButtonRef}
            onClick={() => {
              setCalendarDropdownStyle(getAnchoredDropdownStyle(calendarButtonRef.current, { align: 'left' }));
              setIsCalendarOpen(true);
            }}
            className="calendar-button"
          >
            <FiCalendar className="calendar-icon" />
          </button>

          {/* View Mode Buttons (W, M, Y) */}
          <div className="view-mode-buttons">
            <button
              onClick={() => handleViewModeChange('week')}
              className={`view-mode-button ${viewMode === 'week' ? 'active' : ''}`}
            >
              <span className="view-mode-label-full">Week</span>
              <span className="view-mode-label-short">W</span>
            </button>
            <button
              onClick={() => handleViewModeChange('month')}
              className={`view-mode-button ${viewMode === 'month' ? 'active' : ''}`}
            >
              <span className="view-mode-label-full">Month</span>
              <span className="view-mode-label-short">M</span>
            </button>
            <button
              onClick={() => handleViewModeChange('year')}
              className={`view-mode-button ${viewMode === 'year' ? 'active' : ''}`}
            >
              <span className="view-mode-label-full">Year</span>
              <span className="view-mode-label-short">Y</span>
            </button>
          </div>

          <div className="date-range-divider" />

          {/* Navigation */}
          <button
            onClick={navigatePrevious}
            className="nav-button"
          >
            <FiChevronLeft className="nav-icon" />
          </button>

          {/* Display Text */}
          <div className="date-display">
            <div>{getDisplayText()}</div>
          </div>

          <button
            onClick={navigateNext}
            className="nav-button"
          >
            <FiChevronRight className="nav-icon" />
          </button>

          <div className="date-range-divider" />

          {/* View Scope Buttons (Personal/MGA/RGA) - RIGHT SIDE */}
          {renderViewScopeButtons()}

          {/* Stats Timeframe Filter - Show only for personal view */}
          {viewScope === 'personal' && onStatsTimeframeChange && (
            <>
              <div className="date-range-divider" style={{ marginLeft: '0.5rem', marginRight: '0.5rem' }} />
              <button
                ref={statsButtonRef}
                onClick={() => {
                  const nextOpen = !isStatsDropdownOpen;
                  if (nextOpen) {
                    setStatsDropdownStyle(getAnchoredDropdownStyle(statsButtonRef.current, { align: 'right' }));
                  }
                  setIsStatsDropdownOpen(nextOpen);
                }}
                className="calendar-button"
                title="Filter stats timeframe"
              >
                <FiFilter className="calendar-icon" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Timeframe Dropdown */}
      {isStatsDropdownOpen && (
        <>
          <div
            className="date-range-backdrop"
            onClick={() => setIsStatsDropdownOpen(false)}
          />
          <div className="date-range-dropdown" style={statsDropdownStyle || undefined}>
            <h3 className="dropdown-title">Stats Timeframe</h3>
            <div className="dropdown-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['thisMonth', 'lastMonth', 'sixMonths', 'allTime'].map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => {
                    onStatsTimeframeChange(timeframe);
                    setIsStatsDropdownOpen(false);
                  }}
                  className={`view-mode-button ${statsTimeframe === timeframe ? 'active' : ''}`}
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
                >
                  {timeframe === 'thisMonth' && 'This Month'}
                  {timeframe === 'lastMonth' && 'Last Month'}
                  {timeframe === 'sixMonths' && '6 Months'}
                  {timeframe === 'allTime' && 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Custom Date Range Dropdown */}
      {isCalendarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="date-range-backdrop"
            onClick={() => setIsCalendarOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="date-range-dropdown" style={calendarDropdownStyle || undefined}>
            <h3 className="dropdown-title">Select Custom Date Range</h3>
            <div className="dropdown-content">
              <div className="input-group">
                <label className="input-label">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
              <button onClick={applyCustomRange} className="apply-button">
                Apply Date Range
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default DateRangeSelector;

