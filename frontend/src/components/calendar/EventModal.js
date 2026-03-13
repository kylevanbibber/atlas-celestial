import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiTrash2, FiExternalLink, FiClock, FiMapPin, FiEdit2, FiUsers, FiVideo } from 'react-icons/fi';
import {
  EVENT_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  COLOR_OPTIONS,
  CLNAME_OPTIONS,
  ESID_RANGE_OPTIONS,
  isoToLocalInput,
  localInputToISO,
  formatEventDateRange,
  getSourceLabel,
  getEventTypeColor,
  getMeetingLink,
} from './calendarUtils';
import api from '../../api';
import './EventModal.css';

const EventModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event = null,
  defaultStart = null,
  defaultEnd = null,
  defaultValues = null,
  userClname = null,
  userRole = null,
  userLagnname = null,
  initialMode = 'view',
}) => {
  const isExisting = !!event;
  const isExternal = event?.resource?.source && event.resource.source !== 'manual';
  const canEdit = isExisting && !isExternal;

  const [mode, setMode] = useState('view');
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    all_day: false,
    event_type: 'personal',
    color: '#007bff',
    visibility: 'private',
    team_lagnname: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Targeted audience state
  const [audienceClnames, setAudienceClnames] = useState([]);
  const [audienceEsidRanges, setAudienceEsidRanges] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const userSearchTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setDeleteConfirm(false);
      setSaving(false);
      setUserSearch('');
      setUserSearchResults([]);
      return;
    }

    // Set mode: new events always edit; existing events use initialMode
    setMode(event ? initialMode : 'edit');

    if (event) {
      // Editing existing event
      const resource = event.resource || {};
      setForm({
        title: event.title || '',
        description: resource.description || '',
        location: resource.location || '',
        start_time: isoToLocalInput(event.start),
        end_time: isoToLocalInput(event.end),
        all_day: !!event.allDay,
        event_type: resource.event_type || resource.eventType || 'personal',
        color: resource.color || resource.eventColor || '#007bff',
        visibility: resource.visibility || 'private',
        team_lagnname: resource.team_lagnname || userLagnname || '',
      });

      // Populate audience criteria from existing event
      const criteria = resource.audience_criteria
        ? (typeof resource.audience_criteria === 'string'
            ? JSON.parse(resource.audience_criteria)
            : resource.audience_criteria)
        : null;
      setAudienceClnames(criteria?.clnames || []);
      setAudienceEsidRanges(criteria?.esid_ranges || []);
      // We don't reload user chips from user_ids on edit — just reset
      setSelectedUsers([]);
    } else {
      // Creating new event — apply defaultValues override if provided (e.g. from iCal targeted flow)
      const start = defaultStart || new Date();
      const end = defaultEnd || new Date(start.getTime() + 60 * 60 * 1000);
      setForm({
        title: defaultValues?.title || '',
        description: defaultValues?.description || '',
        location: defaultValues?.location || '',
        start_time: isoToLocalInput(defaultValues?.start_time ? new Date(defaultValues.start_time) : start),
        end_time: isoToLocalInput(defaultValues?.end_time ? new Date(defaultValues.end_time) : end),
        all_day: defaultValues?.all_day || false,
        event_type: defaultValues?.event_type || 'personal',
        color: defaultValues?.color || '#007bff',
        visibility: defaultValues?.visibility || 'private',
        team_lagnname: userLagnname || '',
      });
      setAudienceClnames([]);
      setAudienceEsidRanges([]);
      setSelectedUsers([]);
    }
  }, [isOpen, event, defaultStart, defaultEnd, defaultValues, userLagnname, initialMode]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Debounced user search for audience builder
  useEffect(() => {
    if (!userSearch.trim() || form.visibility !== 'targeted') {
      setUserSearchResults([]);
      return;
    }
    clearTimeout(userSearchTimerRef.current);
    userSearchTimerRef.current = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(userSearch.trim())}&active=true`);
        const results = (res.data?.users || []).filter(
          u => !selectedUsers.find(s => s.id === u.id)
        );
        setUserSearchResults(results.slice(0, 8));
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(userSearchTimerRef.current);
  }, [userSearch, form.visibility, selectedUsers]);

  const toggleAudienceClname = (val) => {
    setAudienceClnames(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  };

  const toggleAudienceEsidRange = (val) => {
    setAudienceEsidRanges(prev =>
      prev.includes(val) ? prev.filter(r => r !== val) : [...prev, val]
    );
  };

  const addSelectedUser = (user) => {
    setSelectedUsers(prev => [...prev, { id: user.id, lagnname: user.lagnname, clname: user.clname }]);
    setUserSearch('');
    setUserSearchResults([]);
  };

  const removeSelectedUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!form.start_time || !form.end_time) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        start_time: localInputToISO(form.start_time),
        end_time: localInputToISO(form.end_time),
        all_day: form.all_day,
        event_type: form.event_type,
        color: form.color,
        visibility: form.visibility,
        team_lagnname: form.visibility !== 'private' ? form.team_lagnname : null,
        audience_criteria: form.visibility === 'targeted' ? {
          clnames: audienceClnames,
          user_ids: selectedUsers.map(u => u.id),
          esid_ranges: audienceEsidRanges,
        } : null,
      };

      await onSave(payload, isExisting ? event.id : null);
      onClose();
    } catch (err) {
      console.error('Error saving event:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setSaving(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch (err) {
      console.error('Error deleting event:', err);
    } finally {
      setSaving(false);
      setDeleteConfirm(false);
    }
  };

  // Determine if user can create team/org/targeted events
  const canCreateTeam = ['SA', 'GA', 'MGA', 'RGA', 'SGA'].includes(userClname) || userRole === 'Admin';
  const canCreateOrg = userClname === 'SGA' || userRole === 'Admin';

  const filteredVisibility = VISIBILITY_OPTIONS.filter(opt => {
    if (opt.value === 'team') return canCreateTeam;
    if (opt.value === 'organization') return canCreateOrg;
    if (opt.value === 'targeted') return canCreateTeam;
    return true;
  });

  // Build a human-readable audience summary for view mode
  const buildAudienceSummary = (criteria) => {
    if (!criteria) return 'No criteria set';
    const parts = [];
    if (criteria.clnames?.length) parts.push(criteria.clnames.join(', '));
    if (criteria.esid_ranges?.length) parts.push(criteria.esid_ranges.map(r => r.toUpperCase()).join(', '));
    if (criteria.user_ids?.length) parts.push(`${criteria.user_ids.length} user${criteria.user_ids.length !== 1 ? 's' : ''}`);
    return parts.length ? parts.join(' · ') : 'All agents';
  };

  if (!isOpen) return null;

  const showDetails = mode === 'view' && isExisting;

  return (
    <div className="event-modal-overlay" onClick={onClose}>
      <div className="event-modal" onClick={e => e.stopPropagation()}>
        <div className="event-modal-header">
          <h3>{showDetails ? 'Event Details' : isExisting ? 'Edit Event' : 'New Event'}</h3>
          <button className="event-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {showDetails ? (
          // Details view for any existing event
          <div className="event-modal-body">
            <div className="event-modal-readonly">
              <h4 className="event-readonly-title">{event.title}</h4>
              <div className="event-readonly-meta">
                {isExternal && (
                  <span className="event-readonly-badge" style={{ background: event.resource?.eventColor || '#006BFF' }}>
                    {getSourceLabel(event.resource?.source)}
                  </span>
                )}
                {event.resource?.eventType && (
                  <span
                    className="event-readonly-badge"
                    style={{ background: getEventTypeColor(event.resource.eventType), marginLeft: isExternal ? 6 : 0 }}
                  >
                    {EVENT_TYPE_OPTIONS.find(o => o.value === event.resource.eventType)?.label || event.resource.eventType}
                  </span>
                )}
              </div>
              <div className="event-readonly-row">
                <FiClock />
                <span>{formatEventDateRange(event.start, event.end, event.allDay)}</span>
              </div>
              {event.resource?.location && !getMeetingLink({ location: event.resource.location }) && (
                <div className="event-readonly-row">
                  <FiMapPin />
                  <span>{event.resource.location}</span>
                </div>
              )}
              {event.resource?.visibility === 'targeted' && (
                <div className="event-readonly-row">
                  <FiUsers />
                  <span>Audience: {buildAudienceSummary(
                    event.resource.audience_criteria
                      ? (typeof event.resource.audience_criteria === 'string'
                          ? JSON.parse(event.resource.audience_criteria)
                          : event.resource.audience_criteria)
                      : null
                  )}</span>
                </div>
              )}
              {event.resource?.description && (
                <p className="event-readonly-desc">{event.resource.description}</p>
              )}
              {(() => {
                const meetingLink = getMeetingLink(event.resource);
                return meetingLink ? (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-join-meeting-btn"
                  >
                    <FiVideo size={15} />
                    Join Meeting
                  </a>
                ) : null;
              })()}
              {event.resource?.external_url && !getMeetingLink(event.resource) && (
                <a
                  href={event.resource.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="event-external-link"
                >
                  <FiExternalLink /> Open in {getSourceLabel(event.resource?.source)}
                </a>
              )}
            </div>
            <div className="event-modal-footer">
              {canEdit && (
                <button
                  type="button"
                  className="event-btn event-btn-danger"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  <FiTrash2 />
                  {deleteConfirm ? 'Confirm Delete' : 'Delete'}
                </button>
              )}
              <div className="event-modal-footer-right">
                {canEdit && (
                  <button type="button" className="event-btn event-btn-primary" onClick={() => setMode('edit')}>
                    <FiEdit2 /> Edit
                  </button>
                )}
                <button type="button" className="event-btn event-btn-secondary" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Editable form
          <form className="event-modal-body" onSubmit={handleSubmit}>
            <div className="event-form-group">
              <label>Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Event title"
                required
                autoFocus
              />
            </div>

            <div className="event-form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={e => handleChange('description', e.target.value)}
                placeholder="Add description..."
                rows={3}
              />
            </div>

            <div className="event-form-group">
              <label>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => handleChange('location', e.target.value)}
                placeholder="Add location or meeting link"
              />
            </div>

            <div className="event-form-row">
              <div className="event-form-group flex-1">
                <label>Start *</label>
                <input
                  type={form.all_day ? 'date' : 'datetime-local'}
                  value={form.all_day ? form.start_time.split('T')[0] : form.start_time}
                  onChange={e => handleChange('start_time', form.all_day ? e.target.value + 'T00:00' : e.target.value)}
                  required
                />
              </div>
              <div className="event-form-group flex-1">
                <label>End *</label>
                <input
                  type={form.all_day ? 'date' : 'datetime-local'}
                  value={form.all_day ? form.end_time.split('T')[0] : form.end_time}
                  onChange={e => handleChange('end_time', form.all_day ? e.target.value + 'T23:59' : e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="event-form-group event-form-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={e => handleChange('all_day', e.target.checked)}
                />
                All day event
              </label>
            </div>

            <div className="event-form-row">
              <div className="event-form-group flex-1">
                <label>Type</label>
                <select
                  value={form.event_type}
                  onChange={e => handleChange('event_type', e.target.value)}
                >
                  {EVENT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="event-form-group flex-1">
                <label>Visibility</label>
                <select
                  value={form.visibility}
                  onChange={e => handleChange('visibility', e.target.value)}
                >
                  {filteredVisibility.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {form.visibility === 'targeted' && (
              <div className="audience-builder">
                <div className="audience-builder-section">
                  <label className="audience-builder-label">Roles</label>
                  <div className="audience-checkboxes">
                    {CLNAME_OPTIONS.map(opt => (
                      <label key={opt.value} className="audience-checkbox-item">
                        <input
                          type="checkbox"
                          checked={audienceClnames.includes(opt.value)}
                          onChange={() => toggleAudienceClname(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="audience-builder-section">
                  <label className="audience-builder-label">Career Stage</label>
                  <div className="audience-checkboxes">
                    {ESID_RANGE_OPTIONS.map(opt => (
                      <label key={opt.value} className="audience-checkbox-item">
                        <input
                          type="checkbox"
                          checked={audienceEsidRanges.includes(opt.value)}
                          onChange={() => toggleAudienceEsidRange(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="audience-builder-section">
                  <label className="audience-builder-label">Specific Users</label>
                  <div className="audience-user-search">
                    <input
                      type="text"
                      className="audience-user-input"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Search by name..."
                      autoComplete="off"
                    />
                    {(userSearchResults.length > 0 || userSearchLoading) && (
                      <div className="audience-user-dropdown">
                        {userSearchLoading && <div className="audience-user-loading">Searching...</div>}
                        {userSearchResults.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            className="audience-user-result"
                            onClick={() => addSelectedUser(u)}
                          >
                            <span className="audience-user-name">{u.displayName || u.lagnname}</span>
                            <span className="audience-user-role">{u.clname}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="audience-user-chips">
                      {selectedUsers.map(u => (
                        <span key={u.id} className="audience-user-chip">
                          {u.lagnname}
                          <button
                            type="button"
                            className="audience-chip-remove"
                            onClick={() => removeSelectedUser(u.id)}
                          >
                            <FiX size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {audienceClnames.length === 0 && audienceEsidRanges.length === 0 && selectedUsers.length === 0 && (
                  <p className="audience-empty-note">Select at least one role, career stage, or user above.</p>
                )}
              </div>
            )}

            <div className="event-form-group">
              <label>Color</label>
              <div className="event-color-picker">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`event-color-swatch ${form.color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => handleChange('color', c)}
                  />
                ))}
              </div>
            </div>

            <div className="event-modal-footer">
              {isExisting && (
                <button
                  type="button"
                  className="event-btn event-btn-danger"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  <FiTrash2 />
                  {deleteConfirm ? 'Confirm Delete' : 'Delete'}
                </button>
              )}
              <div className="event-modal-footer-right">
                {isExisting && (
                  <button type="button" className="event-btn event-btn-secondary" onClick={() => setMode('view')}>
                    Cancel
                  </button>
                )}
                {!isExisting && (
                  <button type="button" className="event-btn event-btn-secondary" onClick={onClose}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="event-btn event-btn-primary" disabled={saving || !form.title.trim()}>
                  {saving ? 'Saving...' : isExisting ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EventModal;
