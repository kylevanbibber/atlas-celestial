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
import { FiX } from "react-icons/fi";

const DataTable = ({
  columns,
  data,
  onCellUpdate,
  onMassStatusChange,
  onSelectionChange,
  enableRowContextMenu = false,
  getRowContextMenuOptions, 
  onCreateCompany,
  onOpenDetails,
  existingCompanies = [],
  disablePagination = false,
  disableSorting = false,
  defaultSortBy = null,
  defaultSortOrder = "asc",
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
  showActionBar = true,
  disableCellEditing = false,
  actionBarButtons = {
    addNew: true,
    import: true,
    export: true,
    delete: true,
    archive: true,
    sendEmail: true,
    toggleArchived: true,
    refresh: true,
    reassign: true
  },
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
  // Sticky props
  stickyHeader = true, // make header sticky
  stickyRows = [], // array of row IDs that should be sticky
  stickyTop = 0, // top offset for sticky positioning
  pageScrollSticky = false, // true = stick to page scroll, false = stick to table scroll
  onRowHover = null, // callback for row hover events
  onRowClick = null // callback for row click events
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [localData, setLocalData] = useState(data);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedRows, setSelectedRows] = useState({});
  const [activeFilters, setActiveFilters] = useState({
    // Role filters
    ...filterOptions.roleFilters.reduce((acc, role) => ({ ...acc, [role]: true }), {}),
    // Status filters
    ...filterOptions.statusFilters.reduce((acc, filter) => ({ ...acc, [filter.key]: null }), {}),
    // State filters
    states: {}
  });
  const [allAvailableStates, setAllAvailableStates] = useState([]);
  const tableRef = useRef(null);
  const inputRef = useRef(null);

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
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  
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
  
    // 2c) kick off the debounced save
    saveChangeDebounced(id, field, value);
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
      const columnId = columns[newCol]?.accessor;
      if (columnId !== undefined) {
        setEditingCell({ id: localData[newRow].id, field: columnId });
      }
    };

    switch (e.key) {
      case "Escape":
        setEditingCell(null);
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        moveToCell(rowIndex, (columnIndex + 1) % totalCols);
        break;
      case "ArrowRight":
        moveToCell(rowIndex, columnIndex + 1 < totalCols ? columnIndex + 1 : 0);
        break;
      case "ArrowLeft":
        moveToCell(rowIndex, columnIndex > 0 ? columnIndex - 1 : totalCols - 1);
        break;
      case "ArrowDown":
        moveToCell(rowIndex + 1 < totalRows ? rowIndex + 1 : rowIndex, columnIndex);
        break;
      case "ArrowUp":
        moveToCell(rowIndex > 0 ? rowIndex - 1 : rowIndex, columnIndex);
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

  // Build table hooks array conditionally
  const tableHooks = [];
  if (!disableSorting) {
    tableHooks.push(useSortBy);
  }
  tableHooks.push(usePagination);

  // Build initial sort state
  const initialSort = (!disableSorting && defaultSortBy)
    ? [{ id: defaultSortBy, desc: defaultSortOrder === "desc" }]
    : [];

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    canNextPage,
    canPreviousPage,
    state: { pageIndex, pageSize },
  } = useTable(
    { 
      columns, 
      data: localData,
      getRowId: (row, index) => row.id || row.userId || index, // Ensure proper row identification
      initialState: { 
        pageIndex: 0, 
        pageSize: disablePagination ? localData.length || 1000 : 25,
        sortBy: initialSort
      }, 
      autoResetPage: false, 
      autoResetSortBy: false   
    },
    ...tableHooks
  );
  
  // Update page size when data changes and pagination is disabled
  useEffect(() => {
    if (disablePagination && setPageSize && localData.length > 0) {
      setPageSize(localData.length);
    }
  }, [localData.length, disablePagination, setPageSize]);
  
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
  
  const renderCell = (cell, row) => {
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
      rowIndex: row.index,
      columnIndex: cell.column.index,
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
          localData.length,
          columns.length
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

  const filteredData = localData.filter(row => archivedView ? row.archive : !row.archive);

  // Calculate totals for specified columns
  const calculateTotals = () => {
    if (!showTotals || totalsColumns.length === 0) return null;

    const totals = {};
    const labelColumnAccessor = totalsLabelColumn || columns[0]?.accessor;

    // Initialize totals object
    columns.forEach(col => {
      if (totalsColumns.includes(col.accessor)) {
        totals[col.accessor] = 0;
      } else if (col.accessor === labelColumnAccessor) {
        totals[col.accessor] = totalsLabel;
      } else {
        totals[col.accessor] = '';
      }
    });

    // Sum the specified columns (exclude weekly total rows to prevent double-counting)
    filteredData.forEach(row => {
      // Skip weekly total rows when calculating overall totals
      if (row.isWeeklyTotal) return;
      
      totalsColumns.forEach(colAccessor => {
        const value = parseFloat(row[colAccessor]) || 0;
        totals[colAccessor] += value;
      });
    });

    // Format decimal columns to 2 places if they have decimals
    totalsColumns.forEach(colAccessor => {
      const total = totals[colAccessor];
      if (total % 1 !== 0) {
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
        {columns.map((column) => {
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

  return (
    <div className="data-table-container" ref={tableRef}>
      {showActionBar && (
        <ActionBar
          selectedCount={Object.keys(selectedRows).length}
          totalCount={filteredData.length}
          entityName={entityName}
          archivedView={archivedView}
        >
          {actionBarButtons.addNew && onAddNew && (
            <button onClick={onAddNew} className="action-button">
              Add New
            </button>
          )}
          {actionBarButtons.import && onImport && (
            <button onClick={onImport} className="action-button">
              Import
            </button>
          )}
          {actionBarButtons.export && onExport && (
            <button onClick={onExport} className="action-button">
              Export
            </button>
          )}
          {actionBarButtons.delete && onDelete && (
            <button 
              onClick={() => {
                const selectedIds = Object.keys(selectedRows);
                if (selectedIds.length > 0) {
                  onDelete(selectedIds);
                }
              }} 
              className="action-button" 
              disabled={Object.keys(selectedRows).length === 0}
            >
              Delete
            </button>
          )}
          {actionBarButtons.archive && onArchive && (
            <button 
              onClick={() => {
                const selectedIds = Object.keys(selectedRows);
                if (selectedIds.length > 0) {
                  onArchive(selectedIds);
                }
              }} 
              className="action-button" 
              disabled={Object.keys(selectedRows).length === 0}
            >
              Archive
            </button>
          )}
          {actionBarButtons.sendEmail && onSendEmail && (
            <button 
              onClick={onSendEmail} 
              className="action-button" 
              disabled={Object.keys(selectedRows).length === 0}
            >
              Send Email
            </button>
          )}
          {actionBarButtons.toggleArchived && onToggleArchivedView && (
            <button onClick={onToggleArchivedView} className="action-button">
              {archivedView ? "Show Active" : "Show Archived"}
            </button>
          )}
          {actionBarButtons.refresh && onRefresh && (
            <button onClick={onRefresh} className="action-button">
              Refresh
            </button>
          )}
          {actionBarButtons.reassign && onMassReassign && (
            <button 
              onClick={onMassReassign} 
              className="action-button" 
              disabled={Object.keys(selectedRows).length === 0}
            >
              Reassign
            </button>
          )}
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
            <table {...getTableProps()} className="table">
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
                        style={{ 
                          width: column.width ? `${column.width}px` : "auto"
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
                          column.render("Header")
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
                {(!page || page.length === 0) && (
                  <tr className="no-data-row">
                    <td colSpan={columns.length} className="no-data-cell">
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
                
                {page.map((row, rowIndex) => {
                  prepareRow(row);
                  const isEditingRow =
                    highlightRowOnEdit && editingCell?.id === row.original.id;
                  
                  // Build className from editing state and custom row classes
                  const customClassName = rowClassNames[row.original.id] || "";
                  const isSticky = stickyRows.includes(row.original.id);
                  const className = [
                    isEditingRow ? "editing-row" : "",
                    customClassName,
                    isSticky ? "sticky-row" : ""
                  ].filter(Boolean).join(" ");
                  
                  return (
                    <tr
                      {...row.getRowProps()}
                      key={rowIndex}
                      className={className}
                      style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                      onClick={(e) => {
                        // Only trigger row click if not editing and onRowClick is provided
                        if (onRowClick && !editingCell) {
                          // Check if the click is on a cell that shouldn't trigger row click
                          const isSelectCell = e.target.closest('input[type="checkbox"]');
                          const isDropdownCell = e.target.closest('select');
                          
                          if (!isSelectCell && !isDropdownCell) {
                            onRowClick(row.original);
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
                        const colDef = columns.find(
                          (c) => c.accessor === cell.column.id
                        );
                        const isEditingCell = editingCell?.id === row.original.id && editingCell?.field === cell.column.id;
                        return (
                          <td
                            {...cell.getCellProps()}
                            key={cell.column.id}
                            className={isEditingCell ? "editing-cell" : ""}
                            style={{ width: colDef?.width || "auto" }}
                            tabIndex={0}
                            onClick={
                              colDef?.massSelection
                                ? undefined
                                : row.original.id === 'totals-row'
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
                                page.length,
                                columns.length
                              )
                            }
                          >
                            {renderCell(cell, row)}
                          </td>
                        );
                      })}
                    </tr>
                  );
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
              x={contextMenu.x}
              y={contextMenu.y}
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
        </div>
      </div>
    </div>
  );
};

export default DataTable;