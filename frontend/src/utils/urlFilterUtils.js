// URL parameter management utilities for report components

// Update URL parameters based on filter changes
export const updateFilterUrlParams = (filterUpdates) => {
  const url = new URL(window.location);
  
  // Update URL parameters based on filter changes
  Object.entries(filterUpdates).forEach(([key, value]) => {
    if (key === 'dateRange' && value) {
      if (value.start) {
        url.searchParams.set('dateStart', value.start);
      } else {
        url.searchParams.delete('dateStart');
      }
      if (value.end) {
        url.searchParams.set('dateEnd', value.end);
      } else {
        url.searchParams.delete('dateEnd');
      }
    } else if (key === 'hierarchyLevel') {
      if (value && value !== 'all') {
        url.searchParams.set('hierarchyLevel', value);
      } else {
        url.searchParams.delete('hierarchyLevel');
      }
    } else if (key === 'selectedTeam') {
      if (value && value !== 'all') {
        url.searchParams.set('team', value);
      } else {
        url.searchParams.delete('team');
      }
    } else if (key === 'rangeType') {
      if (value && value !== 'month') { // month is default for RefReport, week for MoreReport
        url.searchParams.set('rangeType', value);
      } else {
        url.searchParams.delete('rangeType');
      }
    } else if (key === 'currentDate') {
      if (value) {
        const dateStr = value instanceof Date ? value.toISOString().split('T')[0] : value;
        url.searchParams.set('currentDate', dateStr);
      } else {
        url.searchParams.delete('currentDate');
      }
    }
  });
  
  // Update URL without page reload
  window.history.pushState({}, '', url);
};

// Read filter parameters from URL
export const readFilterParamsFromUrl = (validOptions = {}) => {
  const urlParams = new URLSearchParams(window.location.search);
  const filterUpdates = {};
  let hasUpdates = false;

  // Read date range
  const dateStart = urlParams.get('dateStart');
  const dateEnd = urlParams.get('dateEnd');
  if (dateStart || dateEnd) {
    filterUpdates.dateRange = { start: dateStart, end: dateEnd };
    hasUpdates = true;
  }

  // Read hierarchy level
  const urlHierarchyLevel = urlParams.get('hierarchyLevel');
  if (urlHierarchyLevel && (!validOptions.hierarchyOptions || validOptions.hierarchyOptions.some(opt => opt.value === urlHierarchyLevel))) {
    filterUpdates.hierarchyLevel = urlHierarchyLevel;
    hasUpdates = true;
  }

  // Read team
  const urlTeam = urlParams.get('team');
  if (urlTeam) {
    filterUpdates.selectedTeam = urlTeam;
    hasUpdates = true;
  }

  // Read range type
  const urlRangeType = urlParams.get('rangeType');
  if (urlRangeType && ['week', 'month', 'year'].includes(urlRangeType)) {
    filterUpdates.rangeType = urlRangeType;
    hasUpdates = true;
  }

  // Read current date
  const urlCurrentDate = urlParams.get('currentDate');
  if (urlCurrentDate) {
    try {
      const [year, month, day] = urlCurrentDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        filterUpdates.currentDate = date;
        hasUpdates = true;
      }
    } catch (e) {
      console.warn('Invalid currentDate parameter:', urlCurrentDate);
    }
  }

  return hasUpdates ? filterUpdates : null;
};

// Clear all filter parameters from URL
export const clearFilterUrlParams = () => {
  const url = new URL(window.location);
  url.searchParams.delete('dateStart');
  url.searchParams.delete('dateEnd');
  url.searchParams.delete('hierarchyLevel');
  url.searchParams.delete('team');
  url.searchParams.delete('rangeType');
  url.searchParams.delete('currentDate');
  window.history.pushState({}, '', url);
};

// Setup browser navigation event listeners for filter synchronization
export const setupFilterNavigation = (handleFilterChange, readFiltersCallback) => {
  const handlePopState = () => {
    const urlFilterUpdates = readFiltersCallback ? readFiltersCallback() : readFilterParamsFromUrl();
    
    if (urlFilterUpdates) {
      handleFilterChange(urlFilterUpdates);
    } else {
      // No filter parameters, reset to defaults
      handleFilterChange(null); // Component should handle null as reset signal
    }
  };

  window.addEventListener('popstate', handlePopState);
  
  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}; 