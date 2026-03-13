import React, { useState, useEffect } from 'react';
import { FaDiscord } from 'react-icons/fa';
import { FiLink, FiRefreshCw, FiTrash2, FiPlus, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import api from '../../api';
import DiscordUtilities from './discord/DiscordUtilities';
import './IntegrationSettings.css';

const ICAL_COLORS = ['#17a2b8', '#6f42c1', '#28a745', '#fd7e14', '#e83e8c', '#20c997'];

const IntegrationSettings = () => {
  // Calendly
  const [calendlyStatus, setCalendlyStatus] = useState({ isLinked: false, username: null });
  const [calendlyLoading, setCalendlyLoading] = useState(true);
  const [calendlySubmitting, setCalendlySubmitting] = useState(false);
  const [calendlyMsg, setCalendlyMsg] = useState({ type: '', text: '' });

  // Google Calendar
  const [googleCalStatus, setGoogleCalStatus] = useState({ isLinked: false, email: null });
  const [googleCalLoading, setGoogleCalLoading] = useState(true);
  const [googleCalSubmitting, setGoogleCalSubmitting] = useState(false);
  const [googleCalMsg, setGoogleCalMsg] = useState({ type: '', text: '' });

  // Outlook Calendar
  const [outlookCalStatus, setOutlookCalStatus] = useState({ isLinked: false, email: null });
  const [outlookCalLoading, setOutlookCalLoading] = useState(true);
  const [outlookCalSubmitting, setOutlookCalSubmitting] = useState(false);
  const [outlookCalMsg, setOutlookCalMsg] = useState({ type: '', text: '' });

  // iCal subscriptions (multiple)
  const [icalSubs, setIcalSubs] = useState([]);
  const [icalLoading, setIcalLoading] = useState(true);
  const [icalSubmitting, setIcalSubmitting] = useState(false);
  const [icalMsg, setIcalMsg] = useState({ type: '', text: '' });
  const [newIcalUrl, setNewIcalUrl] = useState('');
  const [newIcalLabel, setNewIcalLabel] = useState('');
  const [showAddIcal, setShowAddIcal] = useState(false);

  // Discord expanded
  const [discordExpanded, setDiscordExpanded] = useState(false);

  useEffect(() => {
    fetchAllStatuses();
    fetchIcalList();
  }, []);

  // Fetch all integration statuses in one call
  const fetchAllStatuses = async () => {
    try {
      setCalendlyLoading(true);
      setGoogleCalLoading(true);
      setOutlookCalLoading(true);
      const r = await api.get('/account/status/all');
      if (r.data?.success) {
        setCalendlyStatus({ isLinked: r.data.calendly?.isLinked || false, username: r.data.calendly?.username || null });
        setGoogleCalStatus({ isLinked: r.data.googleCalendar?.isLinked || false, email: r.data.googleCalendar?.email || null });
        setOutlookCalStatus({ isLinked: r.data.outlookCalendar?.isLinked || false, email: r.data.outlookCalendar?.email || null });
      }
    } catch { /* ignore */ } finally {
      setCalendlyLoading(false);
      setGoogleCalLoading(false);
      setOutlookCalLoading(false);
    }
  };

  // ---- Calendly ----
  const fetchCalendlyStatus = async () => {
    try {
      setCalendlyLoading(true);
      const r = await api.get('/account/calendly/status');
      if (r.data.success) setCalendlyStatus({ isLinked: r.data.isLinked, username: r.data.username });
    } catch { /* ignore */ } finally { setCalendlyLoading(false); }
  };

  const handleLinkCalendly = async () => {
    setCalendlyMsg({ type: '', text: '' });
    setCalendlySubmitting(true);
    try {
      const r = await api.get('/account/calendly/oauth/init');
      if (r.data.success && r.data.authUrl) {
        sessionStorage.setItem('calendly_oauth_initiated', 'true');
        window.location.href = r.data.authUrl;
      } else {
        setCalendlyMsg({ type: 'error', text: r.data.message || 'Failed to start OAuth' });
        setCalendlySubmitting(false);
      }
    } catch {
      setCalendlyMsg({ type: 'error', text: 'Error starting Calendly OAuth' });
      setCalendlySubmitting(false);
    }
  };

  const handleRefreshCalendly = async () => {
    setCalendlyMsg({ type: '', text: '' });
    setCalendlySubmitting(true);
    try {
      const r = await api.post('/account/calendly/refresh');
      if (r.data.success) { setCalendlyMsg({ type: 'success', text: 'Refreshed' }); await fetchCalendlyStatus(); }
      else setCalendlyMsg({ type: 'error', text: r.data.message || 'Refresh failed' });
    } catch { setCalendlyMsg({ type: 'error', text: 'Error refreshing' }); }
    finally { setCalendlySubmitting(false); }
  };

  const handleUnlinkCalendly = async () => {
    if (!window.confirm('Unlink Calendly?')) return;
    setCalendlyMsg({ type: '', text: '' });
    setCalendlySubmitting(true);
    try {
      const r = await api.delete('/account/calendly/unlink');
      if (r.data.success) { setCalendlyMsg({ type: 'success', text: 'Unlinked' }); await fetchCalendlyStatus(); }
      else setCalendlyMsg({ type: 'error', text: r.data.message || 'Failed' });
    } catch { setCalendlyMsg({ type: 'error', text: 'Error unlinking' }); }
    finally { setCalendlySubmitting(false); }
  };

  // ---- Google Calendar ----
  const fetchGoogleCalStatus = async () => {
    try {
      setGoogleCalLoading(true);
      const r = await api.get('/account/google-calendar/status');
      if (r.data.success) setGoogleCalStatus({ isLinked: r.data.isLinked, email: r.data.email });
    } catch { /* ignore */ } finally { setGoogleCalLoading(false); }
  };

  const handleLinkGoogleCal = async () => {
    setGoogleCalMsg({ type: '', text: '' });
    setGoogleCalSubmitting(true);
    try {
      const r = await api.get('/account/google-calendar/oauth/init');
      if (r.data.success && r.data.authUrl) {
        sessionStorage.setItem('google_calendar_oauth_initiated', 'true');
        window.location.href = r.data.authUrl;
      } else {
        setGoogleCalMsg({ type: 'error', text: r.data.message || 'Failed to start OAuth' });
        setGoogleCalSubmitting(false);
      }
    } catch {
      setGoogleCalMsg({ type: 'error', text: 'Error starting Google Calendar OAuth' });
      setGoogleCalSubmitting(false);
    }
  };

  const handleRefreshGoogleCal = async () => {
    setGoogleCalMsg({ type: '', text: '' });
    setGoogleCalSubmitting(true);
    try {
      const r = await api.post('/account/google-calendar/refresh');
      if (r.data.success) { setGoogleCalMsg({ type: 'success', text: 'Refreshed' }); await fetchGoogleCalStatus(); }
      else setGoogleCalMsg({ type: 'error', text: r.data.message || 'Refresh failed' });
    } catch { setGoogleCalMsg({ type: 'error', text: 'Error refreshing' }); }
    finally { setGoogleCalSubmitting(false); }
  };

  const handleUnlinkGoogleCal = async () => {
    if (!window.confirm('Unlink Google Calendar?')) return;
    setGoogleCalMsg({ type: '', text: '' });
    setGoogleCalSubmitting(true);
    try {
      const r = await api.delete('/account/google-calendar/unlink');
      if (r.data.success) { setGoogleCalMsg({ type: 'success', text: 'Unlinked' }); await fetchGoogleCalStatus(); }
      else setGoogleCalMsg({ type: 'error', text: r.data.message || 'Failed' });
    } catch { setGoogleCalMsg({ type: 'error', text: 'Error unlinking' }); }
    finally { setGoogleCalSubmitting(false); }
  };

  // ---- Outlook Calendar ----
  const fetchOutlookCalStatus = async () => {
    try {
      setOutlookCalLoading(true);
      const r = await api.get('/account/outlook-calendar/status');
      if (r.data.success) setOutlookCalStatus({ isLinked: r.data.isLinked, email: r.data.email });
    } catch { /* ignore */ } finally { setOutlookCalLoading(false); }
  };

  const handleLinkOutlookCal = async () => {
    setOutlookCalMsg({ type: '', text: '' });
    setOutlookCalSubmitting(true);
    try {
      const r = await api.get('/account/outlook-calendar/oauth/init');
      if (r.data.success && r.data.authUrl) {
        sessionStorage.setItem('outlook_calendar_oauth_initiated', 'true');
        window.location.href = r.data.authUrl;
      } else {
        setOutlookCalMsg({ type: 'error', text: r.data.message || 'Failed to start OAuth' });
        setOutlookCalSubmitting(false);
      }
    } catch {
      setOutlookCalMsg({ type: 'error', text: 'Error starting Outlook Calendar OAuth' });
      setOutlookCalSubmitting(false);
    }
  };

  const handleRefreshOutlookCal = async () => {
    setOutlookCalMsg({ type: '', text: '' });
    setOutlookCalSubmitting(true);
    try {
      const r = await api.post('/account/outlook-calendar/refresh');
      if (r.data.success) { setOutlookCalMsg({ type: 'success', text: 'Refreshed' }); await fetchOutlookCalStatus(); }
      else setOutlookCalMsg({ type: 'error', text: r.data.message || 'Refresh failed' });
    } catch { setOutlookCalMsg({ type: 'error', text: 'Error refreshing' }); }
    finally { setOutlookCalSubmitting(false); }
  };

  const handleUnlinkOutlookCal = async () => {
    if (!window.confirm('Unlink Outlook Calendar?')) return;
    setOutlookCalMsg({ type: '', text: '' });
    setOutlookCalSubmitting(true);
    try {
      const r = await api.delete('/account/outlook-calendar/unlink');
      if (r.data.success) { setOutlookCalMsg({ type: 'success', text: 'Unlinked' }); await fetchOutlookCalStatus(); }
      else setOutlookCalMsg({ type: 'error', text: r.data.message || 'Failed' });
    } catch { setOutlookCalMsg({ type: 'error', text: 'Error unlinking' }); }
    finally { setOutlookCalSubmitting(false); }
  };

  // ---- iCal Subscriptions (multiple) ----
  const fetchIcalList = async () => {
    try {
      setIcalLoading(true);
      const r = await api.get('/account/ical/list');
      if (r.data.success) setIcalSubs(r.data.subscriptions || []);
    } catch { /* ignore */ } finally { setIcalLoading(false); }
  };

  const handleAddIcal = async () => {
    if (!newIcalUrl.trim()) { setIcalMsg({ type: 'error', text: 'Please enter an iCal URL' }); return; }
    setIcalMsg({ type: '', text: '' });
    setIcalSubmitting(true);
    try {
      const color = ICAL_COLORS[icalSubs.length % ICAL_COLORS.length];
      const r = await api.post('/account/ical/subscribe', {
        url: newIcalUrl.trim(),
        label: newIcalLabel.trim() || 'My Calendar',
        color
      });
      if (r.data.success) {
        setIcalMsg({ type: 'success', text: 'Subscription added' });
        setNewIcalUrl('');
        setNewIcalLabel('');
        setShowAddIcal(false);
        await fetchIcalList();
      } else {
        setIcalMsg({ type: 'error', text: r.data.message || 'Failed to add' });
      }
    } catch (err) {
      setIcalMsg({ type: 'error', text: err.response?.data?.message || 'Error adding subscription' });
    } finally { setIcalSubmitting(false); }
  };

  const handleDeleteIcal = async (id, label) => {
    if (!window.confirm(`Remove "${label}"?`)) return;
    setIcalMsg({ type: '', text: '' });
    try {
      const r = await api.delete(`/account/ical/${id}`);
      if (r.data.success) { setIcalMsg({ type: 'success', text: 'Removed' }); await fetchIcalList(); }
      else setIcalMsg({ type: 'error', text: r.data.message || 'Failed' });
    } catch { setIcalMsg({ type: 'error', text: 'Error removing subscription' }); }
  };

  // ---- Render helpers ----
  const renderMessage = (msg) => {
    if (!msg.text) return null;
    return <div className={`integration-msg integration-msg-${msg.type}`}>{msg.text}</div>;
  };

  const renderOAuthCard = ({ title, description, color, loading, isLinked, detail, submitting, msg, onLink, onRefresh, onUnlink }) => (
    <div className="integration-card">
      <div className="integration-card-header">
        <div className="integration-card-dot" style={{ background: isLinked ? '#10b981' : color }} />
        <div className="integration-card-info">
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
        {isLinked && <span className="integration-status-badge connected">Connected</span>}
        {!isLinked && !loading && <span className="integration-status-badge disconnected">Not Connected</span>}
      </div>
      {renderMessage(msg)}
      {loading ? (
        <div className="integration-card-loading">Loading...</div>
      ) : isLinked ? (
        <div className="integration-card-body">
          {detail && <div className="integration-detail">{detail}</div>}
          <div className="integration-card-actions">
            <button className="integration-btn integration-btn-secondary" onClick={onRefresh} disabled={submitting}>
              <FiRefreshCw /> {submitting ? 'Working...' : 'Refresh'}
            </button>
            <button className="integration-btn integration-btn-danger" onClick={onUnlink} disabled={submitting}>
              <FiTrash2 /> Unlink
            </button>
          </div>
        </div>
      ) : (
        <div className="integration-card-body">
          <button className="integration-btn integration-btn-primary" onClick={onLink} disabled={submitting}>
            <FiLink /> {submitting ? 'Connecting...' : `Connect ${title}`}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="integration-settings">
      <h2 className="integration-settings-title">Integrations</h2>
      <p className="integration-settings-desc">Connect your external accounts and calendars to sync with Atlas.</p>


      <div className="integration-section">
        <h3 className="integration-section-title">Calendar Integrations</h3>
        <div className="integration-grid">
          {renderOAuthCard({
            title: 'Calendly',
            description: 'Sync Calendly appointments to your Atlas calendar.',
            color: '#006BFF',
            loading: calendlyLoading,
            isLinked: calendlyStatus.isLinked,
            detail: calendlyStatus.username,
            submitting: calendlySubmitting,
            msg: calendlyMsg,
            onLink: handleLinkCalendly,
            onRefresh: handleRefreshCalendly,
            onUnlink: handleUnlinkCalendly,
          })}

          {renderOAuthCard({
            title: 'Google Calendar',
            description: 'Sync Google Calendar events to Atlas.',
            color: '#4285F4',
            loading: googleCalLoading,
            isLinked: googleCalStatus.isLinked,
            detail: googleCalStatus.email,
            submitting: googleCalSubmitting,
            msg: googleCalMsg,
            onLink: handleLinkGoogleCal,
            onRefresh: handleRefreshGoogleCal,
            onUnlink: handleUnlinkGoogleCal,
          })}

          {/* Outlook Calendar - hidden for now
          {renderOAuthCard({
            title: 'Outlook Calendar',
            description: 'Sync Outlook Calendar events to Atlas.',
            color: '#0078D4',
            loading: outlookCalLoading,
            isLinked: outlookCalStatus.isLinked,
            detail: outlookCalStatus.email,
            submitting: outlookCalSubmitting,
            msg: outlookCalMsg,
            onLink: handleLinkOutlookCal,
            onRefresh: handleRefreshOutlookCal,
            onUnlink: handleUnlinkOutlookCal,
          })}
          */}
        </div>
      </div>

      <div className="integration-section">
        <div className="integration-section-header">
          <h3 className="integration-section-title">iCal Subscriptions</h3>
          <button className="integration-btn integration-btn-sm" onClick={() => setShowAddIcal(!showAddIcal)}>
            <FiPlus /> Add
          </button>
        </div>
        <p className="integration-section-desc">
          Paste .ics URLs to subscribe to any calendar (read-only). Works with Google, Outlook, Apple, and more.
        </p>
        {renderMessage(icalMsg)}

        {showAddIcal && (
          <div className="integration-card integration-card-add">
            <div className="integration-form-group">
              <label>iCal URL</label>
              <input
                type="url"
                value={newIcalUrl}
                onChange={e => setNewIcalUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                className="integration-input"
              />
            </div>
            <div className="integration-form-group">
              <label>Label</label>
              <input
                type="text"
                value={newIcalLabel}
                onChange={e => setNewIcalLabel(e.target.value)}
                placeholder="My Calendar"
                className="integration-input"
              />
            </div>
            <div className="integration-card-actions">
              <button className="integration-btn integration-btn-primary" onClick={handleAddIcal} disabled={icalSubmitting || !newIcalUrl.trim()}>
                <FiLink /> {icalSubmitting ? 'Saving...' : 'Subscribe'}
              </button>
              <button className="integration-btn integration-btn-secondary" onClick={() => { setShowAddIcal(false); setNewIcalUrl(''); setNewIcalLabel(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {icalLoading ? (
          <div className="integration-card-loading">Loading...</div>
        ) : icalSubs.length === 0 && !showAddIcal ? (
          <div className="integration-empty">
            No iCal subscriptions yet. Click "Add" to subscribe to a calendar feed.
          </div>
        ) : (
          <div className="integration-ical-list">
            {icalSubs.map(sub => (
              <div key={sub.id} className="integration-ical-item">
                <div className="integration-ical-dot" style={{ background: sub.color || '#17a2b8' }} />
                <div className="integration-ical-info">
                  <strong>{sub.label}</strong>
                  <span className="integration-ical-url">{sub.url.length > 60 ? sub.url.substring(0, 57) + '...' : sub.url}</span>
                  {sub.last_synced_at && (
                    <span className="integration-ical-synced">
                      Last synced: {new Date(sub.last_synced_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  className="integration-btn integration-btn-icon integration-btn-danger"
                  onClick={() => handleDeleteIcal(sub.id, sub.label)}
                  title="Remove subscription"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="integration-section">
        <h3 className="integration-section-title">Communication</h3>
        <div className="integration-card">
          <div className="integration-card-header integration-card-clickable" onClick={() => setDiscordExpanded(!discordExpanded)}>
            <FaDiscord style={{ fontSize: '24px', color: '#5865f2', flexShrink: 0 }} />
            <div className="integration-card-info">
              <h4>Discord</h4>
              <p>Manage your Discord bot integration and server settings.</p>
            </div>
            {discordExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </div>
          {discordExpanded && (
            <div className="integration-card-body">
              <DiscordUtilities />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
