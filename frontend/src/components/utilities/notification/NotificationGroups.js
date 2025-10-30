import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiSave, FiX, FiUsers, FiChevronDown, FiChevronUp, FiDatabase, FiCopy } from 'react-icons/fi';
import api from '../../../api';
import QueryBuilder from './QueryBuilder';

const NotificationGroups = ({ groups, onUpdate }) => {
  const [newGroup, setNewGroup] = useState({ 
    name: '', 
    description: '',
    queryData: {
      conditions: [
        {
          id: Date.now(),
          field: 'username',
          operator: 'equals',
          value: '',
          secondaryValue: ''
        }
      ],
      logicOperator: 'AND',
      joins: []
    } 
  });
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editFormData, setEditFormData] = useState({ 
    name: '', 
    description: '', 
    queryData: null 
  });
  const [expandedQueryId, setExpandedQueryId] = useState(null);
  const [userCounts, setUserCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState(['activeusers']);
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [groupTableSelections, setGroupTableSelections] = useState({});

  // Fetch available database tables on component mount
  useEffect(() => {
    const fetchAvailableTables = async () => {
      try {
        const response = await api.get('/schema/tables');
        if (response.data && response.data.tables) {
          setAvailableTables(response.data.tables);
        }
      } catch (err) {
        console.error('Error fetching available tables:', err);
      }
    };

    fetchAvailableTables();
  }, []);

  // Toggle table selection in the list
  const toggleTable = (tableName) => {
    setSelectedTables(prev => {
      if (prev.includes(tableName)) {
        return prev.filter(table => table !== tableName);
      } else {
        return [...prev, tableName];
      }
    });
  };

  const handleAddGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Include the selected tables in the new group
      const groupData = {
        ...newGroup,
        tables: selectedTables
      };
      
      await api.post('/notifications/admin/groups', groupData);
      setNewGroup({ 
        name: '', 
        description: '', 
        queryData: {
          conditions: [
            {
              id: Date.now(),
              field: 'username',
              operator: 'equals',
              value: '',
              secondaryValue: ''
            }
          ],
          logicOperator: 'AND',
          joins: []
        } 
      });
      setSelectedTables(['activeusers']);
      setIsAddingGroup(false);
      onUpdate();
    } catch (err) {
      console.error('Error adding notification group:', err);
      setError(err.response?.data?.message || 'Failed to add notification group');
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroupId(group.id);
    
    // Get the tables from the group's queryData or default to activeusers
    const tables = group.tables || ['activeusers'];
    setSelectedTables(tables);
    
    // Store the tables selection for this group
    setGroupTableSelections(prev => ({
      ...prev,
      [group.id]: tables
    }));
    
    setEditFormData({ 
      name: group.name,
      description: group.description || '',
      queryData: group.queryData || {
        conditions: [
          {
            id: Date.now(),
            field: 'username',
            operator: 'equals',
            value: '',
            secondaryValue: ''
          }
        ],
        logicOperator: 'AND',
        joins: []
      },
      tables: tables
    });
  };

  const handleUpdateGroup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Include the selected tables in the update
      const updateData = {
        ...editFormData,
        tables: selectedTables
      };
      
      await api.put(`/notifications/admin/groups/${editingGroupId}`, updateData);
      setEditingGroupId(null);
      onUpdate();
    } catch (err) {
      console.error('Error updating notification group:', err);
      setError(err.response?.data?.message || 'Failed to update notification group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this notification group?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      await api.delete(`/notifications/admin/groups/${groupId}`);
      onUpdate();
    } catch (err) {
      console.error('Error deleting notification group:', err);
      setError(err.response?.data?.message || 'Failed to delete notification group');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateGroup = async (group) => {
    try {
      setLoading(true);
      setError(null);
      
      // Create a new group with the same settings but with "(2)" appended to the name
      const duplicateData = {
        name: `${group.name} (2)`,
        description: group.description || '',
        queryData: group.queryData,
        tables: group.tables || ['activeusers']
      };
      
      await api.post('/notifications/admin/groups', duplicateData);
      onUpdate();
    } catch (err) {
      console.error('Error duplicating notification group:', err);
      setError(err.response?.data?.message || 'Failed to duplicate notification group');
    } finally {
      setLoading(false);
    }
  };

  const handleQueryUpdate = (queryData, isEditing, id) => {
    if (isEditing) {
      setEditFormData(prev => ({
        ...prev,
        queryData
      }));
    } else {
      setNewGroup(prev => ({
        ...prev,
        queryData
      }));
    }
  };

  const handleQueryPreview = async (count, groupId) => {
    setUserCounts(prev => ({
      ...prev,
      [groupId]: count
    }));
  };

  const toggleQueryView = (id) => {
    setExpandedQueryId(expandedQueryId === id ? null : id);
  };

  const getQuerySummary = (queryData) => {
    if (!queryData || !queryData.conditions || queryData.conditions.length === 0) {
      return 'No query defined';
    }

    const conditionCount = queryData.conditions.length;
    const operator = queryData.logicOperator === 'AND' ? 'all' : 'any';
    
    return `Match ${operator} of ${conditionCount} condition${conditionCount !== 1 ? 's' : ''}`;
  };

  const renderGroupQueryBuilder = (group) => {
    const tables = group.tables || []; // Define the tables array
    
    return (
      <div className="notification-group-query-details">
        <div className="query-tables-info">
          <FiDatabase style={{ marginRight: '5px' }} />
          Data Tables: {tables.join(', ')}
        </div>
        <QueryBuilder 
          conditions={group.queryData?.conditions || []}
          logicOperator={group.queryData?.logicOperator || 'AND'}
          joins={group.queryData?.joins || []}
          tables={tables}
          onChange={(queryData) => {}} // Read-only in view mode
          onTablesChange={() => {}} // Read-only in view mode
        />
      </div>
    );
  };

  return (
    <div className="notification-groups">
      {error && (
        <div className="settings-alert settings-alert-error">{error}</div>
      )}
      
      <p className="settings-help-text">
        Create and manage notification groups using database filters to target specific users
      </p>
      
      <div className="notification-groups-list">
        {groups.length === 0 ? (
          <div className="notification-groups-empty">No groups defined</div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="notification-group-item">
              {editingGroupId === group.id ? (
                // Edit mode
                <div className="notification-group-edit">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Group name"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                      disabled={loading}
                    />
                    <textarea
                      className="form-control"
                      placeholder="Description (optional)"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                      disabled={loading}
                    />
                    
                    <div className="query-builder-container">
                      <div className="query-table-selector">
                        <div className="table-selector-header" onClick={() => setShowTableSelection(!showTableSelection)}>
                          <div className="table-selector-title">
                            <FiDatabase style={{ marginRight: '5px' }} />
                            Data Tables: {selectedTables.join(', ')}
                          </div>
                          <div className="table-selector-toggle">
                            {showTableSelection ? <FiChevronUp /> : <FiChevronDown />}
                          </div>
                        </div>
                        
                        {showTableSelection && (
                          <div className="table-selector-options">
                            {availableTables.map(table => (
                              <div key={table.name} className="table-option">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={selectedTables.includes(table.name)}
                                    onChange={() => toggleTable(table.name)}
                                  />
                                  {table.displayName || table.name}
                                  {table.description && <span className="table-description">{table.description}</span>}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <h4>Query Builder</h4>
                      <p className="settings-help-text">Define which users should be included in this group</p>
                      
                      <QueryBuilder 
                        conditions={editFormData.queryData?.conditions || []}
                        logicOperator={editFormData.queryData?.logicOperator || 'AND'}
                        joins={editFormData.queryData?.joins || []}
                        tables={selectedTables}
                        onChange={(queryData) => handleQueryUpdate(queryData, true, group.id)}
                        onTablesChange={(tables) => setSelectedTables(tables)}
                      />
                    </div>
                    
                    <div className="form-actions">
                      <button 
                        className="settings-button" 
                        onClick={handleUpdateGroup}
                        disabled={loading || !editFormData.name.trim()}
                      >
                        <FiSave style={{ marginRight: '5px' }} />
                        Save Group
                      </button>
                      <button 
                        className="settings-button settings-button-secondary" 
                        onClick={() => setEditingGroupId(null)}
                        disabled={loading}
                      >
                        <FiX style={{ marginRight: '5px' }} />
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="notification-group-info">
                    <h4>{group.name}</h4>
                    {group.description && <p>{group.description}</p>}
                    
                    <div className="notification-group-query-summary" onClick={() => toggleQueryView(group.id)}>
                      <div className="query-summary-header">
                        <span className="query-indicator">
                          <FiUsers size={14} style={{ marginRight: '5px' }} />
                          {getQuerySummary(group.queryData)}
                        </span>
                        <span className="expand-icon">
                          {expandedQueryId === group.id ? <FiChevronUp /> : <FiChevronDown />}
                        </span>
                      </div>
                      
                      {userCounts[group.id] !== undefined && (
                        <div className="user-count-badge">
                          {userCounts[group.id]} {userCounts[group.id] === 1 ? 'user' : 'users'}
                        </div>
                      )}
                    </div>
                    
                    {expandedQueryId === group.id && renderGroupQueryBuilder(group)}
                  </div>
                  <div className="notification-group-actions">
                    <button 
                      className="icon-button" 
                      onClick={() => handleEditGroup(group)}
                      disabled={loading}
                      title="Edit Group"
                      style={{
                        padding: '8px',
                        margin: '0 4px',
                        border: '1px solid var(--border-color, #ddd)',
                        borderRadius: '4px',
                        background: 'var(--bg-secondary, #f8f9fa)',
                        color: 'var(--text-primary, #333)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button 
                      className="icon-button" 
                      onClick={() => {
                        console.log('Duplicate button clicked for group:', group.name);
                        handleDuplicateGroup(group);
                      }}
                      disabled={loading}
                      title="Duplicate Group"
                      style={{
                        padding: '8px',
                        margin: '0 4px',
                        border: '1px solid var(--border-color, #ddd)',
                        borderRadius: '4px',
                        background: 'var(--bg-secondary, #f8f9fa)',
                        color: 'var(--text-primary, #333)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <FiCopy size={16} />
                    </button>
                    <button 
                      className="icon-button" 
                      onClick={() => handleDeleteGroup(group.id)}
                      disabled={loading}
                      title="Delete Group"
                      style={{
                        padding: '8px',
                        margin: '0 4px',
                        border: '1px solid var(--border-color, #ddd)',
                        borderRadius: '4px',
                        background: 'var(--bg-secondary, #f8f9fa)',
                        color: 'var(--text-danger, #dc3545)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
      
      {isAddingGroup ? (
        <div className="notification-group-add-form">
          <h4>Create Notification Group</h4>
          
          <input
            type="text"
            className="form-control"
            placeholder="Group name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
            disabled={loading}
          />
          <textarea
            className="form-control"
            placeholder="Description (optional)"
            value={newGroup.description}
            onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
            disabled={loading}
          />
          
          <div className="query-builder-container">
            <div className="query-table-selector">
              <div className="table-selector-header" onClick={() => setShowTableSelection(!showTableSelection)}>
                <div className="table-selector-title">
                  <FiDatabase style={{ marginRight: '5px' }} />
                  Data Tables: {selectedTables.join(', ')}
                </div>
                <div className="table-selector-toggle">
                  {showTableSelection ? <FiChevronUp /> : <FiChevronDown />}
                </div>
              </div>
              
              {showTableSelection && (
                <div className="table-selector-options">
                  {availableTables.map(table => (
                    <div key={table.name} className="table-option">
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedTables.includes(table.name)}
                          onChange={() => toggleTable(table.name)}
                        />
                        {table.displayName || table.name}
                        {table.description && <span className="table-description">{table.description}</span>}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <h4>Query Builder</h4>
            <p className="settings-help-text">Define which users should be included in this group</p>
            
            <QueryBuilder 
              conditions={newGroup.queryData?.conditions || []}
              logicOperator={newGroup.queryData?.logicOperator || 'AND'}
              joins={newGroup.queryData?.joins || []}
              tables={selectedTables} 
              onChange={(queryData) => handleQueryUpdate(queryData, false)}
              onTablesChange={(tables) => setSelectedTables(tables)}
            />
          </div>
          
          <div className="form-actions">
            <button 
              className="settings-button"
              onClick={handleAddGroup}
              disabled={loading || !newGroup.name.trim()}
            >
              {loading ? 'Adding...' : 'Add Group'}
            </button>
            <button 
              className="settings-button settings-button-secondary"
              onClick={() => setIsAddingGroup(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button 
          className="settings-button settings-button-add"
          onClick={() => setIsAddingGroup(true)}
        >
          <FiPlus /> Add Notification Group
        </button>
      )}
    </div>
  );
};

export default NotificationGroups; 