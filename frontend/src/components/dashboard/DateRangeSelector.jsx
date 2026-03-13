import React, { useEffect, useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiFilter } from 'react-icons/fi';
import { Button } from '../ui/button';
import { 
  formatLocalDate, 
  getFridayOfWeek,
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
  isGlobalAdmin,
  // Custom scope options override – array of { value, label } objects
  // When provided, these replace the default role-based scope buttons
  scopeOptions,
  // Stats timeframe props
  statsTimeframe,
  onStatsTimeframeChange,
  // As of date
  asOfDate,
  // Week mode: 'standard' (Mon-Sun, default) or 'friday' (Mon-Fri, for MORE report)
  weekMode = 'standard',
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
  const [isQuickPickOpen, setIsQuickPickOpen] = useState(false);
  const statsButtonRef = useRef(null);
  const dateDisplayRef = useRef(null);
  const [calendarDropdownStyle, setCalendarDropdownStyle] = useState(null);
  const [statsDropdownStyle, setStatsDropdownStyle] = useState(null);
  const [quickPickDropdownStyle, setQuickPickDropdownStyle] = useState(null);

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
      case 'week': {
        if (weekMode === 'friday') {
          // Friday mode (MORE report): Mon-Fri, anchored to Friday
          const fri = getFridayOfWeek(date);
          start = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() - 4); // Monday
          end = fri;
        } else {
          // Standard mode: Mon-Sun
          start = getMondayOfWeek(date);
          end = getSundayOfWeek(date);
        }
        break;
      }
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
      case 'week': {
        if (weekMode === 'friday') {
          // Friday mode: jump to previous Friday
          const curFri = getFridayOfWeek(currentDate);
          newDate = new Date(curFri);
          newDate.setDate(curFri.getDate() - 7);
        } else {
          // Standard mode: jump to previous Monday
          const curMon = getMondayOfWeek(currentDate);
          newDate = new Date(curMon);
          newDate.setDate(curMon.getDate() - 7);
        }
        break;
      }
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
      case 'week': {
        if (weekMode === 'friday') {
          // Friday mode: jump to next Friday
          const curFri = getFridayOfWeek(currentDate);
          newDate = new Date(curFri);
          newDate.setDate(curFri.getDate() + 7);
        } else {
          // Standard mode: jump to next Monday
          const curMon = getMondayOfWeek(currentDate);
          newDate = new Date(curMon);
          newDate.setDate(curMon.getDate() + 7);
        }
        break;
      }
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
        ? calculateDateRange(viewMode, start, { weekMode })
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

    const displayOpts = { weekMode };
    switch (viewMode) {
      case 'week':
        return formatDateRangeDisplay('week', start, end, displayOpts);
      case 'month':
        return formatDateRangeDisplay('month', start, end, displayOpts);
      case 'year':
        return formatDateRangeDisplay('year', start, end, displayOpts);
      default:
        return formatDateRangeDisplay('month', start, end, displayOpts);
    }
  };

  // Build quick-pick options based on current view mode
  const getQuickPickOptions = () => {
    const now = new Date();
    const options = [];

    if (viewMode === 'week') {
      // Current week + previous 7 weeks
      for (let i = 0; i < 8; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        let start, end;
        if (weekMode === 'friday') {
          const fri = getFridayOfWeek(d);
          start = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() - 4);
          end = fri;
        } else {
          start = getMondayOfWeek(d);
          end = getSundayOfWeek(d);
        }
        const label = i === 0
          ? 'This Week'
          : i === 1
            ? 'Last Week'
            : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        options.push({ label, start: formatLocalDate(start), end: formatLocalDate(end), date: start });
      }
    } else if (viewMode === 'month') {
      // Current month + previous 11 months
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = i === 0
          ? 'This Month'
          : i === 1
            ? 'Last Month'
            : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        options.push({ label, start: formatLocalDate(start), end: formatLocalDate(end), date: start });
      }
    } else if (viewMode === 'year') {
      // Current year + previous 4 years
      for (let i = 0; i < 5; i++) {
        const y = now.getFullYear() - i;
        const start = new Date(y, 0, 1);
        const end = new Date(y, 11, 31);
        const label = i === 0 ? `${y} (This Year)` : `${y}`;
        options.push({ label, start: formatLocalDate(start), end: formatLocalDate(end), date: start });
      }
    }
    return options;
  };

  const handleQuickPick = (option) => {
    onDateRangeChange({ start: option.start, end: option.end });
    setCurrentDate(option.date);
    setIsQuickPickOpen(false);
  };

  // Check if an option matches the current date range
  const isQuickPickActive = (option) => {
    return dateRange.start === option.start && dateRange.end === option.end;
  };

  // Render view scope buttons based on user role (or custom scopeOptions)
  const renderViewScopeButtons = () => {
    if (!onViewScopeChange) return null;

    // Build scope options list based on role
    let options = [];
    if (scopeOptions && scopeOptions.length > 0) {
      options = scopeOptions;
    } else if (!userRole) {
      return null;
    } else if (isGlobalAdmin) {
      options = [
        { value: 'personal', label: 'Personal' },
        { value: 'team', label: 'All' },
      ];
    } else if (userRole === 'RGA') {
      options = [
        { value: 'personal', label: 'Personal' },
        { value: 'mga', label: 'MGA' },
        { value: 'rga', label: 'RGA' },
      ];
    } else if (userRole === 'MGA') {
      options = [
        { value: 'personal', label: 'Personal' },
        { value: 'team', label: 'MGA' },
      ];
    } else if (['SA', 'GA'].includes(userRole)) {
      options = [
        { value: 'personal', label: 'Personal' },
        { value: 'team', label: 'Team' },
      ];
    } else if (userRole === 'SGA') {
      options = [
        { value: 'personal', label: 'Agency' },
        { value: 'mga', label: 'MGA' },
        { value: 'rga', label: 'RGA' },
      ];
    }

    if (options.length <= 1) return null;

    return options.map(opt => (
      <Button
        key={opt.value}
        variant={viewScope === opt.value ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewScopeChange(opt.value)}
        className="drs-btn"
      >
        {opt.label}
      </Button>
    ));
  };

  return (
    <>
      <div className="date-range-selector-wrapper">
        <div className="date-range-selector">
          {/* Calendar Button - LEFT SIDE */}
          <Button
            ref={calendarButtonRef}
            variant="outline"
            size="icon"
            onClick={() => {
              setCalendarDropdownStyle(getAnchoredDropdownStyle(calendarButtonRef.current, { align: 'left' }));
              setIsCalendarOpen(true);
            }}
            className="drs-icon-btn"
          >
            <FiCalendar className="calendar-icon" />
          </Button>

          {/* View Mode Buttons (W, M, Y) */}
          <div className="view-mode-buttons">
            {['week', 'month', 'year'].map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange(mode)}
                className="drs-btn"
              >
                <span className="view-mode-label-full">
                  {mode === 'week' ? 'Week' : mode === 'month' ? 'Month' : 'Year'}
                </span>
                <span className="view-mode-label-short">
                  {mode[0].toUpperCase()}
                </span>
              </Button>
            ))}
          </div>

          <div className="date-range-divider" />

          {/* Navigation */}
          <Button
            variant="ghost"
            size="icon"
            onClick={navigatePrevious}
            className="drs-nav-btn"
          >
            <FiChevronLeft className="nav-icon" />
          </Button>

          {/* Display Text — clickable to open quick-pick */}
          <div
            ref={dateDisplayRef}
            className="date-display date-display-clickable"
            onClick={() => {
              setQuickPickDropdownStyle(getAnchoredDropdownStyle(dateDisplayRef.current, { align: 'left' }));
              setIsQuickPickOpen(true);
            }}
          >
            <div>{getDisplayText()}</div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={navigateNext}
            className="drs-nav-btn"
          >
            <FiChevronRight className="nav-icon" />
          </Button>

          <div className="date-range-divider" />

          {/* View Scope Buttons (Personal/MGA/RGA) - RIGHT SIDE */}
          {renderViewScopeButtons()}

          {/* Stats Timeframe Filter - Show only for personal view */}
          {viewScope === 'personal' && onStatsTimeframeChange && (
            <>
              <div className="date-range-divider" style={{ marginLeft: '0.5rem', marginRight: '0.5rem' }} />
              <Button
                ref={statsButtonRef}
                variant="outline"
                size="icon"
                onClick={() => {
                  const nextOpen = !isStatsDropdownOpen;
                  if (nextOpen) {
                    setStatsDropdownStyle(getAnchoredDropdownStyle(statsButtonRef.current, { align: 'right' }));
                  }
                  setIsStatsDropdownOpen(nextOpen);
                }}
                className="drs-icon-btn"
                title="Filter stats timeframe"
              >
                <FiFilter className="calendar-icon" />
              </Button>
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
              {[
                { value: 'thisMonth', label: 'This Month' },
                { value: 'lastMonth', label: 'Last Month' },
                { value: 'sixMonths', label: '6 Months' },
                { value: 'allTime', label: 'All Time' },
              ].map(({ value, label }) => (
                <Button
                  key={value}
                  variant={statsTimeframe === value ? 'default' : 'ghost'}
                  onClick={() => {
                    onStatsTimeframeChange(value);
                    setIsStatsDropdownOpen(false);
                  }}
                  className="w-full justify-start"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Quick-Pick Range Dropdown */}
      {isQuickPickOpen && (
        <>
          <div
            className="date-range-backdrop"
            onClick={() => setIsQuickPickOpen(false)}
          />
          <div className="date-range-dropdown" style={quickPickDropdownStyle || undefined}>
            <h3 className="dropdown-title">
              {viewMode === 'week' ? 'Jump to Week' : viewMode === 'year' ? 'Jump to Year' : 'Jump to Month'}
            </h3>
            <div className="dropdown-content" style={{ gap: '0.25rem' }}>
              {getQuickPickOptions().map((option, idx) => (
                <Button
                  key={idx}
                  variant={isQuickPickActive(option) ? 'default' : 'ghost'}
                  onClick={() => handleQuickPick(option)}
                  className="w-full justify-start"
                  style={{ fontSize: '0.8rem' }}
                >
                  {option.label}
                </Button>
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
              <Button onClick={applyCustomRange} className="w-full">
                Apply Date Range
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default DateRangeSelector;

