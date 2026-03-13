/**
 * Calendar utility helpers
 * Normalizes events from different sources into react-big-calendar format
 */

const MEETING_URL_PATTERN = /https?:\/\/[^\s"<>]*(?:zoom\.us\/j\/|zoom\.us\/my\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join\/)[^\s"<>]*/i;

/**
 * Extract the first video meeting link from event fields.
 * Checks location, external_url, and description in that order.
 * Supports Zoom, Google Meet, and Microsoft Teams.
 */
export function getMeetingLink(eventOrResource) {
  if (!eventOrResource) return null;
  for (const field of [eventOrResource.location, eventOrResource.external_url, eventOrResource.description]) {
    if (!field) continue;
    const match = field.match(MEETING_URL_PATTERN);
    if (match) return match[0];
  }
  return null;
}

export { MEETING_URL_PATTERN };

export const EVENT_TYPE_OPTIONS = [
  { value: 'personal', label: 'Personal', color: '#007bff' },
  { value: 'team', label: 'Team', color: '#6f42c1' },
  { value: 'meeting', label: 'Meeting', color: '#28a745' },
  { value: 'deadline', label: 'Deadline', color: '#dc3545' },
  { value: 'reminder', label: 'Reminder', color: '#ffc107' },
  { value: 'other', label: 'Other', color: '#6c757d' },
];

export const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Only Me' },
  { value: 'team', label: 'My Team' },
  { value: 'organization', label: 'Everyone' },
  { value: 'targeted', label: 'Specific Audience' },
];

export const CLNAME_OPTIONS = [
  { value: 'AGT', label: 'Agent' },
  { value: 'SA', label: 'SA' },
  { value: 'GA', label: 'GA' },
  { value: 'MGA', label: 'MGA' },
  { value: 'RGA', label: 'RGA' },
  { value: 'SGA', label: 'SGA' },
];

export const ESID_RANGE_OPTIONS = [
  { value: 'f6',  label: 'F6 (< 6 months)' },
  { value: 'f12', label: 'F12 (< 12 months)' },
  { value: 'f24', label: 'F24 (< 24 months)' },
];

export const COLOR_OPTIONS = [
  '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
  '#6f42c1', '#fd7e14', '#e83e8c', '#20c997', '#6c757d',
];

/**
 * Parse a datetime value from the MySQL database.
 * The mysql driver returns DATETIME as strings without timezone (e.g. "2026-02-26 17:00:00").
 * All calendar events are stored as UTC values, so append 'Z' when no timezone indicator is present.
 */
function parseDBDateTime(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const s = String(val);
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}

/**
 * Convert an API calendar event to react-big-calendar format
 */
export function normalizeCalendarEvent(event) {
  return {
    id: event.id,
    title: event.title,
    start: parseDBDateTime(event.start_time),
    end: parseDBDateTime(event.end_time),
    allDay: !!event.all_day,
    resource: {
      ...event,
      eventType: event.event_type,
      eventColor: event.color || getEventTypeColor(event.event_type),
      isEditable: event.source === 'manual',
    },
  };
}

/**
 * Convert a Calendly API event to the same react-big-calendar format
 */
export function normalizeCalendlyEvent(calendlyEvent) {
  return {
    id: `calendly-${calendlyEvent.uri}`,
    title: calendlyEvent.name || 'Calendly Event',
    start: new Date(calendlyEvent.start_time),
    end: new Date(calendlyEvent.end_time),
    allDay: false,
    resource: {
      source: 'calendly',
      external_id: calendlyEvent.uri,
      external_url: calendlyEvent.location?.join_url || null,
      eventType: 'meeting',
      eventColor: '#006BFF',
      isEditable: false,
    },
  };
}

/**
 * Merge events from multiple sources, deduplicating by external_id
 */
export function mergeEventSources(localEvents, calendlyEvents = []) {
  const localExternalIds = new Set(
    localEvents.filter(e => e.resource?.external_id).map(e => e.resource.external_id)
  );

  const uniqueCalendly = calendlyEvents.filter(
    e => !localExternalIds.has(e.resource?.external_id)
  );

  return [...localEvents, ...uniqueCalendly];
}

/**
 * Get color for an event type
 */
export function getEventTypeColor(eventType) {
  const found = EVENT_TYPE_OPTIONS.find(o => o.value === eventType);
  return found ? found.color : '#007bff';
}

/**
 * Get a display label for event source
 */
export function getSourceLabel(source) {
  switch (source) {
    case 'calendly': return 'Calendly';
    case 'google': return 'Google Calendar';
    case 'outlook': return 'Outlook Calendar';
    case 'ical': return 'iCal Subscription';
    case 'system': return 'System';
    case 'manual': return 'Manual';
    default: return source;
  }
}

/**
 * Format a date range for display in the event modal
 */
export function formatEventDateRange(start, end, allDay) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const dateOpts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };

  if (allDay) {
    const startStr = startDate.toLocaleDateString('en-US', dateOpts);
    const endStr = endDate.toLocaleDateString('en-US', dateOpts);
    return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
  }

  const sameDay = startDate.toDateString() === endDate.toDateString();
  if (sameDay) {
    return `${startDate.toLocaleDateString('en-US', dateOpts)}, ${startDate.toLocaleTimeString('en-US', timeOpts)} - ${endDate.toLocaleTimeString('en-US', timeOpts)}`;
  }

  return `${startDate.toLocaleDateString('en-US', dateOpts)} ${startDate.toLocaleTimeString('en-US', timeOpts)} - ${endDate.toLocaleDateString('en-US', dateOpts)} ${endDate.toLocaleTimeString('en-US', timeOpts)}`;
}

/**
 * Convert a local datetime-local input value to ISO string
 */
export function localInputToISO(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

/**
 * Convert an ISO date string to datetime-local input value
 */
export function isoToLocalInput(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
