import React, { useState, useEffect } from 'react';
import { FiSend, FiUsers, FiAlertCircle } from 'react-icons/fi';
import api from '../../../api';
import './AdminNotifications.css';

const SendNotification = ({ groups, onRefreshGroups }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    selectedGroupId: '',
    link: '',
    userId: ''
  });
  const [sendMode, setSendMode] = useState('group'); // 'group' | 'user'
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/notifications/admin/active-users', { params: { q: userSearch } });
        if (res.data?.success) setActiveUsers(res.data.data || []);
      } catch (e) {
        // noop
      }
    };
    if (sendMode === 'user') fetchUsers();
  }, [sendMode, userSearch]);

  const notificationTypes = [
    { value: 'info', label: 'Information' },
    { value: 'success', label: 'Success' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Reset preview count when group changes
    if (name === 'selectedGroupId') {
      setPreviewCount(null);
    }
  };

  const handlePreviewCount = async () => {
    if (!formData.selectedGroupId) {
      setError('Please select a notification group first');
      return;
    }

    try {
      setPreviewLoading(true);
      setError(null);
      
      const selectedGroup = groups.find(g => g.id === parseInt(formData.selectedGroupId));
      if (!selectedGroup) {
        setError('Selected group not found');
        return;
      }

      const response = await api.post('/notifications/admin/query-preview', {
        conditions: selectedGroup.queryData.conditions,
        logicOperator: selectedGroup.queryData.logicOperator,
        tables: selectedGroup.tables
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.message) {
      setError('Please fill out title and message');
      return;
    }

    if (sendMode === 'group' && !formData.selectedGroupId) {
      setError('Please select a notification group');
      return;
    }

    if (sendMode === 'user') {
      const parsedId = parseInt(formData.userId, 10);
      if (!parsedId || Number.isNaN(parsedId)) {
        setError('Please enter a valid user ID');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      if (sendMode === 'user') {
        const response = await api.post('/notifications/send', {
          userId: parseInt(formData.userId, 10),
          title: formData.title,
          message: formData.message,
          link_url: formData.link || null
        });

        if (response.data.success) {
          setSuccess('Notification sent to user successfully');
          setFormData({ title: '', message: '', type: 'info', selectedGroupId: '', link: '', userId: '' });
          setPreviewCount(null);
        } else {
          setError(response.data.error || 'Failed to send notification');
        }
      } else {
        const selectedGroup = groups.find(g => g.id === parseInt(formData.selectedGroupId));
        if (!selectedGroup) {
          setError('Selected group not found');
          return;
        }

        const response = await api.post('/notifications/admin/send', {
          title: formData.title,
          message: formData.message,
          type: formData.type,
          link: formData.link || null,
          groupId: parseInt(formData.selectedGroupId),
          queryData: selectedGroup.queryData,
          tables: selectedGroup.tables
        });

        if (response.data.success) {
          setSuccess(`Successfully sent notification to ${response.data.count} user(s)`);
          // Reset form after successful submission
          setFormData({
            title: '',
            message: '',
            type: 'info',
            selectedGroupId: '',
            link: '',
            userId: ''
          });
          setPreviewCount(null);
        } else {
          setError(response.data.error || 'Failed to send notification');
        }
      }
    } catch (err) {
      console.error('Error sending notification:', err);
      setError('Failed to send notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="send-notification">
      <div className="notification-section-header">
        <h3>Send Immediate Notification</h3>
      </div>

      {error && (
        <div className="settings-alert settings-alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="settings-alert settings-alert-success">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="notification-form">
          <div className="input-group">
            <label>Send To</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="sendMode"
                  value="group"
                  checked={sendMode === 'group'}
                  onChange={() => setSendMode('group')}
                />
                Group
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="sendMode"
                  value="user"
                  checked={sendMode === 'user'}
                  onChange={() => setSendMode('user')}
                />
                Specific User (activeusers.id)
              </label>
            </div>
          </div>

          {sendMode === 'user' ? (
            <div className="input-group">
              <label htmlFor="userId">User *</label>
              <div className="select-container">
                <select
                  id="userId"
                  name="userId"
                  className="form-control"
                  value={formData.userId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a user</option>
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.lagnname} ({u.clname})</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                className="form-control"
                style={{ marginTop: 8 }}
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
          ) : (
            <div className="input-group">
              <label htmlFor="selectedGroupId">Target Group *</label>
              <div className="select-container">
                <select
                  id="selectedGroupId"
                  name="selectedGroupId"
                  className="form-control"
                  value={formData.selectedGroupId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a notification group</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.selectedGroupId && (
                <div className="target-preview">
                  <button 
                    type="button" 
                    className="settings-button settings-button-secondary"
                    onClick={handlePreviewCount}
                    disabled={previewLoading || !formData.selectedGroupId}
                  >
                    {previewLoading ? (
                      <>
                        <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <FiUsers size={14} style={{ marginRight: '4px' }} />
                        Check Target Count
                      </>
                    )}
                  </button>
                  {previewCount !== null && (
                    <div className="target-user-count">
                      <FiUsers size={14} style={{ marginRight: '8px' }} />
                      This notification will be sent to <strong>{previewCount}</strong> user{previewCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          

          <div className="input-group">
            <label htmlFor="type">Notification Type *</label>
            <div className="select-container">
              <select
                id="type"
                name="type"
                className="form-control"
                value={formData.type}
                onChange={handleChange}
                required
              >
                {notificationTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="title">Notification Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-control"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter notification title"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="message">Notification Message *</label>
            <textarea
              id="message"
              name="message"
              className="form-control"
              value={formData.message}
              onChange={handleChange}
              placeholder="Enter notification message"
              rows="4"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="link">Link (optional)</label>
            <input
              id="link"
              name="link"
              type="text"
              className="form-control"
              value={formData.link}
              onChange={handleChange}
              placeholder="Enter optional URL for the notification"
            />
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="settings-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                  Sending...
                </>
              ) : (
                <>
                  <FiSend size={16} style={{ marginRight: '8px' }} />
                  Send Notification
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SendNotification; 