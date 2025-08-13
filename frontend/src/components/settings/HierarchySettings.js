import React, { useState, useEffect, useCallback } from 'react';
import { FiChevronRight, FiLoader, FiUser, FiUsers, FiSearch, FiFilter, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { US_STATES } from '../../constants';
import api from '../../api';
import '../../pages/settings/Settings.css';
import FilterMenu from '../common/FilterMenu';

// Hierarchy settings component
const HierarchySettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [hierarchyTree, setHierarchyTree] = useState({ sortedHierarchy: [], sortedInactiveNodes: [] });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
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
    managerActive: null, // null = show both, true = only active, false = only inactive
    pending: null, // null = show both, true = only RFC, false = only not RFC
    // State license filters
    states: {} // Will be populated with state codes from licenses
  });
  const [allAvailableStates, setAllAvailableStates] = useState([]);
  const [toggleLoading, setToggleLoading] = useState(null); // Track which user is being toggled

  // Log user data on mount
  useEffect(() => {
    console.log('[HierarchySettings] Component mounted');
    console.log('[HierarchySettings] User data:', user);
  }, []);

  // Fetch the user hierarchy data
  useEffect(() => {
    fetchUserHierarchy();
  }, [user]);

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    
    // Perform search when we have data and query is not empty
    if (hierarchyData?.data && hierarchyData.data.length > 0) {
      performSearch(query);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  // Toggle role filter
  const toggleFilter = (role) => {
    setActiveFilters(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };
  
  // Toggle status filter (released, redeemed, noProfPic, active)
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
  
  // Clear all filters
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
      managerActive: null,
      pending: null,
      states: stateFilters
    });
  };

  // Perform search on hierarchy data
  const performSearch = (query) => {
    if (!query.trim() || !hierarchyData?.data) {
      setSearchResults(null);
      return;
    }
    
    const searchLower = query.toLowerCase();
    const matchingNodes = [];
    const uplineNodeIds = new Set();
    const allNodesMap = {};
    
    // Create a map of all nodes for quick lookup
    hierarchyData.data.forEach(node => {
      allNodesMap[node.lagnname] = node;
    });
    
    // Find matching nodes
    hierarchyData.data.forEach(node => {
      if (
        (node.lagnname && node.lagnname.toLowerCase().includes(searchLower)) ||
        (node.email && node.email.toLowerCase().includes(searchLower)) ||
        (node.phone && node.phone.toLowerCase().includes(searchLower))
      ) {
        matchingNodes.push(node);
        
        // Find all uplines for this node
        const uplines = findUplineNodes(node, allNodesMap);
        uplines.forEach(upline => uplineNodeIds.add(upline.lagnname));
      }
    });
    
    // Process the results
    if (matchingNodes.length > 0) {
      setSearchResults({
        matches: matchingNodes,
        uplineIds: Array.from(uplineNodeIds)
      });
    } else {
      setSearchResults({ matches: [], uplineIds: [] });
    }
  };
  
  // Find all upline nodes for a given node
  const findUplineNodes = (node, nodeMap) => {
    const uplines = [];
    
    // Check SA
    if (node.sa && nodeMap[node.sa]) {
      uplines.push(nodeMap[node.sa]);
    }
    
    // Check GA
    if (node.ga && nodeMap[node.ga]) {
      uplines.push(nodeMap[node.ga]);
    }
    
    // Check MGA
    if (node.mga && nodeMap[node.mga]) {
      uplines.push(nodeMap[node.mga]);
    }
    
    // Check RGA
    if (node.rga && nodeMap[node.rga]) {
      uplines.push(nodeMap[node.rga]);
    }
    
    return uplines;
  };

  // Build hierarchical tree structure from flat data
  const buildHierarchy = (data) => {
    console.log('[HierarchySettings] Building hierarchy from data:', data);
    const hierarchy = [];
    const map = {};
    
    // Initialize map with each item
    data.forEach(item => {
      // Ensure licenses data is available for each node
      map[item.lagnname] = { 
        ...item, 
        userId: item.lagnname, // Preserve for backward compatibility
        licenses: item.licenses || [], // Licenses now come directly from API
        children: [] 
      };
    });

    // Find RGA/MGA for reference
    let rgaName = '';
    data.forEach(item => {
      if (item.clname === 'RGA' || (item.clname === 'MGA' && !rgaName)) {
        rgaName = item.lagnname;
      }
    });

    console.log('[HierarchySettings] Found RGA/MGA:', rgaName);
    
    // Collect all unique states from licenses for state filtering
    const uniqueStates = new Set();
    data.forEach(item => {
      if (item.licenses && Array.isArray(item.licenses)) {
        item.licenses.forEach(license => {
          if (license.state) {
            uniqueStates.add(license.state);
          }
        });
      }
    });
    
    // Update available states for filtering - sorted alphabetically
    const statesList = Array.from(uniqueStates).sort();
    setAllAvailableStates(statesList);
    
    // Initialize state filters if not already set
    setActiveFilters(prev => {
      const currentStateFilters = prev.states || {};
      const updatedStateFilters = {};
      
      // If we have new states, set them to false (not filtered)
      statesList.forEach(state => {
        // Preserve existing state filters or initialize to false
        updatedStateFilters[state] = currentStateFilters[state] !== undefined 
          ? currentStateFilters[state] 
          : false;
      });
      
      return {
        ...prev,
        states: updatedStateFilters
      };
    });
    
    console.log('[HierarchySettings] Found unique states for filtering:', statesList);

    // Group children under their respective parents based on hierarchy rules
    data.forEach(item => {
      // Add to the hierarchy based on relationships
      let added = false;

      // First level: RGA or MGA
      if (item.clname === 'RGA' || item.clname === 'MGA') {
        hierarchy.push(map[item.lagnname]);
        added = true;
      }
      // Second level: AGT with mga = RGA's name, but no sa or ga
      else if (item.clname === 'AGT' && item.mga === rgaName && !item.sa && !item.ga) {
        if (map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
          added = true;
        }
      }
      // Third level: SA with no ga
      else if (item.clname === 'SA' && !item.ga) {
        if (map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
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
      // Fifth level: GA with mga = RGA's name
      else if (item.clname === 'GA' && item.mga === rgaName) {
        if (map[item.mga]) {
          map[item.mga].children.push(map[item.lagnname]);
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

    // Log the hierarchy for debugging
    console.log('[HierarchySettings] Hierarchy before sorting:', hierarchy);

    // Custom sort function for hierarchy levels
    const sortHierarchy = (nodes) => {
      return nodes.sort((a, b) => {
        // Active nodes come before inactive ones
        if (a.managerActive === 'y' && b.managerActive !== 'y') return -1;
        if (a.managerActive !== 'y' && b.managerActive === 'y') return 1;
        
        // Special case: AGT with no sa and ga comes first, above any other role
        if (a.clname === 'AGT' && !a.sa && !a.ga) return -1;
        if (b.clname === 'AGT' && !b.sa && !b.ga) return 1;
        
        // Then sort by clname according to the hierarchy
        const roleOrder = { 'RGA': 0, 'MGA': 1, 'GA': 2, 'SA': 3, 'AGT': 4 };
        const orderA = roleOrder[a.clname] !== undefined ? roleOrder[a.clname] : 99;
        const orderB = roleOrder[b.clname] !== undefined ? roleOrder[b.clname] : 99;
        
        if (orderA !== orderB) return orderA - orderB;
        
        // For AGTs with connections, prioritize by connection type
        if (a.clname === 'AGT' && b.clname === 'AGT') {
          // AGT with only SA comes next
          if (a.sa && !a.ga && (!b.sa || b.ga)) return -1;
          if (b.sa && !b.ga && (!a.sa || a.ga)) return 1;
          
          // AGT with only GA comes next
          if (!a.sa && a.ga && (b.sa || !b.ga)) return -1;
          if (!b.sa && b.ga && (a.sa || !a.ga)) return 1;
          
          // AGT with both SA and GA comes last
          if (a.sa && a.ga && !(b.sa && b.ga)) return 1;
          if (b.sa && b.ga && !(a.sa && a.ga)) return -1;
        }
        
        // For SAs, prioritize those with no GA
        if (a.clname === 'SA' && b.clname === 'SA') {
          if (!a.ga && b.ga) return -1;
          if (!b.ga && a.ga) return 1;
        }
        
        // Sort alphabetically by name as a final tiebreaker
        return a.lagnname.localeCompare(b.lagnname);
      }).map(node => {
        // Sort children recursively
        node.children = sortHierarchy(node.children);
        return node;
      });
    };

    const sortedHierarchy = sortHierarchy(hierarchy);
    console.log('[HierarchySettings] Final sorted hierarchy with license data:', 
      sortedHierarchy.map(node => ({
        name: node.lagnname,
        userId: node.userId,
        licenseCount: node.licenses ? node.licenses.length : 0,
        childCount: node.children.length
      }))
    );

    return { sortedHierarchy, sortedInactiveNodes: [] };
  };

  // Format email address for display
  const formatEmail = (email) => {
    if (!email) return '—';
    
    // Format email as a mailto link
    return email;
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
      console.error('[HierarchySettings] Error formatting date:', e);
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
        console.warn(`[HierarchySettings] Invalid ESID date format: ${esid}`);
        return { isF6: false, isVIPEligible: false, careerMonths: null };
      }

      // Get current date
      const currentDate = new Date();
      
      // Calculate complete months difference
      const yearDiff = currentDate.getFullYear() - esidDate.getFullYear();
      const monthDiff = currentDate.getMonth() - esidDate.getMonth();
      const totalMonthsDiff = (yearDiff * 12) + monthDiff;
      
      console.log(`[HierarchySettings] Career months for ESID ${esid}: ${totalMonthsDiff} months`);
      
      // F6: First 6 months (months 0-5)
      const isF6 = totalMonthsDiff < 6;
      
      // VIP Eligible: Months 2-4 (months 1-3 in zero-based)
      const isVIPEligible = totalMonthsDiff >= 1 && totalMonthsDiff <= 3;
      
      return { isF6, isVIPEligible, careerMonths: totalMonthsDiff };
    } catch (error) {
      console.error(`[HierarchySettings] Error calculating career stage for ESID ${esid}:`, error);
      return { isF6: false, isVIPEligible: false, careerMonths: null };
    }
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

  // Render license state badges for a user node
  const renderLicenseBadges = (node) => {
    if (!node || !node.licenses || node.licenses.length === 0) {
      return null;
    }
    
    console.log(`[HierarchySettings] Rendering license badges for user ${node.lagnname}. Found ${node.licenses.length} licenses.`);
    
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

  // Render a single user card with their information
  const renderUserCard = (node, level = 0, isCurrentUser = false, isUpline = false) => {
    if (!node) {
      console.log('[HierarchySettings] Attempted to render card with null node');
      return null;
    }
    
    // Log node data for debugging
    if (isCurrentUser) {
      console.log('[HierarchySettings] Current user node data:', node);
      console.log('[HierarchySettings] License data for current user:', node.licenses);
    }
    
    // Correctly check redeemed and released states (properly handling 0 values)
    const isRedeemed = node.redeemed !== undefined && 
                        node.redeemed !== null && 
                        parseInt(node.redeemed) === 1;
                        
    const isReleased = node.released !== undefined && 
                        node.released !== null && 
                        parseInt(node.released) === 1;
                        
    const isActive = node.managerActive !== undefined && 
                     node.managerActive !== null && 
                     node.managerActive.toLowerCase() === 'y';
    
    // Check pending status (0 or 1)
    const isPending = node.pending === 1;
                        
    const hasNoProfPic = !node.profpic;
    
    // Calculate career stage based on ESID
    const { isF6, isVIPEligible, careerMonths } = calculateCareerStage(node.esid);
    
    // Check if filtered out by role - always apply role filters
    if (!activeFilters[node.clname]) {
      return null;
    }
    
    // Check if filtered out by state licenses
    const hasActiveStateFilters = Object.values(activeFilters.states).some(value => value === true);
    
    if (hasActiveStateFilters) {
      // If user has no licenses or if none of their licenses match the active state filters
      if (!node.licenses || !Array.isArray(node.licenses) || node.licenses.length === 0) {
        // Hide this node if any state filter is active
        return null;
      }
      
      const userHasFilteredState = node.licenses.some(license => 
        license.state && activeFilters.states[license.state]
      );
      
      if (!userHasFilteredState) {
        return null;
      }
    }
    
    // Determine if this node should be faded due to status filters
    let shouldBeFaded = false;
    
    // For the status filters, check if this node should be shown faded
    // Only fade MGA nodes if they don't match the status filters
    const isMGA = node.clname === 'MGA';
    const isKeyNode = isMGA;
    
    // Check if node matches the status filters
    let matchesStatusFilters = true;
    
    if (activeFilters.released !== null && activeFilters.released !== isReleased) {
      matchesStatusFilters = false;
    }
    
    if (activeFilters.redeemed !== null && activeFilters.redeemed !== isRedeemed) {
      matchesStatusFilters = false;
    }
    
    if (activeFilters.noProfPic !== null && activeFilters.noProfPic !== hasNoProfPic) {
      matchesStatusFilters = false;
    }
    
    if (activeFilters.managerActive !== null && activeFilters.managerActive !== isActive) {
      matchesStatusFilters = false;
    }
    
    if (activeFilters.pending !== null && activeFilters.pending !== isPending) {
      matchesStatusFilters = false;
    }
    
    // If this is a key node (MGA) but doesn't match filters, show it faded
    if (isKeyNode && !matchesStatusFilters) {
      shouldBeFaded = true;
    }
    // If not a key node and doesn't match filters, hide it
    else if (!isKeyNode && !matchesStatusFilters) {
      return null;
    }
    
    // Always show inactive users as faded
    if (!isActive) {
      shouldBeFaded = true;
    }
    
    const roleColor = getRoleColor(node.clname);
    const marginLeft = level * 20; // Indent based on hierarchy level
    
    // Check if PNP data is available
    const hasPnpData = node.pnp_data && (node.pnp_data.curr_mo_4mo_rate || node.pnp_data.proj_plus_1);
    
    return (
      <div 
        className={`hierarchy-card ${isCurrentUser ? 'hierarchy-card-current' : ''} ${isUpline ? 'hierarchy-card-upline' : ''} ${shouldBeFaded ? 'hierarchy-card-faded' : ''}`}
        style={{ marginLeft: `${marginLeft}px` }}
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
            <strong>Email:</strong> <a href={`mailto:${node.email}`} className="hierarchy-email">{formatEmail(node.email)}</a>
          </div>
          <div className="hierarchy-contact">
            <strong>Phone:</strong> <a href={`tel:${node.phone}`} className="hierarchy-phone">{formatPhoneNumber(node.phone)}</a>
          </div>
          
          {/* PNP data section */}
          {hasPnpData && (
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
            {/* Always show redeemed badge, greyed out if value is 0 */}
            <span className={`hierarchy-status-badge ${isRedeemed ? 'redeemed' : 'inactive'}`}>
              {isRedeemed ? 'Redeemed' : 'Not Redeemed'}
            </span>
            
            {/* Always show released badge, greyed out if value is 0 */}
            <span className={`hierarchy-status-badge ${isReleased ? 'released' : 'inactive'}`}>
              {isReleased ? 'Released' : 'Not Released'}
            </span>

            {/* Add Active status badge */}
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
            
            {/* F6 Badge - Shown for agents in their first 6 months, but not when pending=1 */}
            {!isPending && isF6 && (
              <span 
                className="hierarchy-status-badge f6"
                title={`First 6 Months (Month ${careerMonths + 1} of career)`}
              >
                F6
              </span>
            )}
            
            {/* VIP Eligible Badge - Shown for agents in their 2nd-4th month, but not when pending=1 */}
            {!isPending && isVIPEligible && (
              <span 
                className="hierarchy-status-badge vip-eligible"
                title={`VIP Eligible (Month ${careerMonths + 1} of career)`}
              >
                VIP Eligible
              </span>
            )}
          </div>
          
          {/* License state badges - now using licenses directly from the node */}
          {renderLicenseBadges(node)}
        </div>
      </div>
    );
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
      console.error('[HierarchySettings] Error formatting date:', e);
    }
    
    // Return original if parsing fails
    return dateString;
  };

  // Recursively render hierarchy tree
  const renderHierarchyTree = (nodes, level = 0) => {
    if (!nodes || nodes.length === 0) {
      return null;
    }

    const isCurrentUser = (node) => {
      return hierarchyData && hierarchyData.agnName === node.lagnname;
    };

    const isUpline = (node) => {
      return searchResults && searchResults.uplineIds && searchResults.uplineIds.includes(node.lagnname);
    };

    // When doing a search, filter nodes to only show matches and their uplines
    let filteredNodes = nodes;
    if (searchResults) {
      filteredNodes = nodes.filter(node => {
        // Include if it's a direct match
        const isMatch = searchResults.matches.some(match => match.lagnname === node.lagnname);
        
        // Or include if it's an upline of a match
        const isNodeUpline = searchResults.uplineIds.includes(node.lagnname);
        
        return isMatch || isNodeUpline;
      });
    }
    
    // Further filter by role if filters are active
    filteredNodes = filteredNodes.filter(node => activeFilters[node.clname]);
    
    if (filteredNodes.length === 0) {
      return null;
    }
    
    return (
      <div className="hierarchy-tree">
        {filteredNodes.map((node) => (
          <React.Fragment key={node.id || node.lagnname}>
            {renderUserCard(node, level, isCurrentUser(node), isUpline(node))}
            {node.children && node.children.length > 0 && (
              <div className="hierarchy-children">
                {renderHierarchyTree(node.children, level + 1)}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Find current user data
  const findCurrentUserData = () => {
    if (!hierarchyData || !hierarchyData.agnName || !hierarchyTree.sortedHierarchy) {
      return null;
    }
    
    const findUserInNodes = (nodes) => {
      for (const node of nodes) {
        if (node.lagnname === hierarchyData.agnName) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = findUserInNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findUserInNodes(hierarchyTree.sortedHierarchy);
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

  // Handle toggle active
  const handleToggleActive = async (node) => {
    if (!node || !node.lagnname || node.managerActive === undefined) {
      console.error('[HierarchySettings] Invalid node or missing managerActive');
      return;
    }

    try {
      setToggleLoading(node.lagnname);
      
      // Store the new status (opposite of current)
      const newStatus = node.managerActive && node.managerActive.toLowerCase() === 'y' ? 'n' : 'y';
      
      console.log('[HierarchySettings] Making API request to /auth/toggleActive');
      const response = await api.post('/auth/toggleActive', {
        userId: node.lagnname,
        currentStatus: node.managerActive
      });

      console.log('[HierarchySettings] API response received:', response);

      if (response.data.success) {
        console.log('[HierarchySettings] Active status toggled successfully');
        
        // Update local data instead of refetching everything
        
        // 1. Update the node in hierarchyData
        if (hierarchyData && hierarchyData.data) {
          const updatedData = hierarchyData.data.map(item => {
            if (item.lagnname === node.lagnname) {
              return { ...item, managerActive: newStatus };
            }
            return item;
          });
          
          setHierarchyData(prev => ({
            ...prev,
            data: updatedData
          }));
        }
        
        // 2. Helper function to update nodes in the tree recursively
        const updateNodeInTree = (nodes) => {
          return nodes.map(treeNode => {
            // Update this node if it matches
            if (treeNode.lagnname === node.lagnname) {
              return { ...treeNode, managerActive: newStatus };
            }
            
            // Recursively update children
            if (treeNode.children && treeNode.children.length > 0) {
              return {
                ...treeNode,
                children: updateNodeInTree(treeNode.children)
              };
            }
            
            return treeNode;
          });
        };
        
        // 3. Update the hierarchy tree state
        setHierarchyTree(prev => {
          const updatedHierarchy = updateNodeInTree(prev.sortedHierarchy);
          return {
            ...prev,
            sortedHierarchy: updatedHierarchy
          };
        });
        
        // Show a success message or toast notification if needed
      } else {
        console.error('[HierarchySettings] API returned error:', response.data.message);
        setError(response.data.message || 'Failed to toggle active status');
      }
    } catch (err) {
      console.error('[HierarchySettings] Error toggling active status:', err);
      console.error('[HierarchySettings] Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data
      });
      setError(`An error occurred while toggling active status: ${err.message}`);
    } finally {
      console.log('[HierarchySettings] Toggle complete, setting loading to false');
      setToggleLoading(null);
    }
  };

  // Separate function to fetch hierarchy data (so it can be called from multiple places)
  const fetchUserHierarchy = async () => {
    if (!user || !user.userId) {
      console.error('[HierarchySettings] No user or user.userId available:', user);
      setLoading(false);
      setError('User information is not available. Please try logging in again.');
      return;
    }
    
    console.log('[HierarchySettings] Starting data fetch for user ID:', user.userId);
    setLoading(true);
    setError('');
    
    try {
      console.log('[HierarchySettings] Making API request to /auth/searchByUserId');
      // Use the searchByUserId endpoint to get hierarchy information with licenses included
      const response = await api.post('/auth/searchByUserId', {
        userId: user.userId
      });
      
      console.log('[HierarchySettings] API response received. Has licenses data:', 
        response.data?.data?.some(user => user.licenses && user.licenses.length > 0));
      
      if (response.data.success) {
        // Log a sample of user data to verify licenses are included
        if (response.data.data && response.data.data.length > 0) {
          const sampleUser = response.data.data[0];
          console.log('[HierarchySettings] Sample user data:', {
            name: sampleUser.lagnname,
            hasLicenseData: Array.isArray(sampleUser.licenses),
            licenseCount: sampleUser.licenses ? sampleUser.licenses.length : 0
          });
        }
        
        setHierarchyData(response.data);
        
        // Build the hierarchy tree
        if (response.data.data && response.data.data.length > 0) {
          const tree = buildHierarchy(response.data.data);
          setHierarchyTree(tree);
          console.log('[HierarchySettings] Built hierarchy tree successfully');
        }
      } else {
        console.error('[HierarchySettings] API returned error:', response.data.message);
        setError(response.data.message || 'Failed to load hierarchy data');
      }
    } catch (err) {
      console.error('[HierarchySettings] Error fetching hierarchy data:', err);
      console.error('[HierarchySettings] Error details:', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data
      });
      setError(`An error occurred while fetching hierarchy data: ${err.message}`);
    } finally {
      console.log('[HierarchySettings] Fetch complete, setting loading to false');
      setLoading(false);
    }
  };

  console.log('[HierarchySettings] Render - Loading state:', loading);
  console.log('[HierarchySettings] Render - Error state:', error);
  console.log('[HierarchySettings] Render - Data state:', hierarchyData ? 'Has data' : 'No data');

  if (loading) {
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <span>Loading hierarchy data...</span>
      </div>
    );
  }

  // Get current user data for top card
  const currentUserData = findCurrentUserData();

  return (
    <div className="settings-section">
      <h1 className="settings-section-title">Hierarchy</h1>
      
      {error && <div className="settings-alert settings-alert-error">{error}</div>}
      
      {/* Current User Card at Top */}
      {currentUserData && (
        <div className="settings-card your-profile-card">
          <h2 className="settings-card-title">Your Profile</h2>
          <div className="hierarchy-top-profile">
            {renderUserCard(currentUserData, 0, true)}
          </div>
        </div>
      )}
      
      {/* Uplines Table */}
      {currentUserData && (
        <div className="settings-card">
          <h2 className="settings-card-title">Uplines</h2>
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
                {currentUserData.clname === "AGT" && (
                  <>
                    <tr>
                      <th style={{ backgroundColor: "rgb(178, 82, 113)" }}>SA</th>
                      <td>{currentUserData.sa ? formatName(currentUserData.sa) : "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: "rgb(237, 114, 47)" }}>GA</th>
                      <td>{currentUserData.ga ? formatName(currentUserData.ga) : "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: "rgb(104, 182, 117)" }}>MGA</th>
                      <td>{currentUserData.mga ? formatName(currentUserData.mga) : "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                      <td>{currentUserData.rga ? formatName(currentUserData.rga) : "—"}</td>
                    </tr>
                  </>
                )}
                {currentUserData.clname === "SA" && (
                  <>
                    <tr>
                      <th style={{ backgroundColor: "rgb(237, 114, 47)" }}>GA</th>
                      <td>{currentUserData.ga ? formatName(currentUserData.ga) : "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: "rgb(104, 182, 117)" }}>MGA</th>
                      <td>{currentUserData.mga ? formatName(currentUserData.mga) : "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                      <td>{currentUserData.rga ? formatName(currentUserData.rga) : "—"}</td>
                    </tr>
                  </>
                )}
                {currentUserData.clname === "GA" && (
                  <>
                    <tr>
                      <th style={{ backgroundColor: "rgb(104, 182, 117)" }}>MGA</th>
                      <td>{currentUserData.mga ? formatName(currentUserData.mga) : "—"}</td>
                    </tr>
                    <tr>
                      <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                      <td>{currentUserData.rga ? formatName(currentUserData.rga) : "—"}</td>
                    </tr>
                  </>
                )}
                {currentUserData.clname === "MGA" && (
                  <>
                    <tr>
                      <th style={{ backgroundColor: "#00558c" }}>RGA</th>
                      <td>{currentUserData.rga ? formatName(currentUserData.rga) : "—"}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="settings-card">
        <h2 className="settings-card-title">Downlines</h2>

        
        {/* Search and Filter Controls */}
        <div className="hierarchy-controls">
          <div className="controls-left-section">
            <div className="hierarchy-search">
              <div className="search-input-wrapper">
                <FiSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
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
            {searchResults.matches.length === 0 ? (
              <p>No results found for "{searchQuery}"</p>
            ) : (
              <p>Found {searchResults.matches.length} result(s) for "{searchQuery}"</p>
            )}
          </div>
        )}
        
        {/* Active Hierarchy */}
        {hierarchyTree.sortedHierarchy.length > 0 ? (
          <div className="hierarchy-active">
            {renderHierarchyTree(hierarchyTree.sortedHierarchy)}
          </div>
        ) : (
          <p className="hierarchy-empty">No hierarchy data available</p>
        )}
      </div>
    </div>
  );
};

export default HierarchySettings; 