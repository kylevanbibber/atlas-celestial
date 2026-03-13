import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiRefreshCw, FiSettings, FiUser, FiUsers, FiGlobe, FiTarget } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import CalendarView from '../components/calendar/CalendarView';
import EventModal from '../components/calendar/EventModal';
import { normalizeCalendarEvent } from '../components/calendar/calendarUtils';
import toast from 'react-hot-toast';
import './Calendar.css';

const Calendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.Role === 'Admin' || user?.Role === 'admin' || user?.Role === 'superadmin' || user?.Role === 'SuperAdmin';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Calendar view state
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState(() => {
    return window.innerWidth < 768 ? 'agenda' : 'month';
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState(null);
  const [modalMode, setModalMode] = useState('view');

  // iCal add popover state
  const [addPopover, setAddPopover] = useState(null); // { event, x, y }
  // When user picks "Specific Audience" from the popover, store the iCal source for modal use
  const [icalSourceEvent, setIcalSourceEvent] = useState(null);

  // Integration status
  const [hasCalendly, setHasCalendly] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasOutlook, setHasOutlook] = useState(false);
  const [hasIcal, setHasIcal] = useState(false);

  useEffect(() => {
    checkIntegrationStatus();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [date, view]);

  const checkIntegrationStatus = async () => {
    try {
      const r = await api.get('/account/status/all');
      if (r.data?.success) {
        setHasCalendly(r.data.calendly?.isLinked || false);
        setHasGoogle(r.data.googleCalendar?.isLinked || false);
        setHasOutlook(r.data.outlookCalendar?.isLinked || false);
        setHasIcal(r.data.ical?.hasSubscriptions || false);
      }
    } catch { /* ignore */ }
  };

  const getDateRange = useCallback(() => {
    const d = new Date(date);
    let start, end;

    if (view === 'month') {
      start = new Date(d.getFullYear(), d.getMonth(), -7);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 14);
    } else if (view === 'week') {
      const dayOfWeek = d.getDay();
      start = new Date(d);
      start.setDate(d.getDate() - dayOfWeek);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else if (view === 'day') {
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    } else {
      start = new Date(d);
      end = new Date(d);
      end.setDate(end.getDate() + 30);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }, [date, view]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange();
      const response = await api.get('/calendar/events', { params: { start, end } });
      const normalized = (response.data?.events || []).map(normalizeCalendarEvent);
      setEvents(normalized);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { start, end } = getDateRange();
      const syncTasks = [];

      if (hasCalendly) syncTasks.push(api.post('/calendar/sync-calendly', { start, end }));
      if (hasGoogle) syncTasks.push(api.post('/calendar/sync-google', { start, end }));
      if (hasOutlook) syncTasks.push(api.post('/calendar/sync-outlook', { start, end }));
      if (hasIcal) syncTasks.push(api.post('/calendar/sync-ical', { start, end }));

      if (syncTasks.length === 0) {
        toast('No calendar integrations linked. Connect them in Account settings.');
        setSyncing(false);
        return;
      }

      const results = await Promise.allSettled(syncTasks);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        toast.error(`${failed} sync(s) failed. Check Account settings.`);
      }
      if (succeeded > 0) {
        toast.success(`Synced from ${succeeded} source(s)`);
      }

      await fetchEvents();
    } catch (error) {
      console.error('Error syncing calendars:', error);
      toast.error('Failed to sync calendars');
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync all linked sources on first load
  useEffect(() => {
    if ((hasCalendly || hasGoogle || hasOutlook || hasIcal) && !syncing) {
      syncAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCalendly, hasGoogle, hasOutlook, hasIcal]);

  // Left-click: open details view
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setDefaultSlot(null);
    setModalMode('view');
    setModalOpen(true);
  };

  // Right-click: open edit mode (for manual events) or details (for external)
  const handleRightClickEvent = (event) => {
    const isManual = !event.resource?.source || event.resource.source === 'manual';
    setSelectedEvent(event);
    setDefaultSlot(null);
    setModalMode(isManual ? 'edit' : 'view');
    setModalOpen(true);
  };

  const handleSelectSlot = ({ start, end }) => {
    setSelectedEvent(null);
    setDefaultSlot({ start, end });
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedEvent(null);
    setDefaultSlot(null);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleSettingsClick = () => {
    if (isAdmin) {
      navigate('/utilities?section=calendar-admin');
    } else {
      navigate('/utilities?section=account');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    await api.delete(`/calendar/events/${eventId}`);
    toast.success('Event deleted');
    await fetchEvents();
  };

  // Show audience popover when + is clicked on an iCal event
  const handleAddIcalEvent = (event, pos) => {
    setAddPopover({ event, x: pos?.x || 200, y: pos?.y || 200 });
  };

  // Save iCal event with selected audience
  const handleSaveIcalWithAudience = async (visibility) => {
    if (!addPopover?.event) return;
    const event = addPopover.event;
    setAddPopover(null);
    try {
      const resource = event.resource || {};
      const payload = {
        title: event.title,
        description: resource.description || null,
        location: resource.location || null,
        start_time: event.start instanceof Date ? event.start.toISOString() : new Date(event.start).toISOString(),
        end_time: event.end instanceof Date ? event.end.toISOString() : new Date(event.end).toISOString(),
        all_day: !!event.allDay,
        event_type: resource.eventType || 'meeting',
        color: resource.eventColor || '#007bff',
        visibility,
        team_lagnname: visibility !== 'private' ? user?.lagnname : null,
        hide_source_event_id: event.id,
      };
      await api.post('/calendar/events', payload);
      const labels = { private: 'your calendar', team: 'your team', organization: 'the organization' };
      toast.success(`Event added to ${labels[visibility] || 'calendar'}`);
      await fetchEvents();
    } catch (error) {
      console.error('Error adding iCal event:', error);
      toast.error('Failed to add event');
    }
  };

  // Open EventModal pre-filled with iCal event data + targeted visibility
  const handleAddIcalTargeted = () => {
    if (!addPopover?.event) return;
    const icalEvent = addPopover.event;
    setAddPopover(null);
    setIcalSourceEvent(icalEvent);
    setSelectedEvent(null);
    setDefaultSlot({
      start: icalEvent.start instanceof Date ? icalEvent.start : new Date(icalEvent.start),
      end: icalEvent.end instanceof Date ? icalEvent.end : new Date(icalEvent.end),
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  // Override onSave to inject hide_source_event_id when saving from iCal targeted flow
  const handleSaveEvent = async (payload, eventId) => {
    const finalPayload = icalSourceEvent && !eventId
      ? { ...payload, hide_source_event_id: icalSourceEvent.id }
      : payload;
    if (eventId) {
      await api.put(`/calendar/events/${eventId}`, finalPayload);
    } else {
      await api.post('/calendar/events', finalPayload);
    }
    setIcalSourceEvent(null);
    toast.success(eventId ? 'Event updated' : 'Event created');
    await fetchEvents();
  };

  const hasAnyIntegration = hasCalendly || hasGoogle || hasOutlook || hasIcal;

  return (
    <div className="calendar-page">
      <div className="calendar-page-header">
        <div className="calendar-page-title">
          <h2>Calendar</h2>
          {loading && <span className="calendar-loading-indicator" />}
        </div>
        <div className="calendar-page-actions">
          <button
            className="calendar-action-btn calendar-settings-btn"
            onClick={handleSettingsClick}
            title={isAdmin ? 'Calendar Administration' : 'Calendar Settings'}
          >
            <FiSettings />
            <span className="calendar-action-label">Settings</span>
          </button>
          {hasAnyIntegration && (
            <button
              className="calendar-action-btn calendar-sync-btn"
              onClick={syncAll}
              disabled={syncing}
              title="Sync All Connected Calendars"
            >
              <FiRefreshCw className={syncing ? 'spin' : ''} />
              <span className="calendar-action-label">Sync</span>
            </button>
          )}
          <button
            className="calendar-action-btn calendar-create-btn"
            onClick={handleCreateClick}
          >
            <FiPlus />
            <span className="calendar-action-label">New Event</span>
          </button>
        </div>
      </div>

      <CalendarView
        events={events}
        date={date}
        view={view}
        onNavigate={setDate}
        onView={setView}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        onEventRightClick={handleRightClickEvent}
        onAddIcalEvent={handleAddIcalEvent}
      />

      <EventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); setDefaultSlot(null); setIcalSourceEvent(null); }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        event={selectedEvent}
        defaultStart={defaultSlot?.start}
        defaultEnd={defaultSlot?.end}
        defaultValues={icalSourceEvent ? {
          title: icalSourceEvent.title,
          description: icalSourceEvent.resource?.description || '',
          location: icalSourceEvent.resource?.location || '',
          start_time: icalSourceEvent.start instanceof Date ? icalSourceEvent.start.toISOString() : new Date(icalSourceEvent.start).toISOString(),
          end_time: icalSourceEvent.end instanceof Date ? icalSourceEvent.end.toISOString() : new Date(icalSourceEvent.end).toISOString(),
          all_day: !!icalSourceEvent.allDay,
          event_type: icalSourceEvent.resource?.eventType || 'meeting',
          color: icalSourceEvent.resource?.eventColor || '#007bff',
          visibility: 'targeted',
        } : null}
        userClname={user?.clname}
        userRole={user?.Role}
        userLagnname={user?.lagnname}
        initialMode={modalMode}
      />

      {/* Audience selection popover for adding iCal events */}
      {addPopover && (
        <div className="calendar-add-popover-overlay" onClick={() => setAddPopover(null)}>
          <div
            className="calendar-add-popover"
            style={{ left: addPopover.x, top: addPopover.y }}
            onClick={e => e.stopPropagation()}
          >
            <div className="calendar-add-popover-title">
              Add "{addPopover.event.title}" to:
            </div>
            <button className="calendar-add-popover-option" onClick={() => handleSaveIcalWithAudience('private')}>
              <FiUser size={14} />
              <span>My Calendar</span>
            </button>
            <button className="calendar-add-popover-option" onClick={() => handleSaveIcalWithAudience('team')}>
              <FiUsers size={14} />
              <span>My Team</span>
            </button>
            <button className="calendar-add-popover-option" onClick={() => handleSaveIcalWithAudience('organization')}>
              <FiGlobe size={14} />
              <span>Organization</span>
            </button>
            <button className="calendar-add-popover-option" onClick={handleAddIcalTargeted}>
              <FiTarget size={14} />
              <span>Specific Audience</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
