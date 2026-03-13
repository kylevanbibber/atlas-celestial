import React, { useState, useRef, useEffect } from 'react';
import { FiFilter, FiX, FiChevronDown, FiChevronUp, FiCheck } from 'react-icons/fi';

const FilterMenu = ({ 
  activeFilters, 
  onFilterToggle, 
  onStatusFilterToggle, 
  onToggleAllRoles, 
  onResetFilters,
  roleFilters = [], 
  statusFilters = [],
  stateFilters = [],
  onStateFilterToggle,
  onToggleAllStates,
  getRoleColor,
  getFilterColor,
  filterCategories = [],
  menuType = 'expandable', // 'expandable' or 'overlay'
  buttonLabel = 'Filters',
  position = 'bottom', // 'bottom', 'bottom-right', 'right', 'left',
  showFilterState = false,
  getFilterLabel,
  includeDateRange = false,
  dateRange = { start: null, end: null },
  onDateRangeChange,
  dateRangeLabels = {
    title: 'Date Range',
    start: 'Start Date',
    end: 'End Date',
    apply: 'Apply',
    clear: 'Clear'
  },
  customContent = null, // New prop for custom content
  customContentOnly = false // New prop to show only custom content
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const menuContentRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Swipe handling variables
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  // The minimum distance required for a swipe
  const minSwipeDistance = 50;
  
  // Check if device is mobile on mount and on resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Check on mount
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  // Handle touch events for swiping
  const onTouchStart = (e) => {
    setTouchEnd(null); // Reset touchEnd
    setTouchStart(e.targetTouches[0].clientY);
  };
  
  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    // Calculate distance
    const distance = touchStart - touchEnd;
    
    // If swipe down (negative distance) with sufficient length, close the menu
    if (distance < -minSwipeDistance) {
      setIsOpen(false);
    }
  };
  
  // Check if we need to show reset button (if any filters are active)
  const shouldShowReset = () => {
    // Check status filters
    const hasActiveStatusFilters = Object.keys(activeFilters)
      .filter(key => !['RGA', 'MGA', 'GA', 'SA', 'AGT'].includes(key) && key !== 'states')
      .some(key => activeFilters[key] !== null);
    
    // Check role filters (if not all are selected)
    const hasActiveRoleFilters = !roleFilters.every(role => activeFilters[role]);
    
    // Check state filters
    const hasActiveStateFilters = activeFilters.states && 
      Object.values(activeFilters.states).some(isActive => isActive);
    
    // Check date range
    const hasDateRange = dateRange && (dateRange.start || dateRange.end);
    
    return hasActiveStatusFilters || hasActiveRoleFilters || hasActiveStateFilters || hasDateRange;
  };
  
  // Handle clicking outside to close overlay menu
  useEffect(() => {
    if (menuType === 'overlay' && isOpen) {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, menuType]);
  
  // Count active filters for badge
  const getActiveFilterCount = () => {
    let count = 0;
    
    // Count active status filters
    Object.keys(activeFilters)
      .filter(key => !['RGA', 'MGA', 'GA', 'SA', 'AGT'].includes(key) && key !== 'states')
      .forEach(key => {
        if (activeFilters[key] !== null) count++;
      });
    
    // Count unselected role filters
    roleFilters.forEach(role => {
      if (!activeFilters[role]) count++;
    });
    
    // Count active state filters
    if (activeFilters.states) {
      Object.values(activeFilters.states).forEach(isActive => {
        if (isActive) count++;
      });
    }
    
    // Count date range if active
    if (dateRange && (dateRange.start || dateRange.end)) {
      count++;
    }
    
    return count;
  };
  
  const filterCount = getActiveFilterCount();
  
  // Toggle menu open/closed
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };
  
  // Handle reset and close menu
  const handleReset = () => {
    onResetFilters();
    if (menuType === 'overlay') {
      setIsOpen(false);
    }
  };
  
  /* Apply dark mode compatible styles to the filter menu */
  const menuStyles = {
    menuContainer: {
      position: 'relative',
      display: 'inline-block'
    },
    backdrop: {
      display: 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 98
    },
    content: {
      display: 'none',
      position: 'absolute',
      minWidth: '260px',
      backgroundColor: 'var(--card-bg)',
      boxShadow: '0 2px 8px var(--shadow-color)',
      borderRadius: '4px',
      padding: '12px 16px',
      zIndex: 99,
      border: '1px solid var(--border-color)'
    },
    contentOpen: {
      display: 'block',
      animation: 'fadeIn 0.2s ease-in-out'
    },
    backdropOpen: {
      display: 'block'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-color)',
      paddingBottom: '8px',
      marginBottom: '12px'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      padding: '5px'
    },
    heading: {
      fontSize: '1rem',
      fontWeight: '500',
      margin: 0,
      color: 'var(--text-primary)'
    },
    filterGroup: {
      marginBottom: '16px'
    },
    filterLabel: {
      fontWeight: '500',
      marginBottom: '8px',
      display: 'block',
      color: 'var(--text-primary)'
    },
    filterButtons: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      marginBottom: '8px'
    },
    filterButton: {
      padding: '5px 10px',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      transition: 'all 0.2s ease',
      backgroundColor: 'var(--sidebar-hover)',
      color: 'var(--text-primary)',
      fontWeight: '400'
    },
    filterButtonActive: {
      backgroundColor: 'var(--button-primary-bg)',
      color: 'white'
    },
    actionButton: {
      padding: '5px 10px',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      transition: 'all 0.2s ease',
      backgroundColor: 'var(--button-primary-bg)',
      color: 'white'
    }
  };
  
  // Generate the correct content position styles based on device
  const getContentPositionStyles = () => {
    if (isMobile && menuType === 'expandable') {
      // For mobile expandable mode, we want to open from bottom
      // We'll use CSS classes for this and avoid inline styles
      return {};
    }
    
    // For non-mobile or non-expandable mode, use the position prop
    if (position === 'bottom') {
      return { top: '100%', left: '0', marginTop: '8px' };
    } else if (position === 'bottom-right') {
      // Open below the button, aligned to the right edge of the trigger
      return { top: '100%', right: '0', marginTop: '8px' };
    } else if (position === 'right') {
      return { top: '0', left: '100%', marginLeft: '8px' };
    } else if (position === 'left') {
      return { top: '0', right: '100%', marginRight: '8px' };
    }
    
    return {};
  };
  
  // Date range handlers
  const handleDateRangeChange = (field, value) => {
    if (onDateRangeChange) {
      onDateRangeChange({
        ...dateRange,
        [field]: value
      });
    }
  };
  
  const clearDateRange = () => {
    if (onDateRangeChange) {
      onDateRangeChange({
        start: null,
        end: null
      });
    }
  };
  
  return (
    <div 
      className={`filter-menu-container ${menuType} ${isOpen ? 'open' : ''}`} 
      ref={menuRef}
      style={menuStyles.menuContainer}
    >
      <button 
        className={`filter-menu-toggle ${isOpen ? 'active' : ''} ${filterCount > 0 ? 'has-filters' : ''}`}
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-label="Toggle filter menu"
      >
        {typeof buttonLabel === 'string' ? (
          <>
            <FiFilter className="filter-icon" />
            <span className="filter-label">{buttonLabel}</span>
          </>
        ) : (
          <span className="filter-label">{buttonLabel}</span>
        )}
        {filterCount > 0 && (
          <span className="filter-badge">{filterCount}</span>
        )}
        {menuType === 'expandable' && (
          isOpen ? <FiChevronUp className="chevron-icon" /> : <FiChevronDown className="chevron-icon" />
        )}
      </button>
      
      <div 
        className="filter-menu-backdrop" 
        style={{
          ...menuStyles.backdrop,
          ...(isOpen && menuStyles.backdropOpen)
        }}
        onClick={toggleMenu}
      ></div>
      
      <div 
        className={`filter-menu-content ${position} ${isMobile && menuType === 'expandable' ? 'mobile-bottom' : ''}`}
        style={{
          ...menuStyles.content,
          ...(isOpen && menuStyles.contentOpen),
          ...getContentPositionStyles()
        }}
        ref={menuContentRef}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
      >
        <div className="filter-menu-header" style={menuStyles.header}>
          <h3 style={menuStyles.heading}>Filters</h3>
          <button 
            className="filter-menu-close"
            onClick={toggleMenu}
            style={menuStyles.closeButton}
          >
            <FiX size={16} />
          </button>
        </div>
        
        <div className="filter-menu-body">
          {/* Custom Content */}
          {customContent && (
            <>
              {customContent}
              {!customContentOnly && <div style={{ borderBottom: '1px solid var(--border-color)', margin: '12px 0' }}></div>}
            </>
          )}
          
          {/* Filter Categories */}
          {!customContentOnly && filterCategories && filterCategories.length > 0 && (
            <>
              {filterCategories.filter(cat => cat.type !== 'sort').map((category, index) => (
                <div key={`category-${index}`} className="filter-group" style={menuStyles.filterGroup}>
                  <span className="filter-group-label" style={menuStyles.filterLabel}>
                    {category.name}
                    {category.onToggleAll && category.filters.length > 1 && (
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="filter-action-button"
                          onClick={() => category.onToggleAll(true)}
                          style={{ 
                            background: 'none',
                            border: 'none',
                            padding: '2px 6px', 
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: category.filters.every(filter => activeFilters[filter] === true) ? 'var(--hover-color, #4a6cf7)' : 'var(--text-secondary, #666)',
                            cursor: 'pointer'
                          }}
                        >
                          All
                        </button>
                        <button
                          className="filter-action-button"
                          onClick={() => category.onToggleAll(false)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px 6px', 
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: category.filters.every(filter => activeFilters[filter] === false) ? 'var(--hover-color, #4a6cf7)' : 'var(--text-secondary, #666)',
                            cursor: 'pointer'
                          }}
                        >
                          None
                        </button>
                      </span>
                    )}
                  </span>
                  <div className="filter-buttons-row" style={menuStyles.filterButtons}>
                    {category.filters.map(filter => {
                      // Determine if filter is active
                      const currentValue = activeFilters[filter];
                      
                      // Get label for filter (either from category or global function)
                      const label = category.getFilterLabel ? 
                        category.getFilterLabel(filter) : 
                        (getFilterLabel ? getFilterLabel(filter) : filter);
                      
                      // Get color for filter (either from category or global function)
                      const filterColor = getFilterColor ? getFilterColor(filter) : null;
                      
                      // For tristate filters (true, false, null)
                      if (showFilterState && currentValue !== undefined) {
                        // Determine styling based on current state
                        let stateStyle = {};
                        let stateClass = '';
                        
                        if (currentValue === true) {
                          stateStyle = {
                            backgroundColor: '#d4edda',
                            color: '#155724',
                            border: '1px solid #c3e6cb'
                          };
                          stateClass = 'include';
                        } else if (currentValue === false) {
                          stateStyle = {
                            backgroundColor: '#f8d7da',
                            color: '#721c24',
                            border: '1px solid #f5c6cb'
                          };
                          stateClass = 'exclude';
                        }
                        
                        return (
                          <button
                            key={filter}
                            className={`filter-button tristate ${stateClass}`}
                            style={{
                              ...menuStyles.filterButton,
                              ...stateStyle
                            }}
                            onClick={() => category.onToggle(filter)}
                          >
                            {label}
                          </button>
                        );
                      }
                      
                      // For boolean filters (true/false)
                      return (
                        <button
                          key={filter}
                          className={`filter-button ${currentValue ? 'active' : ''}`}
                          style={{
                            ...menuStyles.filterButton,
                            ...(currentValue && menuStyles.filterButtonActive),
                            ...(currentValue && filterColor && { 
                              backgroundColor: filterColor.bg, 
                              border: `1px solid ${filterColor.border}` 
                            })
                          }}
                          onClick={() => category.onToggle(filter)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
          
          {/* Sort options for categories with type 'sort' */}
          {filterCategories && filterCategories.length > 0 && filterCategories.filter(cat => cat.type === 'sort').map((category, index) => (
            <div key={`sort-category-${index}`} className="filter-group" style={menuStyles.filterGroup}>
              <span className="filter-group-label" style={menuStyles.filterLabel}>
                {category.name}
              </span>
              <div className="sort-options" style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '8px'
              }}>
                {category.options && category.options.map((option, optIndex) => (
                  <button
                    key={`sort-option-${optIndex}`}
                    className={`sort-option-button ${
                      category.value && 
                      category.value.key === option.key && 
                      category.value.direction === option.direction ? 'active' : ''
                    }`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      padding: '8px 12px',
                      backgroundColor: category.value && 
                        category.value.key === option.key && 
                        category.value.direction === option.direction ? 
                        'var(--button-primary-bg-light, rgba(62, 123, 250, 0.1))' : 'transparent',
                      color: category.value && 
                        category.value.key === option.key && 
                        category.value.direction === option.direction ? 
                        'var(--button-primary-text, #3e7bfa)' : 'var(--text-primary, #333)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left'
                    }}
                    onClick={() => category.onChange && category.onChange(option)}
                  >
                    {category.value && 
                     category.value.key === option.key && 
                     category.value.direction === option.direction ? (
                      <FiCheck 
                        size={16} 
                        style={{ marginRight: '8px' }}
                      />
                    ) : (
                      <span style={{ width: '24px', display: 'inline-block' }}></span>
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          
          {/* Legacy Role filters */}
          {!customContentOnly && roleFilters.length > 0 && filterCategories.length === 0 && (
            <div className="filter-group" style={menuStyles.filterGroup}>
              <span className="filter-group-label" style={menuStyles.filterLabel}>
                Roles
                {roleFilters.length > 1 && (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '8px' }}>
                    <button
                      className="filter-action-button"
                      onClick={() => onToggleAllRoles(true)}
                      style={{ 
                        background: 'none',
                        border: 'none',
                        padding: '2px 6px', 
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: roleFilters.every(role => activeFilters[role]) ? 'var(--hover-color, #4a6cf7)' : 'var(--text-secondary, #666)',
                        cursor: 'pointer'
                      }}
                    >
                      All
                    </button>
                    <button
                      className="filter-action-button"
                      onClick={() => onToggleAllRoles(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px 6px', 
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: roleFilters.every(role => !activeFilters[role]) ? 'var(--hover-color, #4a6cf7)' : 'var(--text-secondary, #666)',
                        cursor: 'pointer'
                      }}
                    >
                      None
                    </button>
                  </span>
                )}
              </span>
              <div className="filter-buttons-row" style={menuStyles.filterButtons}>
                {roleFilters.map(role => {
                  const isActive = activeFilters[role];
                  const roleColor = getRoleColor ? getRoleColor(role) : { bg: '#ccc', border: '#aaa' };
                  
                  return (
                    <button
                      key={role}
                      className={`filter-button ${isActive ? 'active' : ''}`}
                      style={{
                        ...menuStyles.filterButton,
                        ...(isActive && menuStyles.filterButtonActive),
                        backgroundColor: isActive ? roleColor.bg : menuStyles.filterButton.backgroundColor
                      }}
                      onClick={() => onFilterToggle(role)}
                    >
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Legacy Status filters */}
          {!customContentOnly && statusFilters.length > 0 && filterCategories.length === 0 && (
            <div className="filter-group" style={menuStyles.filterGroup}>
              <label className="filter-group-label" style={menuStyles.filterLabel}>
                Status
              </label>
              <div className="filter-buttons-row" style={menuStyles.filterButtons}>
                {statusFilters.map(statusFilter => {
                  const currentValue = activeFilters[statusFilter.key];
                  const getStatusText = () => {
                    if (currentValue === null) return statusFilter.label;
                    if (currentValue === true) return statusFilter.yesLabel || 'Yes';
                    return statusFilter.noLabel || 'No';
                  };
                  
                  return (
                    <button
                      key={statusFilter.key}
                      className={`status-filter ${currentValue !== null ? 'active' : ''}`}
                      style={{
                        ...menuStyles.filterButton,
                        backgroundColor: currentValue === null 
                          ? menuStyles.filterButton.backgroundColor
                          : currentValue === true
                            ? '#d4edda' // Green for Yes
                            : '#f8d7da', // Red for No
                        color: currentValue === null
                          ? menuStyles.filterButton.color
                          : currentValue === true
                            ? '#155724' // Dark green text
                            : '#721c24' // Dark red text
                      }}
                      onClick={() => onStatusFilterToggle(statusFilter.key)}
                    >
                      {getStatusText()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Legacy State filters */}
          {!customContentOnly && stateFilters.length > 0 && filterCategories.length === 0 && (
            <div className="filter-group" style={menuStyles.filterGroup}>
              <label className="filter-group-label" style={menuStyles.filterLabel}>
                States
                {stateFilters.length > 1 && (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '8px' }}>
                    <button 
                      className="filter-action-button"
                      onClick={() => onToggleAllStates(true)}
                      style={{ 
                        background: 'none',
                        border: 'none',
                        padding: '2px 6px', 
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: activeFilters.states && Object.keys(activeFilters.states).length > 0 && Object.values(activeFilters.states).every(v => v) ? 'var(--hover-color, #4a6cf7)' : 'var(--text-secondary, #666)',
                        cursor: 'pointer'
                      }}
                    >
                      All
                    </button>
                    <button 
                      className="filter-action-button"
                      onClick={() => onToggleAllStates(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px 6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: activeFilters.states && Object.keys(activeFilters.states).length > 0 && Object.values(activeFilters.states).every(v => !v) ? 'var(--hover-color, #4a6cf7)' : 'var(--text-secondary, #666)',
                        cursor: 'pointer'
                      }}
                    >
                      None
                    </button>
                  </span>
                )}
              </label>
              <div className="filter-buttons-row" style={menuStyles.filterButtons}>
                {stateFilters.map(state => {
                  const isActive = activeFilters.states && activeFilters.states[state];
                  
                  return (
                    <button
                      key={state}
                      className={`filter-button state-filter ${isActive ? 'active' : ''}`}
                      style={{
                        ...menuStyles.filterButton,
                        ...(isActive && menuStyles.filterButtonActive)
                      }}
                      onClick={() => onStateFilterToggle(state)}
                    >
                      {state}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Date range filter */}
          {!customContentOnly && includeDateRange && (
            <div className="filter-group" style={menuStyles.filterGroup}>
              <label className="filter-group-label" style={menuStyles.filterLabel}>
                {dateRangeLabels.title}
              </label>
              <div className="date-range-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ minWidth: '80px', fontSize: '0.9rem' }}>{dateRangeLabels.start}:</label>
                  <input 
                    type="date" 
                    value={dateRange.start || ''} 
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    style={{ 
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ minWidth: '80px', fontSize: '0.9rem' }}>{dateRangeLabels.end}:</label>
                  <input 
                    type="date" 
                    value={dateRange.end || ''} 
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    style={{ 
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                
                {(dateRange.start || dateRange.end) && (
                  <button
                    onClick={clearDateRange}
                    style={{
                      alignSelf: 'flex-end',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <FiX size={14} /> {dateRangeLabels.clear}
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Reset button shown only when there are active filters */}
          {!customContentOnly && shouldShowReset() && (
            <div className="filter-actions" style={{ textAlign: 'right', marginTop: '16px' }}>
              <button 
                className="filter-reset-button"
                style={{
                  ...menuStyles.actionButton,
                  backgroundColor: 'var(--button-secondary-bg)'
                }}
                onClick={handleReset}
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterMenu; 