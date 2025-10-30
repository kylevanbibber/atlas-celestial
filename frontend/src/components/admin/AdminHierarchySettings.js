import React, { useState, useEffect, useCallback } from 'react';
import { FiChevronRight, FiLoader, FiUser, FiSearch, FiFilter, FiX, FiCheck, FiDownload, FiChevronDown, FiChevronUp, FiUsers, FiGrid } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import '../../pages/utilities/Utilities.css';
import './AdminHierarchySettings.css';
import FilterMenu from '../common/FilterMenu';
import ScrollToTop from '../utils/ScrollToTop';
import HierarchyMGAUtilitiesTable from '../utilities/HierarchyMGAUtilitiesTable';

// Don't import from constants directly, define states here to avoid circular dependencies
const US_STATES_LIST = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
];

// Admin Hierarchy settings component
const AdminHierarchySettings = () => {
  const { hasPermission, user } = useAuth();
  const [initialLoading, setInitialLoading] = useState(true); // Show UI skeleton immediately
  const [dataLoading, setDataLoading] = useState(false); // Track data loading separately
  const [rgaHierarchies, setRgaHierarchies] = useState([]);
  const [expandedRGAs, setExpandedRGAs] = useState({});
  const [expandedNodes, setExpandedNodes] = useState({});
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(null);
  const [activeFilters, setActiveFilters] = useState({
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
  // Add view toggle state - 'tree' or 'table'
  const [viewMode, setViewMode] = useState('tree');
  // Add search mode state - 'full' or 'isolated'
  const [searchMode, setSearchMode] = useState('full');

  // Show UI immediately, then load data
  useEffect(() => {
    // Show UI skeleton immediately
    setInitialLoading(false);
    
    // Start data loading after a brief delay to allow UI to render
    const loadData = async () => {
      setDataLoading(true);
      try {
        // Determine if the current user should see org-wide data
        // Strict org-wide viewer check: Admin role, app teamRole, or SGA clname only
        const isOrgWideViewer = (
          String(user?.Role || '').toUpperCase() === 'ADMIN' ||
          String(user?.teamRole || '').toLowerCase() === 'app' ||
          String(user?.clname || '').toUpperCase() === 'SGA'
        );

        if (!isOrgWideViewer) {
          await fetchUserHierarchyData();
        } else {
          await fetchAllRGAsHierarchy();
        }
      } finally {
        setDataLoading(false);
      }
    };
    
    // Small delay to let the UI render first
    setTimeout(loadData, 100);
  }, [hasPermission, user?.userId, user?.teamRole, user?.clname]);

  // New function to fetch data using searchByUserId for non-admin users
  const fetchUserHierarchyData = async () => {
    try {
      setError('');
      
      if (!user || !user.userId) {
        setError('User information is not available. Please try logging in again.');
        return;
      }

      const response = await api.post('/auth/searchByUserId', {
        userId: user.userId
      });
      
      if (response.data.success) {
        // Create a single "RGA hierarchy" object from the user data
        const incomingData = response.data.data || [];
        const activeOnly = Array.isArray(incomingData)
          ? incomingData.filter(u => (u.Active || '').toLowerCase() === 'y')
          : [];
        const userHierarchyData = {
          rgaId: response.data.agnName || user.userId,
          rgaName: response.data.agnName || user.userId,
          hierarchyData: activeOnly
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
    }
  };

  // Fetch hierarchy data for all RGAs
  const fetchAllRGAsHierarchy = async () => {
    try {
      setError('');
      setProcessingStats({
        total: 0,
        loaded: 0,
        inProgress: true
      });

      const response = await api.get('/admin/getAllRGAsHierarchy');
      
      if (response.data.success) {
        // Process received hierarchies
        const hierarchies = (response.data.data || []).map(h => ({
          ...h,
          hierarchyData: Array.isArray(h.hierarchyData)
            ? h.hierarchyData.filter(u => (u.Active || '').toLowerCase() === 'y')
            : []
        }));
        
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

  // Toggle RGA expansion
  const toggleRgaExpansion = (rgaId) => {
    setExpandedRGAs(prev => ({
      ...prev,
      [rgaId]: !prev[rgaId]
    }));
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

  // Build isolated hierarchy for a specific user
  const buildIsolatedHierarchy = (targetUser, rgaHierarchy) => {
    const allUsers = rgaHierarchy.hierarchyData;
    const isolatedUsers = new Set();
    const userMap = {};
    
    // Create a map for quick user lookup
    allUsers.forEach(user => {
      userMap[user.lagnname] = user;
    });
    
    // Add the target user
    isolatedUsers.add(targetUser.lagnname);
    
    // Find and add all uplines
    const addUplines = (user) => {
      if (user.sa && userMap[user.sa]) {
        isolatedUsers.add(user.sa);
        addUplines(userMap[user.sa]);
      }
      if (user.ga && userMap[user.ga]) {
        isolatedUsers.add(user.ga);
        addUplines(userMap[user.ga]);
      }
      if (user.mga && userMap[user.mga]) {
        isolatedUsers.add(user.mga);
        addUplines(userMap[user.mga]);
      }
      if (user.rga && userMap[user.rga]) {
        isolatedUsers.add(user.rga);
        addUplines(userMap[user.rga]);
      }
    };
    
    // Find and add all downlines
    const addDownlines = (userName) => {
      allUsers.forEach(user => {
        if (!isolatedUsers.has(user.lagnname)) {
          // Check if this user has the target user as an upline
          if (user.sa === userName || user.ga === userName || 
              user.mga === userName || user.rga === userName) {
            isolatedUsers.add(user.lagnname);
            addDownlines(user.lagnname); // Recursively add their downlines
          }
        }
      });
    };
    
    addUplines(targetUser);
    addDownlines(targetUser.lagnname);
    
    // Filter users to only include isolated ones
    const isolatedUserList = allUsers.filter(user => isolatedUsers.has(user.lagnname));
    
    // Build hierarchy with isolated users
    return buildRgaHierarchy(isolatedUserList);
  };

  // Helper function to determine the primary RGA for a user based on their direct reporting chain
  const findPrimaryRGA = (user, allHierarchies) => {
    // Strategy 1: Find the RGA where this user's MGA has the most direct relationship
    const userMGA = user.mga;
    if (userMGA) {
      // Find which RGA hierarchy contains this user's MGA as a direct MGA
      for (const hierarchy of allHierarchies) {
        const mgaInHierarchy = hierarchy.hierarchyData.find(person => 
          person.lagnname === userMGA && person.clname === 'MGA'
        );
        
        // Check if this MGA directly reports to this RGA (not through other relationships)
        if (mgaInHierarchy && mgaInHierarchy.rga === hierarchy.rgaName) {
          return hierarchy.rgaId;
        }
      }
    }
    
    // Strategy 2: If no direct MGA relationship found, use user's direct RGA field
    if (user.rga) {
      const directRgaHierarchy = allHierarchies.find(h => h.rgaName === user.rga);
      if (directRgaHierarchy) {
        return directRgaHierarchy.rgaId;
      }
    }
    
    // Fallback: Find the RGA hierarchy where this user appears first
    for (const hierarchy of allHierarchies) {
      const userInHierarchy = hierarchy.hierarchyData.find(person => person.lagnname === user.lagnname);
      if (userInHierarchy) {
        return hierarchy.rgaId;
      }
    }
    
    return null;
  };

  // Update performSearch to use the search index for faster lookups
  const performSearch = (query, mode = null) => {
    if (!query.trim() || rgaHierarchies.length === 0) {
      setSearchResults(null);
      return;
    }
    
    // Use the provided mode or fall back to current searchMode
    const currentSearchMode = mode !== null ? mode : searchMode;
    
    console.time('search');
    
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
    
    // Fast prefix matching using the index with deduplication
    const matchedNodeIds = new Set();
    
    // Step 1: Collect all potential matches across all hierarchies
    const potentialMatches = new Map(); // Map of lagnname -> [{node, rgaId}, ...]

    // Check each key in the index for matches
    Object.keys(searchIndex).forEach(key => {
      if (key.includes(searchLower)) {
        searchIndex[key].forEach(({ node, rgaId }) => {
          if (!potentialMatches.has(node.lagnname)) {
            potentialMatches.set(node.lagnname, []);
          }
          potentialMatches.get(node.lagnname).push({ node, rgaId });
        });
      }
    });

    // Step 2: Deduplicate users by determining their primary RGA
    potentialMatches.forEach((matches, lagnname) => {
      if (matches.length === 0) return;
      
      // If user appears in multiple RGAs, determine their primary RGA
      let primaryMatch;
      
      if (matches.length === 1) {
        // User only appears in one RGA, use it
        primaryMatch = matches[0];
      } else {
        // User appears in multiple RGAs, find their primary one
        const firstNode = matches[0].node;
        const primaryRgaId = findPrimaryRGA(firstNode, rgaHierarchies);
        
        // Find the match that corresponds to the primary RGA
        primaryMatch = matches.find(m => m.rgaId === primaryRgaId);
        
        // If primary RGA not found in matches, use the first match as fallback
        if (!primaryMatch) {
          primaryMatch = matches[0];
        }
        
        console.log(`Deduplicated user ${lagnname}: found in ${matches.length} RGAs, showing in primary RGA:`, primaryMatch.rgaId);
      }
      
      const { node, rgaId } = primaryMatch;
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
          
          // For each matching node, create a record of its direct uplines
          // Search across ALL hierarchies to find uplines (they might be in different RGA data)
          const findUplineAcrossHierarchies = (uplineName) => {
            if (!uplineName) return null;
            const uplineNameLower = uplineName.toLowerCase();
            
            // First try current RGA (case-insensitive)
            let upline = rgaHierarchy.hierarchyData.find(u => 
              u.lagnname && u.lagnname.toLowerCase() === uplineNameLower
            );
            if (upline) return upline;
            
            // If not found, search all other RGA hierarchies (case-insensitive)
            for (const otherRga of rgaHierarchies) {
              if (otherRga.rgaId !== rgaId) {
                upline = otherRga.hierarchyData.find(u => 
                  u.lagnname && u.lagnname.toLowerCase() === uplineNameLower
                );
                if (upline) return upline;
              }
            }
            return null;
          };
          
          const uplines = {
            sa: findUplineAcrossHierarchies(node.sa),
            ga: findUplineAcrossHierarchies(node.ga),
            mga: findUplineAcrossHierarchies(node.mga),
            rga: findUplineAcrossHierarchies(node.rga),
          };
          
          // Debug logging
          if (node.lagnname === 'VALENT MICHAEL B') {
            console.log('[Search Debug] VALENT MICHAEL B uplines object:', uplines);
            console.log('[Search Debug] MGA details:', {
              mga_exists: !!uplines.mga,
              mga_lagnname: uplines.mga?.lagnname,
              mga_clname: uplines.mga?.clname,
              mga_full_object: uplines.mga
            });
          }
          
          // Build uplineIds array in order: SA, GA, MGA, RGA
          const uplineIds = [];
          if (uplines.sa) {
            uplineIds.push(uplines.sa.lagnname);
            if (node.lagnname === 'VALENT MICHAEL B') console.log('Added SA:', uplines.sa.lagnname);
          }
          if (uplines.ga) {
            uplineIds.push(uplines.ga.lagnname);
            if (node.lagnname === 'VALENT MICHAEL B') console.log('Added GA:', uplines.ga.lagnname);
          }
          if (uplines.mga) {
            uplineIds.push(uplines.mga.lagnname);
            if (node.lagnname === 'VALENT MICHAEL B') console.log('Added MGA:', uplines.mga.lagnname);
          } else {
            if (node.lagnname === 'VALENT MICHAEL B') console.log('MGA is null/undefined, node.mga was:', node.mga);
          }
          if (uplines.rga) {
            uplineIds.push(uplines.rga.lagnname);
            if (node.lagnname === 'VALENT MICHAEL B') console.log('Added RGA:', uplines.rga.lagnname);
          }
          
          if (node.lagnname === 'VALENT MICHAEL B') {
            console.log('[Search Debug] Built uplineIds:', uplineIds);
          }
          
          // Add node to matches with uplineIds attached
          matchingGroup.matches.push({
            ...node,
            uplineIds: uplineIds
          });
          
          // Debug logging for VALENT
          if (node.lagnname === 'VALENT MICHAEL B') {
            console.log('[Match Add Debug] Added VALENT MICHAEL B to matchingGroup for RGA:', rgaId, rgaHierarchy.rgaName);
            console.log('[Match Add Debug] Current matches in this group:', matchingGroup.matches.map(m => m.lagnname));
          }
          if (node.lagnname === 'KOZEJ SPENCER G') {
            console.log('[Match Add Debug] Added KOZEJ SPENCER G to matchingGroup for RGA:', rgaId, rgaHierarchy.rgaName);
            console.log('[Match Add Debug] Current matches in this group:', matchingGroup.matches.map(m => m.lagnname));
          }
          
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
      
      // Build isolated hierarchies if in isolated mode
      const processedMatchingNodes = matchingNodes.map(matchingGroup => {
        if (currentSearchMode === 'isolated') {
          // Find the RGA hierarchy for this group
          const rgaHierarchy = rgaHierarchies.find(h => h.rgaId === matchingGroup.rgaId);
          if (rgaHierarchy && matchingGroup.matches.length > 0) {
            // For isolated mode, build isolated hierarchy for each match
            const isolatedHierarchies = matchingGroup.matches.map(match => {
              const isolatedHierarchy = buildIsolatedHierarchy(match, rgaHierarchy);
              return {
                targetUser: match,
                isolatedHierarchy: isolatedHierarchy
              };
            });
            
            return {
              ...matchingGroup,
              isolatedHierarchies: isolatedHierarchies,
              searchMode: 'isolated'
            };
          }
        }
        
        return {
          ...matchingGroup,
          searchMode: 'full'
        };
      });
      
      setSearchResults({
        matchingRgaGroups: processedMatchingNodes,
        totalMatches: matchingNodes.reduce((sum, group) => sum + group.matches.length, 0),
        directUplineMap,
        searchMode: currentSearchMode
      });
    } else {
      setSearchResults({ 
        matchingRgaGroups: [], 
        totalMatches: 0, 
        directUplineMap: new Map(),
        searchMode: currentSearchMode
      });
    }
    
    console.timeEnd('search');
  };

  // Add a helper function to identify and expand nodes with matching children
  const findAndExpandMatchingNodes = () => {
    // Skip if no hierarchy data
    if (rgaHierarchies.length === 0) return;
    
    // Keep track of nodes to expand
    const nodesToExpand = new Set();
    
    // Function to identify nodes with matching children
    const findNodesWithMatchingChildren = (nodes) => {
      let hasMatchingDescendant = false;
      
      for (const node of nodes) {
        // Check if this node matches filters
        const nodeMatches = passesAllFilters(node);
        
        // Check children recursively
        let childrenMatch = false;
        if (node.children && node.children.length > 0) {
          // Call recursively and get result
          childrenMatch = findNodesWithMatchingChildren(node.children);
          
          // If children have matches, mark this node for expansion
          if (childrenMatch && (node.clname === 'RGA' || node.clname === 'MGA')) {
            nodesToExpand.add(node.lagnname);
          }
        }
        
        // If either this node or its children match, report match to parent
        if (nodeMatches || childrenMatch) {
          hasMatchingDescendant = true;
        }
      }
      
      return hasMatchingDescendant;
    };
    
    // Process all hierarchies to find nodes to expand
    rgaHierarchies.forEach(hierarchy => {
      if (hierarchy.hierarchicalData) {
        findNodesWithMatchingChildren(hierarchy.hierarchicalData);
      }
    });
    
    // Update expansion state to ensure matching nodes are expanded
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
  };

  // Toggle role filter
  const toggleFilter = (role) => {
    setActiveFilters(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
    
    // Find and expand nodes with matching children
    setTimeout(findAndExpandMatchingNodes, 0);
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
    
    // Find and expand nodes with matching children
    setTimeout(findAndExpandMatchingNodes, 0);
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
    
    // Find and expand nodes with matching children
    setTimeout(findAndExpandMatchingNodes, 0);
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
        // Update local state - need to update both hierarchyData and hierarchicalData
        setRgaHierarchies(prev => {
          return prev.map(rgaHierarchy => {
            // Update flat hierarchyData
            const updatedHierarchyData = rgaHierarchy.hierarchyData.map(user => {
              if (user.lagnname === node.lagnname) {
                return { ...user, managerActive: newStatus };
              }
              return user;
            });
            
            // Also update hierarchicalData (tree structure) recursively
            const updateHierarchicalNodes = (nodes) => {
              if (!nodes) return nodes;
              return nodes.map(hierarchyNode => {
                const updatedNode = { ...hierarchyNode };
                if (hierarchyNode.lagnname === node.lagnname) {
                  updatedNode.managerActive = newStatus;
                }
                if (hierarchyNode.children && hierarchyNode.children.length > 0) {
                  updatedNode.children = updateHierarchicalNodes(hierarchyNode.children);
                }
                return updatedNode;
              });
            };
            
            const updatedHierarchicalData = rgaHierarchy.hierarchicalData 
              ? updateHierarchicalNodes(rgaHierarchy.hierarchicalData)
              : rgaHierarchy.hierarchicalData;
            
            return {
              ...rgaHierarchy,
              hierarchyData: updatedHierarchyData,
              hierarchicalData: updatedHierarchicalData
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
    
    return (
      <div className="license-badges">
        {sortedLicenses.map(license => (
          <span 
            key={license.id} 
            className={`license-state-badge ${license.resident_state === 1 ? 'resident' : ''}`}
            title={`${license.resident_state === 1 ? 'Resident' : 'Non-resident'} license in ${license.state}`}
          >
            {license.state}
          </span>
        ))}
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
      console.error('[AdminHierarchySettings] Error formatting date:', e);
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
        children: [] 
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
          added = true;
        } 
        // Check for MGA-RGA link
        else if (item.mga_rga_link && map[item.mga_rga_link]) {
          map[item.mga_rga_link].children.push(map[item.lagnname]);
          added = true;
        }
        // Otherwise add to top level
        else {
          hierarchy.push(map[item.lagnname]);
          added = true;
        }
      }
      // Second level: AGT with no sa or ga
      else if (item.clname === 'AGT' && !item.sa && !item.ga) {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Third level: SA with no ga
      else if (item.clname === 'SA' && !item.ga) {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Fourth level: AGT with SA value but no ga
      else if (item.clname === 'AGT' && item.sa && !item.ga) {
        if (map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Fifth level: GA
      else if (item.clname === 'GA') {
        if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          added = true;
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Sixth level: AGT with no sa but with GA
      else if (item.clname === 'AGT' && !item.sa && item.ga) {
        if (map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Seventh level: SA with ga
      else if (item.clname === 'SA' && item.ga) {
        if (map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Eighth level: AGT with both sa and ga
      else if (item.clname === 'AGT' && item.sa && item.ga) {
        if (map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
          added = true;
        }
      }

      // Default fallback if not handled by above rules
      if (!added) {
        if (item.sa && map[item.sa]) {
          map[item.sa].children.push(map[item.lagnname]);
        } else if (item.ga && map[item.ga]) {
          map[item.ga].children.push(map[item.lagnname]);
        } else if (item.mga && map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
        } else if (item.rga && map[item.rga]) {
          map[item.rga].children.push(map[item.lagnname]);
        } else {
          hierarchy.push(map[item.lagnname]);
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

  // Update useEffect for expandedNodes to set RGAs and MGAs as expanded by default
  useEffect(() => {
    // Initialize expanded state for hierarchical nodes
    if (rgaHierarchies.length > 0) {
      const initialNodeExpandedState = {};
      
      // Traverse all hierarchies and collect node IDs
      rgaHierarchies.forEach(rgaHierarchy => {
        if (rgaHierarchy.hierarchicalData) {
          const collectNodeIds = (nodes) => {
            nodes.forEach(node => {
              // Set all nodes as collapsed by default
              initialNodeExpandedState[node.lagnname] = false;
              
              if (node.children && node.children.length > 0) {
                collectNodeIds(node.children);
              }
            });
          };
          
          collectNodeIds(rgaHierarchy.hierarchicalData);
        }
      });
      
      setExpandedNodes(initialNodeExpandedState);
    }
  }, [rgaHierarchies]);

  // Add a useEffect to auto-expand nodes with matching children when filters change
  useEffect(() => {
    // Skip if no hierarchy data yet
    if (rgaHierarchies.length === 0) return;
    
    // Check if any filters are active, excluding the default "Active: yes" state
    const hasActiveFilters = 
      activeFilters.released !== null || 
      activeFilters.redeemed !== null || 
      activeFilters.noProfPic !== null || 
      (activeFilters.managerActive !== null && activeFilters.managerActive !== true) || // Exclude default "Active: yes"
      Object.values(activeFilters.states).some(value => value === true);
    
    // If no active filters, don't change expansion state
    if (!hasActiveFilters) return;
    
    // Keep track of nodes to expand
    const nodesToExpand = new Set();
    
    // Function to identify nodes with matching children
    const findNodesWithMatchingChildren = (nodes) => {
      let hasMatchingDescendant = false;
      
      for (const node of nodes) {
        // Check if this node matches filters
        const nodeMatches = passesAllFilters(node);
        
        // Check children recursively
        let childrenMatch = false;
        if (node.children && node.children.length > 0) {
          // Call recursively and get result
          childrenMatch = findNodesWithMatchingChildren(node.children);
          
          // If children have matches, mark this node for expansion
          if (childrenMatch && (node.clname === 'RGA' || node.clname === 'MGA')) {
            nodesToExpand.add(node.lagnname);
          }
        }
        
        // If either this node or its children match, report match to parent
        if (nodeMatches || childrenMatch) {
          hasMatchingDescendant = true;
        }
      }
      
      return hasMatchingDescendant;
    };
    
    // Process all hierarchies to find nodes to expand
    rgaHierarchies.forEach(hierarchy => {
      if (hierarchy.hierarchicalData) {
        findNodesWithMatchingChildren(hierarchy.hierarchicalData);
      }
    });
    
    // Update expansion state to ensure matching nodes are expanded
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
  }, [activeFilters, rgaHierarchies]);

  // Modify the renderHierarchyTree function to handle filtered nodes better
  const renderHierarchyTree = (nodes, level = 0, matchingSet = null) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    // When filtering by role, we need to show all matching nodes regardless of hierarchy
    const areRoleFiltersActive = !activeFilters.RGA || !activeFilters.MGA || !activeFilters.GA || !activeFilters.SA || !activeFilters.AGT;
    
    // If we're filtering by role, we want to flatten the hierarchy
    if (areRoleFiltersActive && !matchingSet) {
      // Let's filter the nodes directly
      return renderFlatFilteredNodes(flattenHierarchy(nodes));
    }

    // Identify status filters or state filters
    const hasStatusOrStateFilters = 
      activeFilters.released !== null || 
      activeFilters.redeemed !== null || 
      activeFilters.noProfPic !== null || 
      activeFilters.managerActive !== null || 
      Object.values(activeFilters.states).some(value => value === true);

    // If we're applying status or state filters, check for child matches first
    if (hasStatusOrStateFilters && !matchingSet) {
      // Create a set of nodes with matching children
      const nodesWithMatchingChildren = new Set();
      
      // Function to collect nodes with matching children
      const collectNodesWithMatchingChildren = (startNodes) => {
        // Check each node
        startNodes.forEach(node => {
          // Check if this node's children match
          if (node.children && node.children.length > 0) {
            // First recurse deeper to collect matching descendants
            collectNodesWithMatchingChildren(node.children);
            
            // Now check if any direct children match filters
            const hasAnyMatchingChild = node.children.some(child => 
              passesAllFilters(child) || nodesWithMatchingChildren.has(child.lagnname)
            );
            
            // If it has matching children, add it to our set
            if (hasAnyMatchingChild) {
              nodesWithMatchingChildren.add(node.lagnname);
            }
          }
        });
      };
      
      // Start the collection process
      collectNodesWithMatchingChildren(nodes);
      
      // Create a new matchingSet to pass down
      const filterMatchingSet = new Set();
      
      // Collect all passing nodes and nodes with passing descendants
      const collectAllMatchingNodes = (startNodes) => {
        startNodes.forEach(node => {
          if (passesAllFilters(node) || nodesWithMatchingChildren.has(node.lagnname)) {
            filterMatchingSet.add(node.lagnname);
          }
          
          if (node.children && node.children.length > 0) {
            collectAllMatchingNodes(node.children);
          }
        });
      };
      
      collectAllMatchingNodes(nodes);
      
      // Use this set as the matching set parameter
      matchingSet = filterMatchingSet.size > 0 ? filterMatchingSet : null;
    }

    // Function to determine if a node is the current user
    const isCurrentUser = (node) => {
      return node.lagnname === user?.userId;
    };

    // Regular hierarchical rendering for search or when no role filters
    return (
      <>
        {nodes.map(node => {
          // Whether this node passes filters or is in the matching set
          const nodeMatches = passesAllFilters(node) || (matchingSet && matchingSet.has(node.lagnname));
          
          // If not a match and not in search results, check if any children match
          let hasMatchingChildren = false;
          
          if (node.children && node.children.length > 0) {
            // Check if any children (or their descendants) match
            const checkChildrenForMatches = (childNodes) => {
              for (const child of childNodes) {
                // Direct match for this child
                if (passesAllFilters(child) || (matchingSet && matchingSet.has(child.lagnname))) {
                  return true;
                }
                
                // Recurse to check grand-children
                if (child.children && child.children.length > 0) {
                  if (checkChildrenForMatches(child.children)) {
                    return true;
                  }
                }
              }
              return false;
            };
            
            hasMatchingChildren = checkChildrenForMatches(node.children);
          }
          
          // Skip this node if it doesn't match and has no matching children
          if (!nodeMatches && !hasMatchingChildren) {
            return null;
          }
          
          // For search results, check if this node or any of its children are in the matching set
          const isMatch = matchingSet ? matchingSet.has(node.lagnname) : false;
          
          // Check if node should be collapsible:
          // Instead of checking if it's level 0, we need to properly handle RGA children
          const isReallyTopLevelRga = level === 0 && node.clname === 'RGA';
          const isChildRga = level > 0 && node.clname === 'RGA';
          const isMga = node.clname === 'MGA';
          
          const hasNonRgaMgaChildren = node.children && node.children.some(
            child => child.clname !== 'RGA' && child.clname !== 'MGA'
          );
          
          // Make node collapsible if it has any children
          const isCollapsible = (
            ((node.clname === 'RGA' || node.clname === 'MGA')) && 
            node.children && 
            node.children.length > 0
          );
          
          // Get expanded state for this node
          const isNodeExpanded = expandedNodes[node.lagnname] !== false;
          
          // Count children that pass filters
          const visibleChildrenCount = node.children ? 
            node.children.filter(child => {
              return passesAllFilters(child) || (matchingSet && matchingSet.has(child.lagnname));
            }).length : 0;
          
          return (
            <React.Fragment key={node.lagnname}>
              <div 
                className={`hierarchy-node-container ${isCollapsible ? 'collapsible' : ''}`}
                style={{ marginLeft: `${level * 20}px` }} // Add indentation based on level
              >
                {isCollapsible && visibleChildrenCount > 0 ? (
                  <div 
                    className="hierarchy-collapse-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeExpansion(node.lagnname);
                    }}
                  >
                    {isNodeExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  </div>
                ) : (
                  <div className="hierarchy-collapse-spacer"></div>
                )}
                
                {passesAllFilters(node) && renderUserCard(
                  node, 
                  0, // Set level to 0 for the card as we're using container margins for indentation
                  isCurrentUser(node), // Pass whether this is the current user
                  isMatch,  // Pass if this is a matching node for highlighting
                  false     // Not an upline in regular hierarchy view
                )}
                
                {!passesAllFilters(node) && hasMatchingChildren && (
                  <div className="filtered-parent-marker">
                    <span className="parent-label">{node.clname}: {node.lagnname}</span>
                    <span className="filtered-explanation">(Contains matching members)</span>
                  </div>
                )}
              </div>
              
              {/* Rendering children based on node type */}
              {node.children && node.children.length > 0 && (
                <div className="hierarchy-children-container">
                  {/* Always render immediate RGA/MGA children, regardless of parent's expanded state */}
                  {node.children
                    .filter(child => child.clname === 'RGA' || child.clname === 'MGA')
                    .map(child => renderHierarchyTree([child], level + 1, matchingSet))}
                  
                  {/* Only render non-RGA/MGA children if this node is explicitly expanded */}
                  {isNodeExpanded && 
                   expandedNodes[node.lagnname] === true && // Must be explicitly expanded
                   node.children.filter(child => child.clname !== 'RGA' && child.clname !== 'MGA').length > 0 && (
                    <>
                      {/* Render all non-RGA/MGA children while preserving their order */}
                      {node.children
                        .filter(child => child.clname !== 'RGA' && child.clname !== 'MGA')
                        .map(child => renderHierarchyTree([child], level + 1, matchingSet))}
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  };

  // New function to flatten the hierarchy
  const flattenHierarchy = (nodes) => {
    let flatNodes = [];
    
    const traverse = (node) => {
      flatNodes.push(node);
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse);
      }
    };
    
    nodes.forEach(traverse);
    return flatNodes;
  };

  // New function to render a flat list of filtered nodes
  const renderFlatFilteredNodes = (nodes) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }
    
    // Helper function to determine if a node is the current user
    const isCurrentUser = (node) => {
      return node.lagnname === user?.userId;
    };
    
    // Filter nodes that pass all role and status filters
    const filteredNodes = nodes.filter(node => passesAllFilters(node));
    
    return (
      <div className="admin-flat-filtered-nodes">
        {filteredNodes.map(node => (
          <div key={node.lagnname} className="admin-flat-node">
            {renderUserCard(
              node, 
              0, 
              isCurrentUser(node), // Pass whether this is the current user
              false, // Not a search match
              false  // Not an upline
            )}
          </div>
        ))}
      </div>
    );
  };

  // Function to check if a node passes all filters
  const passesAllFilters = (node) => {
    // First check: Never show users with Active = 'n' regardless of managerActive status
    if (node.Active !== undefined && node.Active !== null && 
        node.Active.toLowerCase() === 'n') {
      return false;
    }
    
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

  // Update renderSearchResults to handle filtered nodes better
  const renderSearchResults = (rgaHierarchy, searchResults) => {
    // If no search results or no matching group for this RGA, return null
    const matchingGroup = searchResults?.matchingRgaGroups?.find(group => group.rgaId === rgaHierarchy.rgaId);
    
    console.log('[renderSearchResults] Looking for matches for RGA ID:', rgaHierarchy.rgaId, 'Name:', rgaHierarchy.rgaName);
    console.log('[renderSearchResults] All matchingRgaGroups:', searchResults?.matchingRgaGroups?.map(g => ({
      rgaId: g.rgaId,
      rgaName: g.rgaName,
      matches: g.matches.map(m => m.lagnname)
    })));
    console.log('[renderSearchResults] Found matchingGroup?', !!matchingGroup);
    
    // If no matches for this RGA, return null
    if (!matchingGroup || !matchingGroup.matches || matchingGroup.matches.length === 0) {
      return null;
    }
    
    // If in isolated mode and we have isolated hierarchies, render them instead
    if (matchingGroup.searchMode === 'isolated' && matchingGroup.isolatedHierarchies) {
      return renderIsolatedSearchResults(matchingGroup);
    }
    
    console.log('[Full Team View] Rendering search results for RGA:', rgaHierarchy.rgaName);
    console.log('[Full Team View] Number of matches:', matchingGroup.matches.length);
    console.log('[Full Team View] Matches:', matchingGroup.matches.map(m => m.lagnname));
    
    // Helper function to determine if a node is the current user
    const isCurrentUser = (node) => {
      return node.lagnname === user?.userId;
    };
    
    // First create a flat map of all nodes for quick lookup
    // Build from flat hierarchyData (not hierarchicalData) to ensure we get everyone
    const nodeMap = {};
    if (rgaHierarchy.hierarchyData) {
      rgaHierarchy.hierarchyData.forEach(node => {
        nodeMap[node.lagnname] = node;
      });
    }
    
    // Also add nodes from ALL other RGA hierarchies to find cross-RGA uplines
    rgaHierarchies.forEach(otherRga => {
      if (otherRga.rgaId !== rgaHierarchy.rgaId && otherRga.hierarchyData) {
        otherRga.hierarchyData.forEach(node => {
          // Only add if not already in map (current RGA takes precedence)
          if (!nodeMap[node.lagnname]) {
            nodeMap[node.lagnname] = node;
          }
        });
      }
    });
    
    // Then create a map of match nodes with their uplines
    const matchNodesWithUplines = matchingGroup.matches.map(match => {
      // Start with the match node
      const result = {
        node: nodeMap[match.lagnname] || match, // Use hierarchical node if available
        uplines: []
      };
      
      // Add all available uplines
      if (match.uplineIds && match.uplineIds.length > 0) {
        // Map uplines and preserve their order from uplineIds (SA, GA, MGA, RGA)
        // Then reverse to show RGA first, then MGA, then GA, then SA
        result.uplines = match.uplineIds
          .map(uplineId => {
            const uplineNode = nodeMap[uplineId];
            if (match.lagnname === 'VALENT MICHAEL B') {
              console.log('[Render Debug] Looking up upline:', uplineId, 'Found:', !!uplineNode, uplineNode?.clname);
            }
            return uplineNode;
          })
          .filter(Boolean) // Filter out any missing nodes
          .reverse(); // Reverse to show RGA, MGA, GA, SA order (most senior first)
        
        if (match.lagnname === 'VALENT MICHAEL B') {
          console.log('[Render Debug] Final uplines array (after reverse):', result.uplines.map(u => u.lagnname));
          console.log('[Render Debug] Full upline details:', result.uplines);
        }
      }
      
      return result;
    });
    
    // Sort the matches by type and then name
    matchNodesWithUplines.sort((a, b) => {
      // First sort by role/class
      const roleOrder = { 'RGA': 1, 'MGA': 2, 'GA': 3, 'SA': 4, 'AGT': 5 };
      const roleA = roleOrder[a.node.clname] || 99;
      const roleB = roleOrder[b.node.clname] || 99;
      
      if (roleA !== roleB) {
        return roleA - roleB;
      }
      
      // Then sort alphabetically by name within same role
      return a.node.lagnname.localeCompare(b.node.lagnname);
    });
    
    // Create a map to track rendered node IDs
    const renderedNodeIds = new Set();
    
    // Pre-compute current user checks for all nodes
    const currentUserMap = {};
    matchNodesWithUplines.forEach(({ node, uplines }) => {
      currentUserMap[node.lagnname] = isCurrentUser(node);
      uplines.forEach(upline => {
        currentUserMap[upline.lagnname] = isCurrentUser(upline);
      });
    });
    
    return (
      <div className="admin-search-results">
        {matchNodesWithUplines.map((matchWithUplines, index) => {
          const { node, uplines } = matchWithUplines;
          
          // Skip if somehow this node was already rendered
          if (renderedNodeIds.has(node.lagnname)) {
            return null;
          }
          
          // Mark this node as rendered
          renderedNodeIds.add(node.lagnname);
          
          // Uplines are already in the correct order (RGA, MGA, GA, SA) from the reverse() above
          // Don't re-sort by clname since both might be 'RGA' but have different relationships
          const sortedUplines = uplines;
          
          if (node.lagnname === 'VALENT MICHAEL B') {
            console.log('[Display Debug] About to render VALENT MICHAEL B');
            console.log('[Display Debug] sortedUplines:', sortedUplines.map(u => u.lagnname));
            console.log('[Display Debug] sortedUplines.length:', sortedUplines.length);
          }
          
          // Don't mark uplines as rendered - they can appear multiple times as uplines for different matches
          
          if (node.lagnname === 'VALENT MICHAEL B') {
            console.log('[JSX Debug] About to render JSX for VALENT MICHAEL B');
            console.log('[JSX Debug] sortedUplines.length > 0?', sortedUplines.length > 0);
            console.log('[JSX Debug] Will render uplines section?', sortedUplines.length > 0);
          }
          
          return (
            <div key={`match-${node.lagnname}-${index}`} className="admin-search-result-item">
              {/* Show uplines first (top-down hierarchy) as standalone cards to avoid nesting/layout issues */}
              {sortedUplines.length > 0 && (
                sortedUplines.map((upline, uplineIndex) => {
                  if (node.lagnname === 'VALENT MICHAEL B') {
                    console.log(`[Map Debug] Rendering upline ${uplineIndex}:`, upline.lagnname, 'Calling renderUserCard with isUpline=true');
                  }
                  const cardResult = renderUserCard(
                    upline,
                    0,
                    currentUserMap[upline.lagnname],
                    false,
                    true
                  );
                  if (node.lagnname === 'VALENT MICHAEL B') {
                    console.log(`[Map Debug] renderUserCard returned for ${upline.lagnname}:`, cardResult ? 'JSX element' : 'null');
                  }
                  return (
                    <div key={`upline-${upline.lagnname}-${uplineIndex}`} className="admin-search-match">
                      {cardResult}
                    </div>
                  );
                })
              )}

              {/* Then show the matched user below their uplines */}
              <div className="admin-search-match">
                {renderUserCard(
                  node,
                  0,
                  currentUserMap[node.lagnname],
                  true,
                  false
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render isolated search results showing isolated hierarchies
  const renderIsolatedSearchResults = (matchingGroup) => {
    if (!matchingGroup.isolatedHierarchies || matchingGroup.isolatedHierarchies.length === 0) {
      return null;
    }

    // Helper function to determine if a node is the current user
    const isCurrentUser = (node) => {
      return node.lagnname === user?.userId;
    };

    return (
      <div className="admin-search-results">
        {matchingGroup.isolatedHierarchies.map((isolatedItem, index) => {
          const { targetUser, isolatedHierarchy } = isolatedItem;

          return (
            <div key={`isolated-${targetUser.lagnname}-${index}`} className="admin-isolated-result">
              <div className="admin-isolated-header">
                <div className="isolated-target-info">
                  <FiUsers size={16} />
                  <span>Isolated hierarchy for: <strong>{targetUser.lagnname}</strong> ({targetUser.clname})</span>
                </div>
              </div>
              
              <div className="admin-isolated-hierarchy">
                {isolatedHierarchy && isolatedHierarchy.length > 0 ? (
                  renderHierarchyTree(isolatedHierarchy, 0, new Set([targetUser.lagnname]))
                ) : (
                  <div className="isolated-empty">
                    <span>No hierarchy data available for {targetUser.lagnname}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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
    
    // Function to recursively search through nodes
    const findUserInNodes = (nodes) => {
      for (const node of nodes) {
        if (node.lagnname === user.userId) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = findUserInNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Search through all RGA hierarchies
    for (const rgaHierarchy of rgaHierarchies) {
      if (rgaHierarchy.hierarchicalData) {
        const found = findUserInNodes(rgaHierarchy.hierarchicalData);
        if (found) return found;
      }
    }
    
    // Also search in flat hierarchy data if hierarchical data is not found
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
      console.error('[AdminHierarchySettings] Error formatting date:', e);
    }
    
    // Return original if parsing fails
    return dateString;
  };

  // Update the renderUserCard function to use formatDateForDisplay for PNP date
  const renderUserCard = (node, level = 0, isCurrentUser = false, isSearchMatch = false, isUpline = false) => {
    if (!node) {
      console.log('[RenderCard Debug] Node is null/undefined, returning null');
      return null;
    }
    
    if (node.lagnname === 'BRATIN JASON' || node.lagnname === 'KOZEJ SPENCER G') {
      console.log(`[RenderCard Debug] Rendering card for ${node.lagnname}, isUpline: ${isUpline}, isSearchMatch: ${isSearchMatch}`);
    }
    
    // Calculate indentation based on level
    const marginLeft = level * 20;
    
    // Get active status for styling
    const isActive = node.managerActive !== undefined && 
                    node.managerActive !== null && 
                    node.managerActive.toLowerCase() === 'y';
    
    // Check pending status (0 or 1)
    const isPending = node.pending === 1 || node.pending === '1';
    
    // Add additional classes for uplines and matches, but only when searching
    const cardClasses = [
      'admin-hierarchy-card',
      !isActive ? 'inactive' : '',
      searchQuery && isSearchMatch ? 'search-match' : '',
      searchQuery && isUpline ? 'search-upline' : '',
      isCurrentUser ? 'hierarchy-card-current' : ''
    ].filter(Boolean).join(' ');
    
    const roleColor = getRoleColor(node.clname);
    const { isF6, isVIPEligible, careerMonths } = calculateCareerStage(node.esid);
    
    return (
      <div 
        className={cardClasses}
        style={{ marginLeft: `${marginLeft}px` }}
        data-role={node.clname}
      >
        <div className="hierarchy-card-header">
          <div className="hierarchy-header-left">
            <div className="hierarchy-user-icon">
              {node.profpic ? (
                <img 
                  src={node.profpic} 
                  alt={`${node.lagnname}'s profile`} 
                  className="hierarchy-profile-image"
                />
              ) : (
                <FiUser size={22} />
              )}
            </div>
            <div className="hierarchy-title">
              {node.lagnname}
              {isCurrentUser && <span className="hierarchy-you-badge">You</span>}
            </div>
          </div>
          <div 
            className="hierarchy-role-badge"
            style={{
              backgroundColor: roleColor.bg,
              borderColor: roleColor.border
            }}
          >
            {node.clname}
          </div>
        </div>
        <div className="hierarchy-card-content">
          <div className="hierarchy-contact">
            <strong>Email:</strong> <a href={`mailto:${node.email}`} className="hierarchy-email">{node.email || '—'}</a>
          </div>
          <div className="hierarchy-contact">
            <strong>Phone:</strong> <a href={`tel:${node.phone}`} className="hierarchy-phone">{formatPhoneNumber(node.phone)}</a>
          </div>
          <div className="hierarchy-contact">
            <strong>Agent #:</strong> <span className="hierarchy-agtnum">{node.agtnum || '—'}</span>
          </div>
          
          {/* PNP data section */}
          {node.pnp_data && node.pnp_data.curr_mo_4mo_rate && (
            <div className="hierarchy-pnp-data">
              {node.pnp_data.curr_mo_4mo_rate && (
                <div className="pnp-stat">
                  <span className="pnp-label">4mo Ret:</span>
                  <span className="pnp-value">{node.pnp_data.curr_mo_4mo_rate}%</span>
                </div>
              )}
              {node.pnp_data.pnp_date && (
                <div className="pnp-date">
                  <span className="pnp-date-label">As of:</span>
                  <span className="pnp-date-value">{formatDateForDisplay(node.pnp_data.pnp_date)}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Status badges */}
          <div className="hierarchy-meta">
            <span className={`hierarchy-status-badge ${node.redeemed === 1 ? 'redeemed' : 'inactive'}`}>
              {node.redeemed === 1 ? 'Redeemed' : 'Not Redeemed'}
            </span>
            
            <span className={`hierarchy-status-badge ${node.released === 1 ? 'released' : 'inactive'}`}>
              {node.released === 1 ? 'Released' : 'Not Released'}
            </span>

            <span 
              className={`hierarchy-status-badge ${isActive ? 'active' : 'inactive'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (toggleLoading !== node.lagnname) {
                  handleToggleActive(node);
                }
              }}
              style={{ cursor: toggleLoading === node.lagnname ? 'wait' : 'pointer' }}
            >
              {toggleLoading === node.lagnname ? (
                <span className="status-loading">Updating...</span>
              ) : (
                isActive ? 'Active' : 'Inactive'
              )}
            </span>
            
            {/* Display RFC tag when pending=1 */}
            {isPending && (
              <span className="hierarchy-status-badge rfc">
                RFC
              </span>
            )}
            
            {/* Only show F6 and VIP tags if not pending */}
            {!isPending && isF6 && (
              <span 
                className="hierarchy-status-badge f6"
                title={`First 6 Months (Month ${careerMonths + 1} of career)`}
              >
                F6
              </span>
            )}
            
            {!isPending && isVIPEligible && (
              <span 
                className="hierarchy-status-badge vip-eligible"
                title={`VIP Eligible (Month ${careerMonths + 1} of career)`}
              >
                VIP Eligible
              </span>
            )}
          </div>
          
          {/* License state badges */}
          {renderLicenseBadges(node)}
        </div>
      </div>
    );
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

  // Scroll to next manager (MGA/GA/SA) card in view
  const scrollToNextManager = useCallback(() => {
    try {
      // Detect scrollable container (match ScrollToTop behavior)
      const detectScrollable = () => {
        const selectors = [
          '.settings-content',
          '.settings-section-large',
          '.settings-section',
          'main',
          'body'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.scrollHeight > el.clientHeight) return el;
        }
        return window;
      };

      const container = detectScrollable();
      const header = document.querySelector('.admin-hierarchy-controls-container') || document.querySelector('.admin-hierarchy-controls');
      const headerHeight = header ? header.offsetHeight : 0;

      // Collect manager elements (tree cards and table rows)
      let managerCards = Array.from(document.querySelectorAll(
        '.admin-hierarchy-card[data-role="RGA"], .admin-hierarchy-card[data-role="MGA"], .admin-hierarchy-card[data-role="GA"], .admin-hierarchy-card[data-role="SA"], .hierarchy-table tbody tr[data-role="RGA"], .hierarchy-table tbody tr[data-role="MGA"], .hierarchy-table tbody tr[data-role="GA"], .hierarchy-table tbody tr[data-role="SA"]'
      ));
      if (!managerCards.length) {
        // Fallback: infer role from Role column text in table (4th column)
        const rows = Array.from(document.querySelectorAll('.hierarchy-table tbody tr'));
        const roleSet = new Set(['RGA','MGA','GA','SA']);
        managerCards = rows.filter(row => {
          const cell = row.querySelector('td:nth-child(4)');
          if (!cell) return false;
          const text = (cell.textContent || '').trim().toUpperCase();
          return roleSet.has(text);
        });
        if (!managerCards.length) return;
      }

      // Helper to compute element top relative to container scroll
      const getElementTop = (el) => {
        const rect = el.getBoundingClientRect();
        if (container === window) {
          return rect.top + (window.pageYOffset || document.documentElement.scrollTop);
        }
        const cRect = container.getBoundingClientRect();
        return rect.top - cRect.top + container.scrollTop;
      };

      const getScrollTop = () => (
        container === window
          ? (window.pageYOffset || document.documentElement.scrollTop)
          : container.scrollTop
      );

      const currentTop = getScrollTop();
      // Use header bottom as the threshold so we always pick a manager below the sticky header
      const threshold = currentTop + headerHeight + 1;

      // Build sorted list of tops
      const tops = managerCards.map(getElementTop);
      // Find the index of the first manager whose top is at/after the header bottom
      const firstIdx = tops.findIndex(top => top >= threshold);
      // Choose the NEXT manager after the first visible one, wrapping to start
      const targetIdx = firstIdx === -1 ? 0 : (firstIdx + 1) % managerCards.length;
      let target = managerCards[targetIdx];

      // Smooth scroll to target
      const targetTop = getElementTop(target) - headerHeight - 8; // account for sticky header + small padding
      if (container === window) {
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    } catch (e) {
      // noop on failure
    }
  }, []);

  // Scroll to previous manager (MGA/GA/SA) above the header
  const scrollToPrevManager = useCallback(() => {
    try {
      const detectScrollable = () => {
        const selectors = [
          '.settings-content',
          '.settings-section-large',
          '.settings-section',
          'main',
          'body'
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.scrollHeight > el.clientHeight) return el;
        }
        return window;
      };

      const container = detectScrollable();
      const header = document.querySelector('.admin-hierarchy-controls-container') || document.querySelector('.admin-hierarchy-controls');
      const headerHeight = header ? header.offsetHeight : 0;

      let managerCards = Array.from(document.querySelectorAll(
        '.admin-hierarchy-card[data-role="RGA"], .admin-hierarchy-card[data-role="MGA"], .admin-hierarchy-card[data-role="GA"], .admin-hierarchy-card[data-role="SA"], .hierarchy-table tbody tr[data-role="RGA"], .hierarchy-table tbody tr[data-role="MGA"], .hierarchy-table tbody tr[data-role="GA"], .hierarchy-table tbody tr[data-role="SA"]'
      ));
      if (!managerCards.length) {
        const rows = Array.from(document.querySelectorAll('.hierarchy-table tbody tr'));
        const roleSet = new Set(['RGA','MGA','GA','SA']);
        managerCards = rows.filter(row => {
          const cell = row.querySelector('td:nth-child(4)');
          if (!cell) return false;
          const text = (cell.textContent || '').trim().toUpperCase();
          return roleSet.has(text);
        });
        if (!managerCards.length) return;
      }

      const getElementTop = (el) => {
        const rect = el.getBoundingClientRect();
        if (container === window) {
          return rect.top + (window.pageYOffset || document.documentElement.scrollTop);
        }
        const cRect = container.getBoundingClientRect();
        return rect.top - cRect.top + container.scrollTop;
      };

      const getScrollTop = () => (
        container === window
          ? (window.pageYOffset || document.documentElement.scrollTop)
          : container.scrollTop
      );

      const currentTop = getScrollTop();
      const threshold = currentTop + headerHeight + 1; // header bottom

      const tops = managerCards.map(getElementTop);
      const firstIdx = tops.findIndex(top => top >= threshold);
      const prevIdx = firstIdx === -1 ? (managerCards.length - 1) : ((firstIdx - 1 + managerCards.length) % managerCards.length);
      const target = managerCards[prevIdx];

      const targetTop = getElementTop(target) - headerHeight - 8;
      if (container === window) {
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    } catch (e) {
      // noop
    }
  }, []);

  // Main render function
  // Show initial loading only for the first render
  if (initialLoading) {
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <span>Loading hierarchy data...</span>
      </div>
    );
  }

  return (
    <div className="settings-section-large">
      
      {error && <div className="settings-alert settings-alert-error">{error}</div>}
      
      {/* Current User Card at Top - Only shown for non-admin users */}
      {!hasPermission('admin') && findCurrentUserData() && (
        <div className="settings-card your-profile-card">
          <h2 className="settings-card-title">Your Profile</h2>
          {renderUserCard(findCurrentUserData(), 0, true)}
          
          {/* Uplines for non-admin users */}
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
      
      <div className="settings-card">
        {/* Controls panel - now centered */}
        <div className="admin-hierarchy-controls-container">
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
                  yesLabel: 'Redeemed',
                  noLabel: 'Not Redeemed'
                },
                {
                  key: 'released',
                  label: 'Released',
                  yesLabel: 'Released',
                  noLabel: 'Not Released'
                },
                {
                  key: 'managerActive',
                  label: 'Active',
                  yesLabel: 'Active',
                  noLabel: 'Inactive'
                },
                {
                  key: 'noProfPic',
                  label: 'Profile Pic',
                  yesLabel: 'No Pic Set',
                  noLabel: 'Pic Set'
                },
                {
                  key: 'pending',
                  label: 'Pending',
                  yesLabel: 'RFC',
                  noLabel: 'Coded'
                }
              ]}
            />
          </div>
          
          <div className="controls-right-section">
            <div className="view-toggle">
              <button 
                className={`view-toggle-button ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setViewMode('tree')}
                title="Tree View"
              >
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="18" cy="18" r="3"></circle>
                  <circle cx="6" cy="6" r="3"></circle>
                  <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
                  <line x1="6" y1="9" x2="6" y2="21"></line>
                </svg>
              </button>
              <button 
                className={`view-toggle-button ${viewMode === 'mga' ? 'active' : ''}`}
                onClick={() => setViewMode('mga')}
                title="MGA Teams View"
              >
                <FiUsers />
              </button>
              
              <button className="admin-toggle-button" onClick={toggleAllRGAs} title={Object.values(expandedRGAs).some(isExpanded => isExpanded) ? "Collapse All" : "Expand All"}>
                {Object.values(expandedRGAs).some(isExpanded => isExpanded) 
                  ? <FiChevronUp /> 
                  : <FiChevronDown />
                }
              </button>
              <button className="admin-scroll-prev-button" onClick={scrollToPrevManager} title="Scroll to previous manager (MGA/GA/SA)">
                Prev Manager
              </button>
              <button className="admin-scroll-next-button" onClick={scrollToNextManager} title="Scroll to next manager (MGA/GA/SA)">
                Next Manager
              </button>
              <button className="admin-export-button" onClick={exportToCSV} title="Export to CSV">
                <FiDownload />
              </button>
            </div>
          </div>
        </div>
        </div>
        
        {/* State filters visibility indicator */}
        {Object.values(activeFilters.states).some(value => value) && (
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
        
        {/* Search Results Status */}
        {searchQuery && searchResults && (
          <div className="search-results-status">
            {searchResults.totalMatches === 0 ? (
              <p>No results found for "{searchQuery}"</p>
            ) : (
              <div>
                <p>Found {searchResults.totalMatches} result(s) for "{searchQuery}" across {searchResults.matchingRgaGroups.length} RGA(s). <span className="search-tip">(Search works with first name, last name, or full name formats)</span></p>
                
                {/* Search Mode Toggle */}
                <div className="search-mode-toggle">
                  <span className="search-mode-label">View:</span>
                  <button 
                    className={`search-mode-button ${searchMode === 'full' ? 'active' : ''}`}
                    onClick={() => {
                      setSearchMode('full');
                      // Re-trigger search with new mode immediately
                      performSearch(searchQuery, 'full');
                    }}
                    title="Show only uplines and downlines"
                  >
                    Isolated
                  </button>
                  <button 
                    className={`search-mode-button ${searchMode === 'isolated' ? 'active' : ''}`}
                    onClick={() => {
                      setSearchMode('isolated');
                      // Re-trigger search with new mode immediately
                      performSearch(searchQuery, 'isolated');
                    }}
                    title="Show full team hierarchy"
                  >
                    Full Team
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Processing stats if still loading data */}
        {(dataLoading || processingStats.inProgress) && (
          <div className="processing-stats">
            <div className="spinner"></div>
            <span>Loading hierarchy data...</span>
          </div>
        )}
        
        {/* Render either tree view or table view based on viewMode */}
        {viewMode === 'tree' ? (
          /* Existing tree view content */
          <div className="admin-hierarchy-container">
            {/* Show skeleton loading when no data yet */}
            {rgaHierarchies.length === 0 && dataLoading && (
              <div className="hierarchy-skeleton">
                <div className="skeleton-rga-section">
                  <div className="skeleton-rga-header">
                    <div className="skeleton-text skeleton-rga-name"></div>
                    <div className="skeleton-badge"></div>
                  </div>
                </div>
                <div className="skeleton-rga-section">
                  <div className="skeleton-rga-header">
                    <div className="skeleton-text skeleton-rga-name"></div>
                    <div className="skeleton-badge"></div>
                  </div>
                </div>
                <div className="skeleton-rga-section">
                  <div className="skeleton-rga-header">
                    <div className="skeleton-text skeleton-rga-name"></div>
                    <div className="skeleton-badge"></div>
                  </div>
                </div>
              </div>
            )}
            {rgaHierarchies.length > 0 ? (
              rgaHierarchies.map((rgaHierarchy, rgaIndex) => {
                // Skip if this hierarchy doesn't have any matching users in search results
                if (searchQuery && searchResults && searchResults.matchingRgaGroups) {
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
                      <div className="admin-hierarchy-tree">
                        {/* Render search results or regular hierarchy */}
                        {searchQuery && searchResults && searchResults.matchingRgaGroups ? (
                          renderSearchResults(rgaHierarchy, searchResults)
                        ) : (
                          // Show the hierarchical tree for this RGA
                          renderHierarchyTree(rgaHierarchy.hierarchicalData)
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="admin-hierarchy-empty">
                <p>No hierarchy data available. {error ? 'Error: ' + error : ''}</p>
              </div>
            )}
          </div>
        ) : (
          /* MGA Teams view */
          <div>
            {dataLoading ? (
              <div className="mga-skeleton">
                <div className="skeleton-text" style={{width: '200px', height: '18px', marginBottom: '15px'}}></div>
                {[1,2,3].map(i => (
                  <div key={i} className="skeleton-mga-row">
                    <div className="skeleton-badge" style={{width: '40px', height: '20px'}}></div>
                    <div className="skeleton-text" style={{width: '150px', height: '16px'}}></div>
                  </div>
                ))}
              </div>
            ) : (
              <HierarchyMGAUtilitiesTable 
                searchQuery={searchQuery}
                rgaHierarchies={rgaHierarchies}
                dataLoading={dataLoading}
                error={error}
                activeFilters={activeFilters}
                allAvailableStates={allAvailableStates}
                passesAllFilters={passesAllFilters}
                searchMode={searchMode}
                searchResults={searchResults}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Add ScrollToTop component with explicit settings */}
      <ScrollToTop 
        showAfterScrollHeight={100}
        position={{ bottom: '30px', right: '30px' }}
        zIndex={9999}
        scrollableContainerSelector=".settings-section"
      />
    </div>
  );
};

export default AdminHierarchySettings; 