import React, { useMemo, useCallback, useState, useRef } from 'react';
import { Calendar, luxonLocalizer } from 'react-big-calendar';
import { DateTime } from 'luxon';
import { FiChevronLeft, FiChevronRight, FiClock, FiMapPin, FiPlus, FiVideo } from 'react-icons/fi';
import { formatEventDateRange, getSourceLabel, getMeetingLink } from './calendarUtils';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './CalendarView.css';

// Configure Luxon localizer
const localizer = luxonLocalizer(DateTime);

// Custom toolbar component matching Atlas header style
function CalendarToolbar({ label, onNavigate, onView, view, views }) {
  return (
    <div className="calendar-toolbar">
      <div className="calendar-toolbar-left">
        <button className="calendar-nav-btn" onClick={() => onNavigate('TODAY')}>
          Today
        </button>
        <button className="calendar-nav-btn calendar-nav-arrow" onClick={() => onNavigate('PREV')}>
          <FiChevronLeft />
        </button>
        <button className="calendar-nav-btn calendar-nav-arrow" onClick={() => onNavigate('NEXT')}>
          <FiChevronRight />
        </button>
        <span className="calendar-toolbar-label">{label}</span>
      </div>
      <div className="calendar-toolbar-right">
        {views.map(v => (
          <button
            key={v}
            className={`calendar-view-btn ${view === v ? 'active' : ''}`}
            onClick={() => onView(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Custom agenda event component for the agenda view
function AgendaEventComponent({ event }) {
  const resource = event.resource || {};
  const color = resource.eventColor || '#007bff';
  const meetingLink = getMeetingLink(resource);

  return (
    <span className="calendar-agenda-event">
      <span className="calendar-agenda-dot" style={{ backgroundColor: color }} />
      <span>{event.title}</span>
      {resource.source === 'calendly' && <span className="calendar-event-badge calendly">Calendly</span>}
      {resource.source === 'google' && <span className="calendar-event-badge google">Google</span>}
      {resource.source === 'outlook' && <span className="calendar-event-badge outlook">Outlook</span>}
      {resource.source === 'ical' && <span className="calendar-event-badge ical">iCal +</span>}
      {resource.eventType && (
        <span className="calendar-agenda-type">{resource.eventType}</span>
      )}
      {meetingLink && (
        <a
          href={meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="calendar-agenda-join"
          onClick={e => e.stopPropagation()}
          title="Join meeting"
        >
          <FiVideo size={12} />
          Join
        </a>
      )}
    </span>
  );
}

const CalendarView = ({
  events = [],
  date,
  view,
  onNavigate,
  onView,
  onSelectEvent,
  onSelectSlot,
  onEventRightClick,
  onAddIcalEvent,
}) => {
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimeoutRef = useRef(null);

  // Use a ref for callbacks so event components stay stable
  const actionsRef = useRef({});
  actionsRef.current = { setTooltip, onEventRightClick, onAddIcalEvent };

  // Wrap onSelectEvent to clear tooltip
  const handleSelectEvent = useCallback((event, e) => {
    clearTimeout(tooltipTimeoutRef.current);
    setTooltip(null);
    onSelectEvent?.(event, e);
  }, [onSelectEvent]);

  // Style events by their color
  const eventPropGetter = useCallback((event) => {
    const color = event.resource?.eventColor || '#007bff';
    return {
      style: {
        backgroundColor: color + '20',
        borderLeft: `3px solid ${color}`,
        color: 'var(--text-primary)',
        borderRadius: '4px',
        padding: '2px 4px',
        fontSize: '0.8rem',
      },
    };
  }, []);

  // Stable components via useMemo with actionsRef for state access
  const components = useMemo(() => {
    const EventComp = ({ event }) => {
      const resource = event.resource || {};
      const color = resource.eventColor || '#007bff';
      const meetingLink = getMeetingLink(resource);

      return (
        <div
          className="calendar-event-content"
          style={{ borderLeftColor: color }}
          onMouseEnter={(e) => {
            clearTimeout(tooltipTimeoutRef.current);
            const rect = e.currentTarget.getBoundingClientRect();
            tooltipTimeoutRef.current = setTimeout(() => {
              actionsRef.current.setTooltip({
                event,
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }, 400);
          }}
          onMouseLeave={() => {
            clearTimeout(tooltipTimeoutRef.current);
            actionsRef.current.setTooltip(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            clearTimeout(tooltipTimeoutRef.current);
            actionsRef.current.setTooltip(null);
            actionsRef.current.onEventRightClick?.(event);
          }}
        >
          <span className="calendar-event-title">{event.title}</span>
          {resource.source === 'calendly' && <span className="calendar-event-badge calendly">C</span>}
          {resource.source === 'google' && <span className="calendar-event-badge google">G</span>}
          {resource.source === 'outlook' && <span className="calendar-event-badge outlook">O</span>}
          {resource.source === 'ical' && (
            <span
              className="calendar-event-badge ical calendar-event-add-btn"
              title="Add to my calendar"
              onClick={(e) => {
                e.stopPropagation();
                clearTimeout(tooltipTimeoutRef.current);
                actionsRef.current.setTooltip(null);
                actionsRef.current.onAddIcalEvent?.(event, { x: e.clientX, y: e.clientY });
              }}
            >
              <FiPlus size={10} />
            </span>
          )}
          {meetingLink && (
            <a
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="calendar-event-join-btn"
              title="Join meeting"
              onClick={(e) => {
                e.stopPropagation();
                clearTimeout(tooltipTimeoutRef.current);
                actionsRef.current.setTooltip(null);
              }}
            >
              <FiVideo size={10} />
            </a>
          )}
        </div>
      );
    };

    return {
      toolbar: CalendarToolbar,
      event: EventComp,
      agenda: {
        event: AgendaEventComponent,
      },
    };
  }, []);

  return (
    <div className="calendar-view-container" style={{ position: 'relative' }}>
      <Calendar
        localizer={localizer}
        events={events}
        date={date}
        view={view}
        views={['month', 'week', 'day', 'agenda']}
        onNavigate={onNavigate}
        onView={onView}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={onSelectSlot}
        selectable
        popup
        eventPropGetter={eventPropGetter}
        components={components}
        style={{ minHeight: 600 }}
        tooltipAccessor={() => null}
      />

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="calendar-event-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="calendar-tooltip-title">{tooltip.event.title}</div>
          <div className="calendar-tooltip-time">
            <FiClock size={12} />
            <span>{formatEventDateRange(tooltip.event.start, tooltip.event.end, tooltip.event.allDay)}</span>
          </div>
          {tooltip.event.resource?.location && (
            <div className="calendar-tooltip-location">
              <FiMapPin size={12} />
              <span>{tooltip.event.resource.location}</span>
            </div>
          )}
          {tooltip.event.resource?.source && tooltip.event.resource.source !== 'manual' && (
            <div className="calendar-tooltip-source">
              {getSourceLabel(tooltip.event.resource.source)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
