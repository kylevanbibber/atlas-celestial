/*
 * QueryBuilder with Cross-Table Join Support
 * 
 * This component now supports cross-table queries with joins, enabling complex queries like:
 * 
 * Example: Find activeusers.id where activeusers.lagnname matches MGAs.lagnname and MGAs.active = 'y'
 * 
 * To configure this:
 * 1. Select multiple tables: activeusers, MGAs
 * 2. Add a join: activeusers.lagnname = MGAs.lagnname (INNER JOIN)
 * 3. Add conditions:
 *    - activeusers.id IS NOT EMPTY (to get the IDs)
 *    - MGAs.active equals 'y'
 * 
 * The query structure includes:
 * - conditions: Array of field conditions
 * - logicOperator: 'AND' or 'OR' for condition logic
 * - joins: Array of table join definitions
 * - tables: Array of selected table names
 */

import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp, FiCheck, FiDatabase, FiLink } from 'react-icons/fi';
import api from '../../../api';

// Default operators available for each field type
const OPERATORS_BY_TYPE = {
  string: [
    { id: 'equals', label: 'equals', symbol: '=' },
    { id: 'not_equals', label: 'does not equal', symbol: '!=' },
    { id: 'contains', label: 'contains', symbol: 'LIKE' },
    { id: 'starts_with', label: 'starts with', symbol: 'LIKE' },
    { id: 'ends_with', label: 'ends with', symbol: 'LIKE' },
    { id: 'is_empty', label: 'is empty', symbol: 'IS NULL' },
    { id: 'is_not_empty', label: 'is not empty', symbol: 'IS NOT NULL' },
  ],
  number: [
    { id: 'equals', label: 'equals', symbol: '=' },
    { id: 'not_equals', label: 'does not equal', symbol: '!=' },
    { id: 'greater_than', label: 'greater than', symbol: '>' },
    { id: 'less_than', label: 'less than', symbol: '<' },
    { id: 'greater_or_equal', label: 'greater than or equal to', symbol: '>=' },
    { id: 'less_or_equal', label: 'less than or equal to', symbol: '<=' },
    { id: 'is_empty', label: 'is empty', symbol: 'IS NULL' },
    { id: 'is_not_empty', label: 'is not empty', symbol: 'IS NOT NULL' },
  ],
  boolean: [
    { id: 'is_true', label: 'is true', symbol: '=' },
    { id: 'is_false', label: 'is false', symbol: '=' },
  ],
  date: [
    { id: 'equals', label: 'equals', symbol: '=' },
    { id: 'not_equals', label: 'does not equal', symbol: '!=' },
    { id: 'greater_than', label: 'after', symbol: '>' },
    { id: 'less_than', label: 'before', symbol: '<' },
    { id: 'between', label: 'between', symbol: 'BETWEEN' },
    { id: 'is_empty', label: 'is empty', symbol: 'IS NULL' },
    { id: 'is_not_empty', label: 'is not empty', symbol: 'IS NOT NULL' },
  ],
};

// Available join types
const JOIN_TYPES = [
  { value: 'INNER', label: 'INNER JOIN (only matching records)' },
  { value: 'LEFT', label: 'LEFT JOIN (all from left table)' },
  { value: 'RIGHT', label: 'RIGHT JOIN (all from right table)' },
  { value: 'FULL', label: 'FULL JOIN (all records from both tables)' }
];

// Default condition object
const DEFAULT_CONDITION = {
  id: Date.now(), // unique ID for the condition
  field: '',
  operator: 'equals',
  value: '',
  secondaryValue: '', // For "between" operators
  connector: 'AND', // Default connector for additional conditions
  isMultiValue: false, // Flag for comma-separated values
};

// Default join object
const DEFAULT_JOIN = {
  id: Date.now(),
  type: 'INNER',
  leftTable: '',
  leftField: '',
  rightTable: '',
  rightField: ''
};

// Add subquery operators to all types
const SUBQUERY_OPERATORS = [
  { value: 'in_subquery', label: 'In Subquery' },
  { value: 'not_in_subquery', label: 'Not In Subquery' }
];

// Helper: check if operator is a subquery operator
const isSubqueryOperator = (operator) => ['in_subquery', 'not_in_subquery'].includes(operator);

const QueryBuilder = ({ 
  conditions = [], 
  logicOperator = 'AND', 
  tables = ['activeusers'], 
  joins = [],
  onChange,
  onTablesChange
}) => {
  const [availableTables, setAvailableTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [columns, setColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [subqueryColumns, setSubqueryColumns] = useState({});
  const [loadingSubqueryColumns, setLoadingSubqueryColumns] = useState({});
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [joinMenuOpen, setJoinMenuOpen] = useState(false);
  const [error, setError] = useState(null);

  // Load available tables on mount
  useEffect(() => {
    fetchAvailableTables();
  }, []);

  // Load columns when tables change
  useEffect(() => {
    if (tables && tables.length > 0) {
      fetchTableColumns(tables);
    }
  }, [tables]);

  // Ensure all conditions have connector property
  useEffect(() => {
    const updatedConditions = conditions.map((condition, index) => {
      if (index === 0) return condition; // First condition doesn't need a connector
      return {
        ...condition,
        connector: condition.connector || 'AND'
      };
    });
    
    // Only update if there's a difference to avoid infinite loops
    if (JSON.stringify(updatedConditions) !== JSON.stringify(conditions) && conditions.length > 0) {
      onChange({
        conditions: updatedConditions,
        logicOperator,
        joins
      });
    }
  }, [conditions]);

  // Fetch available tables
  const fetchAvailableTables = async () => {
    try {
      setLoadingTables(true);
      setError(null);
      
      const response = await api.get('/schema/tables');
      
      if (response.data.success) {
        setAvailableTables(response.data.tables);
      } else {
        setError(response.data.error || 'Failed to fetch available tables');
      }
    } catch (err) {
      console.error('Error fetching available tables:', err);
      setError('Failed to fetch available tables. Please try again.');
    } finally {
      setLoadingTables(false);
    }
  };

  // Fetch columns for selected tables
  const fetchTableColumns = async (selectedTables) => {
    try {
      setLoadingColumns(true);
      setError(null);
      
      const response = await api.post('/schema/columns', { tables: selectedTables });
      
      if (response.data.success) {
        setColumns(response.data.columns);
      } else {
        setError(response.data.error || 'Failed to fetch table columns');
      }
    } catch (err) {
      console.error('Error fetching table columns:', err);
      setError('Failed to fetch table columns. Please try again.');
    } finally {
      setLoadingColumns(false);
    }
  };

  // NEW: Fetch columns for a subquery table
  const fetchSubqueryColumns = async (tableName) => {
    if (!tableName || subqueryColumns[tableName] || loadingSubqueryColumns[tableName]) return;
    setLoadingSubqueryColumns(prev => ({ ...prev, [tableName]: true }));
    try {
      const response = await api.post('/schema/columns', { tables: [tableName] });
      if (response.data.success) {
        setSubqueryColumns(prev => ({ ...prev, [tableName]: response.data.columns }));
      }
    } catch (err) {
      // Optionally handle error
    } finally {
      setLoadingSubqueryColumns(prev => ({ ...prev, [tableName]: false }));
    }
  };

  // Add a new condition
  const addCondition = () => {
    const newConditions = [...conditions, { 
      field: '', // Don't set a default field
      operator: 'equals',
      value: '',
      secondaryValue: '',
      connector: 'AND', // Default connector logic
      isMultiValue: false,
    }];
    
    onChange({ 
      conditions: newConditions, 
      logicOperator,
      joins
    });
  };

  // Remove a condition
  const removeCondition = (index) => {
    const newConditions = [...conditions];
    newConditions.splice(index, 1);
    
    onChange({ 
      conditions: newConditions, 
      logicOperator,
      joins
    });
  };

  // Update a condition
  const updateCondition = (index, field, value) => {
    const newConditions = [...conditions];
    newConditions[index] = {
      ...newConditions[index],
      [field]: value
    };
    
    // If changing the operator, reset secondary value if not needed
    if (field === 'operator' && value !== 'between') {
      newConditions[index].secondaryValue = '';
    }
    
    // Process comma-separated values for equals operator
    if (field === 'value' && newConditions[index].operator === 'equals') {
      newConditions[index].isMultiValue = value.includes(',');
    }
    
    onChange({ 
      conditions: newConditions, 
      logicOperator,
      joins
    });
  };

  // Toggle multi-value option
  const toggleMultiValue = (index) => {
    const newConditions = [...conditions];
    newConditions[index] = {
      ...newConditions[index],
      isMultiValue: !newConditions[index].isMultiValue
    };
    
    onChange({
      conditions: newConditions,
      logicOperator,
      joins
    });
  };

  // Update connector (AND/OR) for a specific condition
  const updateConnector = (index, value) => {
    const newConditions = [...conditions];
    newConditions[index] = {
      ...newConditions[index],
      connector: value
    };
    
    onChange({
      conditions: newConditions,
      logicOperator,
      joins
    });
  };

  // Update logic operator
  const updateLogicOperator = (value) => {
    onChange({ 
      conditions, 
      logicOperator: value,
      joins
    });
  };

  // Add a new join
  const addJoin = () => {
    const newJoins = [...joins, {
      ...DEFAULT_JOIN,
      id: Date.now(),
      leftTable: tables[0] || '',
      rightTable: tables[1] || ''
    }];
    
    onChange({
      conditions,
      logicOperator,
      joins: newJoins
    });
  };

  // Remove a join
  const removeJoin = (index) => {
    const newJoins = [...joins];
    newJoins.splice(index, 1);
    
    onChange({
      conditions,
      logicOperator,
      joins: newJoins
    });
  };

  // Update a join
  const updateJoin = (index, field, value) => {
    const newJoins = [...joins];
    newJoins[index] = {
      ...newJoins[index],
      [field]: value
    };
    
    onChange({
      conditions,
      logicOperator,
      joins: newJoins
    });
  };

  // Toggle table selection
  const toggleTable = (tableName) => {
    let updatedTables;
    
    if (tables.includes(tableName)) {
      // Remove table if it's already selected
      updatedTables = tables.filter(name => name !== tableName);
    } else {
      // Add table if it's not already selected
      updatedTables = [...tables, tableName];
    }
    
    // Ensure at least one table is selected
    if (updatedTables.length === 0) {
      return;
    }
    
    onTablesChange(updatedTables);
  };

  // Get fields for a specific table
  const getFieldsForTable = (tableName, columnsSource = columns) => {
    if (!columnsSource || columnsSource.length === 0) {
      return [];
    }
    
    return columnsSource
      .filter(col => col.table === tableName)
      .map(col => ({
        value: `${tableName}.${col.column}`,
        label: `${col.displayName || col.column} (${tableName})`
      }));
  };

  // Refactor getOperatorOptions to accept columns argument
  const getOperatorOptions = (field, columnsArg = columns) => {
    if (!field || !columnsArg || columnsArg.length === 0) {
      return getDefaultOperators();
    }
    const [table, column] = field.split('.');
    const columnInfo = columnsArg.find(col => col.table === table && col.column === column);
    let baseOperators;
    if (!columnInfo) {
      baseOperators = getDefaultOperators();
    } else {
      const dataType = columnInfo.dataType.toLowerCase();
      const isDateLike = dataType.includes('date') || dataType.includes('time') || (column && column.toLowerCase().includes('date'));
      if (dataType.includes('int') || dataType.includes('float') || dataType.includes('double') || dataType === 'decimal') {
        baseOperators = [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'greater_than', label: 'Greater Than' },
          { value: 'less_than', label: 'Less Than' },
          { value: 'greater_or_equal', label: 'Greater Than or Equal' },
          { value: 'less_or_equal', label: 'Less Than or Equal' },
          { value: 'between', label: 'Between' },
          { value: 'is_null', label: 'Is Null' },
          { value: 'is_not_null', label: 'Is Not Null' },
          { value: 'is_empty', label: 'Is Empty' },
          { value: 'is_not_empty', label: 'Is Not Empty' }
        ];
      } else if (isDateLike) {
        baseOperators = [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'greater_than', label: 'After' },
          { value: 'less_than', label: 'Before' },
          { value: 'between', label: 'Between' },
          { value: 'is_today', label: 'Is Today' },
          { value: 'is_before_today', label: 'Is Before Today' },
          { value: 'is_after_today', label: 'Is After Today' },
          { value: 'is_this_month', label: 'Is This Month' },
          { value: 'is_this_year', label: 'Is This Year' },
          { value: 'is_in_past', label: 'Is In The Past' },
          { value: 'is_in_future', label: 'Is In The Future' },
          { value: 'is_null', label: 'Is Null' },
          { value: 'is_not_null', label: 'Is Not Null' },
          { value: 'is_empty', label: 'Is Empty' },
          { value: 'is_not_empty', label: 'Is Not Empty' }
        ];
      } else if (dataType === 'tinyint' || dataType === 'boolean') {
        baseOperators = [
          { value: 'is_true', label: 'Is True/Yes' },
          { value: 'is_false', label: 'Is False/No' }
        ];
      } else {
        baseOperators = [
          { value: 'equals', label: 'Equals' },
          { value: 'not_equals', label: 'Not Equals' },
          { value: 'contains', label: 'Contains' },
          { value: 'starts_with', label: 'Starts With' },
          { value: 'ends_with', label: 'Ends With' },
          { value: 'is_null', label: 'Is Null' },
          { value: 'is_not_null', label: 'Is Not Null' },
          { value: 'is_empty', label: 'Is Empty' },
          { value: 'is_not_empty', label: 'Is Not Empty' }
        ];
      }
    }
    return [...baseOperators, ...SUBQUERY_OPERATORS];
  };

  // Default operators for unknown field types
  const getDefaultOperators = () => {
    return [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'is_empty', label: 'Is Empty' },
      { value: 'is_not_empty', label: 'Is Not Empty' },
      ...SUBQUERY_OPERATORS
    ];
  };

  // Check if a specific operator requires a value input
  const operatorRequiresValue = (operator) => {
    return ![
      'is_empty', 'is_not_empty', 'is_true', 'is_false',
      'is_today', 'is_before_today', 'is_after_today', 'is_this_month', 'is_this_year',
      'is_in_past', 'is_in_future', 'is_null', 'is_not_null'
    ].includes(operator);
  };

  // Check if a specific operator requires a secondary value input (for between operator)
  const operatorRequiresSecondaryValue = (operator) => {
    return operator === 'between';
  };

  // Get a list of all available fields from the selected tables
  const getAvailableFields = () => {
    if (!columns || columns.length === 0) {
      return [];
    }
    
    return columns
      .filter(col => tables.includes(col.table))
      .map(col => ({
        value: `${col.table}.${col.column}`,
        label: `${col.displayName || col.column} (${col.table})`,
        group: col.table
      }));
  };

  // Group fields by table for better organization in the select dropdown
  const getFieldsByGroup = () => {
    const fields = getAvailableFields();
    const fieldsByGroup = {};
    
    fields.forEach(field => {
      if (!fieldsByGroup[field.group]) {
        fieldsByGroup[field.group] = [];
      }
      fieldsByGroup[field.group].push(field);
    });
    
    return fieldsByGroup;
  };
  
  // Get display name for a table
  const getTableDisplayName = (tableName) => {
    const table = availableTables.find(t => t.name === tableName);
    return table ? table.displayName : tableName;
  };

  // When a subquery table is selected, fetch its columns
  useEffect(() => {
    // Find all subquery tables in current conditions
    const subqueryTables = [];
    conditions.forEach(cond => {
      if (isSubqueryOperator(cond.operator) && cond.subquery?.table) {
        if (!subqueryTables.includes(cond.subquery.table)) {
          subqueryTables.push(cond.subquery.table);
        }
      }
    });
    subqueryTables.forEach(table => {
      fetchSubqueryColumns(table);
    });
  }, [conditions]);

  return (
    <div className="query-builder">
      {/* Table selector */}
      <div className="query-table-selector">
        <div 
          className="table-selector-header"
          onClick={() => setTableMenuOpen(!tableMenuOpen)}
        >
          <div className="table-selector-title">
            <FiDatabase size={14} style={{ marginRight: '8px' }} />
            Data Sources
          </div>
          {tableMenuOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </div>
        
        {tableMenuOpen && (
          <div className="table-selector-options">
            {loadingTables ? (
              <div className="query-builder-loading" style={{ padding: '10px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                <p>Loading tables...</p>
              </div>
            ) : (
              availableTables.map(table => (
                <div key={table.name} className="table-option">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={tables.includes(table.name)}
                      onChange={() => toggleTable(table.name)}
                    />
                    {table.displayName || table.name}
                    {table.description && (
                      <span className="table-description">{table.description}</span>
                    )}
                  </label>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {tables.length > 0 && (
        <div className="query-tables-info">
          <FiCheck size={14} style={{ marginRight: '8px' }} />
          Using data from: {tables.map(t => getTableDisplayName(t)).join(', ')}
        </div>
      )}

      {/* Join configuration - show when multiple tables are selected */}
      {tables.length > 1 && (
        <div className="query-join-selector">
          <div 
            className="join-selector-header"
            onClick={() => setJoinMenuOpen(!joinMenuOpen)}
          >
            <div className="join-selector-title">
              <FiLink size={14} style={{ marginRight: '8px' }} />
              Table Relationships ({joins.length} configured)
            </div>
            {joinMenuOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
          </div>
          
          {joinMenuOpen && (
            <div className="join-selector-content">
              <div className="join-info">
                <p>Define how tables are related to each other. This enables cross-table queries.</p>
              </div>
              
              {/* Existing joins */}
              {joins.length > 0 && (
                <div className="joins-list">
                  {joins.map((join, index) => (
                    <div key={join.id || index} className="join-container">
                      <div className="join-row">
                        {/* Join type */}
                        <div className="join-type">
                          <select
                            className="form-control form-control-sm"
                            value={join.type}
                            onChange={(e) => updateJoin(index, 'type', e.target.value)}
                          >
                            {JOIN_TYPES.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Left table */}
                        <div className="join-left-table">
                          <select
                            className="form-control form-control-sm"
                            value={join.leftTable}
                            onChange={(e) => updateJoin(index, 'leftTable', e.target.value)}
                          >
                            <option value="">Select table...</option>
                            {tables.map(table => (
                              <option key={table} value={table}>
                                {getTableDisplayName(table)}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Left field */}
                        <div className="join-left-field">
                          <select
                            className="form-control form-control-sm"
                            value={join.leftField}
                            onChange={(e) => updateJoin(index, 'leftField', e.target.value)}
                            disabled={!join.leftTable}
                          >
                            <option value="">Select field...</option>
                            {join.leftTable && getFieldsForTable(join.leftTable).map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="join-equals">=</div>
                        
                        {/* Right table */}
                        <div className="join-right-table">
                          <select
                            className="form-control form-control-sm"
                            value={join.rightTable}
                            onChange={(e) => updateJoin(index, 'rightTable', e.target.value)}
                          >
                            <option value="">Select table...</option>
                            {tables.map(table => (
                              <option key={table} value={table}>
                                {getTableDisplayName(table)}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Right field */}
                        <div className="join-right-field">
                          <select
                            className="form-control form-control-sm"
                            value={join.rightField}
                            onChange={(e) => updateJoin(index, 'rightField', e.target.value)}
                            disabled={!join.rightTable}
                          >
                            <option value="">Select field...</option>
                            {join.rightTable && getFieldsForTable(join.rightTable).map(field => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Remove join button */}
                        <div className="join-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => removeJoin(index)}
                            title="Remove join"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Join description */}
                      {join.leftTable && join.leftField && join.rightTable && join.rightField && (
                        <div className="join-description">
                          <small>
                            {join.type} {getTableDisplayName(join.rightTable)} ON {getTableDisplayName(join.leftTable)}.{join.leftField} = {getTableDisplayName(join.rightTable)}.{join.rightField}
                          </small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add join button */}
              <div className="join-actions-footer">
                <button
                  type="button"
                  className="settings-button settings-button-secondary"
                  onClick={addJoin}
                  disabled={tables.length < 2}
                >
                  <FiPlus size={14} style={{ marginRight: '4px' }} />
                  Add Table Relationship
                </button>
                {tables.length < 2 && (
                  <small className="join-help-text">
                    Select at least 2 tables to define relationships
                  </small>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Query builder header with logic operator */}
      <div className="query-builder-header">
        <h4>Build Query</h4>
        <div className="query-logic">
          <label>Match:</label>
          <select 
            className="form-control form-control-sm"
            value={logicOperator}
            onChange={(e) => updateLogicOperator(e.target.value)}
          >
            <option value="AND">ALL conditions (AND)</option>
            <option value="OR">ANY condition (OR)</option>
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="settings-alert settings-alert-error" style={{ margin: '8px 0' }}>
          {error}
        </div>
      )}
      
      {/* Loading state */}
      {loadingColumns && (
        <div className="query-builder-loading">
          <div className="spinner"></div>
          <p>Loading query fields...</p>
        </div>
      )}
      
      {/* Conditions list */}
      {!loadingColumns && columns.length > 0 && (
        <div className="conditions-list">
          {conditions.length === 0 ? (
            <div className="notification-groups-empty" style={{ margin: '10px 0' }}>
              <p>No conditions added yet. Add a condition to start building your query.</p>
            </div>
          ) : (
            conditions.map((condition, index) => (
              <div key={index} className="condition-container">
                {/* Connector select for all but first condition */}
                {index > 0 && (
                  <div className="condition-connector-select">
                    <select
                      className="form-control form-control-sm"
                      value={condition.connector || 'AND'}
                      onChange={(e) => updateConnector(index, e.target.value)}
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </div>
                )}
                
                <div className="condition-row">
                  {/* Field select */}
                  <div className="condition-field">
                    <select
                      className="form-control"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                    >
                      <option value="">Select field...</option>
                      {Object.entries(getFieldsByGroup()).map(([groupName, fields]) => (
                        <optgroup key={groupName} label={getTableDisplayName(groupName)}>
                          {fields.map(field => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  
                  {/* Operator select */}
                  <div className="condition-operator">
                    <select
                      className="form-control"
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                    >
                      {getOperatorOptions(condition.field, subqueryColumns[condition.subquery?.table] || columns).map(op => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Value input (if needed) */}
                  {operatorRequiresValue(condition.operator) && (
                    <div className="condition-value">
                      <input
                        type="text"
                        className="form-control"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        placeholder="Value"
                      />
                      {/* Multi-value indicator for equals operator */}
                      {condition.operator === 'equals' && condition.value.includes(',') && (
                        <div className="multi-value-indicator">
                          <small>Using comma-separated values (OR logic)</small>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Secondary value input (for between operator) */}
                  {operatorRequiresSecondaryValue(condition.operator) && (
                    <>
                      <div className="condition-connector">and</div>
                      <div className="condition-secondary-value">
                        <input
                          type="text"
                          className="form-control"
                          value={condition.secondaryValue}
                          onChange={(e) => updateCondition(index, 'secondaryValue', e.target.value)}
                          placeholder="Second Value"
                        />
                      </div>
                    </>
                  )}
                  
                  {/* Remove button */}
                  <div className="condition-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeCondition(index)}
                      title="Remove condition"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>

                {isSubqueryOperator(condition.operator) && (
                  <div className="subquery-builder" style={{ marginTop: 8, marginBottom: 8, padding: 8, background: '#f5f7fa', borderRadius: 4 }}>
                    <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>Subquery</div>
                    {/* Subquery Table Select */}
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 12, marginRight: 6 }}>Table:</label>
                      <select
                        className="form-control form-control-sm"
                        value={condition.subquery?.table || ''}
                        onChange={e => {
                          const newSubquery = { 
                            ...condition.subquery, 
                            table: e.target.value, 
                            field: e.target.value === 'activeusers' ? 'activeusers.id' : '', 
                            conditions: [] 
                          };
                          updateCondition(index, 'subquery', newSubquery);
                        }}
                      >
                        <option value="">Select table...</option>
                        {availableTables.map(table => (
                          <option key={table.name} value={table.name}>{table.displayName || table.name}</option>
                        ))}
                      </select>
                    </div>
                    {/* Subquery Field Select */}
                    {condition.subquery?.table && (
                      <div style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 12, marginRight: 6 }}>Field:</label>
                        <select
                          className="form-control form-control-sm"
                          value={condition.subquery?.field || ''}
                          onChange={e => {
                            const newSubquery = { ...condition.subquery, field: e.target.value };
                            updateCondition(index, 'subquery', newSubquery);
                          }}
                        >
                          <option value="">Select field...</option>
                          {getFieldsForTable(condition.subquery.table, subqueryColumns[condition.subquery.table]).map(field => (
                            <option key={field.value} value={field.value}>{field.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* Subquery Conditions */}
                    {condition.subquery?.table && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, marginBottom: 4 }}>Subquery Conditions:</div>
                        {/* Render a mini QueryBuilder for subquery conditions */}
                        {(condition.subquery.conditions || []).map((subCond, subIdx) => (
                          <div key={subIdx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                            {/* Field select */}
                            <select
                              className="form-control form-control-sm"
                              value={subCond.field}
                              onChange={e => {
                                const newConds = [...condition.subquery.conditions];
                                newConds[subIdx] = { ...newConds[subIdx], field: e.target.value };
                                updateCondition(index, 'subquery', { ...condition.subquery, conditions: newConds });
                              }}
                            >
                              <option value="">Field...</option>
                              {getFieldsForTable(condition.subquery.table, subqueryColumns[condition.subquery.table]).map(field => (
                                <option key={field.value} value={field.value}>{field.label}</option>
                              ))}
                            </select>
                            {/* Operator select */}
                            <select
                              className="form-control form-control-sm"
                              value={subCond.operator}
                              onChange={e => {
                                const newConds = [...condition.subquery.conditions];
                                newConds[subIdx] = { ...newConds[subIdx], operator: e.target.value };
                                updateCondition(index, 'subquery', { ...condition.subquery, conditions: newConds });
                              }}
                            >
                              <option value="">Operator...</option>
                              {(getOperatorOptions(subCond.field, subqueryColumns[condition.subquery.table])
                                || []).filter(op => !isSubqueryOperator(op.value)).map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            {/* Value input (if needed) */}
                            {operatorRequiresValue(subCond.operator) && (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={subCond.value || ''}
                                onChange={e => {
                                  const newConds = [...condition.subquery.conditions];
                                  newConds[subIdx] = { ...newConds[subIdx], value: e.target.value };
                                  updateCondition(index, 'subquery', { ...condition.subquery, conditions: newConds });
                                }}
                                placeholder="Value"
                              />
                            )}
                            {/* Secondary value input (for between) */}
                            {operatorRequiresSecondaryValue(subCond.operator) && (
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={subCond.secondaryValue || ''}
                                onChange={e => {
                                  const newConds = [...condition.subquery.conditions];
                                  newConds[subIdx] = { ...newConds[subIdx], secondaryValue: e.target.value };
                                  updateCondition(index, 'subquery', { ...condition.subquery, conditions: newConds });
                                }}
                                placeholder="Second Value"
                              />
                            )}
                            {/* Remove subquery condition */}
                            <button
                              type="button"
                              className="icon-button"
                              style={{ width: 24, height: 24, padding: 0 }}
                              onClick={() => {
                                const newConds = [...condition.subquery.conditions];
                                newConds.splice(subIdx, 1);
                                updateCondition(index, 'subquery', { ...condition.subquery, conditions: newConds });
                              }}
                              title="Remove subquery condition"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        ))}
                        {/* Add subquery condition button */}
                        <button
                          type="button"
                          className="settings-button settings-button-secondary"
                          style={{ fontSize: 12, marginTop: 4 }}
                          onClick={() => {
                            const newConds = [...(condition.subquery.conditions || [])];
                            // Initialize with empty field and default operator
                            newConds.push({ 
                              field: '', 
                              operator: 'equals', 
                              value: '',
                              secondaryValue: '',
                              connector: 'AND'
                            });
                            updateCondition(index, 'subquery', { ...condition.subquery, conditions: newConds });
                          }}
                        >
                          + Add Subquery Condition
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
      
      {/* Add condition button */}
      <div className="query-builder-footer">
        {!loadingColumns && columns.length > 0 && (
          <button
            type="button"
            className="settings-button settings-button-secondary add-condition-btn"
            onClick={addCondition}
          >
            <FiPlus size={14} style={{ marginRight: '4px' }} />
            Add Condition
          </button>
        )}
      </div>
    </div>
  );
};

export default QueryBuilder; 