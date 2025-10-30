import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import Card from "../../components/utils/Card";
import DataTable from "../../components/utils/DataTable";
import ImportModal from "../../components/utils/ImportModal";
import MassReassignMenu from "../../components/utils/MassReassignMenu";
import FilterMenu from "../../components/common/FilterMenu";
import globeBg from "../../img/globe_bg_watermark.png";
import api from "../../api";
import { AuthContext } from "../../context/AuthContext";
import { useUserHierarchy } from "../../hooks/useUserHierarchy";
import { FiCalendar, FiFilter, FiSearch } from 'react-icons/fi';
import RefDetails from "../../components/utils/RefDetails";
import { US_STATES } from "../../constants/usStates";
import { debounce } from 'lodash';
import "../../components/production/ProductionReports.css";

const RefsPage = () => {
  const [tableData, setTableData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [archivedView, setArchivedView] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showMassReassignMenu, setShowMassReassignMenu] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detailsData, setDetailsData] = useState(null);
  const { user } = useContext(AuthContext);
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  
  // Determine if user can see all refs (Admin or SGA)
  const canSeeAllRefs = useMemo(() => {
    return user?.Role === 'Admin' || user?.clname === 'SGA';
  }, [user?.Role, user?.clname]);
  
  // Determine if user is an AGT (should only see their own refs)
  const isAgent = useMemo(() => {
    return user?.clname === 'AGT';
  }, [user?.clname]);
  
  // Determine if user has hierarchy-based access (SA, GA, MGA, RGA)
  const hasHierarchyAccess = useMemo(() => {
    const clname = (user?.clname || '').toUpperCase();
    return ['SA', 'GA', 'MGA', 'RGA'].includes(clname);
  }, [user?.clname]);
  
  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (canSeeAllRefs) return []; // Admin/SGA see all data
    if (isAgent) return []; // AGT users don't use hierarchy, they use direct filtering
    if (hasHierarchyAccess) {
      const ids = getHierarchyForComponent('ids');
      // Include the user's own ID in the hierarchy
      const userId = user?.userId || user?.id;
      if (userId && !ids.includes(userId)) {
        return [...ids, userId];
      }
      return ids;
    }
    return getHierarchyForComponent('ids');
  }, [canSeeAllRefs, isAgent, hasHierarchyAccess, getHierarchyForComponent, user?.userId, user?.id]);
  
  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);
  
  // Filter state - flattened structure for FilterMenu compatibility
  const [activeFilters, setActiveFilters] = useState({
    // Time Period filters (based on date_created)
    age: null, // null = show all, 'thisMonth' = this month, 'lastMonth' = last month, '6months' = 6 months, 'ytd' = year to date, 'allTime' = all time
    // Scheduled filters
    scheduled: null, // null = show all, true = scheduled only, false = unscheduled only
    // Type and state filters will be added dynamically as flat properties
    // e.g. "Personal Ref": true, "CSK": false, "AL": true, "CA": false
  });
  const [allAvailableTypes, setAllAvailableTypes] = useState([]);
  const [allAvailableStates, setAllAvailableStates] = useState([]);
  
  // Search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      // Only initialize if user is available and has ID
      if (!user || (!user.userId && !user.id)) {
        console.warn("User not loaded yet, skipping refs initialization");
        setIsLoading(false);
        return;
      }

      // For hierarchy-based users (SA/GA/MGA/RGA), wait for hierarchy data
      // But only if hierarchy is still loading - don't wait forever
      if (hasHierarchyAccess && hierarchyLoading) {
        console.warn("Hierarchy-based user waiting for hierarchy data");
        return;
      }
      
      // If hierarchy finished loading but we still have no data, proceed anyway with empty allowedIds
      if (hasHierarchyAccess && !hierarchyData && !hierarchyLoading) {
        console.warn("Hierarchy data failed to load, proceeding with empty hierarchy");
      }
      
      setIsLoading(true);
      try {
        await Promise.all([fetchUsers(), fetchRefs()]);
      } catch (error) {
        console.error("Error loading refs data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivedView, user?.userId, canSeeAllRefs, isAgent, hasHierarchyAccess, hierarchyLoading]);

  const fetchRefs = async () => {
    try {
      // Get the user ID - handle different possible field names
      const userId = user?.userId || user?.id;
      if (!userId) {
        console.error("No user ID found in user object:", user);
        return;
      }

      let response;

      if (canSeeAllRefs) {
        // Admin or SGA users see all refs
        response = await api.get('/refs', {
        params: {
            archive: archivedView ? 1 : 0
          }
        });
      } else if (isAgent) {
        // AGT users only see refs they are assigned to or created
        response = await api.get('/refs', {
          params: {
            archive: archivedView ? 1 : 0
          }
        });

        // Filter to only refs where user is assigned_to or created_by
        response.data = response.data.filter(ref => {
          const assignedToId = ref.assigned_to;
          const createdById = ref.created_by;
          
          return String(assignedToId) === String(userId) || String(createdById) === String(userId);
        });
      } else if (hasHierarchyAccess) {
        // SA, GA, MGA, RGA users: see refs for anyone in their hierarchy
        response = await api.get('/refs', {
          params: {
            archive: archivedView ? 1 : 0
          }
        });

        // Apply hierarchy filtering - filter by assigned_to or created_by being in allowedIdsSet
        response.data = response.data.filter(ref => {
          const assignedToId = ref.assigned_to;
          const createdById = ref.created_by;
          
          // Show ref if anyone in hierarchy is assigned to it or created it
          return (assignedToId && allowedIdsSet.has(String(assignedToId))) ||
                 (createdById && allowedIdsSet.has(String(createdById)));
        });
      } else {
        // Fallback: get all refs but filter by hierarchy (legacy behavior)
        response = await api.get('/refs', {
          params: {
            archive: archivedView ? 1 : 0
          }
        });

        // Apply hierarchy filtering - filter by assigned_to or created_by being in allowedIdsSet
        response.data = response.data.filter(ref => {
          const assignedToId = ref.assigned_to;
          const createdById = ref.created_by;
          
          return (assignedToId && allowedIdsSet.has(String(assignedToId))) ||
                 (createdById && allowedIdsSet.has(String(createdById)));
        });
      }

      // Check and update overdue scheduled appointments
      const updatedData = await checkAndUpdateOverdueScheduled(response.data);
      
      // Backend now returns assigned_to_display and created_by_display directly
      setTableData(updatedData);
      
      // Extract unique types and statuses for filtering
      extractUniqueFilters(updatedData);
    } catch (error) {
      console.error("Error fetching refs:", error);
      // Silently handle errors
    }
  };

  const fetchUsers = async () => {
    try {
      // Get the user ID - handle different possible field names
      const userId = user?.userId || user?.id;
      if (!userId) {
        console.error("No user ID found in user object:", user);
        return;
      }

      let response;

      if (canSeeAllRefs) {
        // Admin or SGA users see all active users
        response = await api.get('/auth/activeusers', {
        params: {
            active: 'y',
            managerActive: 'y'
          }
        });
      } else {
        // Other users: get all active users but filter by hierarchy
        response = await api.get('/auth/activeusers', {
          params: {
          active: 'y',
          managerActive: 'y'
        }
      });

        // Apply hierarchy filtering - only show users in allowed hierarchy
        response.data = response.data.filter(user => 
          allowedIdsSet.has(String(user.id))
        );
      }
      
      // Transform the data to use lagnname for display but ID for value
      // and sort alphabetically by lagnname
      const transformedUsers = response.data
        .map(user => ({
          id: user.id, // Using the actual user ID as the value
          first_name: user.lagnname, // Using lagnname for display
          last_name: '' // Not needed since we're only using lagnname
        }))
        .sort((a, b) => a.first_name.localeCompare(b.first_name)); // Sort alphabetically by lagnname
      
      setUsers(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      // Silently handle errors
    }
  };

  // Debounced search to improve performance
  const debouncedSetSearch = useMemo(
    () => debounce((searchValue) => {
      setDebouncedSearchTerm(searchValue);
      setIsSearching(false);
    }, 150),
    []
  );

  // Update debounced search when searchTerm changes
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    }
    debouncedSetSearch(searchTerm);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchTerm, debouncedSearchTerm, debouncedSetSearch]);

  // Handle search input changes with immediate visual feedback
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Check and update refs with scheduled appointments that are 5+ hours overdue
  const checkAndUpdateOverdueScheduled = async (refsData) => {
    const now = new Date();
    const overdueRefs = [];
    const updatedData = [...refsData];

    refsData.forEach((ref, index) => {
      if (ref.scheduled && ref.status !== 'No Show') {
        try {
          // Parse the scheduled date - handle different formats
          let scheduledDate;
          
          if (typeof ref.scheduled === 'string') {
            // Handle MM/DD/YY HH:MM AM/PM format
            if (ref.scheduled.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
              // Convert MM/DD/YY to MM/DD/20YY for proper parsing
              const [datePart, timePart, period] = ref.scheduled.split(' ');
              const [month, day, year] = datePart.split('/');
              const fullYear = '20' + year;
              const fullDateString = `${month}/${day}/${fullYear} ${timePart} ${period}`;
              scheduledDate = new Date(fullDateString);
            } else {
              // Try standard date parsing
              scheduledDate = new Date(ref.scheduled);
            }
          } else {
            scheduledDate = new Date(ref.scheduled);
          }

          // Check if the scheduled date is valid and more than 5 hours in the past
          if (!isNaN(scheduledDate.getTime())) {
            const hoursOverdue = (now - scheduledDate) / (1000 * 60 * 60);
            
            if (hoursOverdue > 5) {
              console.log(`Ref ${ref.id} is ${hoursOverdue.toFixed(1)} hours overdue, updating to No Show`);
              overdueRefs.push(ref.id);
              updatedData[index] = { ...ref, status: 'No Show' };
            }
          }
        } catch (error) {
          console.error(`Error parsing scheduled date for ref ${ref.id}:`, error);
        }
      }
    });

    // Update overdue refs in the database
    if (overdueRefs.length > 0) {
      try {
        console.log(`Updating ${overdueRefs.length} overdue refs to No Show status`);
        const updatePromises = overdueRefs.map(id =>
          api.put(`/refs/${id}`, { status: 'No Show' })
        );
        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Error updating overdue refs:', error);
      }
    }

    return updatedData;
  };

  // Extract unique types and states from refs data
  const extractUniqueFilters = (data) => {
    const types = new Set();
    const states = new Set();
    
    data.forEach(ref => {
      if (ref.type) types.add(ref.type);
      if (ref.resstate) states.add(ref.resstate);
    });
    
    const typesArray = Array.from(types).sort();
    const statesArray = Array.from(states).sort();
    
    setAllAvailableTypes(typesArray);
    setAllAvailableStates(statesArray);
    
    // Initialize filter states - flattened structure
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      
      // Add type filters as flat properties (only set to true if they don't already exist)
      typesArray.forEach(type => {
        if (newFilters[type] === undefined) {
          newFilters[type] = true; // Show new types by default
        }
      });
      
      // Add state filters as flat properties (only set to true if they don't already exist)  
      statesArray.forEach(state => {
        if (newFilters[state] === undefined) {
          newFilters[state] = true; // Show new states by default
        }
      });
      
      return newFilters;
    });
  };

  // Check if a ref passes all active filters
  const passesAllFilters = (ref) => {
    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch = 
        ref.name?.toLowerCase().includes(searchLower) ||
        ref.phone?.toLowerCase().includes(searchLower) ||
        ref.email?.toLowerCase().includes(searchLower) ||
        ref.type?.toLowerCase().includes(searchLower) ||
        ref.resstate?.toLowerCase().includes(searchLower) ||
        ref.assigned_to_display?.toLowerCase().includes(searchLower) ||
        ref.created_by_display?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) {
        return false;
      }
    }
    
    // Type filters - now flattened
    if (ref.type && !activeFilters[ref.type]) {
      return false;
    }
    
    // State filters - now flattened
    if (ref.resstate && !activeFilters[ref.resstate]) {
      return false;
    }
    
    // Time Period filters (based on date_created)
    if (activeFilters.age !== null && ref.date_created) {
      try {
        // Handle different date formats
        let createdDate;
        if (ref.date_created.includes('/')) {
          // Handle MM/DD/YY format
          const parts = ref.date_created.split(' ')[0].split('/'); // Get date part only
          if (parts.length === 3) {
            const month = parseInt(parts[0]);
            const day = parseInt(parts[1]);
            let year = parseInt(parts[2]);
            if (year < 100) year += 2000; // Convert YY to YYYY
            createdDate = new Date(year, month - 1, day);
          } else {
            createdDate = new Date(ref.date_created);
          }
        } else {
          createdDate = new Date(ref.date_created);
        }
        
        if (!isNaN(createdDate.getTime())) {
          const now = new Date();
          const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const startOf6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          const startOfYTD = new Date(now.getFullYear(), 0, 1); // January 1st of current year
          
          if (activeFilters.age === 'thisMonth' && createdDate < startOfThisMonth) {
            return false;
          } else if (activeFilters.age === 'lastMonth' && (createdDate < startOfLastMonth || createdDate >= startOfThisMonth)) {
            return false;
          } else if (activeFilters.age === '6months' && createdDate < startOf6MonthsAgo) {
            return false;
          } else if (activeFilters.age === 'ytd' && createdDate < startOfYTD) {
            return false;
          }
          // 'allTime' doesn't filter anything out
        }
      } catch (error) {
        // If date parsing fails, skip time period filtering for this item
        console.warn('Date parsing failed for:', ref.date_created);
      }
    }
    
    // Scheduled filters
    if (activeFilters.scheduled !== null) {
      // Check if refs.scheduled is null or blank (unscheduled)
      const isUnscheduled = ref.scheduled === null || ref.scheduled === undefined || ref.scheduled === '' || ref.scheduled === 'null';
      const isScheduled = !isUnscheduled;
      
      if (activeFilters.scheduled === true && !isScheduled) {
        return false; // Show scheduled only, but this ref is unscheduled
      }
      
      if (activeFilters.scheduled === false && !isUnscheduled) {
        return false; // Show unscheduled only, but this ref is scheduled  
      }
    }
    
    return true;
  };

  // Filter functions - updated for flattened structure
  const toggleTypeFilter = (type) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const toggleStateFilter = (state) => {
    setActiveFilters(prev => ({
      ...prev,
      [state]: !prev[state]
    }));
  };

  const toggleScheduledFilter = () => {
    setActiveFilters(prev => {
      const currentScheduled = prev.scheduled;
      let newScheduled;
      
      if (currentScheduled === null) {
        newScheduled = true; // Show scheduled only
      } else if (currentScheduled === true) {
        newScheduled = false; // Show unscheduled only
      } else {
        newScheduled = null; // Show all
      }
      
      return {
        ...prev,
        scheduled: newScheduled
      };
    });
  };

  const toggleAllTypes = (value) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      allAvailableTypes.forEach(type => {
        newFilters[type] = value;
      });
      return newFilters;
    });
  };

  const toggleAllStates = (value) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      allAvailableStates.forEach(state => {
        newFilters[state] = value;
      });
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    const newFilters = {
      age: null,
      scheduled: null
    };
    
    allAvailableTypes.forEach(type => {
      newFilters[type] = true; // Show all by default
    });
    
    allAvailableStates.forEach(state => {
      newFilters[state] = true; // Show all by default  
    });
    
    setActiveFilters(newFilters);
  };

  // Get filtered data - combine archive filtering with other filters
  const filteredData = tableData
    .filter(row => archivedView ? row.archive : !row.archive) // First filter by archive status
    .filter(passesAllFilters); // Then apply other filters

  // Calculate status counts for cards (optimized to avoid multiple filters)
  const statusCounts = useMemo(() => {
    const counts = {
      New: 0,
      Contacted: 0,
      Scheduled: 0,
      Sale: 0
    };
    
    filteredData.forEach(row => {
      if (counts.hasOwnProperty(row.status)) {
        counts[row.status]++;
      }
    });
    
    return counts;
  }, [filteredData]);

  const columns = [
    {
      Header: "",
      accessor: "massSelection",
      massSelection: true,
      width: 40,
    },
    {
      Header: "Name",
      accessor: "name",
    },
    {
      Header: "Phone",
      accessor: "phone",
    },
    {
      Header: "Email",
      accessor: "email",
    },
    {
      Header: "State",
      accessor: "resstate",
      type: "select",
      width: 100,
      DropdownOptions: US_STATES.map(state => state.code),
      dropdownBackgroundColor: (value) => "#ffffff", // White background ensures black text via getContrastColor
      Cell: ({ value }) => {
        const state = US_STATES.find(s => s.code === value);
        return (
          <div style={{
            backgroundColor: "#f0f8ff",
            color: "#000",
            padding: "2px 6px",
            borderRadius: "8px",
            fontSize: "12px",
            display: "inline-block",
            border: "1px solid #b0c4de"
          }}>
            {state ? state.code : value || ''}
          </div>
        );
      }
    },
    {
      Header: "Type",
      accessor: "type",
      type: "select",
      width: 120,
      DropdownOptions: [
        "Personal Ref",
        "Union Catchup",
        "CSK",
        "FWK",
        "POS",
        "AD&D",
        "Beneficiary",
        "Emergency Contact"
      ],
      dropdownBackgroundColor: (value) => {
        switch (value) {
          case "Personal Ref":
            return "#3498db";
          case "Union Catchup":
            return "#2ecc71";
          case "CSK":
            return "#f1c40f";
          case "FWK":
            return "#e74c3c";
          case "POS":
            return "#95a5a6";
          case "AD&D":
            return "#27ae60";
          case "Beneficiary":
            return "#9b59b6";
          case "Emergency Contact":
            return "#e67e22";
          default:
            return "#fff";
        }
      }
    },
    {
      Header: "Referred By",
      accessor: "referred_by",
      type: "autocomplete",
      width: 150,
      autocompleteOptions: users,
      autocompleteValueField: "id",
      autocompleteDisplayField: "first_name",
      autocompleteChipColor: (row) => row.archive ? "#F08080" : "#e0e0e0",
    },
    {
      Header: "Created By",
      accessor: "created_by_display",
      width: 150,
      Cell: ({ value }) => {
        return (
          <div style={{
            backgroundColor: "#e0e0e0",
            color: "#000",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            display: "inline-block"
          }}>
            {value || ''}
          </div>
        );
      }
    },
    {
      Header: "Assigned To",
      accessor: "assigned_to",
      chipDropdown: true,
      width: 150,
      chipDropdownOptions: users,
      chipDropdownValueField: "id",
      chipDropdownDisplay: (user) => user.first_name, // first_name contains lagnname from fetchUsers transformation
      chipDropdownChipColor: (row) => row.active === "n" ? "#F08080" : row.chip_color || "#e0e0e0",
      Cell: ({ row, value }) => {
        // Display the lagnname from assigned_to_display if available, otherwise lookup in users
        const displayName = row.original.assigned_to_display || 
          (users.find(u => u.id === value)?.first_name) || '';
        return (
          <div style={{
            backgroundColor: "#e0e0e0",
            color: "#000", 
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px",
            display: "inline-block"
          }}>
            {displayName}
          </div>
        );
      }
    },
    {
      Header: "Date Created",
      accessor: "date_created",
      type: "date",
      Cell: ({ value }) => {
        if (!value) return '';
        // If it's already in the correct format, return as is
        if (typeof value === 'string' && value.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
          return value;
        }
        // Otherwise parse and format
        const date = new Date(value);
        const hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      }
    },
    {
      Header: "Last Updated",
      accessor: "last_updated",
      type: "date",
      Cell: ({ value }) => {
        if (!value) return '';
        // If it's already in the correct format, return as is
        if (typeof value === 'string' && value.match(/^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/)) {
          return value;
        }
        // Otherwise parse and format
        const date = new Date(value);
        const hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      }
    },
    {
      Header: "Notes",
      accessor: "notes",
      type: "textarea",
    },
    {
      Header: (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <FiCalendar />
          <span>Scheduled</span>
        </div>
      ),
      accessor: "scheduled",
      width: 180,
      datePicker: true,
      type: "date"
    },
    {
      Header: "Status",
      accessor: "status",
      type: "select",
      width: 120,
      DropdownOptions: [
        "New",
        "Contacted",
        "Scheduled",
        "No Show",
        "No Sale",
        "Sale"
      ],
      dropdownBackgroundColor: (value) => {
        switch (value) {
          case "New":
            return "#3498db";
          case "Contacted":
            return "#2ecc71";
          case "Scheduled":
            return "#f1c40f";
          case "No Show":
            return "#e74c3c";
          case "No Sale":
            return "#95a5a6";
          case "Sale":
            return "#27ae60";
          default:
            return "#fff";
        }
      }
    },
  ];

  const handleCellUpdate = async (id, field, value) => {
    try {
      // Get the current ref to check previous values
      const currentRef = tableData.find(row => row.id === id);
      let updateData = { [field]: value };
      
      // If updating date fields, format them (only if value is not null/empty)
      if ((field === 'date_created' || field === 'last_updated' || field === 'scheduled') && value !== null && value !== '') {
        
        const date = new Date(value);
        
        if (isNaN(date.getTime())) {
          return;
        }
        
        const hours = date.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        // Format as m/d/yy h:mm am/pm (single digits for month and day)
        value = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(-2)} ${displayHours}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
        updateData[field] = value;
      }
      
      // Handle scheduled field status updates
      if (field === 'scheduled' && currentRef) {
        const previousScheduled = currentRef.scheduled;
        const wasBlank = !previousScheduled || previousScheduled === '' || previousScheduled === 'null';
        const nowHasValue = value && value !== '' && value !== 'null';
        const nowIsBlank = !value || value === '' || value === 'null';
        
        // If changing from blank to scheduled, update status to "Scheduled"
        if (wasBlank && nowHasValue) {
          console.log(`Ref ${id}: Scheduled changed from ${previousScheduled || 'null'} to ${value}, updating status to Scheduled`);
          updateData.status = 'Scheduled';
        }
        // If clearing scheduled (going from value to blank), update status to "No Show"
        else if (!wasBlank && nowIsBlank) {
          console.log(`Ref ${id}: Scheduled cleared from ${previousScheduled} to null, updating status to No Show`);
          updateData.status = 'No Show';
        }
      }
      
      const response = await api.put(`/refs/${id}`, updateData);
      
      // If updating assigned_to, also update assigned_to_display
      if (field === 'assigned_to' && value) {
        const assignedUser = users.find(u => u.id === parseInt(value));
        if (assignedUser) {
          updateData.assigned_to_display = assignedUser.first_name; // first_name contains lagnname
        }
      }
      
      const updatedTableData = tableData.map((row) => 
        (row.id === id ? { ...row, ...updateData } : row)
      );
      
      setTableData(updatedTableData);
      
      // If updating type or state fields, refresh available filters to include new values
      if (field === 'type' || field === 'resstate') {
        extractUniqueFilters(updatedTableData);
      }
    } catch (error) {
      console.error('Error updating cell:', error);
      // Silently handle errors
    }
  };

  const handleSelectionChange = (selectedIds) => {
    setSelectedRows(selectedIds);
  };

  const handleMassStatusChange = async (newStatus, selectedIds) => {
    try {
      // Update status for each selected ref individually
      const updatePromises = selectedIds.map(id =>
        api.put(`/refs/${id}`, { status: newStatus })
      );
      await Promise.all(updatePromises);
      
      // Update local state
      setTableData(prev =>
        prev.map(row =>
          selectedIds.includes(row.id.toString()) ? { ...row, status: newStatus } : row
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
      // Silently handle errors
    }
  };

  const handleMassReassign = async (newUserId) => {
    try {
      
      const updatePromises = selectedRows.map(id =>
        api.put(`/refs/${id}`, { assigned_to: newUserId })
      );
      await Promise.all(updatePromises);
      
      // Find the user's display name for the new assigned_to
      const assignedUser = users.find(u => u.id === parseInt(newUserId));
      const assignedToDisplay = assignedUser?.first_name || ''; // first_name contains lagnname
      
      setTableData(prev =>
        prev.map(row =>
          selectedRows.includes(row.id.toString()) 
            ? { ...row, assigned_to: newUserId, assigned_to_display: assignedToDisplay } 
            : row
        )
      );
      setShowMassReassignMenu(false);
    } catch (error) {
      // Silently handle errors
    }
  };

  const handleAddNew = async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear().toString().slice(-2)} ${displayHours}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
      
      const newRef = {
        name: "",
        phone: "",
        email: "",
        type: "Personal Ref",
        assigned_to: user?.userId || user?.id,
        referred_by: null,
        created_by: user?.userId || user?.id,
        date_created: formattedDate,
        last_updated: formattedDate,
        notes: "",
        scheduled: null,
        status: "New",
        archive: 0
      };


      const response = await api.post('/refs', newRef);

      // Map the user data for display and ensure dates are set
      const newRow = {
        ...response.data,
        ...newRef, // Include all the fields we sent, including dates
        assigned_to_display: user.lagnname || user.first_name,
        created_by_display: user.lagnname || user.first_name
      };

      const updatedTableData = [...tableData, newRow];
      setTableData(updatedTableData);
      
      // Refresh available filters to include any new types or states from the new row
      extractUniqueFilters(updatedTableData);
    } catch (error) {
      // Silently handle errors
    }
  };

  const handleImport = () => {
    setIsImportModalOpen(true);
  };

  const handleImportData = async (importedData) => {
    try {
      console.log("========== IMPORT DATA DEBUG ==========");
      console.log("Import data received:", importedData);
      console.log("Import data type:", typeof importedData);
      console.log("Is array:", Array.isArray(importedData));
      console.log("Import data JSON:", JSON.stringify(importedData, null, 2));
      
      // Force ensure we have a proper array format
      let dataToSend = [];
      
      if (Array.isArray(importedData)) {
        dataToSend = importedData.map(item => {
          // Ensure each item is a plain object
          if (typeof item === 'object' && item !== null) {
            return { ...item }; // Create a clean copy
          }
          return item;
        });
      } else if (typeof importedData === 'object' && importedData !== null) {
        // If it's a single object, wrap it in an array
        dataToSend = [{ ...importedData }];
      } else {
        throw new Error('Invalid import data format');
      }
      
      console.log("Final data to send:", dataToSend);
      console.log("Final data is array:", Array.isArray(dataToSend));
      console.log("Final data length:", dataToSend.length);
      console.log("Final data JSON:", JSON.stringify(dataToSend, null, 2));
      console.log("========================================");
      
      const response = await api.post('/refs/import', dataToSend);
      console.log("Import response:", response.data);
      
      fetchRefs(); // Refresh the data after import
      console.log("Import completed successfully");
    } catch (error) {
      console.error("Import error:", error);
      console.error("Error response:", error.response?.data);
      // Silently handle errors for now, but log them
    }
  };


  const handleDelete = async () => {
    try {
      const deletePromises = selectedRows.map(id =>
        api.delete(`/refs/${id}`)
      );
      await Promise.all(deletePromises);
      setTableData(prev => prev.filter(row => !selectedRows.includes(row.id.toString())));
      setSelectedRows([]);
    } catch (error) {
      // Silently handle errors
    }
  };

  const handleArchive = async () => {
    try {
      // Convert selectedRows to numbers in case they're strings
      const ids = selectedRows.map(id => parseInt(id)).filter(id => !isNaN(id));
      const archiveValue = archivedView ? 0 : 1; // Toggle based on current view
      
      console.log('Archive request:', { ids, archiveValue, selectedRows });
      
      if (ids.length === 0) {
        console.error('No valid IDs to archive');
        return;
      }
      
      await api.put('/refs/updateArchive', {
        ids: ids,
        archiveValue: archiveValue
      });
      
      setTableData(prev =>
        prev.map(row =>
          selectedRows.includes(row.id.toString())
            ? { ...row, archive: archiveValue }
            : row
        )
      );
      setSelectedRows([]);
    } catch (error) {
      console.error('Error archiving refs:', error);
      // Silently handle errors
    }
  };


  const handleToggleArchivedView = () => {
    setArchivedView(!archivedView);
    setSelectedRows([]);
  };

  const handleRefresh = () => {
    fetchRefs();
  };

  const handleOpenDetails = (row) => {
    setDetailsData(row);
  };


  const handleArchiveRef = async (id) => {
    try {
      // Find the current ref to determine its archive status
      const currentRef = tableData.find(row => row.id === id);
      const newArchiveValue = currentRef?.archive ? 0 : 1; // Toggle archive status
      const numericId = parseInt(id);
      
      console.log('Archive single ref:', { id, numericId, currentArchive: currentRef?.archive, newArchiveValue });
      
      if (isNaN(numericId)) {
        console.error('Invalid ID for archive:', id);
        return;
      }
      
      await api.put('/refs/updateArchive', {
        ids: [numericId],
        archiveValue: newArchiveValue
      });
      
      setTableData(prev =>
        prev.map(row =>
          row.id === id
            ? { ...row, archive: newArchiveValue }
            : row
        )
      );
    } catch (error) {
      console.error('Error archiving ref:', error);
      // Silently handle errors
    }
  };

  const handleDeleteRef = async (id) => {
    try {
      await api.delete(`/refs/${id}`);
      setTableData(prev => prev.filter(row => row.id !== id));
    } catch (error) {
      // Silently handle errors
    }
  };

  // Don't render if user isn't loaded yet
  if (!user || (!user.userId && !user.id)) {
    return <div>Loading user data...</div>;
  }

  return (
    <div>
      {(isLoading || (hierarchyLoading && hasHierarchyAccess)) ? (
        <div>Loading refs{hierarchyLoading && hasHierarchyAccess ? ' and permissions' : ''}...</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            <div className="card-container">
              <Card
                title="New"
                value={`${statusCounts.New}`}
                subText="New Refs"
                donut={true}
                percentage={filteredData.length > 0 ? Math.round((statusCounts.New / filteredData.length) * 100) : 0}
                donutColor="#4caf50"
              />
              <Card
                title="Contacted"
                value={`${statusCounts.Contacted}`}
                subText="Contacted Refs"
                donut={true}
                percentage={filteredData.length > 0 ? Math.round((statusCounts.Contacted / filteredData.length) * 100) : 0}
                donutColor="#2196f3"
              />
              <Card
                title="Scheduled"
                value={`${statusCounts.Scheduled}`}
                subText="Scheduled Refs"
                donut={true}
                percentage={filteredData.length > 0 ? Math.round((statusCounts.Scheduled / filteredData.length) * 100) : 0}
                donutColor="#ff9800"
              />
              <Card
                title="Sale"
                value={`${statusCounts.Sale}`}
                subText="Sale Refs"
                donut={true}
                percentage={filteredData.length > 0 ? Math.round((statusCounts.Sale / filteredData.length) * 100) : 0}
                donutColor="#8bc34a"
                backgroundImage={globeBg}
              />
            </div>
          </div>
          
          <div style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              {/* Search Bar */}
              <div className="reports-search" style={{ flex: 1, marginRight: "20px" }}>
                <div className="search-input-wrapper">
                  <FiSearch className="search-icon" style={{ 
                    color: isSearching ? '#00558c' : undefined,
                    opacity: isSearching ? 0.8 : undefined 
                  }} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, email, type, state, or agent..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                    style={{ 
                      borderColor: isSearching ? '#00558c' : undefined,
                      transition: 'border-color 0.2s ease'
                    }}
                  />
                </div>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FilterMenu
                  activeFilters={activeFilters}
                  onResetFilters={clearAllFilters}
                  menuType="expandable"
                  buttonLabel={<FiFilter title="Filter Refs" />}
                  position="left"
                  filterCategories={[
                    {
                      name: 'Type',
                      type: 'role',
                      filters: allAvailableTypes,
                      onToggle: toggleTypeFilter,
                      onToggleAll: toggleAllTypes,
                      getColor: (type) => {
                        return activeFilters[type] 
                          ? { bg: '#28a745', border: '#1e7e34' } // Green for selected
                          : { bg: '#e0e0e0', border: '#ccc' }; // Gray for unselected
                      }
                    },
                    {
                      name: 'State',
                      type: 'role', 
                      filters: allAvailableStates,
                      onToggle: toggleStateFilter,
                      onToggleAll: toggleAllStates,
                      getColor: (state) => {
                        return activeFilters[state]
                          ? { bg: '#28a745', border: '#1e7e34' } // Green for selected
                          : { bg: '#e0e0e0', border: '#ccc' }; // Gray for unselected
                      }
                    }
                  ]}
                  customContent={(
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                      {/* Time Period filter */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Time Period:</span>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.age === null ? '#00558c' : 'transparent', 
                            color: activeFilters.age === null ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, age: null }))}
                        >
                          All
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.age === 'thisMonth' ? '#00558c' : 'transparent', 
                            color: activeFilters.age === 'thisMonth' ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, age: 'thisMonth' }))}
                        >
                          This Month
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.age === 'lastMonth' ? '#00558c' : 'transparent', 
                            color: activeFilters.age === 'lastMonth' ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, age: 'lastMonth' }))}
                        >
                          Last Month
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.age === '6months' ? '#00558c' : 'transparent', 
                            color: activeFilters.age === '6months' ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, age: '6months' }))}
                        >
                          6 Months
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.age === 'ytd' ? '#00558c' : 'transparent', 
                            color: activeFilters.age === 'ytd' ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, age: 'ytd' }))}
                        >
                          YTD
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.age === 'allTime' ? '#00558c' : 'transparent', 
                            color: activeFilters.age === 'allTime' ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, age: 'allTime' }))}
                        >
                          All Time
                        </button>
                      </div>
                      
                      {/* Scheduled filter */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#666', fontWeight: '500' }}>Scheduled:</span>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.scheduled === null ? '#00558c' : 'transparent', 
                            color: activeFilters.scheduled === null ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, scheduled: null }))}
                        >
                          All
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.scheduled === true ? '#00558c' : 'transparent', 
                            color: activeFilters.scheduled === true ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, scheduled: true }))}
                        >
                          Scheduled
                        </button>
                        <button 
                          className="action-button" 
                          style={{ 
                            backgroundColor: activeFilters.scheduled === false ? '#00558c' : 'transparent', 
                            color: activeFilters.scheduled === false ? 'white' : '#666', 
                            border: '1px solid #ddd',
                            padding: '4px 8px',
                            fontSize: '11px',
                            borderRadius: '4px'
                          }} 
                          onClick={() => setActiveFilters(prev => ({ ...prev, scheduled: false }))}
                        >
                          Unscheduled
                        </button>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
            <DataTable
              columns={columns}
              data={filteredData}
              onCellUpdate={handleCellUpdate}
              onSelectionChange={handleSelectionChange}
              onMassStatusChange={handleMassStatusChange}
              entityName="reference"
              archivedView={archivedView}
              onAddNew={handleAddNew}
              onImport={handleImport}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onToggleArchivedView={handleToggleArchivedView}
              onRefresh={handleRefresh}
              onMassReassign={() => setShowMassReassignMenu(true)}
              enableRowContextMenu={true}
              onOpenDetails={handleOpenDetails}
              getRowContextMenuOptions={(row) => [
                { label: "View Details", action: () => handleOpenDetails(row.original || row) },
                { label: archivedView ? "Unarchive" : "Archive", action: () => handleArchiveRef((row.original || row).id) },
                { label: "Delete", action: () => handleDeleteRef((row.original || row).id) }
              ]}
            />

            {isImportModalOpen && (
              <ImportModal
          isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportData}
          title="Import Refs"
          existingData={tableData}
          users={users}
          columns={columns}
          showToast={(message, type) => {
            console.log(`Toast: ${message} (${type})`);
          }}
          availableFields={[
            'name',
            'email', 
            'phone',
            'type',
            'resstate',
            'status',
            'notes',
            'scheduled',
            'assigned_to',
            'created_by'
          ]}
              />
            )}

            {showMassReassignMenu && (
              <MassReassignMenu
                leads={tableData}
                users={users}
                selectedLeadIds={selectedRows}
                onReassign={handleMassReassign}
                onClose={() => setShowMassReassignMenu(false)}
              />
            )}

            {detailsData && (
              <RefDetails
                data={detailsData}
                columns={columns}
                onClose={() => setDetailsData(null)}
                onSave={async (updatedData) => {
                  try {
                    await api.put(`/refs/${updatedData.id}`, updatedData);
                    
                    // If assigned_to was updated, ensure assigned_to_display is also updated
                    if (updatedData.assigned_to && !updatedData.assigned_to_display) {
                      const assignedUser = users.find(u => u.id === parseInt(updatedData.assigned_to));
                      if (assignedUser) {
                        updatedData.assigned_to_display = assignedUser.first_name; // first_name contains lagnname
                      }
                    }
                    
                    setTableData(prev =>
                      prev.map(row =>
                        row.id === updatedData.id ? updatedData : row
                      )
                    );
                    setDetailsData(null);
                  } catch (error) {
                    // Silently handle errors
                  }
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RefsPage; 