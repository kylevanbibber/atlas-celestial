import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiLink, FiSearch, FiCheck, FiX, FiUsers, FiGlobe, FiArrowRight } from 'react-icons/fi';
import api from '../../api';
import './IntegrationSettings.css';

const ICAL_COLORS = ['#17a2b8', '#6f42c1', '#28a745', '#fd7e14', '#e83e8c', '#20c997'];

const CalendarAdmin = () => {
  // Org feeds state
  const [orgFeeds, setOrgFeeds] = useState([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgMsg, setOrgMsg] = useState({ type: '', text: '' });
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedLabel, setNewFeedLabel] = useState('');
  const [feedSubmitting, setFeedSubmitting] = useState(false);

  // Personal iCal subscriptions
  const [personalSubs, setPersonalSubs] = useState([]);
  const [personalSubsLoading, setPersonalSubsLoading] = useState(true);

  // Preview & Import state
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewEvents, setPreviewEvents] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMsg, setPreviewMsg] = useState({ type: '', text: '' });
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [importTarget, setImportTarget] = useState('organization');
  const [importUserSearch, setImportUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchOrgFeeds();
    fetchPersonalSubs();
  }, []);

  const fetchPersonalSubs = async () => {
    try {
      setPersonalSubsLoading(true);
      const r = await api.get('/calendar/admin/ical/my-subs');
      if (r.data.success) setPersonalSubs(r.data.subscriptions || []);
    } catch { /* ignore */ }
    finally { setPersonalSubsLoading(false); }
  };

  const selectSubForImport = (sub) => {
    setPreviewUrl(sub.url);
    setPreviewEvents([]);
    setSelectedEvents(new Set());
    setPreviewMsg({ type: '', text: '' });
    // Scroll to preview section
    document.querySelector('.cal-admin-import-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ---- Org Feeds ----
  const fetchOrgFeeds = async () => {
    try {
      setOrgLoading(true);
      const r = await api.get('/calendar/admin/ical/list');
      if (r.data.success) setOrgFeeds(r.data.subscriptions || []);
    } catch { /* ignore */ }
    finally { setOrgLoading(false); }
  };

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) { setOrgMsg({ type: 'error', text: 'Please enter an iCal URL' }); return; }
    setOrgMsg({ type: '', text: '' });
    setFeedSubmitting(true);
    try {
      const color = ICAL_COLORS[orgFeeds.length % ICAL_COLORS.length];
      const r = await api.post('/calendar/admin/ical/subscribe', {
        url: newFeedUrl.trim(),
        label: newFeedLabel.trim() || 'Organization Calendar',
        color
      });
      if (r.data.success) {
        setOrgMsg({ type: 'success', text: 'Organization feed added' });
        setNewFeedUrl('');
        setNewFeedLabel('');
        setShowAddFeed(false);
        await fetchOrgFeeds();
      } else {
        setOrgMsg({ type: 'error', text: r.data.message || 'Failed to add feed' });
      }
    } catch (err) {
      setOrgMsg({ type: 'error', text: err.response?.data?.message || 'Error adding feed' });
    } finally { setFeedSubmitting(false); }
  };

  const handleDeleteFeed = async (id, label) => {
    if (!window.confirm(`Remove organization feed "${label}"? This will also remove all synced events from this feed.`)) return;
    setOrgMsg({ type: '', text: '' });
    try {
      const r = await api.delete(`/calendar/admin/ical/${id}`);
      if (r.data.success) { setOrgMsg({ type: 'success', text: 'Feed removed' }); await fetchOrgFeeds(); }
      else setOrgMsg({ type: 'error', text: r.data.message || 'Failed' });
    } catch { setOrgMsg({ type: 'error', text: 'Error removing feed' }); }
  };

  // ---- Preview & Import ----
  const handlePreview = async () => {
    if (!previewUrl.trim()) { setPreviewMsg({ type: 'error', text: 'Please enter an iCal URL' }); return; }
    setPreviewMsg({ type: '', text: '' });
    setPreviewLoading(true);
    setPreviewEvents([]);
    setSelectedEvents(new Set());
    try {
      const r = await api.post('/calendar/admin/ical/preview', { url: previewUrl.trim() });
      if (r.data.success) {
        setPreviewEvents(r.data.events || []);
        if (r.data.events.length === 0) {
          setPreviewMsg({ type: 'error', text: 'No events found in this feed for the current date range.' });
        }
      } else {
        setPreviewMsg({ type: 'error', text: r.data.message || 'Failed to preview' });
      }
    } catch (err) {
      setPreviewMsg({ type: 'error', text: err.response?.data?.message || 'Error fetching preview' });
    } finally { setPreviewLoading(false); }
  };

  const toggleEvent = (uid) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleAllEvents = () => {
    if (selectedEvents.size === previewEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(previewEvents.map(e => e.uid)));
    }
  };

  // User search for targeted import
  const searchUsers = async (searchTerm) => {
    setImportUserSearch(searchTerm);
    if (searchTerm.length < 2) { setUserSearchResults([]); return; }
    setUserSearchLoading(true);
    try {
      const r = await api.get('/admin/getAllUsers');
      if (r.data.success) {
        const filtered = (r.data.users || []).filter(u =>
          u.lagnname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 20);
        setUserSearchResults(filtered);
      }
    } catch { setUserSearchResults([]); }
    finally { setUserSearchLoading(false); }
  };

  const addUser = (user) => {
    if (selectedUserIds.find(u => u.id === user.id)) return;
    setSelectedUserIds(prev => [...prev, user]);
    setImportUserSearch('');
    setUserSearchResults([]);
  };

  const removeUser = (userId) => {
    setSelectedUserIds(prev => prev.filter(u => u.id !== userId));
  };

  const handleImport = async () => {
    if (selectedEvents.size === 0) { setImportMsg({ type: 'error', text: 'Select at least one event' }); return; }
    if (importTarget === 'users' && selectedUserIds.length === 0) {
      setImportMsg({ type: 'error', text: 'Select at least one user' });
      return;
    }

    setImportMsg({ type: '', text: '' });
    setImporting(true);
    try {
      const eventsToImport = previewEvents.filter(e => selectedEvents.has(e.uid));
      const r = await api.post('/calendar/admin/ical/import', {
        events: eventsToImport,
        target: importTarget,
        userIds: importTarget === 'users' ? selectedUserIds.map(u => u.id) : undefined,
      });
      if (r.data.success) {
        setImportMsg({ type: 'success', text: `Imported ${eventsToImport.length} event(s) successfully` });
        setSelectedEvents(new Set());
      } else {
        setImportMsg({ type: 'error', text: r.data.message || 'Failed to import' });
      }
    } catch (err) {
      setImportMsg({ type: 'error', text: err.response?.data?.message || 'Error importing events' });
    } finally { setImporting(false); }
  };

  // ---- Render helpers ----
  const renderMessage = (msg) => {
    if (!msg.text) return null;
    return <div className={`integration-msg integration-msg-${msg.type}`}>{msg.text}</div>;
  };

  const formatDateTime = (isoStr, allDay) => {
    const d = new Date(isoStr);
    if (allDay) return d.toLocaleDateString();
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="integration-settings">
      <h2 className="integration-settings-title">Calendar Administration</h2>
      <p className="integration-settings-desc">Manage organization-wide calendar feeds and import events for your team.</p>

      {/* Section 1: Organization Calendar Feeds */}
      <div className="integration-section">
        <div className="integration-section-header">
          <h3 className="integration-section-title">Organization Calendar Feeds</h3>
          <button className="integration-btn integration-btn-sm" onClick={() => setShowAddFeed(!showAddFeed)}>
            <FiPlus /> Add Feed
          </button>
        </div>
        <p className="integration-section-desc">
          iCal feeds added here will sync automatically and appear on every user's calendar.
        </p>
        {renderMessage(orgMsg)}

        {showAddFeed && (
          <div className="integration-card integration-card-add">
            <div className="integration-form-group">
              <label>iCal URL</label>
              <input
                type="url"
                value={newFeedUrl}
                onChange={e => setNewFeedUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                className="integration-input"
              />
            </div>
            <div className="integration-form-group">
              <label>Label</label>
              <input
                type="text"
                value={newFeedLabel}
                onChange={e => setNewFeedLabel(e.target.value)}
                placeholder="Organization Calendar"
                className="integration-input"
              />
            </div>
            <div className="integration-card-actions">
              <button className="integration-btn integration-btn-primary" onClick={handleAddFeed} disabled={feedSubmitting || !newFeedUrl.trim()}>
                <FiLink /> {feedSubmitting ? 'Saving...' : 'Add Feed'}
              </button>
              <button className="integration-btn integration-btn-secondary" onClick={() => { setShowAddFeed(false); setNewFeedUrl(''); setNewFeedLabel(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {orgLoading ? (
          <div className="integration-card-loading">Loading...</div>
        ) : orgFeeds.length === 0 && !showAddFeed ? (
          <div className="integration-empty">
            No organization feeds configured. Click "Add Feed" to subscribe to a calendar feed for all users.
          </div>
        ) : (
          <div className="integration-ical-list">
            {orgFeeds.map(feed => (
              <div key={feed.id} className="integration-ical-item">
                <div className="integration-ical-dot" style={{ background: feed.color || '#17a2b8' }} />
                <div className="integration-ical-info">
                  <strong>{feed.label}</strong>
                  <span className="integration-ical-url">{feed.url.length > 60 ? feed.url.substring(0, 57) + '...' : feed.url}</span>
                  <span className="integration-ical-synced">
                    {feed.created_by_name && `Added by ${feed.created_by_name}`}
                    {feed.last_synced_at && ` | Last synced: ${new Date(feed.last_synced_at).toLocaleString()}`}
                  </span>
                </div>
                <button
                  className="integration-btn integration-btn-icon integration-btn-danger"
                  onClick={() => handleDeleteFeed(feed.id, feed.label)}
                  title="Remove feed"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Preview & Import */}
      <div className="integration-section cal-admin-import-section">
        <h3 className="integration-section-title">Import Events from iCal</h3>
        <p className="integration-section-desc">
          Paste an iCal URL to preview events, then selectively import them for specific users or the entire organization.
        </p>

        {/* Personal subscriptions quick-pick */}
        {!personalSubsLoading && personalSubs.length > 0 && (
          <div className="integration-card" style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary, #6c757d)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Your Subscriptions
            </label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6c757d)', margin: '0 0 8px' }}>
              Select one of your personal iCal feeds to preview and import events.
            </p>
            <div className="cal-admin-my-subs-list">
              {personalSubs.map(sub => (
                <button
                  key={sub.id}
                  className={`cal-admin-my-sub-item ${previewUrl === sub.url ? 'active' : ''}`}
                  onClick={() => selectSubForImport(sub)}
                >
                  <div className="integration-ical-dot" style={{ background: sub.color || '#17a2b8' }} />
                  <span className="cal-admin-my-sub-label">{sub.label}</span>
                  <FiArrowRight size={14} className="cal-admin-my-sub-arrow" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="integration-card">
          <div className="integration-form-group">
            <label>iCal URL</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="url"
                value={previewUrl}
                onChange={e => setPreviewUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                className="integration-input"
                style={{ flex: 1 }}
              />
              <button
                className="integration-btn integration-btn-primary"
                onClick={handlePreview}
                disabled={previewLoading || !previewUrl.trim()}
              >
                <FiSearch /> {previewLoading ? 'Loading...' : 'Preview'}
              </button>
            </div>
          </div>
          {renderMessage(previewMsg)}
        </div>

        {previewEvents.length > 0 && (
          <div className="integration-card" style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ fontSize: '0.875rem' }}>{previewEvents.length} event(s) found</strong>
              <button
                className="integration-btn integration-btn-secondary"
                onClick={toggleAllEvents}
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                {selectedEvents.size === previewEvents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="cal-admin-event-list">
              {previewEvents.map(evt => (
                <label key={evt.uid} className={`cal-admin-event-item ${selectedEvents.has(evt.uid) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(evt.uid)}
                    onChange={() => toggleEvent(evt.uid)}
                  />
                  <div className="cal-admin-event-info">
                    <strong>{evt.title}</strong>
                    <span className="cal-admin-event-time">
                      {formatDateTime(evt.start, evt.allDay)}
                      {' - '}
                      {formatDateTime(evt.end, evt.allDay)}
                    </span>
                    {evt.location && <span className="cal-admin-event-location">{evt.location}</span>}
                  </div>
                </label>
              ))}
            </div>

            {selectedEvents.size > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color, #e8e8e8)' }}>
                <div className="integration-form-group">
                  <label>Import to</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button
                      className={`integration-btn ${importTarget === 'organization' ? 'integration-btn-primary' : 'integration-btn-secondary'}`}
                      onClick={() => setImportTarget('organization')}
                    >
                      <FiGlobe /> Organization
                    </button>
                    <button
                      className={`integration-btn ${importTarget === 'users' ? 'integration-btn-primary' : 'integration-btn-secondary'}`}
                      onClick={() => setImportTarget('users')}
                    >
                      <FiUsers /> Specific Users
                    </button>
                  </div>
                </div>

                {importTarget === 'users' && (
                  <div className="integration-form-group">
                    <label>Search Users</label>
                    <input
                      type="text"
                      value={importUserSearch}
                      onChange={e => searchUsers(e.target.value)}
                      placeholder="Type a name to search..."
                      className="integration-input"
                    />
                    {userSearchLoading && <div className="integration-card-loading" style={{ padding: '8px 0' }}>Searching...</div>}
                    {userSearchResults.length > 0 && (
                      <div className="cal-admin-user-results">
                        {userSearchResults.map(u => (
                          <button
                            key={u.id}
                            className="cal-admin-user-result"
                            onClick={() => addUser(u)}
                          >
                            <FiPlus size={14} />
                            <span>{u.lagnname}</span>
                            <span className="cal-admin-user-role">{u.clname}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedUserIds.length > 0 && (
                      <div className="cal-admin-selected-users">
                        {selectedUserIds.map(u => (
                          <span key={u.id} className="cal-admin-user-chip">
                            {u.lagnname}
                            <button onClick={() => removeUser(u.id)} title="Remove">
                              <FiX size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {renderMessage(importMsg)}

                <button
                  className="integration-btn integration-btn-primary"
                  onClick={handleImport}
                  disabled={importing}
                  style={{ marginTop: '8px' }}
                >
                  <FiCheck /> {importing ? 'Importing...' : `Import ${selectedEvents.size} Event(s)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarAdmin;
