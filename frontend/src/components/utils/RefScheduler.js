import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FiClock, FiAlertTriangle, FiCheck, FiX, FiChevronLeft, FiChevronRight, FiEdit2, FiTrash2, FiSave } from 'react-icons/fi';
import api from '../../api';
import './RefScheduler.css';

const TIME_SLOTS = [];
for (let h = 7; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    TIME_SLOTS.push({ hour: h, minute: m, label });
  }
}

const RefScheduler = ({ value, assignedTo, refName, onSchedule, onClose, position }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (value) {
      const d = new Date(value);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const [selectedTime, setSelectedTime] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return { hour: d.getHours(), minute: Math.round(d.getMinutes() / 15) * 15 };
      }
    }
    const now = new Date();
    const mins = Math.ceil(now.getMinutes() / 15) * 15;
    return { hour: now.getHours() + (mins >= 60 ? 1 : 0), minute: mins % 60 };
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // { id, title, start_time, end_time }
  const [savingEvent, setSavingEvent] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const d = new Date(value);
      return isNaN(d.getTime())
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const popoverRef = useRef(null);
  const timeListRef = useRef(null);

  const fetchCalendarEvents = useCallback(async (date) => {
    if (!assignedTo) return;
    setLoadingEvents(true);
    try {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      const res = await api.get('/calendar/events', {
        params: {
          start: dayStart.toISOString(),
          end: dayEnd.toISOString(),
          for_user_id: assignedTo
        }
      });
      if (res.data?.success) {
        setCalendarEvents(res.data.events || []);
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err);
      setCalendarEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [assignedTo]);

  useEffect(() => {
    fetchCalendarEvents(selectedDate);
  }, [selectedDate, fetchCalendarEvents]);

  // Scroll time list to selected time on mount
  useEffect(() => {
    if (timeListRef.current) {
      const idx = TIME_SLOTS.findIndex(
        s => s.hour === selectedTime.hour && s.minute === selectedTime.minute
      );
      if (idx >= 0) {
        const el = timeListRef.current.children[idx];
        if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleConfirm = () => {
    const scheduled = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.hour,
      selectedTime.minute
    );
    onSchedule(scheduled.toISOString());
  };

  const handleClear = () => {
    onSchedule(null);
  };

  const getConflict = (hour, minute) => {
    const slotStart = new Date(
      selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
      hour, minute
    ).getTime();
    const slotEnd = slotStart + 15 * 60 * 1000;

    return calendarEvents.find(evt => {
      const evtStart = new Date(evt.start_time).getTime();
      const evtEnd = new Date(evt.end_time).getTime();
      return slotStart < evtEnd && slotEnd > evtStart;
    });
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="ref-scheduler-day empty" />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = date.getTime() === today.getTime();
      const isSelected =
        selectedDate.getDate() === d &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;
      const isPast = date < today;

      days.push(
        <div
          key={d}
          className={`ref-scheduler-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}${isPast ? ' past' : ''}`}
          onClick={() => !isPast && setSelectedDate(new Date(year, month, d))}
        >
          {d}
        </div>
      );
    }

    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
      <div className="ref-scheduler-calendar">
        <div className="ref-scheduler-month-nav">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}><FiChevronLeft /></button>
          <span>{monthName}</span>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}><FiChevronRight /></button>
        </div>
        <div className="ref-scheduler-weekdays">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="ref-scheduler-weekday">{d}</div>
          ))}
        </div>
        <div className="ref-scheduler-days">{days}</div>
      </div>
    );
  };

  const formatEventTime = (dateVal) => {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  };

  const toLocalInput = (dateVal) => {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    // Convert to Eastern for the input value
    const eastern = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const y = eastern.getFullYear();
    const mo = String(eastern.getMonth() + 1).padStart(2, '0');
    const da = String(eastern.getDate()).padStart(2, '0');
    const h = String(eastern.getHours()).padStart(2, '0');
    const mi = String(eastern.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da}T${h}:${mi}`;
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    setSavingEvent(true);
    try {
      await api.put(`/calendar/events/${editingEvent.id}`, {
        title: editingEvent.title,
        start_time: editingEvent.start_time,
        end_time: editingEvent.end_time
      });
      setEditingEvent(null);
      fetchCalendarEvents(selectedDate);
    } catch (err) {
      console.error('Error updating calendar event:', err);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await api.delete(`/calendar/events/${eventId}`);
      fetchCalendarEvents(selectedDate);
    } catch (err) {
      console.error('Error deleting calendar event:', err);
    }
  };

  const selectedSlotConflict = getConflict(selectedTime.hour, selectedTime.minute);

  // Compute position — keep within viewport
  const style = {};
  if (position) {
    const menuWidth = 370;
    const menuHeight = 420;
    let left = position.x;
    let top = position.y;

    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    style.position = 'fixed';
    style.left = left;
    style.top = top;
  }

  const content = (
    <div className="ref-scheduler-popover" ref={popoverRef} style={style} onClick={e => e.stopPropagation()}>
      <div className="ref-scheduler-header">
        <FiClock size={14} />
        <span>Schedule{refName ? `: ${refName}` : ''}</span>
        <button className="ref-scheduler-close" onClick={onClose}><FiX size={14} /></button>
      </div>

      <div className="ref-scheduler-body">
        {renderCalendar()}

        <div className="ref-scheduler-time-section">
          <div className="ref-scheduler-time-label">Time</div>
          <div className="ref-scheduler-time-list" ref={timeListRef}>
            {TIME_SLOTS.map(slot => {
              const conflict = getConflict(slot.hour, slot.minute);
              const isSelected = selectedTime.hour === slot.hour && selectedTime.minute === slot.minute;
              return (
                <div
                  key={slot.label}
                  className={`ref-scheduler-time-slot${isSelected ? ' selected' : ''}${conflict ? ' conflict' : ''}`}
                  onClick={() => setSelectedTime({ hour: slot.hour, minute: slot.minute })}
                >
                  <span>{slot.label}</span>
                  {conflict && (
                    <FiAlertTriangle size={12} className="ref-scheduler-conflict-icon" title={conflict.title} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {calendarEvents.length > 0 && (
        <div className="ref-scheduler-conflicts">
          <div className="ref-scheduler-conflicts-title">
            <FiAlertTriangle size={12} />
            Events on this day ({calendarEvents.length})
          </div>
          <div className="ref-scheduler-conflicts-list">
            {calendarEvents.map((evt, i) => {
              const isEditing = editingEvent?.id === evt.id;
              if (isEditing) {
                return (
                  <div key={evt.id || i} className="ref-scheduler-conflict-item editing">
                    <input
                      className="ref-scheduler-edit-input title"
                      value={editingEvent.title}
                      onChange={(e) => setEditingEvent(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <div className="ref-scheduler-edit-times">
                      <input
                        type="datetime-local"
                        className="ref-scheduler-edit-input"
                        value={toLocalInput(editingEvent.start_time)}
                        onChange={(e) => setEditingEvent(prev => ({ ...prev, start_time: new Date(e.target.value).toISOString() }))}
                      />
                      <span style={{ fontSize: '10px', color: '#999' }}>to</span>
                      <input
                        type="datetime-local"
                        className="ref-scheduler-edit-input"
                        value={toLocalInput(editingEvent.end_time)}
                        onChange={(e) => setEditingEvent(prev => ({ ...prev, end_time: new Date(e.target.value).toISOString() }))}
                      />
                    </div>
                    <div className="ref-scheduler-edit-actions">
                      <button
                        className="ref-scheduler-edit-btn save"
                        onClick={handleSaveEvent}
                        disabled={savingEvent}
                        title="Save"
                      >
                        <FiSave size={12} />
                      </button>
                      <button
                        className="ref-scheduler-edit-btn cancel"
                        onClick={() => setEditingEvent(null)}
                        title="Cancel"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={evt.id || i} className="ref-scheduler-conflict-item">
                  <span className="ref-scheduler-conflict-time">
                    {formatEventTime(evt.start_time)} - {formatEventTime(evt.end_time)}
                  </span>
                  <span className="ref-scheduler-conflict-title">{evt.title}</span>
                  <div className="ref-scheduler-event-actions">
                    <button
                      className="ref-scheduler-event-btn"
                      onClick={() => setEditingEvent({
                        id: evt.id,
                        title: evt.title,
                        start_time: evt.start_time,
                        end_time: evt.end_time
                      })}
                      title="Edit event"
                    >
                      <FiEdit2 size={11} />
                    </button>
                    <button
                      className="ref-scheduler-event-btn delete"
                      onClick={() => handleDeleteEvent(evt.id)}
                      title="Delete event"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loadingEvents && (
        <div className="ref-scheduler-loading">Checking calendar...</div>
      )}

      {selectedSlotConflict && (
        <div className="ref-scheduler-warning">
          <FiAlertTriangle size={12} />
          Conflicts with: {selectedSlotConflict.title}
        </div>
      )}

      <div className="ref-scheduler-footer">
        {value && (
          <button className="ref-scheduler-btn clear" onClick={handleClear}>Clear</button>
        )}
        <button className="ref-scheduler-btn cancel" onClick={onClose}>Cancel</button>
        <button className="ref-scheduler-btn confirm" onClick={handleConfirm}>
          <FiCheck size={14} />
          Schedule
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default RefScheduler;
