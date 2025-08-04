import React, { useState, useEffect } from 'react';
import './Widgets.css';

const CalendarWidget = ({ view = 'month', onError }) => {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [currentDate, view]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      // Mock calendar events - replace with actual API calls
      const mockEvents = [
        {
          id: 1,
          title: 'Client Meeting - John Smith',
          date: new Date(2024, 11, 15, 10, 0),
          type: 'meeting',
          color: '#007bff'
        },
        {
          id: 2,
          title: 'Insurance Review',
          date: new Date(2024, 11, 16, 14, 30),
          type: 'appointment',
          color: '#28a745'
        },
        {
          id: 3,
          title: 'Team Training',
          date: new Date(2024, 11, 18, 9, 0),
          type: 'training',
          color: '#ffc107'
        },
        {
          id: 4,
          title: 'Follow-up Call',
          date: new Date(2024, 11, 20, 11, 0),
          type: 'call',
          color: '#17a2b8'
        }
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 250));
      
      setEvents(mockEvents);
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
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
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="nav-btn"
          >
            ‹
          </button>
          <span className="current-month">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="nav-btn"
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-content">
        {upcomingEvents.length === 0 ? (
          <div className="calendar-empty">
            <div className="empty-icon">📅</div>
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
                  <div className="event-type">{event.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="calendar-footer">
        <button className="view-calendar-btn">
          View Full Calendar
        </button>
      </div>
    </div>
  );
};

export default CalendarWidget;