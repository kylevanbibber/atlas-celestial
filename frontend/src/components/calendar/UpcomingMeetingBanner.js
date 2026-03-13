import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiCalendar, FiClock, FiChevronRight, FiVideo } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { getMeetingLink, MEETING_URL_PATTERN } from './calendarUtils';
import './UpcomingMeetingBanner.css';

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getDayPrefix(date) {
  const now = new Date();
  if (isSameDay(date, now)) return null;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeRelative(date) {
  const now = new Date();
  const diffMs = date - now;
  const diffMin = Math.round(diffMs / 60000);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffMs < 0 && diffMs > -60 * 60 * 1000) return 'Now';
  if (diffMin <= 0) return 'Now';
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffMin < 120) return 'in 1h';

  const prefix = getDayPrefix(date);
  return prefix ? `${prefix} ${timeStr}` : timeStr;
}

function formatTimeLabel(date) {
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const prefix = getDayPrefix(date);
  return prefix ? `${prefix} · ${timeStr}` : timeStr;
}

function isUrgent(date) {
  const diffMin = (date - new Date()) / 60000;
  return diffMin <= 15 && diffMin > -60;
}

const UpcomingMeetingBanner = () => {
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [open, setOpen] = useState(false);
  const [, forceUpdate] = useState(0);
  const dropdownRef = useRef(null);
  const fetchTimerRef = useRef(null);
  const tickTimerRef = useRef(null);

  const fetchUpcoming = useCallback(async () => {
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const res = await api.get(
        `/calendar/events?start=${now.toISOString()}&end=${end.toISOString()}`
      );
      const events = (res.data?.events || [])
        .map(e => ({
          ...e,
          startDate: new Date(typeof e.start_time === 'string'
            ? e.start_time.replace(' ', 'T') + (e.start_time.includes('Z') || e.start_time.includes('+') ? '' : 'Z')
            : e.start_time),
        }))
        .filter(e => {
          const diffMin = (e.startDate - new Date()) / 60000;
          return diffMin > -60 && diffMin < 24 * 60; // show if started <60min ago or upcoming 24h
        })
        .sort((a, b) => a.startDate - b.startDate)
        .slice(0, 5);
      setUpcomingEvents(events);
    } catch {
      // Silently fail — non-critical
    }
  }, []);

  useEffect(() => {
    fetchUpcoming();
    fetchTimerRef.current = setInterval(fetchUpcoming, 5 * 60 * 1000); // refresh every 5 min
    // Tick every minute to update "in Xm" labels
    tickTimerRef.current = setInterval(() => forceUpdate(n => n + 1), 60 * 1000);
    return () => {
      clearInterval(fetchTimerRef.current);
      clearInterval(tickTimerRef.current);
    };
  }, [fetchUpcoming]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (upcomingEvents.length === 0) return null;

  const next = upcomingEvents[0];
  const urgent = isUrgent(next.startDate);

  return (
    <div className="upcoming-meeting-banner" ref={dropdownRef}>
      <button
        className={`upcoming-meeting-pill${urgent ? ' urgent' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        title="Upcoming meetings"
      >
        <FiCalendar size={13} />
        <span className="upcoming-meeting-title">{next.title}</span>
        <span className="upcoming-meeting-time">{formatTimeRelative(next.startDate)}</span>
        {upcomingEvents.length > 1 && (
          <span className="upcoming-meeting-count">+{upcomingEvents.length - 1}</span>
        )}
      </button>

      {open && (
        <div className="upcoming-meeting-dropdown">
          <div className="upcoming-meeting-dropdown-header">
            <FiClock size={12} />
            <span>Upcoming</span>
          </div>
          {upcomingEvents.map(evt => {
            const meetingLink = getMeetingLink(evt);
            return (
              <button
                key={evt.id}
                className="upcoming-meeting-item"
                onClick={() => {
                  setOpen(false);
                  if (meetingLink) {
                    window.open(meetingLink, '_blank', 'noopener,noreferrer');
                  } else {
                    navigate('/calendar');
                  }
                }}
                title={meetingLink ? 'Join meeting' : evt.title}
              >
                <span
                  className="upcoming-meeting-item-dot"
                  style={{ background: evt.color || '#007bff' }}
                />
                <div className="upcoming-meeting-item-info">
                  <span className="upcoming-meeting-item-title">{evt.title}</span>
                  <span className="upcoming-meeting-item-time">
                    {formatTimeLabel(evt.startDate)}
                    {evt.location && !evt.location.match(MEETING_URL_PATTERN) ? ` · ${evt.location}` : ''}
                  </span>
                </div>
                {meetingLink
                  ? <FiVideo size={13} className="upcoming-meeting-item-join" />
                  : <FiChevronRight size={12} className="upcoming-meeting-item-arrow" />
                }
              </button>
            );
          })}
          <button
            className="upcoming-meeting-view-all"
            onClick={() => { setOpen(false); navigate('/calendar'); }}
          >
            View Calendar
          </button>
        </div>
      )}
    </div>
  );
};

export default UpcomingMeetingBanner;
