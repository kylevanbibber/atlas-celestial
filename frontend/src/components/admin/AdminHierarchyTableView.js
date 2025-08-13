import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiChevronRight, FiLoader, FiUser, FiSearch, FiFilter, FiX, FiDownload, FiChevronDown, FiChevronUp, FiUsers, FiCheck, FiMail, FiXCircle, FiCheckCircle, FiList } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import '../../pages/settings/Settings.css';
import './AdminHierarchyTableView.css'; // We'll create this CSS file next
import FilterMenu from '../common/FilterMenu';
import ScrollToTop from '../utils/ScrollToTop';

// Don't import from constants directly, define states here to avoid circular dependencies
const US_STATES_LIST = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
];

// Admin Hierarchy Table View component
const AdminHierarchyTableView = (props) => {
  const { hasPermission, user } = useAuth();
  // Use props if provided, otherwise use local state
  const [loading, setLoading] = useState(!props.rgaHierarchies);
  const [rgaHierarchies, setRgaHierarchies] = useState(props.rgaHierarchies || []);
  const [expandedRGAs, setExpandedRGAs] = useState(props.expandedRGAs || {});
  const [expandedNodes, setExpandedNodes] = useState({});
  const [error, setError] = useState(props.error || '');
  const [searchQuery, setSearchQuery] = useState(props.searchQuery || '');
  const [searchResults, setSearchResults] = useState(props.searchResults || null);
  const [toggleLoading, setToggleLoading] = useState(null);
  const [selectedRows, setSelectedRows] = useState({});
  const [activeFilters, setActiveFilters] = useState(props.activeFilters || {
    // Role filters
    RGA: true,
    MGA: true,
    GA: true,
    SA: true,
    AGT: true,
    // Status filters
    released: null, // null = show both, true = only released, false = only not released
    redeemed: null, // null = show both, true = only redeemed, false = only not redeemed
    noProfPic: null,  // null = show both, true = only without profile pic
    managerActive: true, // true = only active users
    pending: null, // null = show both, true = only RFC, false = only not RFC
    // State license filters
    states: {} // Will be populated with state codes from licenses
  });
  const [allAvailableStates, setAllAvailableStates] = useState([]);
  const [processingStats, setProcessingStats] = useState({
    total: 0,
    loaded: 0,
    inProgress: false
  });
  // Add a search index to improve search performance
  const [searchIndex, setSearchIndex] = useState({});
  // Debounce timer reference
  const [searchTimer, setSearchTimer] = useState(null);
  
  // Add a ref for the scrollable container
  const scrollableContainerRef = useRef(null);
  
  // Check if we should show controls (default to true if not specified)
  const showControls = props.showControls !== undefined ? props.showControls : true;

  // Check if we should load data or use passed data
  useEffect(() => {
    if (props.rgaHierarchies) {
      // Use provided data
      setRgaHierarchies(props.rgaHierarchies);
      if (props.expandedRGAs) {
        setExpandedRGAs(props.expandedRGAs);
      }
      if (props.activeFilters) {
        setActiveFilters(props.activeFilters);
      }
      if (props.searchQuery !== undefined) {
        setSearchQuery(props.searchQuery);
      }
      if (props.searchResults) {
        setSearchResults(props.searchResults);
      }
      if (props.error) {
        setError(props.error);
      }
      setLoading(false);
    } else {
      // If no props provided, load data normally
      if (!hasPermission('admin')) {
        // Use searchByUserId instead of displaying error
        fetchUserHierarchyData();
      } else {
        fetchAllRGAsHierarchy();
      }
    }
  }, [props.rgaHierarchies, props.expandedRGAs, props.activeFilters, props.searchQuery, props.searchResults, props.error]);
  
  // Update expandedRGAs in parent component if prop was provided
  useEffect(() => {
    if (props.setExpandedRGAs && props.expandedRGAs !== expandedRGAs) {
      props.setExpandedRGAs(expandedRGAs);
    }
  }, [expandedRGAs, props.setExpandedRGAs]);

  // New function to fetch data using searchByUserId for non-admin users
  const fetchUserHierarchyData = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!user || !user.userId) {
        setError('User information is not available. Please try logging in again.');
        setLoading(false);
        return;
      }

      const response = await api.post('/auth/searchByUserId', {
        userId: user.userId
      });
      
      if (response.data.success) {
        // Create a single "RGA hierarchy" object from the user data
        const userHierarchyData = {
          rgaId: response.data.agnName || user.userId,
          rgaName: response.data.agnName || user.userId,
          hierarchyData: response.data.data || []
        };
        
        // Process the hierarchy data
        const hierarchicalData = buildRgaHierarchy(userHierarchyData.hierarchyData);
        const processedHierarchy = {
          ...userHierarchyData,
          hierarchicalData
        };
        
        // Initialize expanded state
        const initialExpandedState = {};
        initialExpandedState[processedHierarchy.rgaId] = true; // Expand by default for single user
        setExpandedRGAs(initialExpandedState);
        
        // Set the hierarchy data
        setRgaHierarchies([processedHierarchy]);
        
        // Collect all states for filtering
        const allStates = collectAllStatesFromHierarchies([userHierarchyData]);
        setAllAvailableStates(allStates);
        
        // Initialize state filters
        initializeStateFilters(allStates);
      } else {
        setError(response.data.message || 'Failed to load hierarchy data');
      }
    } catch (err) {
      setError('Error loading hierarchy data: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Fetch hierarchy data for all RGAs
  const fetchAllRGAsHierarchy = async () => {
    try {
      setLoading(true);
      setError('');
      setProcessingStats({
        total: 0,
        loaded: 0,
        inProgress: true
      });

      const response = await api.get('/admin/getAllRGAsHierarchy');
      
      if (response.data.success) {
        // Process received hierarchies
        const hierarchies = response.data.data;
        
        // Process the hierarchies to build the tree structure
        const processedHierarchies = processHierarchyData(hierarchies);
        
        // Initialize expanded state for each RGA (collapsed by default)
        const initialExpandedState = {};
        processedHierarchies.forEach(rga => {
          initialExpandedState[rga.rgaId] = false;
        });
        setExpandedRGAs(initialExpandedState);
        
        // Set the hierarchies data
        setRgaHierarchies(processedHierarchies);
        
        // Collect all states for filtering
        const allStates = collectAllStatesFromHierarchies(hierarchies);
        setAllAvailableStates(allStates);
        
        // Initialize state filters
        initializeStateFilters(allStates);
        
        setProcessingStats({
          total: response.data.totalRgaCount,
          loaded: response.data.rgaCount,
          inProgress: false
        });
      } else {
        setError(response.data.message || 'Failed to load hierarchy data');
        setProcessingStats({
          total: 0,
          loaded: 0,
          inProgress: false
        });
      }
    } catch (err) {
      setError('Error loading hierarchy data: ' + (err.response?.data?.message || err.message));
      setProcessingStats({
        total: 0,
        loaded: 0,
        inProgress: false
      });
    } finally {
      setLoading(false);
    }
  };

  // Collect all states from user licenses across all hierarchies
  const collectAllStatesFromHierarchies = (hierarchies) => {
    const uniqueStates = new Set();
    
    hierarchies.forEach(rgaHierarchy => {
      rgaHierarchy.hierarchyData.forEach(user => {
        if (user.licenses && Array.isArray(user.licenses)) {
          user.licenses.forEach(license => {
            if (license.state) {
              uniqueStates.add(license.state);
            }
          });
        }
      });
    });
    
    return Array.from(uniqueStates).sort();
  };

  // Initialize state filters
  const initializeStateFilters = (states) => {
    setActiveFilters(prev => {
      const updatedStateFilters = {};
      states.forEach(state => {
        updatedStateFilters[state] = false;
      });
      
      return {
        ...prev,
        states: updatedStateFilters
      };
    });
  };

  // Toggle RGA expansion - update both local and parent state if available
  const toggleRgaExpansion = (rgaId) => {
    const newState = {
      ...expandedRGAs,
      [rgaId]: !expandedRGAs[rgaId]
    };
    setExpandedRGAs(newState);
    
    // Update parent component if prop was provided
    if (props.setExpandedRGAs) {
      props.setExpandedRGAs(newState);
    }
  };

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId) => {
    setExpandedNodes(prev => {
      const currentState = prev[nodeId];
      const newState = currentState === true ? false : true;
      return {
        ...prev,
        [nodeId]: newState
      };
    });
  };

  // Update the handleSearchChange function to include debouncing
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    
    // Clear any existing timer
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    // Set a new timer for debouncing (300ms)
    const timer = setTimeout(() => {
      // Only search when we have data and query is not empty
      if (rgaHierarchies.length > 0) {
        performSearch(query);
      }
    }, 300);
    
    setSearchTimer(timer);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    
    // Clear any existing timer
    if (searchTimer) {
      clearTimeout(searchTimer);
      setSearchTimer(null);
    }
  };

  // Add a function to build the search index
  const buildSearchIndex = useCallback(() => {
    if (!rgaHierarchies || rgaHierarchies.length === 0) return;
    
    const index = {};
    
    // Helper function to parse name parts
    const parseNameParts = (name) => {
      if (!name) return { last: '', first: '', middle: '', suffix: '' };
      
      const parts = name.split(' ');
      let last = '', first = '', middle = '', suffix = '';
      
      // last first middle suffix format
      if (parts.length >= 1) last = parts[0];
      if (parts.length >= 2) first = parts[1];
      if (parts.length >= 3) middle = parts[2];
      if (parts.length >= 4) suffix = parts.slice(3).join(' ');
      
      return { last, first, middle, suffix };
    };
    
    // Helper function to add an entry to the index
    const addToIndex = (key, node, rgaId) => {
      if (!key) return;
      const lowerKey = key.toLowerCase();
      if (!index[lowerKey]) index[lowerKey] = [];
      index[lowerKey].push({ node, rgaId });
    };
    
    rgaHierarchies.forEach(rgaHierarchy => {
      rgaHierarchy.hierarchyData.forEach(node => {
        // Index by lagnname (lowercase for case-insensitive search)
        if (node.lagnname) {
          // Index the original lagnname
          addToIndex(node.lagnname, node, rgaHierarchy.rgaId);
          
          // Parse name parts
          const { last, first, middle, suffix } = parseNameParts(node.lagnname);
          
          // Index by first name
          addToIndex(first, node, rgaHierarchy.rgaId);
          
          // Index by last name
          addToIndex(last, node, rgaHierarchy.rgaId);
          
          // Index by "first last"
          addToIndex(`${first} ${last}`, node, rgaHierarchy.rgaId);
          
          // Index by "first middle last"
          if (middle) {
            addToIndex(`${first} ${middle} ${last}`, node, rgaHierarchy.rgaId);
          }
          
          // Index by "first last suffix"
          if (suffix) {
            addToIndex(`${first} ${last} ${suffix}`, node, rgaHierarchy.rgaId);
            addToIndex(`${first} ${middle} ${last} ${suffix}`, node, rgaHierarchy.rgaId);
          }
        }
        
        // Index by email
        if (node.email) {
          addToIndex(node.email, node, rgaHierarchy.rgaId);
        }
        
        // Index by phone
        if (node.phone) {
          addToIndex(node.phone, node, rgaHierarchy.rgaId);
        }
      });
    });
    
    setSearchIndex(index);
  }, [rgaHierarchies]);

  // Call buildSearchIndex when hierarchies change
  useEffect(() => {
    buildSearchIndex();
  }, [rgaHierarchies, buildSearchIndex]);
  
  // Add cleanup for the search timer
  useEffect(() => {
    // Cleanup function to clear the timer on unmount
    return () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
    };
  }, [searchTimer]);

  // Add sticky behavior for bulk action panel
  useEffect(() => {
    // Only run if there are selected rows
    if (getSelectedCount() === 0) return;
    
    const panel = document.getElementById('bulk-action-panel');
    const placeholder = document.getElementById('bulk-action-placeholder');
    
    if (!panel || !placeholder) return;
    
    // Find the correct scrollable container by checking which one actually scrolls
    // Start with most specific and fall back to more general containers
    const possibleContainers = [
      document.querySelector('.settings-content'),
      document.querySelector('.settings-section'),
      document.querySelector('main'),
      document.body
    ].filter(Boolean); // Filter out any null containers
    
    // Determine which container is the actual scrollable one
    let scrollableContainer = window;
    
    for (const container of possibleContainers) {
      // Check for overflow properties that would make it scrollable
      const style = window.getComputedStyle(container);
      const hasScroll = ['auto', 'scroll'].includes(style.overflowY) || 
                        ['auto', 'scroll'].includes(style.overflow);
      
      // Also check if it actually has scrollHeight > clientHeight
      if (hasScroll && container.scrollHeight > container.clientHeight) {
        scrollableContainer = container;
        break;
      }
    }
    
    // Store ref to the container for future use
    scrollableContainerRef.current = scrollableContainer;
    
    // Get the original position of the panel relative to its scrollable container
    const panelRect = panel.getBoundingClientRect();
    const containerRect = scrollableContainer === window ? 
      { top: 0, left: 0 } : 
      scrollableContainer.getBoundingClientRect();
    
    // Calculate the position based on the container type
    const panelPosition = scrollableContainer === window ? 
      panelRect.top + window.scrollY : 
      panelRect.top - containerRect.top;
    
    // Store panel height to use for the placeholder
    const panelHeight = panel.offsetHeight;
    
    // Store the original width of the panel
    const originalPanelWidth = panel.offsetWidth;
    
    placeholder.style.height = '0px';
    
    // Variable to track current sticky state to avoid unnecessary DOM updates
    let isCurrentlySticky = false;
    
    // Handle scroll event with debouncing for better performance
    const handleScroll = () => {
      const scrollPosition = scrollableContainer === window ? 
        window.scrollY : 
        scrollableContainer.scrollTop;
      
      // Check if we need to update sticky state
      const shouldBeSticky = scrollPosition > panelPosition;
      
      // Only update DOM if state changed
      if (shouldBeSticky !== isCurrentlySticky) {
        isCurrentlySticky = shouldBeSticky;
        
        if (shouldBeSticky) {
          // Before adding sticky class, ensure placeholder has the right height
          placeholder.style.height = `${panelHeight}px`;
          placeholder.style.marginBottom = '15px';
          placeholder.classList.add('visible');
          
          // Small delay to let the placeholder animate in size first
          setTimeout(() => {
            panel.classList.add('sticky');
            
            // Add class to container instead of body for better positioning
            if (scrollableContainer !== window) {
              scrollableContainer.classList.add('has-sticky-panel');
            } else {
              document.body.classList.add('has-sticky-panel');
            }
            
            // Set the exact original width
            panel.style.width = `${originalPanelWidth}px`;
            panel.style.maxWidth = `${originalPanelWidth}px`;
          }, 50);
        } else {
          // Remove sticky class first
          panel.classList.remove('sticky');
          
          // Remove class from container
          if (scrollableContainer !== window) {
            scrollableContainer.classList.remove('has-sticky-panel');
          } else {
            document.body.classList.remove('has-sticky-panel');
          }
          
          // Reset width to default
          panel.style.width = '';
          panel.style.maxWidth = '';
          
          // Let the panel transition fully before collapsing placeholder
          setTimeout(() => {
            placeholder.classList.remove('visible');
            placeholder.style.height = '0px';
            placeholder.style.marginBottom = '0px';
          }, 50);
        }
      }
    };
    
    // Debounce function to improve scroll performance
    let scrollTimeout;
    const debouncedHandleScroll = () => {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
      }
      scrollTimeout = window.requestAnimationFrame(handleScroll);
    };
    
    // Add scroll event listener to the appropriate container
    scrollableContainer.addEventListener('scroll', debouncedHandleScroll);
    
    // Check initial scroll position (needed if page loads already scrolled)
    handleScroll();
    
    // Also listen for window resize to adjust panel width
    const handleResize = () => {
      if (panel.classList.contains('sticky')) {
        // Keep the panel width fixed at its original size
        panel.style.width = `${originalPanelWidth}px`;
        panel.style.maxWidth = `${originalPanelWidth}px`;
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up event listener on component unmount
    return () => {
      scrollableContainer.removeEventListener('scroll', debouncedHandleScroll);
      window.removeEventListener('resize', handleResize);
      
      if (scrollableContainer !== window) {
        scrollableContainer.classList.remove('has-sticky-panel');
      } else {
        document.body.classList.remove('has-sticky-panel');
      }
    };
  }, [selectedRows]); // Re-run when selection changes

  // Update performSearch to use the search index for faster lookups
  const performSearch = (query) => {
    if (!query.trim() || rgaHierarchies.length === 0) {
      setSearchResults(null);
      return;
    }
    
    const searchLower = query.toLowerCase();
    const matchingNodes = [];
    const matchingRgas = new Set();
    const directUplineMap = new Map(); // Map to track direct uplines for each matching user
    const nodesToExpand = new Set(); // Track nodes that should be expanded
    
    // Create a map to quickly look up nodes by RGA
    const rgaNodesMap = {};
    rgaHierarchies.forEach(rgaHierarchy => {
      rgaNodesMap[rgaHierarchy.rgaId] = {
        rgaData: rgaHierarchy,
        nodesMap: {}
      };
      
      rgaHierarchy.hierarchyData.forEach(node => {
        rgaNodesMap[rgaHierarchy.rgaId].nodesMap[node.lagnname] = node;
      });
    });
    
    // Fast prefix matching using the index
    const matchedNodeIds = new Set();
    
    // Check each key in the index for matches
    Object.keys(searchIndex).forEach(key => {
      if (key.includes(searchLower)) {
        searchIndex[key].forEach(({ node, rgaId }) => {
          // Avoid duplicates
          const nodeId = `${rgaId}-${node.lagnname}`;
          if (!matchedNodeIds.has(nodeId)) {
            matchedNodeIds.add(nodeId);
            
            // Find the RGA this node belongs to
            const rgaHierarchy = rgaHierarchies.find(h => h.rgaId === rgaId);
            if (rgaHierarchy) {
              // Add to matching RGAs
              matchingRgas.add(rgaId);
              
              // Get existing group or create new one
              let matchingGroup = matchingNodes.find(g => g.rgaId === rgaId);
              if (!matchingGroup) {
                matchingGroup = {
                  rgaId: rgaId,
                  rgaName: rgaHierarchy.rgaName,
                  matches: [],
                  directUplines: new Map()
                };
                matchingNodes.push(matchingGroup);
              }
              
              // Add node to matches
              matchingGroup.matches.push(node);
              
              // For each matching node, create a record of its direct uplines
              const uplines = {
                sa: node.sa ? rgaHierarchy.hierarchyData.find(u => u.lagnname === node.sa) : null,
                ga: node.ga ? rgaHierarchy.hierarchyData.find(u => u.lagnname === node.ga) : null,
                mga: node.mga ? rgaHierarchy.hierarchyData.find(u => u.lagnname === node.mga) : null,
                rga: node.rga ? rgaHierarchy.hierarchyData.find(u => u.lagnname === node.rga) : null,
              };
              
              matchingGroup.directUplines.set(node.lagnname, uplines);
              
              // Track uplines for expansion
              if (uplines.sa) nodesToExpand.add(uplines.sa.lagnname);
              if (uplines.ga) nodesToExpand.add(uplines.ga.lagnname);
              if (uplines.mga) nodesToExpand.add(uplines.mga.lagnname);
              if (uplines.rga) nodesToExpand.add(uplines.rga.lagnname);
              
              // Store upline map for this RGA
              directUplineMap.set(rgaId, matchingGroup.directUplines);
            }
          }
        });
      }
    });
    
    if (matchingNodes.length > 0) {
      // Expand matching RGAs
      const newExpandedState = { ...expandedRGAs };
      matchingRgas.forEach(rgaId => {
        newExpandedState[rgaId] = true;
      });
      setExpandedRGAs(newExpandedState);
      
      // Expand all parent nodes of matches
      if (nodesToExpand.size > 0) {
        setExpandedNodes(prev => {
          const newExpanded = { ...prev };
          
          // Add all nodes that need expansion
          nodesToExpand.forEach(nodeId => {
            newExpanded[nodeId] = true;
          });
          
          return newExpanded;
        });
      }
      
      setSearchResults({
        matchingRgaGroups: matchingNodes,
        totalMatches: matchingNodes.reduce((sum, group) => sum + group.matches.length, 0),
        directUplineMap
      });
    } else {
      setSearchResults({ matchingRgaGroups: [], totalMatches: 0, directUplineMap: new Map() });
    }
  };

  // Toggle role filter
  const toggleFilter = (role) => {
    setActiveFilters(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };
  
  // Toggle status filter
  const toggleStatusFilter = (filterName) => {
    setActiveFilters(prev => {
      // Cycle through: null (both) -> true (only yes) -> false (only no) -> null (both)
      const currentValue = prev[filterName];
      let newValue;
      
      if (currentValue === null) {
        newValue = true;
      } else if (currentValue === true) {
        newValue = false;
      } else {
        newValue = null;
      }
      
      return {
        ...prev,
        [filterName]: newValue
      };
    });
  };
  
  // Toggle all role filters
  const toggleAllRoles = (value) => {
    setActiveFilters(prev => ({
      ...prev,
      RGA: value,
      MGA: value,
      GA: value,
      SA: value,
      AGT: value
    }));
  };
  
  // Toggle state filter
  const toggleStateFilter = (state) => {
    setActiveFilters(prev => ({
      ...prev,
      states: {
        ...prev.states,
        [state]: !prev.states[state]
      }
    }));
  };
  
  // Toggle all state filters
  const toggleAllStates = (value) => {
    const updatedStates = {};
    allAvailableStates.forEach(state => {
      updatedStates[state] = value;
    });
    
    setActiveFilters(prev => ({
      ...prev,
      states: updatedStates
    }));
  };
  
  // Update the clearAllFilters function to maintain showing only active users
  const clearAllFilters = () => {
    const stateFilters = {};
    allAvailableStates.forEach(state => {
      stateFilters[state] = false;
    });
    
    setActiveFilters({
      RGA: true,
      MGA: true,
      GA: true,
      SA: true,
      AGT: true,
      released: null,
      redeemed: null,
      noProfPic: null,
      managerActive: true, // Keep showing only active users on reset
      pending: null,
      states: stateFilters
    });
  };

  // Handle toggle active status
  const handleToggleActive = async (node) => {
    if (!node || !node.lagnname || node.managerActive === undefined) {
      return;
    }

    try {
      setToggleLoading(node.lagnname);
      
      // Store the new status (opposite of current)
      const newStatus = node.managerActive && node.managerActive.toLowerCase() === 'y' ? 'n' : 'y';
      
      const response = await api.post('/auth/toggleActive', {
        userId: node.lagnname,
        currentStatus: node.managerActive
      });

      if (response.data.success) {
        // Update local state
        setRgaHierarchies(prev => {
          return prev.map(rgaHierarchy => {
            const updatedHierarchyData = rgaHierarchy.hierarchyData.map(user => {
              if (user.lagnname === node.lagnname) {
                return { ...user, managerActive: newStatus };
              }
              return user;
            });
            
            return {
              ...rgaHierarchy,
              hierarchyData: updatedHierarchyData
            };
          });
        });
      } else {
        setError(response.data.message || 'Failed to toggle active status');
      }
    } catch (err) {
      setError(`An error occurred while toggling active status: ${err.message}`);
    } finally {
      setToggleLoading(null);
    }
  };

  // Render license state badges for a user node
  const renderLicenseBadges = (node) => {
    if (!node || !node.licenses || node.licenses.length === 0) {
      return null;
    }
    
    // Sort licenses alphabetically by state
    const sortedLicenses = [...node.licenses].sort((a, b) => 
      (a.state || '').localeCompare(b.state || '')
    );
    
    // Universal tooltip handler - same as in renderStatusBadges
    const handleTooltip = (e) => {
      // Create a tooltip element dynamically and position it
      const tooltipText = e.currentTarget.getAttribute('data-tooltip');
      if (!tooltipText) return;
      
      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'dynamic-tooltip';
      tooltip.textContent = tooltipText;
      tooltip.style.position = 'fixed';
      tooltip.style.backgroundColor = '#333';
      tooltip.style.color = 'white';
      tooltip.style.padding = '6px 10px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '0.75rem';
      tooltip.style.zIndex = '10000';
      tooltip.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
      tooltip.style.pointerEvents = 'none';
      
      // Position tooltip near cursor
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY - 40}px`;
      
      // Add to document
      document.body.appendChild(tooltip);
      
      // Set up mousemove to follow cursor
      const moveTooltip = (evt) => {
        tooltip.style.left = `${evt.clientX + 10}px`;
        tooltip.style.top = `${evt.clientY - 40}px`;
      };
      
      // Add mousemove event
      document.addEventListener('mousemove', moveTooltip);
      
      // Remove tooltip and event listener on mouseleave
      e.currentTarget.addEventListener('mouseleave', () => {
        document.removeEventListener('mousemove', moveTooltip);
        if (tooltip && tooltip.parentNode) {
          document.body.removeChild(tooltip);
        }
      }, { once: true });
    };
    
    return (
      <div className="license-badges">
        {sortedLicenses.map(license => {
          // Generate a unique ID for position detection
          const badgeId = `license-${license.id}-${node.id}`;
          
          return (
            <span 
              key={license.id} 
              id={badgeId}
              className={`license-state-badge license-badge-tooltip ${license.resident_state === 1 ? 'resident' : ''}`}
              title={`${license.resident_state === 1 ? 'Resident' : 'Non-resident'} license in ${license.state}`}
              data-tooltip={`${license.resident_state === 1 ? 'Resident' : 'Non-resident'} license in ${license.state}`}
              onMouseEnter={handleTooltip}
            >
              {license.state}
            </span>
          );
        })}
      </div>
    );
  };

  // Determine role color based on clname
  const getRoleColor = (clname) => {
    const roleColors = {
      'RGA': { bg: '#00558c', border: '#004372' },
      'MGA': { bg: 'rgb(104, 182, 117)', border: 'rgb(84, 152, 97)' },
      'GA': { bg: 'rgb(237, 114, 47)', border: 'rgb(197, 94, 37)' },
      'SA': { bg: 'rgb(178, 82, 113)', border: 'rgb(138, 62, 93)' },
      'AGT': { bg: 'lightgrey', border: 'grey' }
    };
    
    return roleColors[clname] || { bg: '#888', border: '#666' };
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '—';
    
    // Format phone number as (XXX) XXX-XXXX
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  };

  // Calculate career stage based on ESID
  const calculateCareerStage = (esid) => {
    if (!esid) return { isF6: false, isVIPEligible: false, careerMonths: null };
    
    try {
      // Parse ESID date
      const esidDate = new Date(esid);
      if (isNaN(esidDate.getTime())) {
        return { isF6: false, isVIPEligible: false, careerMonths: null };
      }

      // Get current date
      const currentDate = new Date();
      
      // Calculate complete months difference
      const yearDiff = currentDate.getFullYear() - esidDate.getFullYear();
      const monthDiff = currentDate.getMonth() - esidDate.getMonth();
      const totalMonthsDiff = (yearDiff * 12) + monthDiff;
      
      // F6: First 6 months (months 0-5)
      const isF6 = totalMonthsDiff < 6;
      
      // VIP Eligible: Months 2-4 (months 1-3 in zero-based)
      const isVIPEligible = totalMonthsDiff >= 1 && totalMonthsDiff <= 3;
      
      return { isF6, isVIPEligible, careerMonths: totalMonthsDiff };
    } catch (error) {
      return { isF6: false, isVIPEligible: false, careerMonths: null };
    }
  };

  // Update the buildRgaHierarchy function to handle the correct ordering
  const buildRgaHierarchy = (rgaData) => {
    const hierarchy = [];
    const map = {};
    
    // Initialize map with each item
    rgaData.forEach(item => {
      map[item.lagnname] = { 
        ...item, 
        children: [],
        level: 0 // Add level for indentation in table view
      };
    });

    // Process nodes in a single pass with clear hierarchy rules
    rgaData.forEach(item => {
      // Add to the hierarchy based on relationships
      let added = false;

      // First level: RGA or MGA
      if (item.clname === 'RGA' || item.clname === 'MGA') {
        // Check if this RGA/MGA should be under another RGA
        if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1; // Set level based on parent
          added = true;
        } 
        // Check for MGA-RGA link
        else if (item.mga_rga_link && map[item.mga_rga_link]) {
          map[item.mga_rga_link].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga_rga_link].level + 1; // Set level based on parent
          added = true;
        }
        // Otherwise add to top level
        else {
          hierarchy.push(map[item.lagnname]);
          map[item.lagnname].level = 0; // Top level
          added = true;
        }
      }
      // Second level: AGT with no sa or ga
      else if (item.clname === 'AGT' && !item.sa && !item.ga) {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1; // Set level based on parent
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1; // Set level based on parent
          added = true;
        }
      }
      // Third level: SA with no ga
      else if (item.clname === 'SA' && !item.ga) {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1; // Set level based on parent
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1; // Set level based on parent
          added = true;
        }
      }
      // Fourth level: AGT with SA value but no ga
      else if (item.clname === 'AGT' && item.sa && !item.ga) {
        if (map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.sa].level + 1; // Set level based on parent
          added = true;
        }
      }
      // Fifth level: GA
      else if (item.clname === 'GA') {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1; // Set level based on parent
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1; // Set level based on parent
          added = true;
        }
      }
      // Sixth level: AGT with no sa but with GA
      else if (item.clname === 'AGT' && !item.sa && item.ga) {
        if (map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.ga].level + 1; // Set level based on parent
          added = true;
        }
      }
      // Seventh level: SA with ga
      else if (item.clname === 'SA' && item.ga) {
        if (map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.ga].level + 1; // Set level based on parent
          added = true;
        }
      }
      // Eighth level: AGT with both sa and ga
      else if (item.clname === 'AGT' && item.sa && item.ga) {
        if (map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.sa].level + 1; // Set level based on parent
          added = true;
        }
      }

      // Default fallback if not handled by above rules
      if (!added) {
        if (item.sa && map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.sa].level + 1;
        } else if (item.ga && map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.ga].level + 1;
        } else if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.mga].level + 1;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          map[item.lagnname].level = map[item.rga].level + 1;
        } else {
          hierarchy.push(map[item.lagnname]);
          map[item.lagnname].level = 0;
        }
      }
    });

    // Sort node children alphabetically within each type group
    const sortChildren = (nodes) => {
      if (!nodes || !nodes.length) return [];
      
      return nodes.map(node => {
        if (node.children && node.children.length) {
          // We're only sorting alphabetically within the same role type
          // but preserving the hierarchy order (not sorting by role)
          node.children.sort((a, b) => {
            if (a.clname === b.clname) {
              // If same role, sort alphabetically
              return a.lagnname.localeCompare(b.lagnname);
            }
            // If different roles, preserve the order they were added in
            return 0;
          });
          
          // Apply sort recursively
          node.children = sortChildren(node.children);
        }
        return node;
      });
    };
    
    // Apply sorting to the hierarchy
    const sortedHierarchy = sortChildren(hierarchy);
    
    return sortedHierarchy;
  };

  // Add this function after fetchAllRGAsHierarchy
  const processHierarchyData = (hierarchies) => {
    const processedHierarchies = hierarchies.map(rgaHierarchy => {
      // Build hierarchical structure for this RGA's data
      const hierarchicalData = buildRgaHierarchy(rgaHierarchy.hierarchyData);
      
      return {
        ...rgaHierarchy,
        hierarchicalData, // Add the processed hierarchical structure
      };
    });
    
    return processedHierarchies;
  };

  // Function to check if a node passes all filters
  const passesAllFilters = (node) => {
    // Check role filters
    if (!activeFilters[node.clname]) {
      return false;
    }
    
    // Check state license filters
    const hasActiveStateFilters = Object.values(activeFilters.states).some(value => value === true);
    
    if (hasActiveStateFilters) {
      // If user has no licenses or if none of their licenses match the active state filters
      if (!node.licenses || !Array.isArray(node.licenses) || node.licenses.length === 0) {
        // Hide this node if any state filter is active
        return false;
      }
      
      const userHasFilteredState = node.licenses.some(license => 
        license.state && activeFilters.states[license.state]
      );
      
      if (!userHasFilteredState) {
        return false;
      }
    }
    
    // Check status filters
    const isRedeemed = node.redeemed !== undefined && 
                        node.redeemed !== null && 
                        parseInt(node.redeemed) === 1;
                        
    const isReleased = node.released !== undefined && 
                        node.released !== null && 
                        parseInt(node.released) === 1;
                        
    const isActive = node.managerActive !== undefined && 
                     node.managerActive !== null && 
                     node.managerActive.toLowerCase() === 'y';
                     
    const hasNoProfPic = !node.profpic;
    
    // Check pending/RFC status
    const isPending = node.pending === 1 || node.pending === '1';
    if (activeFilters.pending !== null && activeFilters.pending !== isPending) {
      return false;
    }
    
    if (activeFilters.released !== null && activeFilters.released !== isReleased) {
      return false;
    }
    
    if (activeFilters.redeemed !== null && activeFilters.redeemed !== isRedeemed) {
      return false;
    }
    
    if (activeFilters.noProfPic !== null && activeFilters.noProfPic !== hasNoProfPic) {
      return false;
    }
    
    // Only apply managerActive filter if it's not the default "Active: yes" state
    // or if it's explicitly set to false (show inactive)
    if (activeFilters.managerActive === false && isActive) {
      return false;
    }
    
    // If managerActive is true (default) or null (show all), show active users
    if (activeFilters.managerActive === true && !isActive) {
      return false;
    }
    
    return true;
  };

  // Flatten hierarchy to array for table display
  const flattenHierarchy = (nodes, parentExpandedState = true) => {
    let result = [];
    
    if (!nodes || !nodes.length) {
      return result;
    }
    
    // Process each node
    nodes.forEach(node => {
      // Add the node itself if it passes filters
      if (passesAllFilters(node)) {
        result.push({
          ...node,
          visible: parentExpandedState && (expandedNodes[node.lagnname] !== false)
        });
      }
      
      // Process children if any
      if (node.children && node.children.length > 0) {
        // Determine if children are visible based on current node's expanded state and parent state
        const childrenVisible = parentExpandedState && expandedNodes[node.lagnname] !== false;
        
        // Recursively process children
        const childrenNodes = flattenHierarchy(node.children, childrenVisible);
        
        // Add children to the result
        result = [...result, ...childrenNodes];
      }
    });
    
    return result;
  };

  // Helper function to check if a node is expandable
  const isNodeExpandable = (node) => {
    return node.children && node.children.length > 0;
  };

  // Export data to CSV with retention date added
  const exportToCSV = () => {
    try {
      // Initialize array for CSV data
      const csvData = [];
      
      // Add header row
      csvData.push([
        'RGA', 'User ID', 'Name', 'Role', 'Email', 'Phone', 
        'Active', 'Redeemed', 'Released', 'ESID',
        'SA', 'GA', 'MGA', 'RGA',
        'License States', '4mo Retention', 'Retention As Of'
      ]);
      
      // Add data rows
      rgaHierarchies.forEach(rgaHierarchy => {
        rgaHierarchy.hierarchyData.forEach(user => {
          // Format license states as comma-separated string
          const licenseStates = user.licenses && Array.isArray(user.licenses)
            ? user.licenses.map(l => l.state).join(', ')
            : '';
          
          // Format retention rates from PNP data
          const fourMonthRate = user.pnp_data?.curr_mo_4mo_rate || '';
          const retentionDate = user.pnp_data?.pnp_date ? formatDateForDisplay(user.pnp_data.pnp_date) : '';
          
          csvData.push([
            rgaHierarchy.rgaName,
            user.lagnname,
            user.rept_name || user.lagnname,
            user.clname,
            user.email || '',
            user.phone || '',
            user.managerActive === 'y' ? 'Yes' : 'No',
            user.redeemed === 1 ? 'Yes' : 'No',
            user.released === 1 ? 'Yes' : 'No',
            user.esid || '',
            user.sa || '',
            user.ga || '',
            user.mga || '',
            user.rga || '',
            licenseStates,
            fourMonthRate,
            retentionDate
          ]);
        });
      });
      
      // Convert to CSV string
      const csvString = csvData.map(row => row.map(cell => {
        // Handle cells with commas by wrapping in quotes
        if (cell && cell.toString().includes(',')) {
          return `"${cell}"`;
        }
        return cell;
      }).join(',')).join('\n');
      
      // Create Blob and download link
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hierarchy_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[AdminHierarchyTableView] Error exporting CSV:', err);
      setError('Failed to export data: ' + err.message);
    }
  };

  // Update the countFilteredUsers function to use the passesAllFilters function
  const countFilteredUsers = (hierarchyData) => {
    if (!hierarchyData) return 0;
    return hierarchyData.filter(node => passesAllFilters(node)).length;
  };

  // Find current user data in the hierarchy
  const findCurrentUserData = () => {
    if (!user || !user.userId || !rgaHierarchies || rgaHierarchies.length === 0) {
      return null;
    }
    
    // Search through all RGA hierarchies' flat data
    for (const rgaHierarchy of rgaHierarchies) {
      if (rgaHierarchy.hierarchyData) {
        const found = rgaHierarchy.hierarchyData.find(node => node.lagnname === user.userId);
        if (found) return found;
      }
    }
    
    return null;
  };

  // Format name for display (Last First --> First Last)
  const formatName = (name) => {
    if (!name) return '—';
    
    const nameParts = name.split(' ');
    
    // If name has two parts: Last First
    if (nameParts.length === 2) {
      return `${nameParts[1]} ${nameParts[0]}`;
    }
    
    // If name has three parts: Last First Middle
    if (nameParts.length === 3) {
      return `${nameParts[1]} ${nameParts[2]} ${nameParts[0]}`;
    }
    
    // If name has four or more parts: Last First Middle Suffix
    if (nameParts.length >= 4) {
      return `${nameParts[1]} ${nameParts[2]} ${nameParts[0]} ${nameParts.slice(3).join(' ')}`;
    }
    
    // Fallback for unexpected format
    return name;
  };

  // Helper function to format PNP date for display
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    try {
      // Handle MM/DD/YY format
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const month = parts[0];
        const day = parts[1];
        // Add '20' prefix to year if it's just 2 digits
        let year = parts[2];
        if (year.length === 2) {
          year = '20' + year;
        }
        return `${month}/${day}/${year}`;
      }
      
      // Handle other formats with Date object
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US');
      }
    } catch (e) {
      console.error('[AdminHierarchyTableView] Error formatting date:', e);
    }
    
    // Return original if parsing fails
    return dateString;
  };

  // Replace the collapse all function with a toggle function
  const toggleAllRGAs = () => {
    // Check if any RGAs are currently expanded
    const hasExpandedRGAs = Object.values(expandedRGAs).some(isExpanded => isExpanded);
    
    // If any are expanded, collapse all; otherwise, expand all
    const newState = {};
    rgaHierarchies.forEach(rga => {
      newState[rga.rgaId] = !hasExpandedRGAs;
    });
    
    setExpandedRGAs(newState);
  };

  // Render status badges for a user node
  const renderStatusBadges = (node) => {
    if (!node) return null;
    
    const isActive = node.managerActive && node.managerActive.toLowerCase() === 'y';
    const isRedeemed = node.redeemed === 1 || node.redeemed === '1';
    const isReleased = node.released === 1 || node.released === '1';
    const isPending = node.pending === 1 || node.pending === '1';
    const { isF6, isVIPEligible } = calculateCareerStage(node.esid);
    
    // Universal tooltip handler
    const handleTooltip = (e) => {
      // Create a tooltip element dynamically and position it
      const tooltipText = e.currentTarget.getAttribute('data-tooltip');
      if (!tooltipText) return;
      
      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'dynamic-tooltip';
      tooltip.textContent = tooltipText;
      tooltip.style.position = 'fixed';
      tooltip.style.backgroundColor = '#333';
      tooltip.style.color = 'white';
      tooltip.style.padding = '6px 10px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '0.75rem';
      tooltip.style.zIndex = '10000';
      tooltip.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
      tooltip.style.pointerEvents = 'none';
      
      // Position tooltip near cursor
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY - 40}px`;
      
      // Add to document
      document.body.appendChild(tooltip);
      
      // Set up mousemove to follow cursor
      const moveTooltip = (evt) => {
        tooltip.style.left = `${evt.clientX + 10}px`;
        tooltip.style.top = `${evt.clientY - 40}px`;
      };
      
      // Add mousemove event
      document.addEventListener('mousemove', moveTooltip);
      
      // Remove tooltip and event listener on mouseleave
      e.currentTarget.addEventListener('mouseleave', () => {
        document.removeEventListener('mousemove', moveTooltip);
        if (tooltip && tooltip.parentNode) {
          document.body.removeChild(tooltip);
        }
      }, { once: true });
    };
    
    return (
      <div className="status-badges">
        <span 
          className={`status-badge status-badge-tooltip ${isActive ? 'active' : 'inactive'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (toggleLoading !== node.lagnname) {
              handleToggleActive(node);
            }
          }}
          style={{ cursor: toggleLoading === node.lagnname ? 'wait' : 'pointer' }}
          data-tooltip={isActive ? "Active (click to toggle)" : "Inactive (click to toggle)"}
          onMouseEnter={handleTooltip}
        >
          {toggleLoading === node.lagnname ? (
            <span>Updating...</span>
          ) : (
            isActive ? 'Active' : 'Inactive'
          )}
        </span>
        
        <span 
          className={`status-badge status-badge-tooltip ${isRedeemed ? 'redeemed' : 'inactive'}`}
          data-tooltip={isRedeemed ? "Redeemed" : "Not Redeemed"}
          onMouseEnter={handleTooltip}
        >
          {isRedeemed ? 'Redeemed' : 'Not Redeemed'}
        </span>
        
        <span 
          className={`status-badge status-badge-tooltip ${isReleased ? 'released' : 'inactive'}`}
          data-tooltip={isReleased ? "Released" : "Not Released"}
          onMouseEnter={handleTooltip}
        >
          {isReleased ? 'Released' : 'Not Released'}
        </span>
        
        {/* Display RFC tag when pending=1 */}
        {isPending && (
          <span 
            className="status-badge status-badge-tooltip rfc"
            data-tooltip="RFC (Ready For Contract)"
            onMouseEnter={handleTooltip}
          >
            RFC
          </span>
        )}
        
        {/* Only show F6 and VIP tags if not pending */}
        {!isPending && isF6 && (
          <span 
            className="status-badge status-badge-tooltip f6"
            data-tooltip="First 6 Months"
            onMouseEnter={handleTooltip}
          >
            F6
          </span>
        )}
        
        {!isPending && isVIPEligible && (
          <span 
            className="status-badge status-badge-tooltip vip-eligible"
            data-tooltip="VIP Eligible (Months 2-4)"
            onMouseEnter={handleTooltip}
          >
            VIP Eligible
          </span>
        )}
      </div>
    );
  };

  // Selection handlers
  const toggleRowSelection = (nodeId, event) => {
    // Prevent row expansion when clicking checkbox
    if (event) {
      event.stopPropagation();
    }
    
    setSelectedRows(prev => {
      const newState = {
        ...prev,
        [nodeId]: !prev[nodeId]
      };
      
      // DEBUG: Log selection change
      console.log(`Row selection changed: ${nodeId} is now ${!prev[nodeId] ? 'selected' : 'deselected'}`);
      console.log('Currently selected rows:', Object.keys(newState).filter(id => newState[id]));
      
      return newState;
    });
  };

  const selectAllVisible = (hierarchyData) => {
    // Get current selection state to determine if we're selecting or deselecting
    // If all visible rows are already selected, clicking should deselect all
    const allSelected = hierarchyData.length > 0 && hierarchyData.every(node => selectedRows[node.lagnname]);
    
    // Create new selection state
    const newSelection = { ...selectedRows };
    
    // If all are selected, deselect all visible rows
    if (allSelected) {
      hierarchyData.forEach(node => {
        newSelection[node.lagnname] = false;
      });
      console.log('Deselecting all visible rows');
    } 
    // Otherwise, select all visible rows
    else {
      hierarchyData.forEach(node => {
        newSelection[node.lagnname] = true;
      });
      console.log('Selecting all visible rows');
    }
    
    setSelectedRows(newSelection);
  };

  const clearSelection = () => {
    setSelectedRows({});
  };

  const getSelectedCount = () => {
    return Object.values(selectedRows).filter(Boolean).length;
  };

  const extendSelectionToChildren = () => {
    // Get copy of current selection
    const newSelection = { ...selectedRows };
    
    // For each RGA hierarchy
    rgaHierarchies.forEach(rgaHierarchy => {
      // Skip if this RGA is not expanded
      if (!expandedRGAs[rgaHierarchy.rgaId]) {
        return;
      }
      
      // Find all selected nodes in this hierarchy
      const selectedNodes = rgaHierarchy.hierarchyData.filter(node => 
        selectedRows[node.lagnname]
      );
      
      // For each selected node, find and select their visible children
      selectedNodes.forEach(selectedNode => {
        // Get the flattened, filtered hierarchy for this RGA that's actually displayed
        let flattenedNodes;
        if (searchResults) {
          // If searching, use search results
          const matchingGroup = searchResults.matchingRgaGroups.find(
            group => group.rgaId === rgaHierarchy.rgaId
          );
          flattenedNodes = matchingGroup ? [...matchingGroup.matches] : [];
        } else {
          // If not searching, use the filtered hierarchy
          flattenedNodes = flattenHierarchy(rgaHierarchy.hierarchicalData);
        }

        // Only select visible children that pass filters
        selectVisibleChildren(selectedNode, flattenedNodes, newSelection);
      });
    });
    
    setSelectedRows(newSelection);
  };

  // Helper function to select only visible children that pass filters
  const selectVisibleChildren = (node, visibleNodes, selectionState) => {
    // Find direct visible children
    const children = visibleNodes.filter(possibleChild => 
      // Must be a direct downline
      (possibleChild.mga === node.lagnname ||
       possibleChild.ga === node.lagnname ||
       possibleChild.sa === node.lagnname ||
       possibleChild.rga === node.lagnname) &&
      // Must be visible (expanded parent)
      possibleChild.visible !== false &&
      // Must not be already selected
      !selectionState[possibleChild.lagnname]
    );
    
    // Select all found children
    children.forEach(child => {
      // Mark the child as selected
      selectionState[child.lagnname] = true;
      
      // Recursively select this child's visible children
      selectVisibleChildren(child, visibleNodes, selectionState);
    });
  };

  const performBulkAction = (action) => {
    // Get unique selected node IDs to prevent double counting
    const selectedNodeIds = Object.keys(selectedRows).filter(id => selectedRows[id]);
    
    // DEBUG: Log which rows are selected at the start of bulk action
    console.log(`Starting ${action} bulk action with ${selectedNodeIds.length} selected rows:`);
    console.log('Selected row IDs:', selectedNodeIds);
    
    // Use a Set to ensure each node is only included once
    const uniqueNodesSet = new Set();
    
    // Find the actual node objects from the hierarchies
    rgaHierarchies.forEach(rgaHierarchy => {
      rgaHierarchy.hierarchyData.forEach(node => {
        if (selectedRows[node.lagnname] && !uniqueNodesSet.has(node.lagnname)) {
          uniqueNodesSet.add(node.lagnname);
        }
      });
    });
    
    // DEBUG: Log unique nodes found after deduplication
    console.log(`After deduplication, found ${uniqueNodesSet.size} unique nodes:`);
    console.log('Unique node IDs:', Array.from(uniqueNodesSet));
    
    // Convert to array of actual node objects - ensure uniqueness by lagnname
    const uniqueNodeMap = new Map(); // Use Map to store unique nodes by lagnname
    rgaHierarchies.forEach(rgaHierarchy => {
      rgaHierarchy.hierarchyData.forEach(node => {
        if (uniqueNodesSet.has(node.lagnname) && !uniqueNodeMap.has(node.lagnname)) {
          uniqueNodeMap.set(node.lagnname, node);
        }
      });
    });
    
    // Get array of unique nodes
    const selectedNodes = Array.from(uniqueNodeMap.values());
    
    // DEBUG: Log the final selected nodes
    console.log(`Final selected nodes for action: ${selectedNodes.length}`);
    console.log('Selected nodes:', selectedNodes.map(node => ({ id: node.lagnname, email: node.email })));
    
    // Get an accurate count
    const selectedCount = selectedNodes.length;
    
    // Perform the requested action
    switch (action) {
      case 'email':
        // Create mailto link with all emails - ensure uniqueness by using a Set
        const uniqueEmails = new Set();
        selectedNodes.forEach(node => {
          if (node.email) {
            uniqueEmails.add(node.email);
          }
        });
        
        const emailArray = Array.from(uniqueEmails);
        
        if (emailArray.length > 0) {
          window.location.href = `mailto:?bcc=${emailArray.join(',')}`;
        } else {
          setError('No email addresses found in the selected users.');
        }
        break;
        
      case 'activate':
        // Batch activate all selected nodes
        if (window.confirm(`Activate all ${selectedCount} selected users?`)) {
          // Here you would implement the batch activation API call
          setError('Batch activation not implemented yet');
        }
        break;
        
      case 'deactivate':
        // Batch deactivate all selected nodes
        if (window.confirm(`Deactivate all ${selectedCount} selected users?`)) {
          // Here you would implement the batch deactivation API call
          setError('Batch deactivation not implemented yet');
        }
        break;
        
      default:
        setError(`Unknown bulk action: ${action}`);
    }
  };

  // Main render function
  if (loading) {
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <span>Loading hierarchy data...</span>
      </div>
    );
  }

  if (!hasPermission('admin') && !loading && !rgaHierarchies.length) {
    return (
      <div className="settings-section">
        <h1 className="settings-section-title">Hierarchy Table</h1>
        <div className="settings-card">
          <div className="settings-alert settings-alert-error">
            {error || 'No hierarchy data available for your account.'}
          </div>
        </div>
      </div>
    );
  }

  // If rendered as a standalone component, render the full section
  // If rendered as a child (showControls=false), render just the content
  const renderContent = () => (
    <>
      {/* Current User Card at Top - Only shown for non-admin users */}
      {!hasPermission('admin') && findCurrentUserData() && showControls && (
        <div className="settings-card your-profile-card">
          <h2 className="settings-card-title">Your Profile</h2>
          <div className="hierarchy-table-container">
            <table className="hierarchy-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className="status-column">Status</th>
                  <th className="license-column">Licenses</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hierarchy-card-current">
                  <td className="user-cell">
                    <div className="user-icon">
                      {findCurrentUserData().profpic ? (
                        <img 
                          src={findCurrentUserData().profpic} 
                          alt={`${findCurrentUserData().lagnname}'s profile`} 
                          className="profile-image"
                        />
                      ) : (
                        <FiUser size={18} />
                      )}
                    </div>
                    <div className="name-with-icon">
                      <span className="user-name">{findCurrentUserData().lagnname}</span>
                      <span className="you-badge">You</span>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge role-${findCurrentUserData().clname}`}>
                      {findCurrentUserData().clname}
                    </span>
                  </td>
                  <td>
                    <a href={`mailto:${findCurrentUserData().email}`}>{findCurrentUserData().email}</a>
                  </td>
                  <td>
                    <a href={`tel:${findCurrentUserData().phone}`}>{formatPhoneNumber(findCurrentUserData().phone)}</a>
                  </td>
                  <td className="status-column">
                    {renderStatusBadges(findCurrentUserData())}
                  </td>
                  <td className="license-column">
                    {renderLicenseBadges(findCurrentUserData())}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Uplines Table */}
          <h2 className="settings-card-title" style={{marginTop: "20px"}}>Uplines</h2>
          <p className="settings-card-description">
            It is recommended to follow the 
            <span 
              className="chain-of-command-tooltip"
              title="The chain of command means contacting the first upline in your hierarchy with a question, from SA-RGA. If that upline does not have an answer, you and that upline can bring the question to the next upline. This ensures keeping lines of communication clear for all levels of the hierarchy."
            > chain of command</span>.
          </p>
          
          <div className="uplines-table-container">
            <table className="uplines-table">
              <tbody>
                {(() => {
                  const currentUser = findCurrentUserData();
                  if (!currentUser) return null;
                  
                  switch(currentUser.clname) {
                    case "AGT":
                      return (
                        <>
                          <tr>
                            <th style={{ backgroundColor: "rgb(178, 82, 113)" }}>SA</th>
                            <td>{currentUser.sa ? formatName(currentUser.sa) : "—"}</td>
                          </tr>
                          <tr>
                            <th style={{ backgroundColor: "rgb(237, 114, 47)" }}>GA</th>
                            <td>{currentUser.ga ? formatName(currentUser.ga) : "—"}</td>
                          </tr>
                          <tr>
                            <th style={{ backgroundColor: "rgb(104, 182, 117)" }}>MGA</th>
                            <td>{currentUser.mga ? formatName(currentUser.mga) : "—"}</td>
                          </tr>
                          <tr>
                            <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                            <td>{currentUser.rga ? formatName(currentUser.rga) : "—"}</td>
                          </tr>
                        </>
                      );
                    case "SA":
                      return (
                        <>
                          <tr>
                            <th style={{ backgroundColor: "rgb(237, 114, 47)" }}>GA</th>
                            <td>{currentUser.ga ? formatName(currentUser.ga) : "—"}</td>
                          </tr>
                          <tr>
                            <th style={{ backgroundColor: "rgb(104, 182, 117)" }}>MGA</th>
                            <td>{currentUser.mga ? formatName(currentUser.mga) : "—"}</td>
                          </tr>
                          <tr>
                            <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                            <td>{currentUser.rga ? formatName(currentUser.rga) : "—"}</td>
                          </tr>
                        </>
                      );
                    case "GA":
                      return (
                        <>
                          <tr>
                            <th style={{ backgroundColor: "rgb(104, 182, 117)" }}>MGA</th>
                            <td>{currentUser.mga ? formatName(currentUser.mga) : "—"}</td>
                          </tr>
                          <tr>
                            <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                            <td>{currentUser.rga ? formatName(currentUser.rga) : "—"}</td>
                          </tr>
                        </>
                      );
                    case "MGA":
                      return (
                        <tr>
                          <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                          <td>{currentUser.rga ? formatName(currentUser.rga) : "—"}</td>
                        </tr>
                      );
                    default:
                      return null;
                  }
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className={showControls ? "settings-card" : ""}>
        {/* Controls panel - only show if showControls is true */}
        {showControls && (
          <div className="admin-hierarchy-controls">
            <div className="controls-left-section">
              <div className="hierarchy-search">
                <div className="search-input-wrapper">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search across all hierarchies..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="hierarchy-search-input"
                  />
                  {searchQuery && (
                    <button className="search-clear-button" onClick={clearSearch}>
                      <FiX />
                    </button>
                  )}
                </div>
              </div>
              
              <FilterMenu
                activeFilters={activeFilters}
                onFilterToggle={toggleFilter}
                onStatusFilterToggle={toggleStatusFilter}
                onToggleAllRoles={toggleAllRoles}
                onResetFilters={clearAllFilters}
                getRoleColor={getRoleColor}
                stateFilters={allAvailableStates}
                onStateFilterToggle={toggleStateFilter}
                onToggleAllStates={toggleAllStates}
                menuType="expandable"
                buttonLabel={<FiFilter title="Filter Results" />}
                position="bottom"
                roleFilters={['RGA', 'MGA', 'GA', 'SA', 'AGT']}
                statusFilters={[
                  {
                    key: 'redeemed',
                    label: 'Redeemed',
                    yesLabel: 'redeemed',
                    noLabel: 'not redeemed'
                  },
                  {
                    key: 'released',
                    label: 'Released',
                    yesLabel: 'released',
                    noLabel: 'not released'
                  },
                  {
                    key: 'managerActive',
                    label: 'Active',
                    yesLabel: 'active',
                    noLabel: 'inactive'
                  },
                  {
                    key: 'noProfPic',
                    label: 'Profile Pic',
                    yesLabel: 'without profile pics',
                    noLabel: 'with profile pics'
                  },
                  {
                    key: 'pending',
                    label: 'Pending',
                    yesLabel: 'RFC',
                    noLabel: 'not RFC'
                  }
                ]}
              />
            </div>
            
            <div className="controls-right-section">
              <div className="view-toggle">
                <button className="admin-toggle-button" onClick={toggleAllRGAs} title={Object.values(expandedRGAs).some(isExpanded => isExpanded) ? "Collapse All" : "Expand All"}>
                  {Object.values(expandedRGAs).some(isExpanded => isExpanded) 
                    ? <FiChevronUp /> 
                    : <FiChevronDown />
                  }
                </button>
                
                <button className="admin-export-button" onClick={exportToCSV} title="Export to CSV">
                  <FiDownload />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Bulk Actions Panel - Only shown when rows are selected */}
        {getSelectedCount() > 0 && (
          <>
            <div id="bulk-action-panel" className="bulk-action-panel">
              <div className="selected-count">
                {getSelectedCount()} user{getSelectedCount() !== 1 ? 's' : ''} selected
              </div>
              <div className="bulk-actions">
                <button 
                  className="bulk-action-button" 
                  onClick={() => performBulkAction('email')}
                  title="Send email to all selected users"
                >
                  <FiMail /> Email
                </button>
                <button 
                  className="bulk-action-button" 
                  onClick={() => performBulkAction('activate')}
                  title="Activate all selected users"
                >
                  <FiCheckCircle /> Activate
                </button>
                <button 
                  className="bulk-action-button" 
                  onClick={() => performBulkAction('deactivate')}
                  title="Deactivate all selected users"
                >
                  <FiXCircle /> Deactivate
                </button>
                <button 
                  className="bulk-action-button" 
                  onClick={() => extendSelectionToChildren()}
                  title="Include children of selected users"
                >
                  <FiUsers /> Include Children
                </button>
                <button 
                  className="bulk-action-button" 
                  onClick={clearSelection}
                  title="Clear selection"
                >
                  <FiX /> Clear
                </button>
              </div>
            </div>
            <div id="bulk-action-placeholder" className="bulk-action-placeholder"></div>
          </>
        )}
        
        {/* State filters visibility indicator - only show when showControls is true */}
        {showControls && Object.values(activeFilters.states).some(value => value) && (
          <div className="active-state-filters">
            <span>Filtering by states: </span>
            {Object.entries(activeFilters.states)
              .filter(([_, isActive]) => isActive)
              .map(([state]) => (
                <span key={state} className="active-state-filter">
                  {state}
                  <button 
                    className="remove-state-filter"
                    onClick={() => toggleStateFilter(state)}
                  >
                    <FiX size={12} />
                  </button>
                </span>
              ))
            }
            <button 
              className="clear-state-filters"
              onClick={() => toggleAllStates(false)}
            >
              Clear all
            </button>
          </div>
        )}
        
        {/* Search Results Status - only show when showControls is true */}
        {showControls && searchQuery && searchResults && (
          <div className="search-results-status">
            {searchResults.totalMatches === 0 ? (
              <p>No results found for "{searchQuery}"</p>
            ) : (
              <p>Found {searchResults.totalMatches} result(s) for "{searchQuery}" across {searchResults.matchingRgaGroups.length} RGA(s). <span className="search-tip">(Search works with first name, last name, or full name formats)</span></p>
            )}
          </div>
        )}
        
        {/* Processing stats if still loading data - only show when showControls is true */}
        {showControls && processingStats.inProgress && (
          <div className="processing-stats">
            <FiLoader className="spinner" />
            <span>Loading hierarchies: {processingStats.loaded}/{processingStats.total} RGAs processed</span>
          </div>
        )}
        
        {/* Display hierarchies grouped by RGA */}
        <div className="admin-hierarchy-container">
          {rgaHierarchies.map((rgaHierarchy, rgaIndex) => {
            // If searching, only show RGAs with matching users
            if (searchResults && searchResults.matchingRgaGroups) {
              const hasMatches = searchResults.matchingRgaGroups.some(
                group => group.rgaId === rgaHierarchy.rgaId
              );
              if (!hasMatches) return null;
            }
            
            const isExpanded = expandedRGAs[rgaHierarchy.rgaId];
            
            // Calculate displayed users count based on filters and search
            let displayedUsersCount = rgaHierarchy.hierarchyData.length;
            
            if (searchResults) {
              // If searching, count only matched users in this RGA
              const matchingGroup = searchResults.matchingRgaGroups.find(
                group => group.rgaId === rgaHierarchy.rgaId
              );
              displayedUsersCount = matchingGroup ? matchingGroup.matches.length : 0;
            } else {
              // If filtering, count only users that pass all filters
              displayedUsersCount = countFilteredUsers(rgaHierarchy.hierarchyData);
            }
            
            return (
              <div key={rgaHierarchy.rgaId} className="admin-rga-section">
                <div 
                  className="rga-section-header"
                  onClick={() => toggleRgaExpansion(rgaHierarchy.rgaId)}
                >
                  <div className="admin-rga-title">
                    {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                    <span>{rgaHierarchy.rgaName}</span>
                  </div>
                  <div className="admin-rga-role">
                    <span 
                      className="role-badge role-RGA"
                      style={{
                        backgroundColor: getRoleColor('RGA').bg,
                        borderColor: getRoleColor('RGA').border
                      }}
                    >
                      RGA
                    </span>
                    <div className="user-count-badge">
                      {displayedUsersCount}
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="hierarchy-table-container">
                    <table className="hierarchy-table">
                      <thead>
                        <tr>
                          <th className="checkbox-column">
                            <input 
                              type="checkbox" 
                              onChange={() => {
                                const tableData = flattenHierarchy(rgaHierarchy.hierarchicalData);
                                selectAllVisible(tableData);
                              }}
                              checked={
                                flattenHierarchy(rgaHierarchy.hierarchicalData).length > 0 && 
                                flattenHierarchy(rgaHierarchy.hierarchicalData).every(node => selectedRows[node.lagnname])
                              }
                              title="Select all visible rows"
                            />
                          </th>
                          <th className="toggle-cell"></th>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th className="status-column">Status</th>
                          <th>ESID</th>
                          <th className="license-column">Licenses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let tableData = [];
                          
                          if (searchResults) {
                            // If searching, only show matched nodes and their uplines
                            const matchingGroup = searchResults.matchingRgaGroups.find(
                              group => group.rgaId === rgaHierarchy.rgaId
                            );
                            
                            if (matchingGroup) {
                              // Create a Set to track which nodes we've already added
                              const addedNodes = new Set();
                              
                              // First add all matched nodes
                              matchingGroup.matches.forEach(node => {
                                if (!addedNodes.has(node.lagnname)) {
                                  tableData.push({
                                    ...node,
                                    isSearchMatch: true,
                                    isUpline: false,
                                    level: node.level || 0
                                  });
                                  addedNodes.add(node.lagnname);
                                }
                              });
                              
                              // Then add all uplines for each matched node
                              matchingGroup.matches.forEach(node => {
                                const uplines = matchingGroup.directUplines.get(node.lagnname);
                                if (uplines) {
                                  Object.values(uplines).forEach(upline => {
                                    if (upline && !addedNodes.has(upline.lagnname)) {
                                      tableData.push({
                                        ...upline,
                                        isSearchMatch: false,
                                        isUpline: true,
                                        level: upline.level || 0
                                      });
                                      addedNodes.add(upline.lagnname);
                                    }
                                  });
                                }
                              });
                              
                              // Sort the data by role and then name
                              tableData.sort((a, b) => {
                                // First sort by role
                                const roleOrder = { 'RGA': 1, 'MGA': 2, 'GA': 3, 'SA': 4, 'AGT': 5 };
                                const roleA = roleOrder[a.clname] || 99;
                                const roleB = roleOrder[b.clname] || 99;
                                
                                if (roleA !== roleB) {
                                  return roleA - roleB;
                                }
                                
                                // Then sort by search match status (matches first)
                                if (a.isSearchMatch !== b.isSearchMatch) {
                                  return a.isSearchMatch ? -1 : 1;
                                }
                                
                                // Then sort alphabetically by name
                                return a.lagnname.localeCompare(b.lagnname);
                              });
                            }
                          } else if (isExpanded && rgaHierarchy.hierarchicalData) {
                            // If not searching and expanded, show the hierarchical data
                            tableData = flattenHierarchy(rgaHierarchy.hierarchicalData);
                          }
                          
                          if (tableData.length === 0) {
                            return (
                              <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                                  {searchQuery ? 'No matching users found' : 'No users to display'}
                                </td>
                              </tr>
                            );
                          }
                          
                          return tableData.map((node, index) => {
                            // Check if this node is the current user
                            const isCurrentUser = node.lagnname === user?.userId;
                            
                            // Get indentation based on level
                            const indentation = node.level * 20;
                            
                            // Check if node is expandable
                            const canExpand = isNodeExpandable(node);
                            
                            // Get expanded state
                            const isExpanded = expandedNodes[node.lagnname] !== false;
                            
                            // Get active status for styling
                            const isActive = node.managerActive && node.managerActive.toLowerCase() === 'y';
                            
                            // Check pending status
                            const isPending = node.pending === 1 || node.pending === '1';
                            
                            // Row classes
                            const rowClasses = [
                              !isActive ? 'inactive' : '',
                              node.isSearchMatch ? 'search-match' : '',
                              node.isUpline ? 'search-upline' : '',
                              isCurrentUser ? 'hierarchy-card-current' : ''
                            ].filter(Boolean).join(' ');
                            
                            return (
                              <tr key={`node-${node.lagnname}-${index}`} className={rowClasses}>
                                <td className="checkbox-column">
                                  <input
                                    type="checkbox"
                                    checked={selectedRows[node.lagnname] || false}
                                    onChange={(e) => toggleRowSelection(node.lagnname, e)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </td>
                                <td className="toggle-cell">
                                  {canExpand ? (
                                    <button 
                                      className="node-toggle"
                                      onClick={() => toggleNodeExpansion(node.lagnname)}
                                      aria-label={isExpanded ? "Collapse" : "Expand"}
                                    >
                                      {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                                    </button>
                                  ) : null}
                                </td>
                                <td className="indented">
                                  <div 
                                    className="indented-content"
                                    style={{ marginLeft: `${indentation}px` }}
                                  >
                                    <div className="user-cell">
                                      <div className="user-icon">
                                        {node.profpic ? (
                                          <img 
                                            src={node.profpic} 
                                            alt={`${node.lagnname}'s profile`} 
                                            className="profile-image"
                                          />
                                        ) : (
                                          <FiUser size={18} />
                                        )}
                                      </div>
                                      <div className="name-with-icon">
                                        <span className="user-name">{node.lagnname}</span>
                                        {isCurrentUser && <span className="you-badge">You</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={`role-badge role-${node.clname}`}>
                                    {node.clname}
                                  </span>
                                </td>
                                <td>
                                  <a href={`mailto:${node.email}`}>{node.email || '—'}</a>
                                </td>
                                <td>
                                  <a href={`tel:${node.phone}`}>{formatPhoneNumber(node.phone)}</a>
                                </td>
                                <td className="status-column">{renderStatusBadges(node)}</td>
                                <td>{node.esid ? formatDate(node.esid) : '—'}</td>
                                <td className="license-column">{renderLicenseBadges(node)}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Add ScrollToTop component with explicit settings - only add when showControls is true */}
      {showControls && (
        <ScrollToTop 
          showAfterScrollHeight={100}
          position={{ bottom: '30px', right: '30px' }}
          zIndex={9999}
          scrollableContainerSelector=".settings-section"
        />
      )}
    </>
  );

  // If standalone component (with controls), render complete settings-section
  if (showControls) {
    return (
      <div className="settings-section">
        {renderContent()}
      </div>
    );
  }
  
  // If used as a child component (without controls), just render the content
  return renderContent();
};

export default AdminHierarchyTableView;