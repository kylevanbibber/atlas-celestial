import React, { useState, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
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
}) => {
  const [internalViewMode, setInternalViewMode] = useState('month');
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const calendarButtonRef = useRef(null);

  // Format date in local timezone (YYYY-MM-DD)
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get Monday of the week
  const getMondayOfWeek = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.getFullYear(), date.getMonth(), diff);
  };

  // Get Sunday of the week
  const getSundayOfWeek = (date) => {
    const monday = getMondayOfWeek(date);
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  };

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
      setIsCalendarOpen(false);
    }
  };

  // Parse date string as local time (not UTC)
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format display text
  const getDisplayText = () => {
    const start = parseLocalDate(dateRange.start);
    const end = parseLocalDate(dateRange.end);

    switch (viewMode) {
      case 'week':
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'year':
        return start.getFullYear().toString();
      default:
        return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
            onClick={() => setIsCalendarOpen(true)}
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
            {getDisplayText()}
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
        </div>
      </div>

      {/* Custom Date Range Dropdown */}
      {isCalendarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="date-range-backdrop"
            onClick={() => setIsCalendarOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="date-range-dropdown">
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

