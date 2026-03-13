import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw } from 'react-icons/fi';
import api from '../../../api';
import './Widgets.css';

const CalendarWidget = ({ view = 'month', onError }) => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [hasCalendly, setHasCalendly] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkCalendlyStatus();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const checkCalendlyStatus = async () => {
    try {
      const response = await api.get('/account/status/all');
      setHasCalendly(response.data?.calendly?.isLinked || false);
    } catch {
      // Not linked
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);

      // Fetch events for the current month
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const response = await api.get('/calendar/events', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });

      const apiEvents = (response.data?.events || []).map(e => ({
        id: e.id,
        title: e.title,
        date: new Date(e.start_time),
        type: e.event_type,
        color: e.color || '#007bff',
        source: e.source,
      }));

      setEvents(apiEvents);
    } catch (error) {
      onError && onError(error);
      // Fall back to empty
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCalendly = async (e) => {
    e.stopPropagation();
    if (syncing) return;
    setSyncing(true);
    try {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
      await api.post('/calendar/sync-calendly', {
        start: start.toISOString(),
        end: end.toISOString(),
      });
      await fetchEvents();
    } catch {
      // Sync failed silently
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(event => event.date >= now)
      .sort((a, b) => a.date - b.date)
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading calendar...</span>
      </div>
    );
  }

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <h4>Upcoming Events</h4>
        <div className="calendar-nav">
          {hasCalendly && (
            <button
              onClick={handleSyncCalendly}
              className="nav-btn"
              title="Sync Calendly"
              disabled={syncing}
            >
              <FiRefreshCw size={12} className={syncing ? 'spin' : ''} />
            </button>
          )}
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="nav-btn"
          >
            &#8249;
          </button>
          <span className="current-month">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="nav-btn"
          >
            &#8250;
          </button>
        </div>
      </div>

      <div className="calendar-content">
        {upcomingEvents.length === 0 ? (
          <div className="calendar-empty">
            <div className="empty-icon">&#128197;</div>
            <p>No upcoming events</p>
          </div>
        ) : (
          <div className="events-list">
            {upcomingEvents.map(event => (
              <div key={event.id} className="event-item">
                <div
                  className="event-indicator"
                  style={{ backgroundColor: event.color }}
                ></div>
                <div className="event-content">
                  <div className="event-title">{event.title}</div>
                  <div className="event-datetime">
                    <span className="event-date">{formatDate(event.date)}</span>
                    <span className="event-time">{formatTime(event.date)}</span>
                  </div>
                  <div className="event-type">
                    {event.type}
                    {event.source === 'calendly' && (
                      <span style={{ marginLeft: 4, fontSize: '0.65rem', background: '#006BFF', color: '#fff', padding: '1px 4px', borderRadius: 3 }}>C</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="calendar-footer">
        <button className="view-calendar-btn" onClick={() => navigate('/calendar')}>
          View Full Calendar
        </button>
      </div>
    </div>
  );
};

export default CalendarWidget;
