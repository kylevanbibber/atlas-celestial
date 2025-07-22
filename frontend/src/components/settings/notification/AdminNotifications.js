import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiUsers, FiRefreshCw, FiCheck, FiX, FiChevronDown, FiChevronRight, FiBell, FiCopy } from 'react-icons/fi';
import api from '../../../api';
import QueryBuilder from './QueryBuilder';
import NotificationSchedule from './NotificationSchedule';
import SendNotification from './SendNotification';
import './AdminNotifications.css';

const AdminNotifications = () => {
  const [activeSection, setActiveSection] = useState('groups');
  const [notificationGroups, setNotificationGroups] = useState([]);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditingGroup, setIsEditingGroup] = useState(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    tables: ['activeusers'],
    queryData: {
      conditions: [],
      logicOperator: 'AND'
    }
  });
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch notification groups on component mount
  useEffect(() => {
    fetchNotificationGroups();
  }, []);

  // Fetch scheduled notifications when that section is active
  useEffect(() => {
    if (activeSection === 'schedule') {
      fetchScheduledNotifications();
    }
  }, [activeSection]);

  // Fetch all notification groups
  const fetchNotificationGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/notifications/admin/groups');
      
      if (response.data.success) {
        // Process the groups to parse JSON data
        const groups = response.data.groups.map(group => ({
          ...group,
          queryData: JSON.parse(group.query_data || '{"conditions":[],"logicOperator":"AND"}'),
          tables: JSON.parse(group.tables || '["activeusers"]')
        }));
        
        setNotificationGroups(groups);
      } else {
        setError(response.data.error || 'Failed to fetch notification groups');
      }
    } catch (err) {
      console.error('Error fetching notification groups:', err);
      setError('Failed to fetch notification groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch scheduled notifications
  const fetchScheduledNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/notifications/scheduled');
      setScheduledNotifications(response.data || []);
    } catch (err) {
      console.error('Error fetching scheduled notifications:', err);
      setError('Failed to fetch scheduled notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a new group
  const handleAddGroup = () => {
    setIsAddingGroup(true);
    setEditFormData({
      name: '',
      description: '',
      queryData: { conditions: [], logicOperator: 'AND' },
      tables: ['activeusers']
    });
  };

  // Handle editing a group
  const handleEditGroup = (group) => {
    setIsEditingGroup(group.id);
    setEditFormData({
      name: group.name,
      description: group.description || '',
      queryData: {
        ...group.queryData,
        joins: group.queryData?.joins || []
      },
      tables: group.tables
    });
  };

  // Handle deleting a group
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this notification group?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.delete(`/notifications/admin/groups/${groupId}`);
      
      if (response.data.success) {
        // Remove the deleted group from state
        setNotificationGroups(notificationGroups.filter(group => group.id !== groupId));
      } else {
        setError(response.data.error || 'Failed to delete notification group');
      }
    } catch (err) {
      console.error('Error deleting notification group:', err);
      setError('Failed to delete notification group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle duplicating a group
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
      
      const response = await api.post('/notifications/admin/groups', duplicateData);
      
      if (response.data.success) {
        await fetchNotificationGroups();
      } else {
        setError(response.data.error || 'Failed to duplicate notification group');
      }
    } catch (err) {
      console.error('Error duplicating notification group:', err);
      setError('Failed to duplicate notification group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission for adding/editing a group
  const handleSubmitGroupForm = async (e) => {
    e.preventDefault();
    
    // Validate form data
    if (!editFormData.name) {
      setError('Group name is required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Prepare the request data
      const requestData = {
        name: editFormData.name,
        description: editFormData.description,
        queryData: editFormData.queryData,
        tables: editFormData.tables
      };
      
      let response;
      
      if (isEditingGroup) {
        // Update existing group
        response = await api.put(`/notifications/admin/groups/${isEditingGroup}`, requestData);
      } else {
        // Create new group
        response = await api.post('/notifications/admin/groups', requestData);
      }
      
      if (response.data.success) {
        await fetchNotificationGroups();
        // Reset form state
        setIsEditingGroup(null);
        setIsAddingGroup(false);
      } else {
        setError(response.data.error || 'Failed to save notification group');
      }
    } catch (err) {
      console.error('Error saving notification group:', err);
      setError('Failed to save notification group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle previewing query results
  const handlePreviewQuery = async () => {
    try {
      setPreviewLoading(true);
      setError(null);
      
      const response = await api.post('/notifications/admin/query-preview', {
        conditions: editFormData.queryData.conditions,
        logicOperator: editFormData.queryData.logicOperator,
        joins: editFormData.queryData.joins || [],
        tables: editFormData.tables
      });
      
      if (response.data.success) {
        setPreviewCount(response.data.count);
      } else {
        setError(response.data.error || 'Failed to preview query results');
      }
    } catch (err) {
      console.error('Error previewing query:', err);
      setError('Failed to preview query. Please try again.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle canceling the add/edit form
  const handleCancelForm = () => {
    setIsEditingGroup(null);
    setIsAddingGroup(false);
    setEditFormData({
      name: '',
      description: '',
      tables: ['activeusers'],
      queryData: {
        conditions: [],
        logicOperator: 'AND',
        joins: []
      }
    });
    setPreviewCount(null);
  };

  return (
    <div className="admin-notifications settings-card">
      <h2 className="settings-card-title">Notification Management</h2>
      
      {/* Section tabs */}
      <div className="settings-tabs">
        <button 
          className={`settings-tab ${activeSection === 'send' ? 'active' : ''}`} 
          onClick={() => setActiveSection('send')}
        >
          <FiBell size={14} style={{ marginRight: '4px' }} />
          Send Notification
        </button>
        <button 
          className={`settings-tab ${activeSection === 'schedule' ? 'active' : ''}`} 
          onClick={() => setActiveSection('schedule')}
        >
          Schedule Notifications
        </button>
                <button 
          className={`settings-tab ${activeSection === 'groups' ? 'active' : ''}`} 
          onClick={() => setActiveSection('groups')}
        >
          Notification Groups
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="settings-alert settings-alert-error">
          {error}
        </div>
      )}
      
      {/* Groups section */}
      {activeSection === 'groups' && (
        <div className="notification-groups">
          <div className="notification-section-header">
            <h3>Manage Notification Groups</h3>
            <button 
              className="settings-button"
              onClick={handleAddGroup}
              disabled={isAddingGroup || isEditingGroup !== null}
            >
              <FiPlus size={16} style={{ marginRight: '4px' }} />
              Add Group
            </button>
          </div>
          
          {/* Add/Edit form */}
          {(isAddingGroup || isEditingGroup !== null) && (
            <div className="notification-group-edit">
              <form onSubmit={handleSubmitGroupForm}>
                <div className="notification-group-add-form">
                  <h4>{isEditingGroup !== null ? 'Edit Group' : 'Add New Group'}</h4>
                  
                  <div className="input-group">
                    <label htmlFor="group-name">Group Name</label>
                    <input
                      id="group-name"
                      type="text"
                      className="form-control"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                      placeholder="Enter group name"
                      required
                    />
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="group-description">Description (optional)</label>
                    <textarea
                      id="group-description"
                      className="form-control"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                      placeholder="Enter group description"
                      rows="2"
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>User Query</label>
                    <div className="query-builder-container">
                      <QueryBuilder
                        conditions={editFormData.queryData.conditions}
                        logicOperator={editFormData.queryData.logicOperator}
                        tables={editFormData.tables}
                        joins={editFormData.queryData.joins || []}
                        onTablesChange={(tables) => setEditFormData({
                          ...editFormData,
                          tables
                        })}
                        onChange={(queryData) => setEditFormData({
                          ...editFormData,
                          queryData
                        })}
                      />
                      
                      <div className="query-preview-actions">
                        <button 
                          type="button" 
                          className="settings-button settings-button-secondary"
                          onClick={handlePreviewQuery}
                          disabled={previewLoading}
                        >
                          {previewLoading ? (
                            <>
                              <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                              Calculating...
                            </>
                          ) : (
                            <>
                              <FiUsers size={14} style={{ marginRight: '4px' }} />
                              Preview User Count
                            </>
                          )}
                        </button>
                        
                        {previewCount !== null && (
                          <div className="target-user-count">
                            <FiUsers size={14} style={{ marginRight: '8px' }} />
                            This query will target <strong>{previewCount}</strong> user{previewCount !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="settings-button"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Group'}
                    </button>
                    <button 
                      type="button" 
                      className="settings-button settings-button-secondary"
                      onClick={handleCancelForm}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
          
          {/* Groups list */}
          <div className="notification-groups-list">
            {loading && !isAddingGroup && isEditingGroup === null ? (
              <div className="query-builder-loading">
                <div className="spinner"></div>
                <p>Loading notification groups...</p>
              </div>
            ) : notificationGroups.length === 0 ? (
              <div className="notification-groups-empty">
                <p>No notification groups found. Create a group to target specific users with notifications.</p>
              </div>
            ) : (
              notificationGroups.map(group => (
                <div key={group.id} className="notification-group-item">
                  <div className="notification-group-info">
                    <h4>{group.name}</h4>
                    {group.description && <p>{group.description}</p>}
                    
                    <div className="notification-group-query-summary">
                      <div className="query-summary-header">
                        <span className="query-indicator">
                          <FiUsers size={14} style={{ marginRight: '4px' }} />
                          Query: {group.queryData?.conditions?.length || 0} condition(s)
                        </span>
                        <FiChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="notification-group-actions">
                    <button 
                      className="icon-button"
                      onClick={() => handleEditGroup(group)}
                      disabled={isAddingGroup || isEditingGroup !== null}
                      title="Edit group"
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
                      <FiEdit size={16} />
                    </button>
                    <button 
                      className="icon-button"
                      onClick={() => handleDuplicateGroup(group)}
                      disabled={loading}
                      title="Duplicate group"
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
                      title="Delete group"
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Send Notification section */}
      {activeSection === 'send' && (
        <SendNotification
          groups={notificationGroups}
          onRefreshGroups={fetchNotificationGroups}
        />
      )}
      
      {/* Schedule section */}
      {activeSection === 'schedule' && (
        <div className="notification-schedule">
          <NotificationSchedule 
            groups={notificationGroups}
            scheduledNotifications={scheduledNotifications}
            onRefresh={fetchScheduledNotifications}
          />
        </div>
      )}
    </div>
  );
};

export default AdminNotifications; 