import React, { useState, useEffect, useCallback } from 'react';
import { FiSend, FiSearch, FiSmartphone, FiRefreshCw, FiChevronLeft, FiChevronRight, FiUsers, FiX } from 'react-icons/fi';
import api from '../../../api';
import './AdminNotifications.css';

const PushSubscribers = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
  
  // Send push modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTarget, setSendTarget] = useState(null);
  const [sendForm, setSendForm] = useState({ title: '', message: '', link_url: '', type: 'info' });
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(null);

  const fetchSubscribers = useCallback(async (searchTerm = '', offset = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(offset) });
      if (searchTerm) params.set('search', searchTerm);
      
      const response = await api.get(`/notifications/admin/push-subscribers?${params}`);
      setSubscribers(response.data.data.subscribers);
      setPagination(response.data.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch push subscribers');
      console.error('Error fetching subscribers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSubscribers();
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSubscribers(search, 0);
    }, 400);
    return () => clearTimeout(timeout);
  }, [search]);

  // Open send modal for a user
  const openSendModal = (subscriber) => {
    setSendTarget(subscriber);
    setSendForm({ title: '', message: '', link_url: '', type: 'info' });
    setSendSuccess(null);
    setShowSendModal(true);
  };

  // Close send modal
  const closeSendModal = () => {
    setShowSendModal(false);
    setSendTarget(null);
    setSendSuccess(null);
  };

  // Send push notification
  const handleSendPush = async () => {
    if (!sendTarget || !sendForm.title || !sendForm.message) return;
    
    setSending(true);
    setSendSuccess(null);
    
    try {
      await api.post('/notifications/send', {
        userId: sendTarget.user_id,
        title: sendForm.title,
        message: sendForm.message,
        link_url: sendForm.link_url || '/notifications',
        type: sendForm.type
      });
      setSendSuccess(`Push notification sent to ${sendTarget.screen_name || sendTarget.lagnname}!`);
      setSendForm({ title: '', message: '', link_url: '', type: 'info' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send push notification');
    } finally {
      setSending(false);
    }
  };

  // Pagination
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  const goToPage = (page) => {
    const offset = (page - 1) * pagination.limit;
    fetchSubscribers(search, offset);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="push-subscribers-section">
      {/* Search & Refresh Bar */}
      <div className="push-subscribers-toolbar">
        <div className="push-subscribers-search">
          <FiSearch size={14} className="push-search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, screen name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="push-subscribers-actions">
          <span className="push-subscriber-count">
            <FiUsers size={14} />
            {pagination.total} subscriber{pagination.total !== 1 ? 's' : ''}
          </span>
          <button
            className="settings-button settings-button-secondary"
            onClick={() => fetchSubscribers(search, pagination.offset)}
            disabled={loading}
          >
            <FiRefreshCw size={14} style={{ marginRight: 4 }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="settings-alert settings-alert-error">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="query-builder-loading">
          <div className="spinner"></div>
          <p>Loading subscribers...</p>
        </div>
      ) : subscribers.length === 0 ? (
        <div className="notification-groups-empty">
          <FiSmartphone size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>{search ? 'No subscribers match your search' : 'No push notification subscribers yet'}</p>
        </div>
      ) : (
        <>
          {/* Subscribers List */}
          <div className="push-subscribers-list">
            {subscribers.map(sub => (
              <div key={sub.user_id} className="push-subscriber-item">
                <div className="push-subscriber-user">
                  <div className="push-subscriber-avatar">
                    {sub.profpic ? (
                      <img src={sub.profpic} alt="" />
                    ) : (
                      <div className="push-subscriber-avatar-fallback">
                        {(sub.screen_name || sub.lagnname || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="push-subscriber-info">
                    <div className="push-subscriber-name">
                      {sub.screen_name || sub.lagnname}
                    </div>
                    {sub.screen_name && sub.lagnname && sub.screen_name !== sub.lagnname && (
                      <div className="push-subscriber-detail">{sub.lagnname}</div>
                    )}
                    {sub.email && (
                      <div className="push-subscriber-detail">{sub.email}</div>
                    )}
                  </div>
                </div>
                
                <div className="push-subscriber-meta">
                  <span className="push-subscriber-level">{sub.clname || '—'}</span>
                  <span className="push-subscriber-devices" title={`${sub.device_count} device(s): ${sub.browsers}`}>
                    <FiSmartphone size={13} />
                    {sub.device_count}
                  </span>
                  <span className="push-subscriber-browsers">{sub.browsers}</span>
                  <span className="push-subscriber-date">{formatDateTime(sub.last_active)}</span>
                </div>
                
                <div className="push-subscriber-action">
                  <button
                    className="settings-button"
                    onClick={() => openSendModal(sub)}
                    title={`Send push to ${sub.screen_name || sub.lagnname}`}
                  >
                    <FiSend size={13} style={{ marginRight: 4 }} />
                    Send Push
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="push-subscribers-pagination">
              <button
                className="settings-button settings-button-secondary"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <FiChevronLeft size={14} />
              </button>
              <span className="push-pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="settings-button settings-button-secondary"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                <FiChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Send Push Modal Overlay */}
      {showSendModal && (
        <div className="push-modal-overlay" onClick={closeSendModal}>
          <div className="push-modal" onClick={(e) => e.stopPropagation()}>
            <div className="push-modal-header">
              <h4>
                <FiSend size={16} style={{ marginRight: 8 }} />
                Send Push Notification
              </h4>
              <button className="push-modal-close" onClick={closeSendModal}>
                <FiX size={18} />
              </button>
            </div>
            
            <div className="push-modal-body">
              {/* Target User Info */}
              {sendTarget && (
                <div className="push-modal-target">
                  <div className="push-subscriber-avatar" style={{ width: 32, height: 32 }}>
                    {sendTarget.profpic ? (
                      <img src={sendTarget.profpic} alt="" />
                    ) : (
                      <div className="push-subscriber-avatar-fallback" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                        {(sendTarget.screen_name || sendTarget.lagnname || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <strong>{sendTarget.screen_name || sendTarget.lagnname}</strong>
                    <div className="push-subscriber-detail">
                      {sendTarget.device_count} device{sendTarget.device_count !== 1 ? 's' : ''} • {sendTarget.browsers}
                    </div>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {sendSuccess && (
                <div className="settings-alert settings-alert-success">
                  {sendSuccess}
                </div>
              )}

              {/* Form */}
              <div className="form-group">
                <label>Title <span style={{ color: '#c62828' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={sendForm.title}
                  onChange={(e) => setSendForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Push notification title"
                />
              </div>
              
              <div className="form-group">
                <label>Message <span style={{ color: '#c62828' }}>*</span></label>
                <textarea
                  className="form-control"
                  value={sendForm.message}
                  onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Push notification message"
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Type</label>
                <div className="select-container">
                  <select
                    className="form-control"
                    value={sendForm.type}
                    onChange={(e) => setSendForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="info">Information</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error / Urgent</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Link URL (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={sendForm.link_url}
                  onChange={(e) => setSendForm(prev => ({ ...prev, link_url: e.target.value }))}
                  placeholder="/dashboard, /notifications, etc."
                />
                <small style={{ color: '#666', fontSize: 12 }}>
                  Where the user goes when they tap the notification
                </small>
              </div>
            </div>
            
            <div className="push-modal-footer">
              <button className="settings-button settings-button-secondary" onClick={closeSendModal}>
                Cancel
              </button>
              <button
                className="settings-button"
                onClick={handleSendPush}
                disabled={sending || !sendForm.title || !sendForm.message}
              >
                {sending ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14, marginRight: 6, borderWidth: 2 }} />
                    Sending...
                  </>
                ) : (
                  <>
                    <FiSend size={13} style={{ marginRight: 4 }} />
                    Send Push
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushSubscribers;
