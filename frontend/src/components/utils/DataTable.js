import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTable, useSortBy, usePagination } from "react-table";
import debounce from "lodash.debounce";
import ContextMenu from "./ContextMenu";
import Pagination from "./Pagination";
import CustomAutocomplete from "./CustomAutocomplete";
import ActionBar from "./ActionBar";
import FilterMenu from "../common/FilterMenu";
import "./DataTable.css";
import { DateTime } from "luxon";
import AddressContextMenu from "./AddressContextMenu";
import { Cell } from "./Cell";
import { FiX, FiPlus, FiUpload, FiDownload, FiTrash2, FiArchive, FiMail, FiRefreshCw, FiUsers, FiEye, FiEyeOff, FiFilter, FiSave, FiBookmark } from "react-icons/fi";
import { BiSortAZ, BiSortZA } from "react-icons/bi";
import { AiOutlineClose } from "react-icons/ai";

const DataTable = ({
  columns,
  data,
  onCellUpdate,
  onCellBlur,
  onMassStatusChange,
  onSelectionChange,
  onRowsRendered = null,
  enableRowContextMenu = false,
  getRowContextMenuOptions, 
  onCreateCompany,
  onOpenDetails,
  existingCompanies = [],
  disablePagination = false,
  disableSorting = false,
  defaultSortBy = null,
  defaultSortOrder = "asc",
  onSortChange,
  highlightRowOnEdit = true,
  entityName = "item",
  archivedView = false,
  onAddNew,
  onImport,
  onExport,
  onDelete,
  onArchive,
  onSendEmail,
  onToggleArchivedView,
  onRefresh,
  onMassReassign,
  onSaveChanges,
  onCancelChanges,
  showActionBar = true,
  disableCellEditing = false,
  autoSave = true, // New prop to control auto-save behavior
  actionBarButtons = {
    addNew: true,
    import: true,
    export: true,
    delete: true,
    archive: true,
    sendEmail: true,
    toggleArchived: true,
    refresh: true,
    reassign: true,
    saveChanges: false,
    cancelChanges: false
  },
  // Custom action bar content appended to default controls
  actionBarExtras = null,
  filterOptions = {
    showFilterMenu: false,
    roleFilters: [],
    statusFilters: [],
    stateFilters: []
  },
  onFilterChange,
  // New totals props
  showTotals = false,
  totalsPosition = 'top', // 'top' | 'bottom' | 'both'
  totalsColumns = [], // array of column accessors to sum
  totalsLabel = 'Totals',
  totalsLabelColumn = null, // which column to show the label in (defaults to first column)
  // Row styling props
  rowClassNames = {}, // object mapping row IDs to CSS class names
  bandedRows = false, // enable alternating row colors (zebra striping) for better readability
  // Sticky props
  stickyHeader = true, // make header sticky
  stickyRows = [], // array of row IDs that should be sticky
  stickyTop = 0, // top offset for sticky positioning
  pageScrollSticky = false, // true = stick to page scroll, false = stick to table scroll
  onRowHover = null, // callback for row hover events
  onRowClick = null, // callback for row click events
  // Expandable row props
  enableRowExpansion = false, // enable expandable rows functionality
  expandableRows = {}, // object mapping row IDs to boolean (which rows can be expanded)
  renderExpandedRow = null, // function to render expanded content: (row) => JSX
  onRowExpansionChange = null, // callback when row expansion state changes: (rowId, isExpanded) => void
  expandedRowsInitial = {}, // initial expanded state: {rowId: boolean}
  expandableDefault = true, // default expandability when row not specified in expandableRows
  isRowExpandable = null, // optional predicate: (rowOriginal) => boolean; further restricts expandability
  expandOnRowClick = false, // when true, clicking anywhere on an expandable row toggles expansion
  showExpandButton = true, // when false, hides the expand arrow button in cells
  // Table layout props
  allowTableOverflow = false, // allow table to be wider than container for horizontal scrolling
  // Row coloring props
  enableRowColoring = false, // enable row coloring functionality
  rowColorColumn = 'rowcolor', // column accessor that contains the color value
  // Table/row customization
  tableClassName = '', // additional class name(s) for the table element
  getRowDataAttributes = null, // optional function: (rowOriginal) => { 'data-role': 'MGA', ... }
  // Column filtering props
  enableColumnFilters = false, // enable Excel-like column filtering
  onColumnFilterChange = null, // callback when column filters change: (filters) => void
  tableId = 'default-table' // unique identifier for the table to save/load filters
}) => {
  // Helper function for creating styled icon buttons
  const createIconButton = (onClick, icon, title, disabled = false) => (
    <button 
      onClick={onClick} 
      className="action-button icon-button"
      title={title}
      disabled={disabled}
      style={{
        color: disabled ? '#9ca3af' : '#6b7280',
        backgroundColor: 'transparent',
        border: 'none',
        padding: '8px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
      onMouseEnter={(e) => !disabled && (e.target.style.color = '#374151')}
      onMouseLeave={(e) => !disabled && (e.target.style.color = '#6b7280')}
    >
      {icon}
    </button>
  );

  const [editingCell, setEditingCell] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [localData, setLocalData] = useState(data);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedRows, setSelectedRows] = useState({});
  const [expandedRows, setExpandedRows] = useState(expandedRowsInitial);
  const [activeFilters, setActiveFilters] = useState({
    // Role filters
    ...filterOptions.roleFilters.reduce((acc, role) => ({ ...acc, [role]: true }), {}),
    // Status filters
    ...filterOptions.statusFilters.reduce((acc, filter) => ({ ...acc, [filter.key]: null }), {}),
    // State filters
    states: {}
  });
  const [allAvailableStates, setAllAvailableStates] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});  // {columnId: filterValue}
  const [showColumnFilter, setShowColumnFilter] = useState(null); // which column's filter dropdown is open
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({ top: 0, left: 0 }); // position for filter dropdown
  const [tempFilterSelections, setTempFilterSelections] = useState({}); // temporary selections before applying
  const [filterSearchTerm, setFilterSearchTerm] = useState(''); // search term for filtering checkbox options
  const [showSaveFilterDialog, setShowSaveFilterDialog] = useState(false); // show save filter dialog
  const [saveFilterName, setSaveFilterName] = useState(''); // name for saving filter
  const [savedFilters, setSavedFilters] = useState([]); // list of saved filters
  const [showSavedFilters, setShowSavedFilters] = useState(false); // show saved filters list
  const [filterToDelete, setFilterToDelete] = useState(null); // filter pending deletion confirmation
  const tableRef = useRef(null);
  const inputRef = useRef(null);
  const filterButtonRefs = useRef({}); // refs for filter buttons to calculate position

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      const input = inputRef.current;
      input.focus();
      if (input.type === "text") {
        setTimeout(() => {
          input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
      }
    }
  }, [editingCell]);
  

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tableRef.current && !tableRef.current.contains(event.target)) {
        setEditingCell(null);
        setShowColumnFilter(null);
        setFilterSearchTerm('');
        setShowSavedFilters(false);
        setShowSaveFilterDialog(false);
        setFilterToDelete(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    if (enableColumnFilters) {
      const loadSavedFilters = () => {
        try {
          const saved = localStorage.getItem(`datatable_saved_filters_${tableId}`);
          if (saved) {
            setSavedFilters(JSON.parse(saved));
          }
        } catch (error) {
          console.error('Error loading saved filters:', error);
        }
      };
      loadSavedFilters();
    }
  }, [tableId, enableColumnFilters]);

  // Save filters to localStorage
  const saveFilter = (name, columnId, filterData) => {
    try {
      const newFilter = {
        id: Date.now().toString(),
        name,
        tableId,
        columnId,
        filterData,
        createdAt: new Date().toISOString()
      };
      
      const updatedFilters = [...savedFilters, newFilter];
      setSavedFilters(updatedFilters);
      localStorage.setItem(`datatable_saved_filters_${tableId}`, JSON.stringify(updatedFilters));
      return true;
    } catch (error) {
      console.error('Error saving filter:', error);
      return false;
    }
  };

  // Load and apply a saved filter
  const loadSavedFilter = (filter) => {
    try {
      setColumnFilters(prev => ({
        ...prev,
        [filter.columnId]: filter.filterData
      }));
      setTempFilterSelections(prev => ({
        ...prev,
        [filter.columnId]: filter.filterData
      }));
      setShowSavedFilters(false);
    } catch (error) {
      console.error('Error loading filter:', error);
    }
  };

  // Delete a saved filter
  const deleteSavedFilter = (filterId) => {
    try {
      const updatedFilters = savedFilters.filter(f => f.id !== filterId);
      setSavedFilters(updatedFilters);
      localStorage.setItem(`datatable_saved_filters_${tableId}`, JSON.stringify(updatedFilters));
    } catch (error) {
      console.error('Error deleting filter:', error);
    }
  };

  
  const saveChangeDebounced = useRef(
    debounce(async (id, field, value) => {
      try {
        await onCellUpdate(id, field, value);
        // ✅ no more setLocalData or editing-data cleanup here
      } catch (error) {
        console.error("Error updating cell:", error);
      }
    }, 500)
  ).current;

  const handleEditStart = (id, field, value, asChip = false) => {
    // Don't allow editing if cell editing is disabled
    if (disableCellEditing) return;
    
    setEditingCell({ id, field, asChip });
    setEditedData((prev) => ({
      ...prev,
      [`${id}-${field}`]: value,
    }));
  };

  const handleEditChange = (id, field, value) => {
    // 2a) keep your "draft" state in case you need it elsewhere
    setEditedData(prev => ({
      ...prev,
      [`${id}-${field}`]: value,
    }));
  
    // 2b) optimistically write into the table's data immediately
    setLocalData(prev =>
      prev.map(r =>
        r.id === id
          ? { ...r, [field]: value }
          : r
      )
    );
  
    // 2c) always call onCellUpdate for local state management (even without autoSave)
    if (onCellUpdate) {
      onCellUpdate(id, field, value);
    }
  
    // 2d) only trigger debounced save if autoSave is enabled
    if (autoSave) {
      saveChangeDebounced(id, field, value);
    }
  };

  const handleCellClick = (id, field, value) => {
    // Don't allow editing if cell editing is disabled
    if (disableCellEditing) return;
    
    if (editingCell && (editingCell.id !== id || editingCell.field !== field)) {
      saveChangeDebounced.flush();
    }
    handleEditStart(id, field, value);
  };


  
  const handleKeyDown = (e, rowIndex, columnIndex, totalRows, totalCols) => {
    const moveToCell = (newRow, newCol) => {
      // Use the currently rendered page rows and their visible cells to determine targets
      const safeRowIndex = Math.max(0, Math.min(newRow, (renderedRows?.length || 0) - 1));
      const targetRow = renderedRows?.[safeRowIndex];
      if (!targetRow) return;

      const visibleColsCount = targetRow.cells?.length || 0;
      if (visibleColsCount === 0) return;

      const wrappedColIndex = ((newCol % visibleColsCount) + visibleColsCount) % visibleColsCount;
      const targetColId = targetRow.cells?.[wrappedColIndex]?.column?.id;
      const targetRowId = targetRow.original?.id ?? targetRow.id;

      if (targetColId !== undefined && targetRowId !== undefined) {
        console.log('[DataTable] moveToCell -> setEditingCell', {
          from: { rowIndex, columnIndex },
          to: { rowIndex: safeRowIndex, columnIndex: wrappedColIndex },
          targetRowId,
          targetColId
        });
        setEditingCell({ id: targetRowId, field: targetColId });

        // Try to programmatically focus the inner control (input/select) for the target cell
        // Selects are not tied to editing state, so they won't be focused by inputRef logic
        setTimeout(() => {
          console.log('[DataTable] focusing inner control for cell', {
            rowIndex: safeRowIndex,
            columnIndex: wrappedColIndex
          });
          const container = tableRef.current;
          if (!container) return;

          // Prefer selecting by indexed row/col added as data attributes
          let td = container.querySelector(
            `tbody tr[data-row-index=\"${safeRowIndex}\"] td[data-column-index=\"${wrappedColIndex}\"]`
          );

          // Fallback: any focusable within the row's nth cell
          if (!td) {
            const rows = Array.from(container.querySelectorAll('tbody tr'))
              .filter(r => !r.classList.contains('totals-row'));
            const rowEl = rows[safeRowIndex];
            if (rowEl) {
              td = rowEl.querySelectorAll('td')?.[wrappedColIndex];
            }
          }

          const focusable = td?.querySelector('select, input, textarea, [tabindex]:not([tabindex=\"-1\"])');
          if (focusable && typeof focusable.focus === 'function') {
            focusable.focus();
            if (focusable.tagName === 'INPUT' && focusable.type === 'text') {
              try {
                const len = focusable.value?.length ?? 0;
                focusable.setSelectionRange(len, len);
              } catch (_) {}
            }
          }
        }, 0);
      }
    };

    // If the active element is a dropdown/select, let it handle arrows/enter,
    // and let Tab move focus naturally.
    const target = e.target;
    const tagName = target?.tagName?.toUpperCase?.();
    const isSelect = tagName === 'SELECT';
    const isComboRole = target?.getAttribute && (
      target.getAttribute('role') === 'combobox' || target.getAttribute('role') === 'listbox'
    );
    const isDropdownLike = isSelect || isComboRole;

    switch (e.key) {
      case "Escape":
        setEditingCell(null);
        break;
      case "Enter":
        if (isDropdownLike) return; // allow select to open/select
        // fallthrough intended to Tab-like behavior
      case "Tab":
        console.log('[DataTable] Tab keydown', { rowIndex, columnIndex, shiftKey: !!e.shiftKey });
        e.preventDefault();
        moveToCell(rowIndex, columnIndex + (e.shiftKey ? -1 : 1));
        break;
      case "ArrowRight":
        if (isDropdownLike) return; // let dropdown handle
        e.preventDefault();
        moveToCell(rowIndex, columnIndex + 1);
        break;
      case "ArrowLeft":
        if (isDropdownLike) return; // let dropdown handle
        e.preventDefault();
        moveToCell(rowIndex, columnIndex - 1);
        break;
      case "ArrowDown":
        if (isDropdownLike) return; // let dropdown handle
        e.preventDefault();
        moveToCell(rowIndex + 1, columnIndex);
        break;
      case "ArrowUp":
        if (isDropdownLike) return; // let dropdown handle
        e.preventDefault();
        moveToCell(rowIndex - 1, columnIndex);
        break;
      default:
        break;
    }
  };

  const toggleRowSelection = (rowId) => {
      console.log(
         `Row ${rowId} will be ${selectedRows[rowId] ? 'deselected' : 'selected'}`
        );
    setSelectedRows((prev) => {
      const newSelection = { ...prev };
      if (newSelection[rowId]) {
        delete newSelection[rowId];
      } else {
        newSelection[rowId] = true;
      }
      if (onSelectionChange) {
        onSelectionChange(Object.keys(newSelection));
      }
      return newSelection;
    });
  };

  const handleHeaderStatusChange = (newValue) => {
    setLocalData((prev) =>
      prev.map((row) =>
        selectedRows[row.id] ? { ...row, status: newValue } : row
      )
    );
    Object.keys(selectedRows).forEach((rowId) => {
      onCellUpdate(rowId, "status", newValue);
    });
    if (onMassStatusChange) {
      onMassStatusChange(newValue, Object.keys(selectedRows));
    }
  };
  

  const toggleSelectAll = () => {
    if (localData.length && Object.keys(selectedRows).length === localData.length) {
      setSelectedRows({});
      onSelectionChange && onSelectionChange([]);
    } else {
      const newSelection = {};
      localData.forEach((row) => {
        newSelection[row.id] = true;
      });
      setSelectedRows(newSelection);
      onSelectionChange && onSelectionChange(Object.keys(newSelection));
    }
  };

  const initialPageSize = disablePagination ? data.length : 10;

  // Apply archive filter
  let filteredData = localData.filter(row => {
    // Handle archive filtering based on archivedView setting
    if (archivedView) {
      // Show only archived rows (archive === 'y')
      return row.archive === 'y' || row.archive === true || row.archive === 1;
    } else {
      // Show non-archived rows (archive !== 'y' or null/undefined)
      return row.archive !== 'y' && row.archive !== true && row.archive !== 1;
    }
  });
  
  // Apply column filters if enabled
  if (enableColumnFilters && Object.keys(columnFilters).length > 0) {
    filteredData = filteredData.filter(row => {
      return Object.entries(columnFilters).every(([columnId, filterValue]) => {
        // Skip empty filters
        if (!filterValue || filterValue === '' || filterValue === 'all') return true;
        
        const cellValue = row[columnId];
        
        // Handle null/undefined values
        if (cellValue === null || cellValue === undefined) return false;
        
        // Find the column config to check if it has filterSplitBy
        const column = columns.find(col => col.accessor === columnId || col.id === columnId);
        const filterSplitBy = column?.filterSplitBy;
        
        // Check if filterValue is an array (checkbox filter)
        if (Array.isArray(filterValue)) {
          const cellStr = String(cellValue).toLowerCase();
          
          // If column has filterSplitBy, check if any selected value is contained in the cell
          if (filterSplitBy) {
            // Split the cell value by the delimiter and check if any match
            const cellParts = cellStr.split(filterSplitBy).map(part => part.trim());
            return filterValue.some(val => {
              const filterStr = String(val).toLowerCase().trim();
              return cellParts.includes(filterStr);
            });
          } else {
            // For non-split columns, check exact match
            return filterValue.some(val => {
              const filterStr = String(val).toLowerCase();
              return cellStr === filterStr;
            });
          }
        } else {
          // For text filters, check if cell value includes the filter value
          const cellStr = String(cellValue).toLowerCase();
          const filterStr = String(filterValue).toLowerCase();
          return cellStr.includes(filterStr);
        }
      });
    });
  }

  // Build table hooks array conditionally
  const tableHooks = [];
  if (!disableSorting) {
    tableHooks.push(useSortBy);
  }
  if (!disablePagination) {
  tableHooks.push(usePagination);
  }

  // Build initial sort state
  const initialSort = (!disableSorting && defaultSortBy)
    ? [{ id: defaultSortBy, desc: defaultSortOrder === "desc" }]
    : [];

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    rows,
    prepareRow,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    canNextPage,
    canPreviousPage,
    state: { pageIndex, pageSize, sortBy },
  } = useTable(
    { 
      columns, 
      data: filteredData,
      getRowId: (row, index) => {
        // Use id or userId as unique identifier, fallback to index
        if (row && (row.id !== undefined && row.id !== null)) return String(row.id);
        if (row && (row.userId !== undefined && row.userId !== null)) return String(row.userId);
        return String(index);
      },
      initialState: { 
        pageIndex: 0, 
        pageSize: disablePagination ? filteredData.length || 1000 : 25,
        sortBy: initialSort
      }, 
      autoResetPage: false, 
      autoResetSortBy: false   
    },
    ...tableHooks
  );
  
  // Choose rows to render: all rows when pagination is disabled
  const renderedRows = disablePagination ? rows : page;

  // Notify parent of currently rendered rows (for diagnostics)
  // Use a ref to avoid infinite loops from inline function props
  const onRowsRenderedRef = React.useRef(onRowsRendered);
  React.useEffect(() => {
    onRowsRenderedRef.current = onRowsRendered;
  }, [onRowsRendered]);

  React.useEffect(() => {
    try {
      if (typeof onRowsRenderedRef.current === 'function') {
        const originals = (renderedRows || []).map(r => r.original || r);
        onRowsRenderedRef.current(originals);
      }
    } catch (_) {}
  }, [renderedRows]);
  
  // Update page size when data changes and pagination is disabled
  useEffect(() => {
    if (disablePagination && setPageSize && filteredData.length > 0) {
      setPageSize(filteredData.length);
    }
  }, [filteredData.length, disablePagination, setPageSize]);

  // Notify parent component when sort changes
  useEffect(() => {
    if (onSortChange && sortBy && sortBy.length > 0) {
      const currentSortBy = sortBy[0].id;
      const currentSortOrder = sortBy[0].desc ? 'desc' : 'asc';
      onSortChange({
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });
    }
  }, [sortBy, onSortChange]);
  
  const getContrastColor = (color) => {
    if (color[0] === "#") {
      color = color.slice(1);
    }
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? "black" : "white";
  };
  const handleCellDoubleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rowId = e.currentTarget.dataset.rowid;
    const field = e.currentTarget.dataset.field;
    // pull the current value from localData
    const value = localData.find(r => String(r.id) === rowId)?.[field];
    handleEditStart(rowId, field, value);
  }, [handleEditStart, localData]);
  const darkenColor = (color, amount) => {
    let usePound = false;
    if (color[0] === "#") {
      color = color.slice(1);
      usePound = true;
    }
    let num = parseInt(color, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;

    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));

    let newColor = (r << 16) | (g << 8) | b;
    let newColorStr = newColor.toString(16).padStart(6, "0");
    return (usePound ? "#" : "") + newColorStr;
  };

  const [addressContextMenu, setAddressContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    initialAddress: {},
    rowId: null,
  });

  const handleOpenAddressMenu = (e, initialAddress, rowId) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setAddressContextMenu({
      visible: true,
      x: rect.left,
      y: rect.top,
      initialAddress,
      rowId,
    });
  };
  
  const saveAddress = (newAddress) => {
    onCellUpdate(addressContextMenu.rowId, "address", newAddress);
    setAddressContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  const onOpenAddressMenu = (e, initialAddress, rowId) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setAddressContextMenu({
      visible: true,
      x: rect.left,
      y: rect.top,
      initialAddress,
      rowId,
    });
  };
  
  const renderCell = (cell, row, rowIndexProp, columnIndexProp) => {
    const isEditing =
      editingCell &&
      editingCell.id === row.id &&
      editingCell.field === cell.column.id;

    const value = cell.value;
    const columnType = cell.column.type || "text";

    const handleChange = (newValue) => {
      handleEditChange(row.id, cell.column.id, newValue);
    };

    const cellProps = {
      cell,
      row,
      rowIndex: rowIndexProp,
      columnIndex: columnIndexProp,
      columns,
      localData,
      editedData,
      editingCell,
      selectedRows,
      toggleRowSelection,
      existingCompanies,
      onCreateCompany,
      onOpenDetails,
      handleEditStart,
      handleEditChange,
      onCellUpdate,
      onCellBlur,
      handleKeyDown,
      inputRef,
      onOpenAddressMenu,
      value,
      isEditing,
      onChange: handleChange,
      onKeyDown: (e) =>
        handleKeyDown(
          e,
          row.index,
          cell.column.index,
          (disablePagination ? rows.length : page.length),
          row.cells.length
        ),
      type: columnType,
    };

    if (columnType === "select" && cell.column.options) {
      cellProps.options = cell.column.options;
    }

    if (cell.column.massSelection) {
      return (
        <input
          type="checkbox"
          checked={!!selectedRows[row.original.id]}
          onChange={(e) => {
            e.stopPropagation();
            toggleRowSelection(row.original.id);
          }}
        />
      );
    }

    return (
      <Cell {...cellProps} />
    );
  };

  // Helper function to flatten grouped columns
  const flattenColumns = (cols) => {
    const flattened = [];
    cols.forEach(col => {
      if (col.columns && col.columns.length > 0) {
        // This is a group, add its children
        flattened.push(...col.columns);
      } else {
        // This is a regular column
        flattened.push(col);
      }
    });
    return flattened;
  };

  // Calculate totals for specified columns
  const calculateTotals = () => {
    if (!showTotals || totalsColumns.length === 0) return null;

    const totals = {};
    const flatColumns = flattenColumns(columns);
    const labelColumnAccessor = totalsLabelColumn || flatColumns[0]?.accessor;

    // Initialize totals object
    flatColumns.forEach(col => {
      if (totalsColumns.includes(col.accessor)) {
        totals[col.accessor] = 0;
      } else if (col.accessor === labelColumnAccessor) {
        totals[col.accessor] = totalsLabel;
      } else {
        totals[col.accessor] = '';
      }
    });

    // Define stats columns that should be calculated, not summed
    const statsColumns = ['showRatio', 'closeRatio', 'alpPerSale', 'alpPerRefSale', 'alpPerRefCollected', 'refCloseRatio', 'refCollectedPerSit', 'callsToSitRatio', 'daysRep'];
    
    // Sum the specified columns (exclude weekly total rows, excluded rows, and stats columns)
    filteredData.forEach(row => {
      // Skip weekly total rows when calculating overall totals
      if (row.isWeeklyTotal) return;
      
      // Skip rows marked to exclude from totals (e.g., expanded MGA headers)
      if (row._excludeFromTotals) return;
      
      totalsColumns.forEach(colAccessor => {
        // Skip stats columns - they will be calculated separately
        if (statsColumns.includes(colAccessor)) return;
        
        const value = parseFloat(row[colAccessor]) || 0;
        totals[colAccessor] += value;
      });
    });

    // Calculate stats based on the summed totals
    if (totalsColumns.some(col => statsColumns.includes(col))) {
      const calls = totals.calls || 0;
      const appts = totals.appts || 0;
      const sits = totals.sits || 0;
      const sales = totals.sales || 0;
      const alp = totals.alp || 0;
      const refs = totals.refs || 0;
      const refAlp = totals.refAlp || 0;
      const refSale = totals.refSale || 0;
      const refSit = totals.refSit || 0;
      
      // Calculate each stat if it's included in totalsColumns
      if (totalsColumns.includes('showRatio')) {
        totals.showRatio = appts > 0 ? ((sits / appts) * 100).toFixed(1) + '%' : '0.0%';
      }
      if (totalsColumns.includes('closeRatio')) {
        totals.closeRatio = sits > 0 ? ((sales / sits) * 100).toFixed(1) + '%' : '0.0%';
      }
      if (totalsColumns.includes('alpPerSale')) {
        totals.alpPerSale = sales > 0 ? '$' + (alp / sales).toFixed(0) : '$0';
      }
      if (totalsColumns.includes('alpPerRefSale')) {
        totals.alpPerRefSale = refSale > 0 ? '$' + (refAlp / refSale).toFixed(0) : '$0';
      }
      if (totalsColumns.includes('alpPerRefCollected')) {
        totals.alpPerRefCollected = refs > 0 ? '$' + (refAlp / refs).toFixed(0) : '$0';
      }
      if (totalsColumns.includes('refCloseRatio')) {
        totals.refCloseRatio = refSit > 0 ? ((refSale / refSit) * 100).toFixed(1) + '%' : '0.0%';
      }
      if (totalsColumns.includes('refCollectedPerSit')) {
        totals.refCollectedPerSit = sits > 0 ? (refs / sits).toFixed(2) : '0.00';
      }
      if (totalsColumns.includes('callsToSitRatio')) {
        totals.callsToSitRatio = sits > 0 ? (calls / sits).toFixed(2) : '0.00';
      }
      
      // Days Rep doesn't make sense to calculate at organization level, leave blank
      if (totalsColumns.includes('daysRep')) {
        totals.daysRep = '';
      }
    }

    // Format decimal columns to 2 places if they have decimals (skip stats columns)
    totalsColumns.forEach(colAccessor => {
      if (statsColumns.includes(colAccessor)) return; // Skip stats columns
      
      const total = totals[colAccessor];
      if (typeof total === 'number' && total % 1 !== 0) {
        totals[colAccessor] = total.toFixed(2);
      }
    });

    return { id: 'totals-row', ...totals };
  };

  const totalsRow = calculateTotals();

  // Render totals row
  const renderTotalsRow = (position) => {
    if (!totalsRow) return null;

    // Calculate sticky top position for totals row
    const totalsTop = stickyHeader ? (stickyTop + 40) : 0; // 40px for header height
    const flatColumns = flattenColumns(columns);

    return (
      <tr 
        key={`totals-${position}`} 
        className="totals-row"
        style={{
          position: 'sticky',
          zIndex: 15,
          backgroundColor: 'var(--bg-tertiary)'
        }}
      >
        {flatColumns.map((column) => {
          const value = totalsRow[column.accessor];
          return (
            <td key={`totals-${column.accessor}`} className="totals-cell">
              <strong>{value}</strong>
            </td>
          );
        })}
      </tr>
    );
  };

  const handleContextMenu = (e, row) => {
    e.preventDefault();
    if (!enableRowContextMenu) return;

    const options = [
      { label: "View Details", action: () => onOpenDetails(row) },
      { label: "Add Interaction", action: () => onAddNew(row) },
      { label: archivedView ? "Unarchive" : "Archive", action: () => onArchive(row.id) },
      { label: "Delete", action: () => onDelete(row.id) }
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      options
    });
  };

  const handleClickOutside = (e) => {
    if (contextMenu && !e.target.closest('.context-menu')) {
      setContextMenu(null);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

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
      ...filterOptions.roleFilters.reduce((acc, role) => ({ ...acc, [role]: value }), {})
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
      ...filterOptions.roleFilters.reduce((acc, role) => ({ ...acc, [role]: true }), {}),
      ...filterOptions.statusFilters.reduce((acc, filter) => ({ ...acc, [filter.key]: null }), {}),
      states: stateFilters
    });
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

  // Add effect to call onFilterChange when activeFilters changes
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(activeFilters);
    }
  }, [activeFilters, onFilterChange]);

  // Call onColumnFilterChange when column filters change
  useEffect(() => {
    if (onColumnFilterChange) {
      onColumnFilterChange(columnFilters);
    }
  }, [columnFilters, onColumnFilterChange]);

  return (
    <div className="data-table-container" ref={tableRef}>
      {showActionBar && (
        <ActionBar
          selectedCount={Object.keys(selectedRows).length}
          totalCount={filteredData.length}
          entityName={entityName}
          archivedView={archivedView}
        >
          {actionBarButtons.addNew && onAddNew && createIconButton(onAddNew, <FiPlus size={16} />, "Add New")}
          {actionBarButtons.import && onImport && createIconButton(onImport, <FiUpload size={16} />, "Import")}
          {actionBarButtons.export && onExport && createIconButton(onExport, <FiDownload size={16} />, "Export")}
          {actionBarButtons.delete && onDelete && createIconButton(
            () => {
              const selectedIds = Object.keys(selectedRows);
              if (selectedIds.length > 0) {
                onDelete(selectedIds);
              }
            },
            <FiTrash2 size={16} />,
            "Delete",
            Object.keys(selectedRows).length === 0
          )}
          {actionBarButtons.archive && onArchive && createIconButton(
            () => {
              const selectedIds = Object.keys(selectedRows);
              if (selectedIds.length > 0) {
                onArchive(selectedIds);
              }
            },
            <FiArchive size={16} />,
            "Archive",
            Object.keys(selectedRows).length === 0
          )}
          {actionBarButtons.sendEmail && onSendEmail && createIconButton(
            onSendEmail,
            <FiMail size={16} />,
            "Send Email",
            Object.keys(selectedRows).length === 0
          )}
          {actionBarButtons.toggleArchived && onToggleArchivedView && createIconButton(
            onToggleArchivedView,
            archivedView ? <FiEye size={16} /> : <FiEyeOff size={16} />,
            archivedView ? "Show Active" : "Show Archived"
          )}
          {actionBarButtons.refresh && onRefresh && createIconButton(onRefresh, <FiRefreshCw size={16} />, "Refresh")}
          {actionBarButtons.reassign && onMassReassign && createIconButton(
            onMassReassign,
            <FiUsers size={16} />,
            "Reassign",
            Object.keys(selectedRows).length === 0
          )}
          {actionBarButtons.saveChanges && onSaveChanges && (
            <button onClick={onSaveChanges} className="action-button save-changes-button" style={{
              backgroundColor: '#28a745',
              color: 'white',
              fontWeight: 'bold'
            }}>
              Save Changes
            </button>
          )}
          {actionBarButtons.cancelChanges && onCancelChanges && (
            <button onClick={onCancelChanges} className="action-button cancel-changes-button" style={{
              backgroundColor: '#dc3545',
              color: 'white'
            }}>
              Cancel Changes
            </button>
          )}
          {actionBarExtras}
        </ActionBar>
      )}

      {filterOptions.showFilterMenu && (
        <div className="data-table-filters">
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
            buttonLabel="Filter Results"
            position="bottom"
            roleFilters={filterOptions.roleFilters}
            statusFilters={filterOptions.statusFilters}
          />
          
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
        </div>
      )}

      <div className="data-table" ref={tableRef}>
        <div className="data-table-container">
          {/* main scrollable table */}
          <div className={`scroll-container ${pageScrollSticky ? 'page-scroll-mode' : 'table-scroll-mode'}`}>
            <table {...getTableProps()} className={`table ${allowTableOverflow ? 'table-overflow' : ''} ${tableClassName}`.trim()}>
              {/* ---------- TABLE HEAD ---------- */}
              <thead>
                {headerGroups.map((headerGroup) => (
                  <tr {...headerGroup.getHeaderGroupProps()} key={headerGroup.id}>
                    {headerGroup.headers.map((column) => (
                      <th
                        key={column.id}
                        {...(
                          column.massSelection
                            ? {}
                            : column.id === "status" &&
                              Object.keys(selectedRows).length > 1
                            ? {}
                            : !disableSorting && column.getSortByToggleProps ? column.getSortByToggleProps() : {}
                        )}
                        {...column.getHeaderProps()}
                        colSpan={column.columns ? column.columns.length : 1}
                        className={`${column.className || ''} ${column.autoWidth ? 'auto-width-column' : ''}`.trim()}
                        style={{ 
                          width: column.autoWidth ? (allowTableOverflow ? 'auto' : 'max-content') : (column.width ? `${column.width}px` : "auto"),
                          minWidth: column.autoWidth ? '120px' : undefined,
                          maxWidth: column.autoWidth ? '300px' : undefined,
                          ...column.getHeaderProps().style
                        }}
                      >
                        {column.massSelection ? (
                          <input
                            type="checkbox"
                            checked={
                              localData.length > 0 &&
                              Object.keys(selectedRows).length === localData.length
                            }
                            onChange={toggleSelectAll}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : column.id === "status" &&
                          Object.keys(selectedRows).length > 1 &&
                          column.DropdownOptions?.length > 0 ? (
                          /* mass status-change dropdown in header */
                          (() => {
                            const defaultValue = column.DropdownOptions[0];
                            const backgroundColor = column.dropdownBackgroundColor
                              ? column.dropdownBackgroundColor(defaultValue)
                              : "#fff";
                            const textColor = getContrastColor(backgroundColor);
                            const borderColor = darkenColor(backgroundColor, 0.2);
                            return (
                              <select
                                style={{
                                  backgroundColor,
                                  color: textColor,
                                  border: `2px solid ${borderColor}`,
                                  width: "100%",
                                  boxSizing: "border-box",
                                }}
                                onChange={(e) =>
                                  handleHeaderStatusChange(e.target.value)
                                }
                              >
                                {column.DropdownOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            );
                          })()
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'space-between' }}>
                            <span>{column.render("Header")}</span>
                            {enableColumnFilters && column.filterable !== false && !column.massSelection && (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <button
                                  ref={(el) => { filterButtonRefs.current[column.id] = el; }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (showColumnFilter === column.id) {
                                      setShowColumnFilter(null);
                                    } else {
                                      // Calculate position based on button location
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setFilterDropdownPosition({
                                        top: rect.bottom + window.scrollY + 4,
                                        left: rect.right + window.scrollX - 240 // 240px is the width of dropdown
                                      });
                                      setShowColumnFilter(column.id);
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: columnFilters[column.id] ? '#3498db' : '#999'
                                  }}
                                  title="Filter column"
                                >
                                  <FiFilter size={14} />
                                </button>
                                {showColumnFilter === column.id && (
                                  <div
                                    style={{
                                      position: 'fixed',
                                      top: `${filterDropdownPosition.top}px`,
                                      left: `${filterDropdownPosition.left}px`,
                                      zIndex: 10000,
                                      background: 'white',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                      padding: '0',
                                      width: '240px',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                      fontSize: '13px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {(() => {
                                      // Get unique values from the column
                                      let uniqueValues;
                                      const filterSplitBy = column.filterSplitBy;
                                      
                                      if (filterSplitBy) {
                                        // For columns with filterSplitBy (e.g., comma-separated values), split and flatten
                                        const allValues = localData
                                          .map(row => row[column.id])
                                          .filter(val => val !== null && val !== undefined && val !== '');
                                        
                                        const splitValues = allValues
                                          .flatMap(val => String(val).split(filterSplitBy).map(v => v.trim()))
                                          .filter(v => v !== '');
                                        
                                        uniqueValues = [...new Set(splitValues)].sort();
                                      } else {
                                        // For regular columns, get unique cell values as before
                                        uniqueValues = [...new Set(
                                          localData
                                            .map(row => row[column.id])
                                            .filter(val => val !== null && val !== undefined && val !== '')
                                        )].sort();
                                      }
                                      
                                      // Initialize temp selections if not already set
                                      if (!tempFilterSelections[column.id]) {
                                        const currentFilter = columnFilters[column.id];
                                        const initialSelections = currentFilter && Array.isArray(currentFilter)
                                          ? currentFilter
                                          : uniqueValues;
                                        setTempFilterSelections(prev => ({
                                          ...prev,
                                          [column.id]: initialSelections
                                        }));
                                      }
                                      
                                      const currentSelections = tempFilterSelections[column.id] || uniqueValues;
                                      const filteredValues = uniqueValues.filter(val =>
                                        val.toString().toLowerCase().includes(filterSearchTerm.toLowerCase())
                                      );
                                      const allSelected = filteredValues.every(val => currentSelections.includes(val));
                                      
                                      const menuItemStyle = {
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '13px',
                                        borderBottom: '1px solid #f0f0f0'
                                      };
                                      
                                      const menuItemHoverStyle = {
                                        background: '#f5f5f5'
                                      };
                                      
                                      return (
                                        <div>
                                          {/* Sort A to Z */}
                                          <div
                                            style={menuItemStyle}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            onClick={() => {
                                              if (!disableSorting && column.toggleSortBy) {
                                                column.toggleSortBy(false); // false = ascending
                                              }
                                              setShowColumnFilter(null);
                                              setFilterSearchTerm('');
                                            }}
                                          >
                                            <BiSortAZ size={16} />
                                            <span>Sort A to Z</span>
                                          </div>
                                          
                                          {/* Sort Z to A */}
                                          <div
                                            style={menuItemStyle}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            onClick={() => {
                                              if (!disableSorting && column.toggleSortBy) {
                                                column.toggleSortBy(true); // true = descending
                                              }
                                              setShowColumnFilter(null);
                                              setFilterSearchTerm('');
                                            }}
                                          >
                                            <BiSortZA size={16} />
                                            <span>Sort Z to A</span>
                                          </div>
                                          
                                          {/* Clear Filter */}
                                          {columnFilters[column.id] && (
                                            <div
                                              style={{...menuItemStyle, color: '#f44336'}}
                                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                              onClick={() => {
                                                setColumnFilters(prev => {
                                                  const newFilters = { ...prev };
                                                  delete newFilters[column.id];
                                                  return newFilters;
                                                });
                                                setTempFilterSelections(prev => {
                                                  const newSelections = { ...prev };
                                                  delete newSelections[column.id];
                                                  return newSelections;
                                                });
                                              }}
                                            >
                                              <AiOutlineClose size={14} />
                                              <span>Clear Filter from "{column.Header}"</span>
                                            </div>
                                          )}
                                          
                                          {/* Divider before search */}
                                          <div style={{ borderBottom: '1px solid #ddd', margin: '4px 0' }}></div>
                                          
                                          {/* Search box */}
                                          <div style={{ padding: '8px' }}>
                                            <input
                                              type="text"
                                              placeholder="Search..."
                                              value={filterSearchTerm}
                                              onChange={(e) => setFilterSearchTerm(e.target.value)}
                                              style={{
                                                width: '100%',
                                                padding: '6px 8px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '13px',
                                                boxSizing: 'border-box'
                                              }}
                                              autoFocus
                                            />
                                          </div>
                                          
                                          {/* Select All checkbox */}
                                          <div style={{
                                            padding: '6px 8px',
                                            borderBottom: '1px solid #eee'
                                          }}>
                                            <label style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              cursor: 'pointer',
                                              fontSize: '13px',
                                              fontWeight: 'bold',
                                              gap: '8px',
                                              margin: 0
                                            }}>
                                              <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={(e) => {
                                                  const newSelections = e.target.checked
                                                    ? [...new Set([...currentSelections, ...filteredValues])]
                                                    : currentSelections.filter(val => !filteredValues.includes(val));
                                                  setTempFilterSelections(prev => ({
                                                    ...prev,
                                                    [column.id]: newSelections
                                                  }));
                                                }}
                                                style={{ 
                                                  margin: 0, 
                                                  flexShrink: 0,
                                                  width: '14px',
                                                  height: '14px'
                                                }}
                                              />
                                              <span>Select All</span>
                                            </label>
                                          </div>
                                          
                                          {/* Scrollable list of checkboxes */}
                                          <div style={{
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            padding: '4px 0'
                                          }}>
                                            {filteredValues.map(val => (
                                              <div key={val} style={{ 
                                                padding: '4px 8px',
                                                display: 'flex',
                                                alignItems: 'center'
                                              }}>
                                                <label style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  cursor: 'pointer',
                                                  fontSize: '13px',
                                                  gap: '8px',
                                                  width: '100%',
                                                  margin: 0
                                                }}>
                                                  <input
                                                    type="checkbox"
                                                    checked={currentSelections.includes(val)}
                                                    onChange={(e) => {
                                                      const newSelections = e.target.checked
                                                        ? [...currentSelections, val]
                                                        : currentSelections.filter(v => v !== val);
                                                      setTempFilterSelections(prev => ({
                                                        ...prev,
                                                        [column.id]: newSelections
                                                      }));
                                                    }}
                                                    style={{ 
                                                      margin: 0, 
                                                      flexShrink: 0,
                                                      width: '14px',
                                                      height: '14px'
                                                    }}
                                                  />
                                                  <span style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    flex: 1
                                                  }}>{val}</span>
                                                </label>
                                              </div>
                                            ))}
                                          </div>
                                          
                                          {/* Action buttons */}
                                          <div style={{ 
                                            display: 'flex', 
                                            gap: '4px', 
                                            padding: '8px',
                                            borderTop: '1px solid #eee',
                                            flexDirection: 'column'
                                          }}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button
                                                onClick={() => {
                                                  const selections = tempFilterSelections[column.id];
                                                  if (selections && selections.length < uniqueValues.length) {
                                                    setColumnFilters(prev => ({
                                                      ...prev,
                                                      [column.id]: selections
                                                    }));
                                                  } else {
                                                    setColumnFilters(prev => {
                                                      const newFilters = { ...prev };
                                                      delete newFilters[column.id];
                                                      return newFilters;
                                                    });
                                                  }
                                                  setShowColumnFilter(null);
                                                  setFilterSearchTerm('');
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '6px 12px',
                                                  background: '#4CAF50',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  cursor: 'pointer',
                                                  fontSize: '13px',
                                                  fontWeight: 'bold'
                                                }}
                                              >
                                                Apply
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setColumnFilters(prev => {
                                                    const newFilters = { ...prev };
                                                    delete newFilters[column.id];
                                                    return newFilters;
                                                  });
                                                  setTempFilterSelections(prev => {
                                                    const newSelections = { ...prev };
                                                    delete newSelections[column.id];
                                                    return newSelections;
                                                  });
                                                  setShowColumnFilter(null);
                                                  setFilterSearchTerm('');
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '6px 12px',
                                                  background: '#f44336',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  cursor: 'pointer',
                                                  fontSize: '13px'
                                                }}
                                              >
                                                Clear
                                              </button>
                                            </div>
                                            
                                            {/* Save and Load Filter buttons */}
                                            <div style={{ 
                                              display: 'flex', 
                                              gap: '4px',
                                              borderTop: '1px solid #eee',
                                              paddingTop: '8px',
                                              marginTop: '4px'
                                            }}>
                                              <button
                                                onClick={() => {
                                                  setShowSaveFilterDialog(true);
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '6px 12px',
                                                  background: '#2196F3',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '4px'
                                                }}
                                              >
                                                <FiSave size={12} />
                                                Save Filter
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setShowSavedFilters(true);
                                                }}
                                                style={{
                                                  flex: 1,
                                                  padding: '6px 12px',
                                                  background: '#9C27B0',
                                                  color: 'white',
                                                  border: 'none',
                                                  borderRadius: '4px',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '4px'
                                                }}
                                              >
                                                <FiBookmark size={12} />
                                                Saved ({savedFilters.filter(f => f.columnId === column.id).length})
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>

              {/* ---------- TABLE BODY ---------- */}
              <tbody {...getTableBodyProps()}>
                {/* Render top totals row */}
                {showTotals && (totalsPosition === 'top' || totalsPosition === 'both') && renderTotalsRow('top')}
                
                {/* No data message */}
                {(!renderedRows || renderedRows.length === 0) && (
                  <tr className="no-data-row">
                    <td colSpan={flattenColumns(columns).length} className="no-data-cell">
                      <div className="no-data-container">
                        <div className="no-data-icon">📋</div>
                        <div className="no-data-message">
                          <h4>No data found</h4>
                          <p>There are no {entityName}s to display at this time.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                
                {renderedRows.map((row, rowIndex) => {
                  prepareRow(row);
                  const isEditingRow =
                    highlightRowOnEdit && editingCell?.id === row.original.id;
                  
                  // Build className parts from editing state, banded rows, and custom row classes
                  const customClassName = rowClassNames[row.original.id] || "";
                  const isSticky = stickyRows.includes(row.original.id);
                  const bandedClassName = bandedRows ? (rowIndex % 2 === 0 ? "banded-row-even" : "banded-row-odd") : "";
                  const baseClassParts = [
                    isEditingRow ? "editing-row" : "",
                    bandedClassName,
                    customClassName,
                    isSticky ? "sticky-row" : ""
                  ];

                  // Build inline style for row coloring
                  let rowStyle = {};
                  if (enableRowColoring && row.original[rowColorColumn]) {
                    const color = row.original[rowColorColumn];
                    rowStyle.backgroundColor = color;
                    // Automatically adjust text color for better readability
                    const rgb = parseInt(color.replace('#', ''), 16);
                    const r = (rgb >> 16) & 0xff;
                    const g = (rgb >> 8) & 0xff;
                    const b = (rgb >> 0) & 0xff;
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    rowStyle.color = brightness > 186 ? '#000000' : '#ffffff';
                  }

                  // Check if this row can be expanded (default governed by expandableDefault) and optional predicate
                  const allowedByPredicate = typeof isRowExpandable === 'function' ? !!isRowExpandable(row.original) : true;
                  const allowedByMap = (expandableRows[row.original.id] === undefined ? !!expandableDefault : !!expandableRows[row.original.id]);
                  const canExpand = enableRowExpansion && allowedByPredicate && allowedByMap;
                  try {
                    if (enableRowExpansion) {
                   
                    }
                  } catch (_) {}
                  const isExpanded = expandedRows[row.original.id] || false;

                  // Finalize className including expanded highlighting (after canExpand is known)
                  const className = [
                    ...baseClassParts,
                    (canExpand && isExpanded) ? "expanded-parent-row" : ""
                  ].filter(Boolean).join(" ");

                  const toggleRowExpansion = () => {
                    const newExpanded = !isExpanded;
                    setExpandedRows(prev => ({
                      ...prev,
                      [row.original.id]: newExpanded
                    }));
                    if (onRowExpansionChange) {
                      onRowExpansionChange(row.original.id, newExpanded);
                    }
                  };
                  
                  const rowElements = [];
                  
                  // Main row
                  rowElements.push(
                    <tr
                      {...row.getRowProps()}
                      className={className}
                      data-row-index={rowIndex}
                      data-rowid={row.original.id}
                      {...(typeof getRowDataAttributes === 'function' ? getRowDataAttributes(row.original) : {})}
                      style={{ 
                        cursor: (expandOnRowClick && canExpand) || onRowClick ? 'pointer' : 'default',
                        ...rowStyle
                      }}
                      onClick={(e) => {
                        // Only trigger row click if not editing and onRowClick is provided
                        if (!editingCell) {
                          // Check if the click is on a cell that shouldn't trigger row click
                          const isSelectCell = e.target.closest('input[type="checkbox"]');
                          const isDropdownCell = e.target.closest('select');
                          const isExpandButton = e.target.closest('.expand-button');
                          
                          if (!isSelectCell && !isDropdownCell && !isExpandButton) {
                            if (expandOnRowClick && canExpand) {
                              try { console.log('[DataTable] row-click expand toggle', { id: row.original.id, canExpand }); } catch (_) {}
                              toggleRowExpansion();
                            } else if (onRowClick) {
                              onRowClick(row.original);
                            }
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        if (enableRowContextMenu && getRowContextMenuOptions) {
                          e.preventDefault();
                          const options = getRowContextMenuOptions(row.original);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            options,
                            row: row.original,
                          });
                        }
                      }}
                      onMouseEnter={() => {
                        if (onRowHover) {
                          onRowHover(row.original, true);
                        }
                      }}
                      onMouseLeave={() => {
                        if (onRowHover) {
                          onRowHover(row.original, false);
                        }
                      }}
                    >
                      {row.cells.map((cell, columnIndex) => {
                        // Find column definition in flattened columns (handles grouped columns)
                        const flatColumns = flattenColumns(columns);
                        const colDef = flatColumns.find(
                          (c) => c.accessor === cell.column.id
                        );
                        const isEditingCell = editingCell?.id === row.original.id && editingCell?.field === cell.column.id;
                        
                        // Determine per-cell editability (default true)
                        const cellEditable = (() => {
                          if (disableCellEditing) return false;
                          if (!colDef) return true;
                          if (typeof colDef.isEditable === 'function') return !!colDef.isEditable(row.original, cell);
                          if (typeof colDef.isEditable === 'boolean') return colDef.isEditable;
                          return true;
                        })();

                        return (
                          <td
                            {...cell.getCellProps()}
                            key={cell.column.id}
                            data-column-index={columnIndex}
                            className={`${isEditingCell ? "editing-cell" : ""} ${colDef?.className || ''} ${colDef?.autoWidth ? 'auto-width-column' : ''}`.trim()}
                            style={{ 
                              width: colDef?.autoWidth ? (allowTableOverflow ? 'auto' : 'max-content') : (colDef?.width ? `${colDef.width}px` : "auto"),
                              minWidth: colDef?.autoWidth ? '120px' : undefined,
                              maxWidth: colDef?.autoWidth ? '300px' : undefined
                            }}
                            tabIndex={0}
                            onClick={
                              colDef?.massSelection
                                ? undefined
                                : row.original.id === 'totals-row'
                                ? undefined
                                : !cellEditable
                                ? undefined
                                : () =>
                                    handleCellClick(
                                      row.original.id,
                                      cell.column.id,
                                      cell.value
                                    )
                            }
                            onDoubleClick={
                              colDef?.massSelection
                                ? undefined
                                : row.original.id === 'totals-row'
                                ? undefined
                                : !cellEditable
                                ? undefined
                                : () =>
                                    handleEditStart(
                                      row.original.id,
                                      cell.column.id,
                                      cell.value
                                    )
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(
                                e,
                                rowIndex,
                                columnIndex,
                                (disablePagination ? rows.length : page.length),
                                row.cells.length
                              )
                            }
                          >
                            {/* Add expand button to first column if row is expandable */}
                            {columnIndex === 0 && canExpand && showExpandButton && (
                              <button
                                className="expand-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpansion();
                                }}
                                style={{
                                  marginRight: '8px',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: '#666'
                                }}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                            {renderCell(cell, row, rowIndex, columnIndex)}
                          </td>
                        );
                      })}
                    </tr>
                  );

                  // Expanded row content
                  if (canExpand && isExpanded && renderExpandedRow) {
                    rowElements.push(
                      <tr key={`${row.original.id}-expanded`} className="expanded-row">
                        <td colSpan={flattenColumns(columns).length} className="expanded-cell">
                          {renderExpandedRow(row.original)}
                        </td>
                      </tr>
                    );
                  }

                  return rowElements;
                })}
                
                {/* Render bottom totals row */}
                {showTotals && (totalsPosition === 'bottom' || totalsPosition === 'both') && renderTotalsRow('bottom')}
              </tbody>
            </table>
          </div>

          {/* ---------- PAGINATION ---------- */}
          {!disablePagination && (
            <Pagination
              gotoPage={gotoPage}
              previousPage={previousPage}
              nextPage={nextPage}
              canNextPage={canNextPage}
              canPreviousPage={canPreviousPage}
              pageCount={pageCount}
              pageIndex={pageIndex}
              pageOptions={pageOptions}
              pageSize={pageSize}
              setPageSize={setPageSize}
              localData={localData}
            />
          )}

          {/* ---------- CONTEXT MENUS ---------- */}
          {contextMenu && (
            <ContextMenu
              style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                zIndex: 1000
              }}
              options={contextMenu.options}
              onClose={() => setContextMenu(null)}
            />
          )}
          {addressContextMenu.visible && (
            <AddressContextMenu
              x={addressContextMenu.x}
              y={addressContextMenu.y}
              initialAddress={addressContextMenu.initialAddress}
              onSave={saveAddress}
              onClose={() =>
                setAddressContextMenu({
                  ...addressContextMenu,
                  visible: false,
                })
              }
            />
          )}
          
          {/* Save Filter Dialog */}
          {showSaveFilterDialog && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowSaveFilterDialog(false);
                  setSaveFilterName('');
                }
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  width: '400px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  Save Filter
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
                  Column: <strong>{showColumnFilter && flattenColumns(columns).find(c => c.id === showColumnFilter)?.Header}</strong>
                </p>
                <input
                  type="text"
                  placeholder="Enter filter name..."
                  value={saveFilterName}
                  onChange={(e) => setSaveFilterName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginBottom: '16px',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && saveFilterName.trim()) {
                      const columnId = showColumnFilter;
                      const filterData = tempFilterSelections[columnId];
                      if (saveFilter(saveFilterName.trim(), columnId, filterData)) {
                        setSaveFilterName('');
                        setShowSaveFilterDialog(false);
                        alert('Filter saved successfully!');
                      }
                    }
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setShowSaveFilterDialog(false);
                      setSaveFilterName('');
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (saveFilterName.trim()) {
                        const columnId = showColumnFilter;
                        const filterData = tempFilterSelections[columnId];
                        if (saveFilter(saveFilterName.trim(), columnId, filterData)) {
                          setSaveFilterName('');
                          setShowSaveFilterDialog(false);
                          alert('Filter saved successfully!');
                        }
                      }
                    }}
                    disabled={!saveFilterName.trim()}
                    style={{
                      padding: '8px 16px',
                      background: saveFilterName.trim() ? '#2196F3' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: saveFilterName.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Saved Filters Modal */}
          {showSavedFilters && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10001
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowSavedFilters(false);
                }
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  width: '500px',
                  maxHeight: '600px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  Saved Filters
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#666' }}>
                  Column: <strong>{showColumnFilter && flattenColumns(columns).find(c => c.id === showColumnFilter)?.Header}</strong>
                </p>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  marginBottom: '16px',
                  border: '1px solid #eee',
                  borderRadius: '4px'
                }}>
                  {savedFilters
                    .filter(f => f.columnId === showColumnFilter)
                    .length === 0 ? (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: '#999'
                    }}>
                      No saved filters for this column
                    </div>
                  ) : (
                    savedFilters
                      .filter(f => f.columnId === showColumnFilter)
                      .map(filter => (
                        <div
                          key={filter.id}
                          style={{
                            padding: '12px',
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div 
                            style={{ flex: 1 }}
                            onClick={() => {
                              loadSavedFilter(filter);
                              setShowColumnFilter(null);
                            }}
                          >
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                              {filter.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {Array.isArray(filter.filterData) 
                                ? `${filter.filterData.length} items selected`
                                : filter.filterData}
                            </div>
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                              {new Date(filter.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterToDelete(filter);
                            }}
                            style={{
                              padding: '4px 8px',
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowSavedFilters(false)}
                    style={{
                      padding: '8px 16px',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Delete Confirmation Dialog */}
          {filterToDelete && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10002
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setFilterToDelete(null);
                }
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  width: '400px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                  Delete Filter
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
                  Are you sure you want to delete the filter "<strong>{filterToDelete.name}</strong>"? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setFilterToDelete(null)}
                    style={{
                      padding: '8px 16px',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      deleteSavedFilter(filterToDelete.id);
                      setFilterToDelete(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataTable;