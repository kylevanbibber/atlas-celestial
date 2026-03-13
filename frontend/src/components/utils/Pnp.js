import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiDownload, FiSearch, FiList, FiGrid, FiFilter, FiUpload, FiChevronDown, FiCheck } from 'react-icons/fi';
import DataTable from './DataTable';
import ActionBar from './ActionBar';
import { useAuth } from '../../context/AuthContext';
import { useUserHierarchy } from '../../hooks/useUserHierarchy';

import api from '../../api';
import * as XLSX from 'xlsx';
import './Pnp.css';

// Define field types for formatting
const CURRENCY_FIELDS = [
  'curr_mo_grs_submit', 'curr_mo_net_submit',
  'past_12_mo_life_grs_submit', 'past_12_mo_life_net_submit',
  'cur_ytd_life_grs_submit', 'cur_ytd_life_net_submit',
  'curr_mo_submit', 'curr_mo_net_iss', 'curr_mo_net_sub',
  'proj_plus_1_submit', 'proj_plus_1_net_iss', 'proj_plus_1_net_sub',
  'proj_plus_2_submit', 'proj_plus_2_net_iss', 'proj_plus_2_net_sub'
];

const PERCENTAGE_FIELDS = [
  'curr_mo_pct', 'past_12_mo_life_pct', 'cur_ytd_pct',
  'curr_mo_4mo_rate', 'proj_plus_1_4mo_rate', 'proj_plus_2_4mo_rate'
];

const NUMERIC_FIELDS = [
  'curr_mo_paid4mo', 'proj_plus_1_paid4mo', 'proj_plus_2_paid4mo'
];

const DATE_RANGE_FIELDS = [
  'proj_plus_1_months', 'proj_plus_2_months'
];

// Helper functions to parse values to numbers (for sorting)
const parseToNumber = (value) => {
  if (!value || value === '' || value === null || value === undefined || value === 'N/A') return 0;
  
  // Remove commas and other formatting before parsing
  const cleanValue = String(value).replace(/[,$%]/g, '');
  const num = parseFloat(cleanValue);
  return isNaN(num) ? 0 : num;
};

// Helper function to format currency values (for display only)
const formatCurrency = (value) => {
  const num = typeof value === 'number' ? value : parseToNumber(value);
  if (num === 0) return '$0';
  
  return '$' + num.toLocaleString('en-US', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  });
};

// Helper function to format percentage values (for display only)
const formatPercentage = (value) => {
  const num = typeof value === 'number' ? value : parseToNumber(value);
  if (num === 0) return '0%';
  
  // If the value is already a percentage (like 25.5), just add %
  // If it's a decimal (like 0.255), multiply by 100
  const displayValue = num > 1 ? num : num * 100;
  return displayValue.toFixed(1) + '%';
};

// Helper function to format numeric values (for display only)
const formatNumber = (value) => {
  const num = typeof value === 'number' ? value : parseToNumber(value);
  if (num === 0) return '0';
  
  return num.toLocaleString('en-US');
};

// Helper function for date range fields (don't parse as numbers)
const formatDateRange = (value) => {
  if (!value || value === '' || value === null || value === undefined || value === 'N/A') return '';
  return String(value); // Keep as-is for date ranges like "10/24-03/25"
};

// Calculate bonus Y/N based on ESID tenure and persistency rates
const calculateBonus = (row) => {
  if (!row.esid) return '';

  // Parse ESID date (mm/dd/yy format)
  const esidParts = String(row.esid).split('/');
  if (esidParts.length !== 3) return '';

  const esidMonth = parseInt(esidParts[0]);
  let esidYear = parseInt(esidParts[2]);
  esidYear = esidYear < 50 ? 2000 + esidYear : 1900 + esidYear;

  // Use report_date or date for reference date
  const reportDateStr = row.report_date || row.date;
  if (!reportDateStr) return '';

  const dateParts = String(reportDateStr).split('/');
  if (dateParts.length !== 3) return '';

  const reportMonth = parseInt(dateParts[0]);
  let reportYear = parseInt(dateParts[2]);
  reportYear = reportYear < 50 ? 2000 + reportYear : 1900 + reportYear;

  // Calculate tenure month (1-based)
  const diffMonths = (reportYear - esidYear) * 12 + (reportMonth - esidMonth);
  const tenureMonth = diffMonths + 1;

  if (tenureMonth <= 0) return '';

  // Months 1-4: always bonus
  if (tenureMonth <= 4) return 'Y';

  // Months 5-6: need past_12_mo_life_pct >= 84%
  if (tenureMonth <= 6) {
    const pct = typeof row.past_12_mo_life_pct === 'number' ? row.past_12_mo_life_pct : parseToNumber(row.past_12_mo_life_pct);
    return pct >= 84 ? 'Y' : 'N';
  }

  // Months 7-12: need past_12_mo_life_pct >= 80%
  if (tenureMonth <= 12) {
    const pct = typeof row.past_12_mo_life_pct === 'number' ? row.past_12_mo_life_pct : parseToNumber(row.past_12_mo_life_pct);
    return pct >= 80 ? 'Y' : 'N';
  }

  // Month 13+: need curr_mo_4mo_rate >= 76%
  const rate = typeof row.curr_mo_4mo_rate === 'number' ? row.curr_mo_4mo_rate : parseToNumber(row.curr_mo_4mo_rate);
  return rate >= 76 ? 'Y' : 'N';
};

// Function to convert string values to numbers for proper sorting
const convertPnpRowData = (row) => {
  const convertedRow = {};
  

  
  Object.keys(row).forEach(key => {
    if (CURRENCY_FIELDS.includes(key) || PERCENTAGE_FIELDS.includes(key) || NUMERIC_FIELDS.includes(key)) {
      const original = row[key];
      const numericValue = parseToNumber(row[key]);
      convertedRow[key] = numericValue;
      
    
    } else if (DATE_RANGE_FIELDS.includes(key)) {
      // Keep date ranges as strings
      convertedRow[key] = formatDateRange(row[key]);
    } else {
      // Keep original value for text fields like name_line, esid, agent_num
      convertedRow[key] = row[key];
    }
  });
  

  
  return convertedRow;
};

// Helper functions for hierarchy view (mirroring HierarchyMGAUtilitiesTable)
const groupAgentsByMGA = (users) => {
  const groups = new Map();
  users.forEach(u => {
    const mgaName = u.mga || u.lagnname;
    if (!groups.has(mgaName)) groups.set(mgaName, new Set());
    groups.get(mgaName).add(u.lagnname);
    if (u.clname === 'MGA' || u.lagnname === mgaName) {
      groups.get(mgaName).add(mgaName);
    }
  });
  return new Map([...groups.entries()].map(([k, v]) => [k, Array.from(v)]));
};

const buildHierarchy = (agents) => {
  const order = ['RGA','MGA','GA','SA','AGT'];
  const nodesByName = new Map();
  agents.forEach(a => { nodesByName.set(a.lagnname, { ...a, children: [] }); });
  const roots = [];
  agents.forEach(a => {
    const node = nodesByName.get(a.lagnname);
    let parentName = null;
    if (a.sa && nodesByName.has(a.sa)) parentName = a.sa; else
    if (a.ga && nodesByName.has(a.ga)) parentName = a.ga; else
    if (a.mga && nodesByName.has(a.mga)) parentName = a.mga; else
    if (a.rga && nodesByName.has(a.rga)) parentName = a.rga;
    if (parentName && nodesByName.has(parentName)) nodesByName.get(parentName).children.push(node);
    else roots.push(node);
  });
  const sortRec = (arr, parent = null) => arr
    .sort((a,b)=> {
      const aRole = String(a.clname || '').toUpperCase();
      const bRole = String(b.clname || '').toUpperCase();
      const orphanA = (aRole === 'AGT' && !a.sa && !a.ga);
      const orphanB = (bRole === 'AGT' && !b.sa && !b.ga);
      if (parent && String(parent.clname || '').toUpperCase() === 'GA') {
        const agtNoSaA = (aRole === 'AGT' && !a.sa);
        const agtNoSaB = (bRole === 'AGT' && !b.sa);
        if (agtNoSaA !== agtNoSaB) return agtNoSaA ? -1 : 1;
        const isSaA = (aRole === 'SA');
        const isSaB = (bRole === 'SA');
        if (isSaA !== isSaB) return isSaA ? 1 : -1;
      }
      if (orphanA !== orphanB) return orphanA ? -1 : 1;
      const oa = order.indexOf(aRole);
      const ob = order.indexOf(bRole);
      if (oa === ob) return a.lagnname.localeCompare(b.lagnname);
      return oa - ob;
    })
    .map(n => ({ ...n, children: sortRec(n.children, n) }));
  return sortRec(roots);
};


const PNP_UPLOAD_URL = 'https://peaceful-badlands-42414-7b2e5f9acb76.herokuapp.com/upload/pnp';

// Tab definitions - defined outside component to prevent recreation
const TABS_CONFIG = [
  { id: 'all', label: 'All', description: 'All records' },
  { id: 'over', label: 'Over', description: 'All 4mo rates ≥ 85%' },
  { id: 'under', label: 'Under', description: 'Any 4mo rate < 85%' },
  { id: 'recap', label: 'Recap', description: 'Month & YTD Recap by level' }
];

const RECAP_SUB_TABS = [
  { id: 'AGT', label: 'AGT' },
  { id: 'SA', label: 'SA' },
  { id: 'GA', label: 'GA' },
  { id: 'MGA', label: 'MGA' }
];

// Stable Cell renderer functions - defined outside component
const CurrencyCell = ({ value }) => formatCurrency(value);
const PercentageCell = ({ value }) => formatPercentage(value);
const NumberCell = ({ value }) => formatNumber(value);
const BonusCell = ({ value }) => (
  <span style={{
    fontWeight: 600,
    color: value === 'Y' ? '#2e7d32' : value === 'N' ? '#c62828' : '#999',
    backgroundColor: value === 'Y' ? '#e8f5e9' : value === 'N' ? '#ffebee' : 'transparent',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px'
  }}>
    {value || '-'}
  </span>
);

const Pnp = () => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const isAdmin = user?.Role === 'Admin'; // Any admin can see all PnP data
  
  // Get allowed names from cached hierarchy data, excluding managerActive = 'n' users
  const allowedNames = useMemo(() => {
    if (isAdmin) return []; // Admins see all data
    
    // Get full hierarchy data to check managerActive status
    const fullHierarchyData = getHierarchyForComponent('full') || [];
    
    // Create a map of name to managerActive status
    const managerActiveMap = new Map();
    fullHierarchyData.forEach(user => {
      if (user.lagnname && user.managerActive !== undefined) {
        managerActiveMap.set(String(user.lagnname).toLowerCase(), String(user.managerActive).toLowerCase() === 'y');
      }
    });
    
    // Get base allowed names and filter out managerActive = 'n' users
    const baseAllowedNames = getHierarchyForComponent('names') || [];
    return baseAllowedNames.filter(name => {
      const isManagerActive = managerActiveMap.get(String(name).toLowerCase());
      return isManagerActive !== false; // Include if not found (undefined) or if true
    });
  }, [isAdmin, getHierarchyForComponent]);
  
  const allowedNamesSet = useMemo(() => new Set(allowedNames.map(name => String(name).toLowerCase())), [allowedNames]);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]); // Array of selected date strings
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pnpData, setPnpData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [isPreparedForExport, setIsPreparedForExport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('flat'); // 'flat' or 'hierarchy'
  const [expandedMga, setExpandedMga] = useState({});
  const [hierarchyUsers, setHierarchyUsers] = useState([]);
  const [pnpHierarchyLoading, setPnpHierarchyLoading] = useState(false);
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [processingUpload, setProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  // No options: always process all pages and all levels
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef(null);
  const datePickerRef = useRef(null);

  // Recap tab state
  const [recapData, setRecapData] = useState({ agt: [], sa: [], ga: [], mga: [] });
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapSubTab, setRecapSubTab] = useState('AGT');
  
  // Check if multiple months are selected
  const isMultiMonth = selectedDates.length > 1;
  
  // Filter state
  const [activeFilters, setActiveFilters] = useState({
    esidRange: { min: '', max: '' },
    grossSubmitRange: { min: '', max: '' },
    netSubmitRange: { min: '', max: '' },
    fourMoRateRange: { min: '', max: '' },
    proj1Range: { min: '', max: '' },
    proj2Range: { min: '', max: '' },
    showZeroValues: true // Whether to show rows with zero/null values
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Determine if user should see tabs (Admin or teamRole = 'app')
  const shouldShowTabs = isAdmin || user?.teamRole === 'app';

  // Filter functions
  const updateRangeFilter = (filterName, field, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: {
        ...prev[filterName],
        [field]: value
      }
    }));
  };

  const clearAllFilters = () => {
    setActiveFilters({
      esidRange: { min: '', max: '' },
      grossSubmitRange: { min: '', max: '' },
      netSubmitRange: { min: '', max: '' },
      fourMoRateRange: { min: '', max: '' },
      proj1Range: { min: '', max: '' },
      proj2Range: { min: '', max: '' },
      showZeroValues: true
    });
  };

  const toggleZeroValuesFilter = () => {
    setActiveFilters(prev => ({
      ...prev,
      showZeroValues: !prev.showZeroValues
    }));
  };

  const hasActiveFilters = () => {
    return activeFilters.esidRange.min || activeFilters.esidRange.max ||
           activeFilters.grossSubmitRange.min || activeFilters.grossSubmitRange.max ||
           activeFilters.netSubmitRange.min || activeFilters.netSubmitRange.max ||
           activeFilters.fourMoRateRange.min || activeFilters.fourMoRateRange.max ||
           activeFilters.proj1Range.min || activeFilters.proj1Range.max ||
           activeFilters.proj2Range.min || activeFilters.proj2Range.max ||
           !activeFilters.showZeroValues;
  };

  // Check if a row passes all active filters
  const passesAllFilters = (row) => {
    // ESID filter (date range)
    if (activeFilters.esidRange.min || activeFilters.esidRange.max) {
      const esidDate = row.esid ? new Date(row.esid) : null;
      if (!esidDate) return false;
      
      if (activeFilters.esidRange.min) {
        const minDate = new Date(activeFilters.esidRange.min);
        if (esidDate < minDate) return false;
      }
      
      if (activeFilters.esidRange.max) {
        const maxDate = new Date(activeFilters.esidRange.max);
        if (esidDate > maxDate) return false;
      }
    }

    // Numeric range filters
    const numericFilters = [
      { filter: 'grossSubmitRange', field: 'curr_mo_grs_submit' },
      { filter: 'netSubmitRange', field: 'curr_mo_net_submit' },
      { filter: 'fourMoRateRange', field: 'curr_mo_4mo_rate' },
      { filter: 'proj1Range', field: 'curr_mo_proj_1' },
      { filter: 'proj2Range', field: 'curr_mo_proj_2' }
    ];

    for (const { filter, field } of numericFilters) {
      const filterRange = activeFilters[filter];
      if (filterRange.min !== '' || filterRange.max !== '') {
        const value = parseFloat(row[field]) || 0;
        
        // If showZeroValues is false and value is 0, exclude this row
        if (!activeFilters.showZeroValues && value === 0) {
          return false;
        }
        
        if (filterRange.min !== '' && value < parseFloat(filterRange.min)) {
          return false;
        }
        
        if (filterRange.max !== '' && value > parseFloat(filterRange.max)) {
          return false;
        }
      }
    }

    return true;
  };

  // Filter data based on active tab and search term
  const getFilteredData = (data) => {
    let filtered = [...data];
    
    // Apply custom filters first
    filtered = filtered.filter(passesAllFilters);
    
    // Apply tab filter only if user should see tabs
    if (shouldShowTabs && activeTab !== 'all') {
      filtered = filtered.filter(row => {
        const currMo4MoRate = row.curr_mo_4mo_rate || 0;
        const proj1Rate = row.proj_plus_1_4mo_rate || 0;
        const proj2Rate = row.proj_plus_2_4mo_rate || 0;
        
        switch (activeTab) {
          case 'over':
            // All rates >= 85
            return currMo4MoRate >= 85 && proj1Rate >= 85 && proj2Rate >= 85;
          case 'under':
            // Any rate < 85
            return currMo4MoRate < 85 || proj1Rate < 85 || proj2Rate < 85;
          default:
            return true;
        }
      });
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(row => {
        const nameLineMatch = row.name_line?.toLowerCase().includes(searchLower);
        const esidMatch = row.esid?.toLowerCase().includes(searchLower);
        const agentNumMatch = row.agent_num?.toLowerCase().includes(searchLower);
        
        return nameLineMatch || esidMatch || agentNumMatch;
      });
    }
    
    return filtered;
  };

  const filteredData = getFilteredData(pnpData);

  // Create hierarchical display data (mirroring HierarchyMGAUtilitiesTable logic)
  const getHierarchicalDisplayData = () => {
    if (viewMode !== 'hierarchy') {
      return filteredData;
    }

    // If hierarchy data is still loading, return filtered data
    if (pnpHierarchyLoading || hierarchyUsers.length === 0) {
      return filteredData;
    }

    // Create a P&P data lookup by name
    const pnpLookup = new Map();
    filteredData.forEach(record => {
      if (record.name_line) {
        pnpLookup.set(record.name_line.toLowerCase(), record);
      }
    });

    // Group hierarchy users by MGA (same as HierarchyMGAUtilitiesTable)
    const mgaToAgents = groupAgentsByMGA(hierarchyUsers);
    
    // Create base MGA rows
    const baseRows = [];
    mgaToAgents.forEach((agents, mgaName) => {
      // Find the MGA user data
      const mgaUser = hierarchyUsers.find(u => u.lagnname === mgaName && u.clname === 'MGA') || 
                      hierarchyUsers.find(u => u.lagnname === mgaName);
      
      // Get P&P data for this MGA if available
      const mgaPnpData = pnpLookup.get(mgaName.toLowerCase());
      
      baseRows.push({ 
        id: mgaName, 
        role: 'MGA', 
        name: mgaName, 
        depth: 0,
        email: mgaUser?.email || '',
        phone: mgaUser?.phone || '',
        esid: mgaUser?.esid || '',
        userData: mgaUser || {},
        pnpData: mgaPnpData,
        // Use P&P data if available, otherwise use empty values
        name_line: mgaName,
        agent_num: mgaPnpData?.agent_num || '',
        curr_mo_grs_submit: mgaPnpData?.curr_mo_grs_submit || 0,
        curr_mo_net_submit: mgaPnpData?.curr_mo_net_submit || 0,
        curr_mo_pct: mgaPnpData?.curr_mo_pct || 0,
        curr_mo_4mo_rate: mgaPnpData?.curr_mo_4mo_rate || 0,
        past_12_mo_life_grs_submit: mgaPnpData?.past_12_mo_life_grs_submit || 0,
        past_12_mo_life_net_submit: mgaPnpData?.past_12_mo_life_net_submit || 0,
        past_12_mo_life_pct: mgaPnpData?.past_12_mo_life_pct || 0,
        cur_ytd_life_grs_submit: mgaPnpData?.cur_ytd_life_grs_submit || 0,
        cur_ytd_life_net_submit: mgaPnpData?.cur_ytd_life_net_submit || 0,
        cur_ytd_pct: mgaPnpData?.cur_ytd_pct || 0,
        proj_plus_1_months: mgaPnpData?.proj_plus_1_months || '',
        proj_plus_1_submit: mgaPnpData?.proj_plus_1_submit || 0,
        proj_plus_1_net_iss: mgaPnpData?.proj_plus_1_net_iss || 0,
        proj_plus_1_net_sub: mgaPnpData?.proj_plus_1_net_sub || 0,
        proj_plus_1_paid4mo: mgaPnpData?.proj_plus_1_paid4mo || 0,
        proj_plus_1_4mo_rate: mgaPnpData?.proj_plus_1_4mo_rate || 0,
        proj_plus_2_months: mgaPnpData?.proj_plus_2_months || '',
        proj_plus_2_submit: mgaPnpData?.proj_plus_2_submit || 0,
        proj_plus_2_net_iss: mgaPnpData?.proj_plus_2_net_iss || 0,
        proj_plus_2_net_sub: mgaPnpData?.proj_plus_2_net_sub || 0,
        proj_plus_2_paid4mo: mgaPnpData?.proj_plus_2_paid4mo || 0,
        proj_plus_2_4mo_rate: mgaPnpData?.proj_plus_2_4mo_rate || 0,
        bonus: mgaPnpData?.bonus || '',
        isMgaHeader: true
      });
    });

    // Sort base rows
    const sortedBaseRows = baseRows.sort((a, b) => a.name.localeCompare(b.name));

    // Build display rows
    const displayRows = [];
    sortedBaseRows.forEach(mgaRow => {
      displayRows.push(mgaRow);
      
      // Add agent hierarchy if MGA is expanded
      if (expandedMga[mgaRow.id]) {
        const agents = hierarchyUsers.filter(u => u.mga === mgaRow.name || u.lagnname === mgaRow.name);
        const tree = buildHierarchy(agents);
        
        // Flatten the tree and add P&P data
        const flattenTree = (nodes, depth) => {
          nodes.forEach(node => {
            const nodePnpData = pnpLookup.get(node.lagnname.toLowerCase());
            
            displayRows.push({
              id: `${mgaRow.id}::${node.lagnname}`,
              role: node.clname || '',
              name: node.lagnname,
              depth,
              email: node.email || '',
              phone: node.phone || '',
              esid: node.esid || '',
              userData: node,
              pnpData: nodePnpData,
              // Merge hierarchy user data with P&P data
              name_line: node.lagnname,
              agent_num: nodePnpData?.agent_num || '',
              curr_mo_grs_submit: nodePnpData?.curr_mo_grs_submit || 0,
              curr_mo_net_submit: nodePnpData?.curr_mo_net_submit || 0,
              curr_mo_pct: nodePnpData?.curr_mo_pct || 0,
              curr_mo_4mo_rate: nodePnpData?.curr_mo_4mo_rate || 0,
              past_12_mo_life_grs_submit: nodePnpData?.past_12_mo_life_grs_submit || 0,
              past_12_mo_life_net_submit: nodePnpData?.past_12_mo_life_net_submit || 0,
              past_12_mo_life_pct: nodePnpData?.past_12_mo_life_pct || 0,
              cur_ytd_life_grs_submit: nodePnpData?.cur_ytd_life_grs_submit || 0,
              cur_ytd_life_net_submit: nodePnpData?.cur_ytd_life_net_submit || 0,
              cur_ytd_pct: nodePnpData?.cur_ytd_pct || 0,
              proj_plus_1_months: nodePnpData?.proj_plus_1_months || '',
              proj_plus_1_submit: nodePnpData?.proj_plus_1_submit || 0,
              proj_plus_1_net_iss: nodePnpData?.proj_plus_1_net_iss || 0,
              proj_plus_1_net_sub: nodePnpData?.proj_plus_1_net_sub || 0,
              proj_plus_1_paid4mo: nodePnpData?.proj_plus_1_paid4mo || 0,
              proj_plus_1_4mo_rate: nodePnpData?.proj_plus_1_4mo_rate || 0,
              proj_plus_2_months: nodePnpData?.proj_plus_2_months || '',
              proj_plus_2_submit: nodePnpData?.proj_plus_2_submit || 0,
              proj_plus_2_net_iss: nodePnpData?.proj_plus_2_net_iss || 0,
              proj_plus_2_net_sub: nodePnpData?.proj_plus_2_net_sub || 0,
              proj_plus_2_paid4mo: nodePnpData?.proj_plus_2_paid4mo || 0,
              proj_plus_2_4mo_rate: nodePnpData?.proj_plus_2_4mo_rate || 0,
              bonus: nodePnpData?.bonus || '',
              isMgaHeader: false
            });
            
            if (node.children && node.children.length) {
              flattenTree(node.children, depth + 1);
            }
          });
        };
        
        flattenTree(tree, 1);
      }
    });
    
    return displayRows;
  };

  const displayData = getHierarchicalDisplayData();

  // Handle MGA row expansion
  const handleMgaExpansion = (mgaName) => {
    setExpandedMga(prev => ({
      ...prev,
      [mgaName]: !prev[mgaName]
    }));
  };

  // Fetch hierarchy data (similar to HierarchyMGAUtilitiesTable)
  const fetchHierarchyData = async () => {
    if (viewMode !== 'hierarchy') return; // Only fetch when needed
    
    setPnpHierarchyLoading(true);
    try {
      if (!user?.userId) throw new Error('No user');
      
      const isOrgAdmin = isAdmin || user?.teamRole === 'app';
      let hierarchyResponse;
      
      if (isOrgAdmin) {
        // Load all hierarchies across the organization (same as HierarchyMGAUtilitiesTable)
        hierarchyResponse = await api.get('/admin/getAllRGAsHierarchy');
      } else {
        // Load only current user's hierarchy (lite version)
        hierarchyResponse = await api.post('/auth/searchByUserIdLite', { userId: user.userId });
      }
      
      if (!hierarchyResponse.data?.success) {
        throw new Error('Hierarchy load failed');
      }
      
      let users = [];
      if (isOrgAdmin) {
        // Flatten all RGA hierarchies
        (hierarchyResponse.data.data || []).forEach(h => {
          (h.hierarchyData || []).forEach(u => users.push(u));
        });
      } else {
        users = hierarchyResponse.data.data || [];
      }
      
      // Filter active users (similar to HierarchyMGAUtilitiesTable)
      const activeUsers = users.filter(u => {
        const active = String(u.Active || '').toLowerCase() === 'y';
        const mgrActive = String(u.managerActive || '').toLowerCase() === 'y';
        return active && mgrActive && u.lagnname;
      });
      
      setHierarchyUsers(activeUsers);
    } catch (err) {
      console.error('Error fetching hierarchy data:', err);
      setError('Failed to fetch hierarchy data');
    } finally {
      setPnpHierarchyLoading(false);
    }
  };

  // Fetch available dates on component mount
  useEffect(() => {
    fetchAvailableDates();
  }, []);

  // Fetch hierarchy data when switching to hierarchy view
  useEffect(() => {
    if (viewMode === 'hierarchy' && hierarchyUsers.length === 0) {
      fetchHierarchyData();
    }
  }, [viewMode, user?.userId]);

  // Fetch data when selected dates change or hierarchy data is ready
  useEffect(() => {
    if (selectedDates.length > 0 && (isAdmin || (hierarchyData && allowedNames.length > 0))) {
      fetchPnpDataForDates(selectedDates);
    }
  }, [selectedDates, isAdmin, hierarchyData, allowedNames]);

  // Fetch recap data when recap tab is active and date changes
  useEffect(() => {
    if (activeTab === 'recap' && selectedDates.length === 1) {
      const fetchRecap = async () => {
        setRecapLoading(true);
        try {
          const resp = await api.get(`/pnp/recap?date=${encodeURIComponent(selectedDates[0])}`);
          if (resp.data?.success) {
            setRecapData(resp.data.data);
          }
        } catch (err) {
          console.error('Error fetching recap data:', err);
        } finally {
          setRecapLoading(false);
        }
      };
      fetchRecap();
    }
  }, [activeTab, selectedDates]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAvailableDates = async () => {
    try {
      const response = await api.get('/pnp/dates');
      const result = response.data;
      
      if (result.success && result.dates.length > 0) {
        setAvailableDates(result.dates);
        // Select the most recent date by default
        setSelectedDates([result.dates[0]]);
      } else {
        setError('No P&P data available');
      }
    } catch (err) {
      console.error('Error fetching PnP dates:', err);
      setError('Failed to fetch P&P dates');
    } finally {
      setLoading(false);
    }
  };

  // Toggle date selection
  const toggleDateSelection = (date) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== date);
      } else {
        return [...prev, date].sort((a, b) => {
          // Sort by date descending (most recent first)
          return new Date(b) - new Date(a);
        });
      }
    });
  };

  // Select all dates
  const selectAllDates = () => {
    setSelectedDates([...availableDates]);
  };

  // Clear to single date (most recent)
  const selectSingleDate = () => {
    if (availableDates.length > 0) {
      setSelectedDates([availableDates[0]]);
    }
  };

  // Navigate to previous date (older)
  const goToPreviousDate = () => {
    if (selectedDates.length === 1) {
      const currentIndex = availableDates.indexOf(selectedDates[0]);
      if (currentIndex < availableDates.length - 1) {
        setSelectedDates([availableDates[currentIndex + 1]]);
      }
    }
  };

  // Navigate to next date (more recent)
  const goToNextDate = () => {
    if (selectedDates.length === 1) {
      const currentIndex = availableDates.indexOf(selectedDates[0]);
      if (currentIndex > 0) {
        setSelectedDates([availableDates[currentIndex - 1]]);
      }
    }
  };

  // Upload handlers (Admin or teamRole = 'app' only)
  const handleChooseFile = () => {
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) {
      setUploadError('Please select a PDF file');
      return;
    }
    setSelectedFileName(f.name);
  };

  const handleProcess = async () => {
    try {
      setUploadError(null);
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        setUploadError('Please choose a PDF file first');
        return;
      }
      setUploading(true);
      setProcessingUpload(false);
      setUploadProgress(0);

      const form = new FormData();
      form.append('file', file);

      // Submit to backend (returns immediately with job_id)
      const uploadResp = await api.post(PNP_UPLOAD_URL, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: {
          // Process all pages; large upper bound
          page_limit: 10000
        },
        withCredentials: false,
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded * 100) / evt.total);
            setUploadProgress(pct);
          }
        }
      });

      // Upload finished, now processing in background
      setUploading(false);
      setProcessingUpload(true);

      if (uploadResp.status === 202 && uploadResp.data.job_id) {
        const jobId = uploadResp.data.job_id;
        console.log(`[PnP Upload] Job started: ${jobId}`);

        // Poll status endpoint until complete
        const pollInterval = 3000; // 3 seconds
        const maxPollTime = 20 * 60 * 1000; // 20 minutes max
        const startTime = Date.now();

        const pollStatus = async () => {
          try {
            const statusResp = await api.get(`${PNP_UPLOAD_URL}/status/${jobId}`, {
              withCredentials: false
            });
            const { status, result, error } = statusResp.data;

            if (status === 'success') {
              console.log('[PnP Upload] Processing complete:', result);
              setProcessingUpload(false);
              
              // Refresh available dates (new data added)
              await fetchAvailableDates();
              // The fetchAvailableDates will set selectedDates to the most recent date
              // which will trigger fetchPnpDataForDates via useEffect
              
              // Clear form
              setSelectedFileName('');
              if (fileInputRef.current) fileInputRef.current.value = '';
              return true; // Done
            } else if (status === 'error') {
              throw new Error(error || 'Processing failed');
            } else if (status === 'processing') {
              // Still processing, continue polling
              if (Date.now() - startTime > maxPollTime) {
                throw new Error('Processing timeout (20 min)');
              }
              setTimeout(pollStatus, pollInterval);
              return false; // Continue
            } else {
              throw new Error(`Unknown status: ${status}`);
            }
          } catch (err) {
            setProcessingUpload(false);
            setUploadError(err?.response?.data?.error || err.message || 'Processing failed');
            return true; // Stop polling on error
          }
        };

        // Start polling
        await pollStatus();
      } else {
        // Unexpected response
        throw new Error('Unexpected upload response');
      }
    } catch (err) {
      setUploading(false);
      setProcessingUpload(false);
      setUploadError(err?.response?.data?.error || err.message || 'Upload failed');
    }
  };

  const fetchPnpDataForDates = async (dates) => {
    if (!dates || dates.length === 0) return;
    
    setLoading(true);
    try {
      // Fetch PnP data for all selected dates
      const allData = [];
      
      for (const date of dates) {
        const dataResponse = await api.get(`/pnp/data?date=${encodeURIComponent(date)}`);
        const dataResult = dataResponse.data;
        
        if (dataResult.success) {
          // Add date to each row, convert values, and calculate bonus
          const dataWithDate = dataResult.data.map((row, index) => {
            const processedRow = {
              ...row,
              report_date: date, // Add the report date to each row
              id: `${date}_${row.id || index + 1}`,
              ...convertPnpRowData(row)
            };
            processedRow.bonus = calculateBonus(processedRow);
            return processedRow;
          });
          allData.push(...dataWithDate);
        }
      }

      let processedData = allData;

      // Apply hierarchy filtering for non-admin users (includes managerActive filtering)
      if (!isAdmin && allowedNamesSet.size > 0) {
        processedData = processedData.filter(row => {
          const nameLineMatch = row.name_line && allowedNamesSet.has(String(row.name_line).toLowerCase());
          return nameLineMatch;
        });
      } else if (isAdmin) {
        // For admin users, still filter out managerActive = 'n' users
        // Get full hierarchy data to check managerActive status
        const fullHierarchyData = hierarchyData ? getHierarchyForComponent('full') || [] : [];
        const managerActiveMap = new Map();
        fullHierarchyData.forEach(user => {
          if (user.lagnname && user.managerActive !== undefined) {
            managerActiveMap.set(String(user.lagnname).toLowerCase(), String(user.managerActive).toLowerCase() === 'y');
          }
        });
        
        // Filter out managerActive = 'n' users for admins too
        processedData = processedData.filter(row => {
          if (!row.name_line) return false;
          const isManagerActive = managerActiveMap.get(String(row.name_line).toLowerCase());
          return isManagerActive !== false; // Include if not found (undefined) or if true
        });
      }

      setPnpData(processedData);
    } catch (err) {
      console.error('Error fetching PnP data:', err);
      setError('Failed to fetch P&P data');
    } finally {
      setLoading(false);
    }
  };

  // Base columns (always shown) - memoized
  const baseColumns = useMemo(() => [
    {
      Header: 'Bonus',
      accessor: 'bonus',
      width: 70,
      className: 'text-center',
      Cell: BonusCell
    },
    {
      Header: 'Name Line',
      accessor: 'name_line',
      autoWidth: true
    },
    {
      Header: 'ESID',
      accessor: 'esid',
      width: 100
    },
    {
      Header: 'Agent #',
      accessor: 'agent_num',
      width: 100
    }
  ], []);

  // Rate-specific columns for Over/Under tabs - memoized
  const rateColumns = useMemo(() => [
    ...baseColumns,
    {
      Header: 'Current Month 4Mo Rate',
      accessor: 'curr_mo_4mo_rate',
      width: 120,
      className: 'text-right',
      Cell: PercentageCell
    },
    {
      Header: 'Proj+1 4Mo Rate',
      accessor: 'proj_plus_1_4mo_rate',
      width: 120,
      className: 'text-right',
      Cell: PercentageCell
    },
    {
      Header: 'Proj+2 4Mo Rate',
      accessor: 'proj_plus_2_4mo_rate',
      width: 120,
      className: 'text-right',
      Cell: PercentageCell
    }
  ], [baseColumns]);

  // Multi-month columns - simplified view with Report Date - memoized
  const multiMonthColumns = useMemo(() => [
    {
      Header: 'Bonus',
      accessor: 'bonus',
      width: 70,
      className: 'text-center',
      Cell: BonusCell
    },
    {
      Header: 'Report Date',
      accessor: 'report_date',
      width: 120,
      sticky: 'left'
    },
    {
      Header: 'Name Line',
      accessor: 'name_line',
      autoWidth: true,
      sticky: 'left'
    },
    {
      Header: 'ESID',
      accessor: 'esid',
      width: 100
    },
    {
      Header: 'Agent #',
      accessor: 'agent_num',
      width: 100
    },
    {
      Header: 'Current Month',
      columns: [
        {
          Header: 'Gross Submit',
          accessor: 'curr_mo_grs_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Submit',
          accessor: 'curr_mo_net_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Percentage',
          accessor: 'curr_mo_pct',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    },
    {
      Header: 'Past 12 Months',
      columns: [
        {
          Header: 'Gross Submit',
          accessor: 'past_12_mo_life_grs_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Submit',
          accessor: 'past_12_mo_life_net_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Percentage',
          accessor: 'past_12_mo_life_pct',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    },
    {
      Header: 'Current YTD',
      columns: [
        {
          Header: 'Gross Submit',
          accessor: 'cur_ytd_life_grs_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Submit',
          accessor: 'cur_ytd_life_net_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Percentage',
          accessor: 'cur_ytd_pct',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    }
  ], []);

  // Define all available columns for "All" tab - memoized with dependencies
  const allColumns = useMemo(() => [
    {
      Header: 'Bonus',
      accessor: 'bonus',
      width: 70,
      className: 'text-center',
      Cell: BonusCell
    },
    // Add role column for hierarchy view
    ...(viewMode === 'hierarchy' ? [{
      Header: 'Role',
      accessor: 'role',
      width: 12,
      sticky: 'left',
      Cell: ({ value, row }) => {
        if (row.original.isMgaHeader) return null;
        const getRoleBadgeStyle = (cl) => {
          const clname = String(cl || '').toUpperCase();
          const styles = { backgroundColor: 'lightgrey', border: '2px solid grey' };
          switch (clname) {
            case 'SA': styles.backgroundColor = 'rgb(178, 82, 113)'; styles.border = '2px solid rgb(138, 62, 93)'; break;
            case 'GA': styles.backgroundColor = 'rgb(237, 114, 47)'; styles.border = '2px solid rgb(197, 94, 37)'; break;
            case 'MGA': styles.backgroundColor = 'rgb(104, 182, 117)'; styles.border = '2px solid rgb(84, 152, 97)'; break;
            case 'RGA': styles.backgroundColor = '#00558c'; styles.border = '2px solid #004372'; break;
            case 'AGT': default: styles.backgroundColor = 'lightgrey'; styles.border = '2px solid grey'; break;
          }
          return {
            ...styles,
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '10px',
            color: 'white',
            fontWeight: 600,
            letterSpacing: '0.5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            display: 'inline-block'
            // Note: marginLeft will be overridden in the component return
          };
        };
        return (
          <div className="sticky-role-cell">
            <span 
              className="user-role-badge"
              style={{
                ...getRoleBadgeStyle(value),
                marginLeft: `${(row.original.depth || 0) * 16}px` // Add hierarchy indentation to role badge
              }}
            >
              {value}
            </span>
          </div>
        );
      }
    }] : []),
    {
      Header: 'Name Line',
      accessor: 'name_line',
      autoWidth: true,
      sticky: 'left',
      Cell: ({ value, row }) => {
        const depth = row.original.depth || 0;
        const isMgaHeader = row.original.isMgaHeader;
        const isExpanded = expandedMga[row.original.id];
        
        if (viewMode === 'hierarchy') {
          return (
            <div 
              className="sticky-name-cell"
              style={{ 
                cursor: isMgaHeader ? 'pointer' : 'default'
              }}
              onClick={isMgaHeader ? () => handleMgaExpansion(row.original.id) : undefined}
            >
              <div 
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%'
                }}
              >
                {isMgaHeader && (
                  <span 
                    style={{ 
                      marginRight: '8px',
                      fontSize: '12px',
                      transition: 'transform 0.2s'
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </span>
                )}
                <span style={{ fontWeight: isMgaHeader ? 'bold' : 'normal' }}>
                  {value}
                </span>
              </div>
            </div>
          );
        } else {
          return (
            <div className="sticky-name-cell">
              {value}
            </div>
          );
        }
      }
    },
    {
      Header: 'ESID',
      accessor: 'esid',
      width: 100
    },
    {
      Header: 'Agent #',
      accessor: 'agent_num',
      width: 100
    },
    {
      Header: 'Current Month',
      columns: [
        {
          Header: 'Gross Submit',
          accessor: 'curr_mo_grs_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Submit',
          accessor: 'curr_mo_net_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Percentage',
          accessor: 'curr_mo_pct',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    },
    {
      Header: 'Past 12 Months',
      columns: [
        {
          Header: 'Gross Submit',
          accessor: 'past_12_mo_life_grs_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Submit',
          accessor: 'past_12_mo_life_net_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Percentage',
          accessor: 'past_12_mo_life_pct',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    },
    {
      Header: 'Current YTD',
      columns: [
        {
          Header: 'Gross Submit',
          accessor: 'cur_ytd_life_grs_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Submit',
          accessor: 'cur_ytd_life_net_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Percentage',
          accessor: 'cur_ytd_pct',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    },
    {
      Header: 'Projection +1',
      columns: [
        {
          Header: 'Months',
          accessor: 'proj_plus_1_months',
          width: 120,
          className: 'text-center'
        },
        {
          Header: 'Submit',
          accessor: 'proj_plus_1_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Issue',
          accessor: 'proj_plus_1_net_iss',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Sub',
          accessor: 'proj_plus_1_net_sub',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Paid 4 Mo',
          accessor: 'proj_plus_1_paid4mo',
          width: 100,
          className: 'text-right',
          Cell: NumberCell
        },
        {
          Header: '4 Mo Rate',
          accessor: 'proj_plus_1_4mo_rate',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    },
    {
      Header: 'Projection +2',
      columns: [
        {
          Header: 'Months',
          accessor: 'proj_plus_2_months',
          width: 120,
          className: 'text-center'
        },
        {
          Header: 'Submit',
          accessor: 'proj_plus_2_submit',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Issue',
          accessor: 'proj_plus_2_net_iss',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Net Sub',
          accessor: 'proj_plus_2_net_sub',
          width: 120,
          className: 'text-right',
          Cell: CurrencyCell
        },
        {
          Header: 'Paid 4 Mo',
          accessor: 'proj_plus_2_paid4mo',
          width: 100,
          className: 'text-right',
          Cell: NumberCell
        },
        {
          Header: '4 Mo Rate',
          accessor: 'proj_plus_2_4mo_rate',
          width: 100,
          className: 'text-right',
          Cell: PercentageCell
        }
      ]
    }
  ], [viewMode]); // Note: expandedMga and handleMgaExpansion are accessed in Cell functions but don't need to trigger column recreation

  // Memoized columns based on active tab and multi-month selection
  const columns = useMemo(() => {
    // If multiple months are selected, use simplified multi-month columns
    if (isMultiMonth) {
      return multiMonthColumns;
    }
    
    // If user shouldn't see tabs, always use all columns
    if (!shouldShowTabs) {
      return allColumns;
    }
    
    switch (activeTab) {
      case 'over':
      case 'under':
        return rateColumns;
      case 'all':
      default:
        return allColumns;
    }
  }, [isMultiMonth, multiMonthColumns, shouldShowTabs, activeTab, rateColumns, allColumns]);

  const currentDate = selectedDates.length === 1 ? selectedDates[0] : null;

  // Debug logging for columns and data (after columns are defined)
  useEffect(() => {
    console.log('🔍 PnP Debug - Columns:', {
      columnCount: columns?.length,
      columnsType: Array.isArray(columns) ? 'Array' : typeof columns,
      isMultiMonth,
      activeTab,
      viewMode
    });
    console.log('🔍 PnP Debug - Data:', {
      displayDataCount: displayData?.length,
      pnpDataCount: pnpData?.length,
      filteredDataCount: filteredData?.length
    });
  }, [columns, displayData, pnpData, filteredData, isMultiMonth, activeTab, viewMode]);

  // Helper function to get data for a specific tab
  const getDataForTab = (tabId) => {
    let tabData = [...pnpData];
    
    // Apply tab-specific filtering only if user should see tabs
    if (shouldShowTabs && tabId !== 'all') {
      tabData = tabData.filter(row => {
        const currMo4MoRate = row.curr_mo_4mo_rate || 0;
        const proj1Rate = row.proj_plus_1_4mo_rate || 0;
        const proj2Rate = row.proj_plus_2_4mo_rate || 0;
        
        switch (tabId) {
          case 'over':
            return currMo4MoRate >= 85 && proj1Rate >= 85 && proj2Rate >= 85;
          case 'under':
            return currMo4MoRate < 85 || proj1Rate < 85 || proj2Rate < 85;
          default:
            return true;
        }
      });
    }
    
    // Apply search filter if active
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      tabData = tabData.filter(row => {
        const nameLineMatch = row.name_line?.toLowerCase().includes(searchLower);
        const esidMatch = row.esid?.toLowerCase().includes(searchLower);
        const agentNumMatch = row.agent_num?.toLowerCase().includes(searchLower);
        
        return nameLineMatch || esidMatch || agentNumMatch;
      });
    }
    
    return tabData;
  };

  // Helper function to transform data for export
  const transformDataForExport = (data) => {
    return data.map(item => {
      // For multi-month exports, include report_date and simplified columns
      if (isMultiMonth) {
        return {
          bonus: item.bonus,
          report_date: item.report_date,
          name_line: item.name_line,
          esid: item.esid,
          agent_num: item.agent_num,
          
          // Current Month
          curr_mo_grs_submit: item.curr_mo_grs_submit,
          curr_mo_net_submit: item.curr_mo_net_submit,
          curr_mo_pct: item.curr_mo_pct,
          
          // Past 12 Months
          past_12_mo_life_grs_submit: item.past_12_mo_life_grs_submit,
          past_12_mo_life_net_submit: item.past_12_mo_life_net_submit,
          past_12_mo_life_pct: item.past_12_mo_life_pct,
          
          // Current YTD
          cur_ytd_life_grs_submit: item.cur_ytd_life_grs_submit,
          cur_ytd_life_net_submit: item.cur_ytd_life_net_submit,
          cur_ytd_pct: item.cur_ytd_pct
        };
      }
      
      // For single month, include all columns
      return {
        // Basic info
        bonus: item.bonus,
        name_line: item.name_line,
        esid: item.esid,
        agent_num: item.agent_num,
        date: item.report_date || currentDate,
        
        // Current Month
        curr_mo_grs_submit: item.curr_mo_grs_submit,
        curr_mo_net_submit: item.curr_mo_net_submit,
        curr_mo_pct: item.curr_mo_pct,
        curr_mo_4mo_rate: item.curr_mo_4mo_rate,
        
        // Past 12 Months
        past_12_mo_life_grs_submit: item.past_12_mo_life_grs_submit,
        past_12_mo_life_net_submit: item.past_12_mo_life_net_submit,
        past_12_mo_life_pct: item.past_12_mo_life_pct,
        
        // Current YTD
        cur_ytd_life_grs_submit: item.cur_ytd_life_grs_submit,
        cur_ytd_life_net_submit: item.cur_ytd_life_net_submit,
        cur_ytd_pct: item.cur_ytd_pct,
        
        // Projection +1
        proj_plus_1_months: item.proj_plus_1_months,
        proj_plus_1_submit: item.proj_plus_1_submit,
        proj_plus_1_net_iss: item.proj_plus_1_net_iss,
        proj_plus_1_net_sub: item.proj_plus_1_net_sub,
        proj_plus_1_paid4mo: item.proj_plus_1_paid4mo,
        proj_plus_1_4mo_rate: item.proj_plus_1_4mo_rate,
        
        // Projection +2
        proj_plus_2_months: item.proj_plus_2_months,
        proj_plus_2_submit: item.proj_plus_2_submit,
        proj_plus_2_net_iss: item.proj_plus_2_net_iss,
        proj_plus_2_net_sub: item.proj_plus_2_net_sub,
        proj_plus_2_paid4mo: item.proj_plus_2_paid4mo,
        proj_plus_2_4mo_rate: item.proj_plus_2_4mo_rate
      };
    });
  };

  // Create export data structure with multiple worksheets
  const exportData = useMemo(() => {
    const dateLabel = isMultiMonth 
      ? `${selectedDates.length} months` 
      : currentDate;
      
    return {
      summary: {
        currentDate: dateLabel,
        selectedDates: selectedDates,
        searchTerm: searchTerm,
        totalAllRecords: pnpData.length,
        isFiltered: searchTerm.trim() !== '',
        isMultiMonth: isMultiMonth,
        generatedTabs: shouldShowTabs && !isMultiMonth ? TABS_CONFIG.length : 1
      },
      // Multiple worksheets - one for each tab (or single sheet if no tabs or multi-month)
      worksheets: (shouldShowTabs && !isMultiMonth) ? TABS_CONFIG.map(tab => {
        const tabData = getDataForTab(tab.id);
        const worksheet = {
          name: tab.label,
          description: tab.description,
          data: transformDataForExport(tabData),
          recordCount: tabData.length,
          columns: tab.id === 'all' ? 'all' : 'rates' // Column set identifier
        };
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 PnP Export - Tab "${tab.label}": ${tabData.length} records`);
        }
        
        return worksheet;
      }) : [{
        name: isMultiMonth ? 'Multi-Month Data' : 'PnP Data',
        description: isMultiMonth ? `P&P data for ${selectedDates.length} months` : 'All P&P records',
        data: transformDataForExport(filteredData),
        recordCount: filteredData.length,
        columns: isMultiMonth ? 'multiMonth' : 'all'
      }],
      // Maintain backward compatibility
      chartData: transformDataForExport(filteredData)
    };
  }, [pnpData, filteredData, selectedDates, isMultiMonth, currentDate, searchTerm, shouldShowTabs]);

  // Create multi-sheet XLSX export function
  const handleXLSXExport = async () => {
    setIsPreparedForExport(true);
    
    try {
      console.log('📊 Starting PnP multi-sheet XLSX export...');
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Process each worksheet from exportData
      exportData.worksheets.forEach(worksheet => {
        console.log(`📊 Creating sheet "${worksheet.name}" with ${worksheet.data.length} records`);
        
        // Prepare headers based on column set
        let headers = [];
        let dataRows = [];
        
        if (worksheet.columns === 'multiMonth') {
          // Multi-month columns (simplified with report date)
          headers = [
            'Bonus', 'Report Date', 'Name Line', 'ESID', 'Agent #',
            'Current Month Gross Submit', 'Current Month Net Submit', 'Current Month %',
            'Past 12 Mo Gross Submit', 'Past 12 Mo Net Submit', 'Past 12 Mo %',
            'Current YTD Gross Submit', 'Current YTD Net Submit', 'Current YTD %'
          ];
          
          dataRows = worksheet.data.map(item => [
            item.bonus, item.report_date, item.name_line, item.esid, item.agent_num,
            item.curr_mo_grs_submit, item.curr_mo_net_submit, item.curr_mo_pct,
            item.past_12_mo_life_grs_submit, item.past_12_mo_life_net_submit, item.past_12_mo_life_pct,
            item.cur_ytd_life_grs_submit, item.cur_ytd_life_net_submit, item.cur_ytd_pct
          ]);
        } else if (worksheet.columns === 'all') {
          // All columns (removed Level)
          headers = [
            'Bonus', 'Name Line', 'ESID', 'Agent #',
            'Current Month Gross Submit', 'Current Month Net Submit', 'Current Month %', 'Current Month 4Mo Rate',
            'Past 12 Mo Life Gross Submit', 'Past 12 Mo Life Net Submit', 'Past 12 Mo Life %',
            'Current YTD Life Gross Submit', 'Current YTD Life Net Submit', 'Current YTD %',
            'Current Month Submit', 'Current Month Net Issue', 'Current Month Net Submit',
            'Current Month Paid 4Mo', 'Proj+1 Months', 'Proj+1 Submit', 'Proj+1 Net Issue',
            'Proj+1 Net Submit', 'Proj+1 Paid 4Mo', 'Proj+1 4Mo Rate',
            'Proj+2 Months', 'Proj+2 Submit', 'Proj+2 Net Issue', 'Proj+2 Net Submit',
            'Proj+2 Paid 4Mo', 'Proj+2 4Mo Rate'
          ];
          
          dataRows = worksheet.data.map(item => [
            item.bonus, item.name_line, item.esid, item.agent_num,
            item.curr_mo_grs_submit, item.curr_mo_net_submit, item.curr_mo_pct, item.curr_mo_4mo_rate,
            item.past_12_mo_life_grs_submit, item.past_12_mo_life_net_submit, item.past_12_mo_life_pct,
            item.cur_ytd_life_grs_submit, item.cur_ytd_life_net_submit, item.cur_ytd_pct,
            item.curr_mo_submit, item.curr_mo_net_iss, item.curr_mo_net_sub, item.curr_mo_paid4mo,
            item.proj_plus_1_months, item.proj_plus_1_submit, item.proj_plus_1_net_iss,
            item.proj_plus_1_net_sub, item.proj_plus_1_paid4mo, item.proj_plus_1_4mo_rate,
            item.proj_plus_2_months, item.proj_plus_2_submit, item.proj_plus_2_net_iss,
            item.proj_plus_2_net_sub, item.proj_plus_2_paid4mo, item.proj_plus_2_4mo_rate
          ]);
        } else {
          // Rate columns (over/under) (removed Level)
          headers = [
            'Bonus', 'Name Line', 'ESID', 'Agent #',
            'Current Month 4Mo Rate', 'Proj+1 4Mo Rate', 'Proj+2 4Mo Rate'
          ];
          dataRows = worksheet.data.map(item => [
            item.bonus, item.name_line, item.esid, item.agent_num,
            item.curr_mo_4mo_rate, item.proj_plus_1_4mo_rate, item.proj_plus_2_4mo_rate
          ]);
        }
        
        // Create sheet data
        const sheetData = [headers, ...dataRows];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Apply formatting
        const range = XLSX.utils.decode_range(sheet['!ref']);
        
        // Format header row
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
          if (sheet[cellRef]) {
            sheet[cellRef].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { bgColor: { indexed: 64 }, fgColor: { rgb: "366092" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
              }
            };
          }
        }
        
        // Set column widths
        const colWidths = headers.map(header => {
          if (header.includes('Name')) return { wch: 25 };
          if (header.includes('ESID')) return { wch: 15 };
          if (header.includes('Agent')) return { wch: 12 };
          if (header.includes('Rate')) return { wch: 18 };
          if (header.includes('Submit') || header.includes('Gross') || header.includes('Net')) return { wch: 16 };
          return { wch: 12 };
        });
        sheet['!cols'] = colWidths;
        
        // Create Excel Table with filters and formatting
        const tableRange = XLSX.utils.encode_range({
          s: { c: 0, r: 0 }, // Start at A1
          e: { c: headers.length - 1, r: dataRows.length } // End at last column, last row
        });
        
        // Add autofilter (enables filtering dropdowns)
        sheet['!autofilter'] = { ref: tableRange };
        
        // Create Excel table formatting (if supported by XLSX version)
        try {
          if (!sheet['!tables']) sheet['!tables'] = [];
          sheet['!tables'].push({
            ref: tableRange,
            name: `Table_${worksheet.name.replace(/[^A-Za-z0-9]/g, '_')}`,
            headerRowCount: 1,
            totalsRowCount: 0,
            style: {
              theme: 'TableStyleMedium2', // Professional blue theme
              showFirstColumn: false,
              showLastColumn: false,
              showRowStripes: true,
              showColumnStripes: false
            }
          });
          console.log(`📊 Added table formatting to "${worksheet.name}" sheet`);
        } catch (error) {
          console.log(`⚠️ Table formatting not fully supported, using autofilter only for "${worksheet.name}"`);
        }
        
        // Freeze header row
        sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, sheet, worksheet.name);
      });
      
      // Generate filename and save
      const tabsSuffix = shouldShowTabs && !isMultiMonth ? '_All_Tabs' : '';
      const dateSuffix = isMultiMonth 
        ? `${selectedDates.length}_months`
        : (currentDate?.replace(/\//g, '-') || 'current');
      const filename = `PnP_Report${tabsSuffix}${searchTerm ? '_filtered' : ''}_${dateSuffix}.xlsx`;
      
      // Write and download the file
      XLSX.writeFile(workbook, filename);
      
      console.log(`✅ PnP XLSX export completed: ${filename}`);
      
    } catch (error) {
      console.error('❌ PnP XLSX export failed:', error);
      window.alert('Failed to export XLSX file. Please try again.');
    } finally {
      setIsPreparedForExport(false);
    }
  };

  // Recap multi-sheet XLSX export
  const handleRecapExport = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const headers = ['Name', 'ESID', 'Month Recap', 'YTD Recap', '4Mo Rate'];

      RECAP_SUB_TABS.forEach(tab => {
        const rows = recapData[tab.id.toLowerCase()] || [];
        const dataRows = rows.map(r => [
          r.name_line,
          r.esid || '',
          r.month_recap,
          r.ytd_recap,
          r.curr_mo_4mo_rate || ''
        ]);

        const sheetData = [headers, ...dataRows];
        const sheet = XLSX.utils.aoa_to_sheet(sheetData);

        // Column widths
        sheet['!cols'] = [
          { wch: 25 }, // Name
          { wch: 12 }, // ESID
          { wch: 16 }, // Month Recap
          { wch: 16 }, // YTD Recap
          { wch: 12 }  // 4Mo Rate
        ];

        // Autofilter
        if (dataRows.length > 0) {
          sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 4, r: dataRows.length } }) };
        }

        XLSX.utils.book_append_sheet(workbook, sheet, tab.label);
      });

      const dateSuffix = currentDate?.replace(/\//g, '-') || 'current';
      XLSX.writeFile(workbook, `PnP_Recap_${dateSuffix}.xlsx`);
    } catch (error) {
      console.error('Recap export failed:', error);
      window.alert('Failed to export recap. Please try again.');
    }
  };

  if ((loading && availableDates.length === 0) || (pnpHierarchyLoading && viewMode === 'hierarchy')) {
    return (
      <div className="pnp-container">
        <div className="route-loading" role="alert" aria-busy="true">
          <div className="spinner"></div>
          <p>Loading P&P data{pnpHierarchyLoading ? ' and hierarchy structure' : ''}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pnp-container">
        <div className="error-message">
          <h3>Error Loading P&P Data</h3>
          <p>{error}</p>
          <button onClick={fetchAvailableDates} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`pnp-container ${viewMode === 'hierarchy' ? 'hierarchy-mode' : ''}`}>
      {/* Header with search and controls */}
      <div className="pnp-header" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Date Navigation / Multi-Select */}
        <div className="date-navigation" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }} ref={datePickerRef}>
          {/* Previous button (only enabled in single-month mode) */}
          <button 
            onClick={goToPreviousDate}
            disabled={isMultiMonth || availableDates.indexOf(selectedDates[0]) >= availableDates.length - 1}
            className="date-nav-btn"
            style={{ padding: 4, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            title={isMultiMonth ? 'Navigation disabled in multi-month mode' : 'Previous month'}
          >
            <FiChevronLeft />
          </button>
          
          {/* Date selector button */}
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="date-selector-btn"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              fontSize: 12, 
              color: 'var(--text-primary)', 
              padding: '6px 10px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              cursor: 'pointer',
              minWidth: 140,
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiCalendar />
              <span>
                {selectedDates.length === 1 
                  ? selectedDates[0] 
                  : `${selectedDates.length} months selected`}
              </span>
            </div>
            <FiChevronDown style={{ fontSize: 14 }} />
          </button>
          
          {/* Next button (only enabled in single-month mode) */}
          <button 
            onClick={goToNextDate}
            disabled={isMultiMonth || availableDates.indexOf(selectedDates[0]) <= 0}
            className="date-nav-btn"
            style={{ padding: 4, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            title={isMultiMonth ? 'Navigation disabled in multi-month mode' : 'Next month'}
          >
            <FiChevronRight />
          </button>
          
          {/* Date picker dropdown */}
          {showDatePicker && (
            <div 
              className="date-picker-dropdown"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                minWidth: 240,
                maxHeight: 360,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header with quick actions */}
              <div style={{ 
                padding: '10px 12px', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: 8,
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Select Months
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={selectAllDates}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      background: 'var(--button-secondary-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={selectSingleDate}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      background: 'var(--button-secondary-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Latest
                  </button>
                </div>
              </div>
              
              {/* Info banner when multiple selected */}
              {isMultiMonth && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(0, 85, 140, 0.1)',
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}>
                  📊 Showing Current Month, Past 12 Mo, and YTD only
                </div>
              )}
              
              {/* Date list */}
              <div style={{ 
                overflowY: 'auto', 
                maxHeight: 260,
                padding: '8px 0'
              }}>
                {availableDates.map((date) => {
                  const isSelected = selectedDates.includes(date);
                  return (
                    <div
                      key={date}
                      onClick={() => toggleDateSelection(date)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(0, 85, 140, 0.1)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? 'rgba(0, 85, 140, 0.15)' : 'var(--hover-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(0, 85, 140, 0.1)' : 'transparent'}
                    >
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: isSelected ? '2px solid #00558c' : '2px solid var(--border-color)',
                        background: isSelected ? '#00558c' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isSelected && <FiCheck style={{ color: 'white', fontSize: 12 }} />}
                      </div>
                      <span style={{ 
                        fontSize: 13, 
                        color: 'var(--text-primary)',
                        fontWeight: isSelected ? 500 : 400
                      }}>
                        {date}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div style={{ 
                padding: '10px 12px', 
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowDatePicker(false)}
                  style={{
                    fontSize: 12,
                    padding: '6px 14px',
                    background: '#00558c',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'white',
                    fontWeight: 500
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="pnp-search-section" style={{ flex: '1 1 520px', minWidth: 260 }}>
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, ESID, or agent number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="clear-search-btn"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        
        <div className="pnp-header-controls" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto', marginLeft: 'auto' }}>
          {/* Admin/app upload UI - upload icon, then separate Process button */}
          {(isAdmin || user?.teamRole === 'app') && (
            <div className="pnp-upload">
              <input
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="upload-btn"
                  onClick={handleChooseFile}
                  style={{
                    padding: '8px',
                    backgroundColor: '#00558c',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Upload PnP PDF"
                  aria-label="Upload PnP PDF"
                  disabled={uploading}
                >
                  <FiUpload />
                </button>
                {selectedFileName && (
                  <span style={{ fontSize: 12, color: '#333' }}>{selectedFileName}</span>
                )}
                <button
                  onClick={handleProcess}
                  disabled={uploading || !selectedFileName}
                  style={{
                    padding: '8px',
                    backgroundColor: uploading ? '#999' : '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                  title="Process PDF"
                >
                  {uploading ? 'Uploading...' : 'Process PDF'}
                </button>
              </div>
              {(uploading || processingUpload) && (
                <div style={{ marginTop: 6 }}>
                  {/* Simple progress bar */}
                  <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', width: 240 }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#4CAF50', transition: 'width 0.2s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {uploading ? `Uploading: ${uploadProgress}%` : 'Processing...'}
                  </div>
                </div>
              )}
              {uploadError && (
                <div style={{ color: '#b00020', fontSize: 12, marginTop: 6 }}>{uploadError}</div>
              )}
            </div>
          )}
          {/* Filter Menu */}
          <div className="pnp-filter-menu">
            <button
              className="filter-toggle-btn"
              style={{
                padding: '8px',
                backgroundColor: hasActiveFilters() ? '#00558c' : 'transparent',
                color: hasActiveFilters() ? 'white' : '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
              title="Filter P&P Data"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
            >
              <FiFilter />
            </button>
            
            {showFilterMenu && (
              <div className="filter-dropdown">
                <div className="filter-section">
                  <h4>ESID Date Range</h4>
                  <div className="filter-row">
                    <input
                      type="date"
                      placeholder="From"
                      value={activeFilters.esidRange.min}
                      onChange={(e) => updateRangeFilter('esidRange', 'min', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="date"
                      placeholder="To"
                      value={activeFilters.esidRange.max}
                      onChange={(e) => updateRangeFilter('esidRange', 'max', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="filter-section">
                  <h4>Gross Submit Range</h4>
                  <div className="filter-row">
                    <input
                      type="number"
                      placeholder="Min"
                      value={activeFilters.grossSubmitRange.min}
                      onChange={(e) => updateRangeFilter('grossSubmitRange', 'min', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={activeFilters.grossSubmitRange.max}
                      onChange={(e) => updateRangeFilter('grossSubmitRange', 'max', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="filter-section">
                  <h4>Net Submit Range</h4>
                  <div className="filter-row">
                    <input
                      type="number"
                      placeholder="Min"
                      value={activeFilters.netSubmitRange.min}
                      onChange={(e) => updateRangeFilter('netSubmitRange', 'min', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={activeFilters.netSubmitRange.max}
                      onChange={(e) => updateRangeFilter('netSubmitRange', 'max', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="filter-section">
                  <h4>4-Mo Rate % Range</h4>
                  <div className="filter-row">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={activeFilters.fourMoRateRange.min}
                      onChange={(e) => updateRangeFilter('fourMoRateRange', 'min', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      placeholder="Max %"
                      value={activeFilters.fourMoRateRange.max}
                      onChange={(e) => updateRangeFilter('fourMoRateRange', 'max', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="filter-section">
                  <h4>Proj +1 Range</h4>
                  <div className="filter-row">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={activeFilters.proj1Range.min}
                      onChange={(e) => updateRangeFilter('proj1Range', 'min', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      placeholder="Max %"
                      value={activeFilters.proj1Range.max}
                      onChange={(e) => updateRangeFilter('proj1Range', 'max', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="filter-section">
                  <h4>Proj +2 Range</h4>
                  <div className="filter-row">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={activeFilters.proj2Range.min}
                      onChange={(e) => updateRangeFilter('proj2Range', 'min', e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      placeholder="Max %"
                      value={activeFilters.proj2Range.max}
                      onChange={(e) => updateRangeFilter('proj2Range', 'max', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="filter-section">
                  <label>
                    <input
                      type="checkbox"
                      checked={activeFilters.showZeroValues}
                      onChange={toggleZeroValuesFilter}
                    />
                    Show zero values
                  </label>
                </div>
                
                <div className="filter-actions">
                  <button onClick={clearAllFilters}>Clear All</button>
                  <button onClick={() => setShowFilterMenu(false)}>Done</button>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              onClick={() => setViewMode('flat')}
              className={`view-mode-btn ${viewMode === 'flat' ? 'active' : ''}`}
              title="Flat view"
            >
              <FiList />
            </button>
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`view-mode-btn ${viewMode === 'hierarchy' ? 'active' : ''}`}
              title="Hierarchy view"
            >
              <FiGrid />
            </button>
          </div>
        </div>
      </div>

      {/* ActionBar with performance tabs and export button */}
      <ActionBar
        selectedCount={0}
        totalCount={displayData.filter(row => !row.isMgaHeader).length}
        entityName="agents"
        archivedView={false}
      >
        {/* Performance Tabs */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {TABS_CONFIG
            .filter(tab => tab.id === 'recap' || shouldShowTabs)
            .map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: activeTab === tab.id ? '#00558c' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#666',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={tab.description}
              >
                {tab.label}
                {tab.id !== 'recap' && (
                  <span style={{ fontSize: '11px', opacity: 0.9 }}>
                    ({activeTab === tab.id ? displayData.filter(row => !row.isMgaHeader).length : tab.count})
                  </span>
                )}
              </button>
            ))}
        </div>

        {/* Export Button - always visible */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={handleXLSXExport}
            disabled={isPreparedForExport}
            style={{
              padding: '8px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isPreparedForExport ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isPreparedForExport ? 0.6 : 1,
              fontSize: '16px'
            }}
            title={`Export ${isMultiMonth ? `${selectedDates.length} months` : (shouldShowTabs ? 'all tabs' : 'data')} to Excel${searchTerm ? ' (filtered)' : ''}`}
          >
            <FiDownload className={isPreparedForExport ? 'spinning' : ''} />
          </button>
        </div>
      </ActionBar>

      {/* Recap view */}
      {activeTab === 'recap' ? (
        <div className="pnp-recap-container">
          <div className="pnp-recap-header">
            <div className="pnp-recap-subtabs">
              {RECAP_SUB_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRecapSubTab(tab.id)}
                  className={`pnp-recap-subtab ${recapSubTab === tab.id ? 'active' : ''}`}
                >
                  {tab.label}
                  <span className="pnp-recap-subtab-count">
                    ({(recapData[tab.id.toLowerCase()] || []).length})
                  </span>
                </button>
              ))}
            </div>
            {!recapLoading && !isMultiMonth && (
              <button
                onClick={handleRecapExport}
                style={{
                  padding: '8px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
                title="Export Recap to Excel (all tabs)"
              >
                <FiDownload />
              </button>
            )}
          </div>
          {recapLoading ? (
            <div className="route-loading" role="alert" aria-busy="true">
              <div className="spinner"></div>
              <p>Loading recap data...</p>
            </div>
          ) : isMultiMonth ? (
            <div className="no-data-message">
              <p>Recap is only available for a single month selection.</p>
            </div>
          ) : (
            <DataTable
              columns={[
                { Header: 'Name', accessor: 'name_line', autoWidth: true },
                { Header: 'ESID', accessor: 'esid', width: 100 },
                { Header: 'Month Recap', accessor: 'month_recap', width: 140, className: 'text-right', Cell: CurrencyCell },
                { Header: 'YTD Recap', accessor: 'ytd_recap', width: 140, className: 'text-right', Cell: CurrencyCell },
                { Header: '4Mo Rate', accessor: 'curr_mo_4mo_rate', width: 100, className: 'text-right', Cell: PercentageCell }
              ]}
              data={recapData[recapSubTab.toLowerCase()] || []}
              disableCellEditing={true}
              showActionBar={false}
              disablePagination={(recapData[recapSubTab.toLowerCase()] || []).length <= 100}
              stickyHeader={true}
              entityName="agent"
            />
          )}
          {!recapLoading && !isMultiMonth && (recapData[recapSubTab.toLowerCase()] || []).length === 0 && (
            <div className="no-data-message">
              <p>No {recapSubTab} recap data available for {currentDate}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Data table */}
          {loading ? (
            <div className="route-loading" role="alert" aria-busy="true">
              <div className="spinner"></div>
              <p>Loading table data...</p>
            </div>
          ) : columns && Array.isArray(columns) && columns.length > 0 && displayData && Array.isArray(displayData) ? (
            <DataTable
              columns={columns}
              data={displayData}
              disableCellEditing={true}
              showActionBar={false}
              disablePagination={displayData.length <= 100}
              allowTableOverflow={true}
              stickyHeader={true}
              entityName="PnP record"
            />
          ) : (
            <div className="error-message">
              <p>Unable to display table: Invalid columns or data</p>
              <p style={{ fontSize: 12, color: '#666' }}>
                Columns: {columns ? `${columns.length} defined` : 'undefined'},
                Data: {displayData ? `${displayData.length} rows` : 'undefined'}
              </p>
            </div>
          )}

          {!loading && displayData.length === 0 && pnpData.length > 0 && (
            <div className="no-data-message">
              <p>
                {shouldShowTabs
                  ? `No records match the "${TABS_CONFIG.find(t => t.id === activeTab)?.label}" filter criteria`
                  : 'No records match your search criteria'
                }
              </p>
            </div>
          )}

          {!loading && pnpData.length === 0 && (
            <div className="no-data-message">
              <p>No P&P data available for {isMultiMonth ? `${selectedDates.length} selected months` : currentDate}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Pnp;
