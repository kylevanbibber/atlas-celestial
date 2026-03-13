const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const ical = require('node-ical');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Valid event types and visibility levels
const VALID_EVENT_TYPES = ['personal', 'team', 'meeting', 'deadline', 'reminder', 'other'];
const VALID_VISIBILITY = ['private', 'team', 'organization', 'targeted'];
const TEAM_EVENT_ROLES = ['SA', 'GA', 'MGA', 'RGA', 'SGA'];
const VALID_CLNAMES = ['AGT', 'SA', 'GA', 'MGA', 'RGA', 'SGA'];
const VALID_ESID_RANGES = ['f6', 'f12', 'f24'];

// Helper: compute months since hire (month of hire does not count)
function computeUserEsidMonths(esid) {
  if (!esid) return null;
  const esidDate = new Date(esid);
  const now = new Date();
  const yearDiff = now.getFullYear() - esidDate.getFullYear();
  const monthDiff = now.getMonth() - esidDate.getMonth();
  return yearDiff * 12 + monthDiff;
}

// Helper: check if a user matches targeted audience criteria
function matchesAudienceCriteria(criteria, user) {
  if (!criteria) return false;
  const { clnames = [], user_ids = [], esid_ranges = [] } = criteria;

  const activeFilters = [];

  if (clnames.length > 0) {
    activeFilters.push(clnames.includes(user.clname));
  }
  if (user_ids.length > 0) {
    activeFilters.push(user_ids.map(Number).includes(Number(user.id)));
  }
  if (esid_ranges.length > 0) {
    const months = computeUserEsidMonths(user.esid);
    const matchesRange = esid_ranges.some(range => {
      if (range === 'f6')  return months !== null && months < 6;
      if (range === 'f12') return months !== null && months < 12;
      if (range === 'f24') return months !== null && months < 24;
      return false;
    });
    activeFilters.push(matchesRange);
  }

  // All active filter groups must match (AND logic across groups, OR within each group)
  return activeFilters.length > 0 && activeFilters.every(Boolean);
}

// Helper: expand iCal events including recurring events (RRULE) into individual occurrences
function expandIcalEvents(icalData, rangeStart, rangeEnd) {
  const results = [];

  for (const [key, event] of Object.entries(icalData)) {
    if (event.type !== 'VEVENT') continue;

    const eventStart = event.start ? new Date(event.start) : null;
    const eventEnd = event.end ? new Date(event.end) : null;

    if (!eventStart || isNaN(eventStart.getTime())) continue;

    const duration = eventEnd
      ? eventEnd.getTime() - eventStart.getTime()
      : 60 * 60 * 1000; // default 1 hour
    const uid = event.uid || key;
    const title = event.summary || 'Untitled Event';
    const description = event.description || null;
    const location = event.location || null;
    const isAllDay = event.datetype === 'date';

    // Build set of excluded dates (EXDATE)
    const exdates = new Set();
    if (event.exdate) {
      for (const exVal of Object.values(event.exdate)) {
        const exDate = new Date(exVal);
        if (!isNaN(exDate.getTime())) {
          // Store as date string for comparison (handles timezone differences)
          exdates.add(exDate.toISOString().split('T')[0]);
        }
      }
    }

    // Build map of recurrence modifications (RECURRENCE-ID overrides)
    const recurrenceMods = {};
    if (event.recurrences) {
      for (const [recKey, recEvent] of Object.entries(event.recurrences)) {
        const recStart = recEvent.start ? new Date(recEvent.start) : null;
        if (recStart && !isNaN(recStart.getTime())) {
          recurrenceMods[new Date(recKey).toISOString().split('T')[0]] = recEvent;
        }
      }
    }

    if (event.rrule) {
      // Recurring event: expand occurrences within range
      try {
        const occurrences = event.rrule.between(rangeStart, rangeEnd, true);

        for (const occ of occurrences) {
          const occDate = new Date(occ);
          const occDateKey = occDate.toISOString().split('T')[0];

          // Skip excluded dates
          if (exdates.has(occDateKey)) continue;

          // Check for recurrence modifications
          const mod = recurrenceMods[occDateKey];
          if (mod) {
            const modStart = new Date(mod.start);
            const modEnd = mod.end ? new Date(mod.end) : new Date(modStart.getTime() + duration);
            results.push({
              uid: `${uid}_${modStart.toISOString()}`,
              title: mod.summary || title,
              description: mod.description || description,
              location: mod.location || location,
              start: modStart.toISOString(),
              end: modEnd.toISOString(),
              allDay: mod.datetype === 'date' || isAllDay,
              recurring: true,
            });
          } else {
            const occEnd = new Date(occDate.getTime() + duration);
            results.push({
              uid: `${uid}_${occDate.toISOString()}`,
              title,
              description,
              location,
              start: occDate.toISOString(),
              end: occEnd.toISOString(),
              allDay: isAllDay,
              recurring: true,
            });
          }
        }
      } catch (rruleErr) {
        // If rrule expansion fails, fall back to master event
        console.error('[Calendar] RRULE expansion failed for event:', uid, rruleErr.message);
        if (!(eventEnd && eventEnd < rangeStart) && !(eventStart > rangeEnd)) {
          results.push({ uid, title, description, location, start: eventStart.toISOString(), end: eventEnd ? eventEnd.toISOString() : new Date(eventStart.getTime() + duration).toISOString(), allDay: isAllDay });
        }
      }
    } else {
      // Non-recurring: simple date range filter
      if (eventEnd && eventEnd < rangeStart) continue;
      if (eventStart > rangeEnd) continue;

      results.push({
        uid,
        title,
        description,
        location,
        start: eventStart.toISOString(),
        end: eventEnd ? eventEnd.toISOString() : new Date(eventStart.getTime() + duration).toISOString(),
        allDay: isAllDay,
      });
    }
  }

  // Sort by start time
  results.sort((a, b) => new Date(a.start) - new Date(b.start));
  return results;
}

// GET /api/calendar/events - List events for a date range
router.get('/events', async (req, res) => {
  try {
    const userId = req.userId;
    const { start, end, types, source, for_user_id } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required query params: start, end (ISO dates)' });
    }

    // Allow fetching events for a different user (e.g., checking assigned agent's calendar for conflicts)
    const targetUserId = for_user_id ? parseInt(for_user_id, 10) : userId;

    // Get user's lagnname, clname, and esid for event visibility checks
    const userRows = await query('SELECT lagnname, clname, esid FROM activeusers WHERE id = ? LIMIT 1', [targetUserId]);
    const userLagnname = userRows?.[0]?.lagnname || null;
    const currentUser = {
      id: targetUserId,
      clname: userRows?.[0]?.clname || null,
      esid: userRows?.[0]?.esid || null,
    };

    let sql = `
      SELECT * FROM calendar_events
      WHERE deleted_at IS NULL
        AND start_time <= ? AND end_time >= ?
        AND (
          user_id = ?
          OR (visibility = 'team' AND team_lagnname = ?)
          OR visibility = 'organization'
        )
    `;
    const params = [end, start, targetUserId, userLagnname];

    if (types) {
      const typeList = types.split(',').filter(t => VALID_EVENT_TYPES.includes(t));
      if (typeList.length > 0) {
        sql += ` AND event_type IN (${typeList.map(() => '?').join(',')})`;
        params.push(...typeList);
      }
    }

    if (source && ['manual', 'calendly', 'google', 'outlook', 'ical', 'system'].includes(source)) {
      sql += ' AND source = ?';
      params.push(source);
    }

    sql += ' ORDER BY start_time ASC';

    const events = await query(sql, params);

    // Fetch targeted events and filter by audience criteria in Node.js
    const targetedEvents = await query(
      `SELECT * FROM calendar_events
       WHERE deleted_at IS NULL AND visibility = 'targeted'
         AND start_time <= ? AND end_time >= ?`,
      [end, start]
    );

    const existingIds = new Set(events.map(e => e.id));
    for (const te of targetedEvents) {
      if (existingIds.has(te.id)) continue; // already included (own event)
      let criteria;
      try {
        criteria = typeof te.audience_criteria === 'string'
          ? JSON.parse(te.audience_criteria) : te.audience_criteria;
      } catch { continue; }
      if (matchesAudienceCriteria(criteria, currentUser)) {
        events.push(te);
      }
    }

    events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    res.json({ success: true, events });
  } catch (error) {
    console.error('[Calendar] Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/calendar/events/:id - Get a single event
router.get('/events/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const eventId = req.params.id;

    const userRows = await query('SELECT lagnname FROM activeusers WHERE id = ? LIMIT 1', [userId]);
    const userLagnname = userRows?.[0]?.lagnname || null;

    const rows = await query(
      `SELECT * FROM calendar_events
       WHERE id = ? AND deleted_at IS NULL
       AND (
         user_id = ?
         OR (visibility = 'team' AND team_lagnname = ?)
         OR visibility = 'organization'
       )
       LIMIT 1`,
      [eventId, userId, userLagnname]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, event: rows[0] });
  } catch (error) {
    console.error('[Calendar] Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/calendar/events - Create a new event
router.post('/events', async (req, res) => {
  try {
    const userId = req.userId;
    const {
      title, description, location, start_time, end_time,
      all_day, event_type, color, visibility, team_lagnname,
      audience_criteria, hide_source_event_id
    } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields: title, start_time, end_time' });
    }

    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({ error: 'end_time must be after start_time' });
    }

    if (event_type && !VALID_EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({ error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
    }

    if (visibility && !VALID_VISIBILITY.includes(visibility)) {
      return res.status(400).json({ error: `Invalid visibility. Must be one of: ${VALID_VISIBILITY.join(', ')}` });
    }

    // Validate audience_criteria shape when visibility is 'targeted'
    if (visibility === 'targeted' && audience_criteria) {
      const { clnames, user_ids, esid_ranges } = audience_criteria;
      if (clnames && (!Array.isArray(clnames) || clnames.some(c => !VALID_CLNAMES.includes(c)))) {
        return res.status(400).json({ error: 'Invalid clnames in audience_criteria' });
      }
      if (user_ids && !Array.isArray(user_ids)) {
        return res.status(400).json({ error: 'audience_criteria.user_ids must be an array' });
      }
      if (esid_ranges && (!Array.isArray(esid_ranges) || esid_ranges.some(r => !VALID_ESID_RANGES.includes(r)))) {
        return res.status(400).json({ error: 'Invalid esid_ranges in audience_criteria' });
      }
    }

    // Check permission for team/org/targeted events
    if (visibility === 'team' || visibility === 'organization' || visibility === 'targeted') {
      const userRows = await query('SELECT clname, Role, lagnname FROM activeusers WHERE id = ? LIMIT 1', [userId]);
      const user = userRows?.[0];
      if (!user) return res.status(403).json({ error: 'User not found' });

      if (visibility === 'organization' && user.clname !== 'SGA' && user.Role !== 'Admin') {
        return res.status(403).json({ error: 'Only SGA or Admin users can create organization-wide events' });
      }
      if ((visibility === 'team' || visibility === 'targeted') && !TEAM_EVENT_ROLES.includes(user.clname) && user.Role !== 'Admin') {
        return res.status(403).json({ error: 'Insufficient permissions to create team or targeted events' });
      }
    }

    const audienceCriteriaJson = visibility === 'targeted' && audience_criteria
      ? JSON.stringify(audience_criteria) : null;

    const result = await query(
      `INSERT INTO calendar_events
        (user_id, title, description, location, start_time, end_time, all_day, event_type, color, visibility, team_lagnname, audience_criteria, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
      [
        userId, title, description || null, location || null,
        start_time, end_time, all_day ? 1 : 0,
        event_type || 'personal', color || '#007bff',
        visibility || 'private', team_lagnname || null, audienceCriteriaJson
      ]
    );

    // If promoting from a synced event, hide the original so it doesn't show as a duplicate
    if (hide_source_event_id) {
      await query(
        `UPDATE calendar_events SET hidden_by_user = 1, deleted_at = NOW()
         WHERE id = ? AND user_id = ? AND source != 'manual'`,
        [hide_source_event_id, userId]
      );
    }

    const newEvent = await query('SELECT * FROM calendar_events WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, event: newEvent[0] });
  } catch (error) {
    console.error('[Calendar] Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/calendar/events/:id - Update an event
router.put('/events/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const eventId = req.params.id;

    // Check ownership and source
    const existing = await query(
      'SELECT * FROM calendar_events WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [eventId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = existing[0];

    if (event.user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    if (event.source !== 'manual') {
      return res.status(403).json({ error: 'Cannot edit events synced from external sources' });
    }

    const {
      title, description, location, start_time, end_time,
      all_day, event_type, color, visibility, team_lagnname,
      audience_criteria
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (start_time !== undefined) { updates.push('start_time = ?'); params.push(start_time); }
    if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time); }
    if (all_day !== undefined) { updates.push('all_day = ?'); params.push(all_day ? 1 : 0); }
    if (event_type !== undefined) {
      if (!VALID_EVENT_TYPES.includes(event_type)) {
        return res.status(400).json({ error: `Invalid event_type` });
      }
      updates.push('event_type = ?'); params.push(event_type);
    }
    if (color !== undefined) { updates.push('color = ?'); params.push(color); }
    if (visibility !== undefined) {
      if (!VALID_VISIBILITY.includes(visibility)) {
        return res.status(400).json({ error: `Invalid visibility` });
      }
      updates.push('visibility = ?'); params.push(visibility);
    }
    if (team_lagnname !== undefined) { updates.push('team_lagnname = ?'); params.push(team_lagnname); }
    if (audience_criteria !== undefined) {
      const newVisibility = visibility !== undefined ? visibility : event.visibility;
      const criteriaJson = newVisibility === 'targeted' && audience_criteria
        ? JSON.stringify(audience_criteria) : null;
      updates.push('audience_criteria = ?'); params.push(criteriaJson);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Validate end > start if both are being updated
    const newStart = start_time || event.start_time;
    const newEnd = end_time || event.end_time;
    if (new Date(newEnd) <= new Date(newStart)) {
      return res.status(400).json({ error: 'end_time must be after start_time' });
    }

    params.push(eventId);
    await query(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await query('SELECT * FROM calendar_events WHERE id = ?', [eventId]);
    res.json({ success: true, event: updated[0] });
  } catch (error) {
    console.error('[Calendar] Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/calendar/events/:id - Soft-delete an event
router.delete('/events/:id', async (req, res) => {
  try {
    const userId = req.userId;
    const eventId = req.params.id;

    const existing = await query(
      'SELECT * FROM calendar_events WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [eventId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (existing[0].user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'You can only delete your own events' });
    }

    await query('UPDATE calendar_events SET deleted_at = NOW() WHERE id = ?', [eventId]);
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('[Calendar] Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// POST /api/calendar/sync-calendly - Sync Calendly events into calendar_events
router.post('/sync-calendly', async (req, res) => {
  try {
    const userId = req.userId;
    const { start, end } = req.body;

    // Get user's Calendly credentials
    const userRows = await query(
      'SELECT calendly_access_token, calendly_user_uri FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0 || !userRows[0].calendly_access_token) {
      return res.status(400).json({ success: false, message: 'No Calendly account linked' });
    }

    const accessToken = userRows[0].calendly_access_token;
    const userUri = userRows[0].calendly_user_uri;

    // Default to current month if no range specified
    const now = new Date();
    const minStart = start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const maxStart = end || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const params = new URLSearchParams({
      user: userUri,
      count: '100',
      status: 'active',
      min_start_time: minStart,
      max_start_time: maxStart
    });

    const eventsResponse = await fetch(
      `https://api.calendly.com/scheduled_events?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('[Calendar] Calendly sync failed:', errorText);
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch events from Calendly. Your account may need to be reconnected.'
      });
    }

    const eventsData = await eventsResponse.json();
    const calendlyEvents = eventsData.collection || [];

    let created = 0;
    let updated = 0;

    for (const event of calendlyEvents) {
      const externalId = event.uri;
      const title = event.name || 'Calendly Event';
      const startTime = event.start_time;
      const endTime = event.end_time;
      const eventLocation = event.location?.join_url || event.location?.location || null;

      // Upsert: insert or update on duplicate (user_id, external_id)
      const result = await query(
        `INSERT INTO calendar_events
          (user_id, title, start_time, end_time, event_type, color, visibility, source, external_id, external_url)
         VALUES (?, ?, ?, ?, 'meeting', '#006BFF', 'private', 'calendly', ?, ?)
         ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          external_url = VALUES(external_url),
          deleted_at = IF(hidden_by_user = 1, deleted_at, NULL)`,
        [userId, title, startTime, endTime, externalId, eventLocation]
      );

      if (result.affectedRows === 1) {
        created++;
      } else if (result.affectedRows === 2) {
        // ON DUPLICATE KEY UPDATE counts as 2 affected rows
        updated++;
      }
    }

    // Mark synced Calendly events that are no longer in the API response as deleted
    if (calendlyEvents.length > 0) {
      const activeExternalIds = calendlyEvents.map(e => e.uri);
      const placeholders = activeExternalIds.map(() => '?').join(',');
      await query(
        `UPDATE calendar_events
         SET deleted_at = NOW()
         WHERE user_id = ? AND source = 'calendly' AND deleted_at IS NULL
           AND start_time >= ? AND start_time <= ?
           AND external_id NOT IN (${placeholders})`,
        [userId, minStart, maxStart, ...activeExternalIds]
      );
    }

    res.json({ success: true, synced: calendlyEvents.length, created, updated });
  } catch (error) {
    console.error('[Calendar] Error syncing Calendly:', error);
    res.status(500).json({ error: 'Failed to sync Calendly events' });
  }
});

// GET /api/calendar/team-events - Get team events visible to the user
router.get('/team-events', async (req, res) => {
  try {
    const userId = req.userId;
    const { start, end, lagnname } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'Missing required query params: start, end' });
    }

    // If lagnname not provided, use the user's own
    let teamName = lagnname;
    if (!teamName) {
      const userRows = await query('SELECT lagnname FROM activeusers WHERE id = ? LIMIT 1', [userId]);
      teamName = userRows?.[0]?.lagnname || null;
    }

    const events = await query(
      `SELECT * FROM calendar_events
       WHERE deleted_at IS NULL
         AND start_time <= ? AND end_time >= ?
         AND (
           (visibility = 'team' AND team_lagnname = ?)
           OR visibility = 'organization'
         )
       ORDER BY start_time ASC`,
      [end, start, teamName]
    );

    res.json({ success: true, events });
  } catch (error) {
    console.error('[Calendar] Error fetching team events:', error);
    res.status(500).json({ error: 'Failed to fetch team events' });
  }
});

// POST /api/calendar/sync-google - Sync Google Calendar events
router.post('/sync-google', async (req, res) => {
  try {
    const userId = req.userId;
    const { start, end } = req.body;

    // Get user's Google Calendar credentials
    const userRows = await query(
      'SELECT google_calendar_access_token, google_calendar_refresh_token FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0 || !userRows[0].google_calendar_access_token) {
      return res.status(400).json({ success: false, message: 'No Google Calendar account linked' });
    }

    let accessToken = userRows[0].google_calendar_access_token;
    const refreshToken = userRows[0].google_calendar_refresh_token;

    const now = new Date();
    const timeMin = start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = end || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    // Helper to fetch events
    const fetchGoogleEvents = async (token) => {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250'
      });

      return fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
    };

    let eventsResponse = await fetchGoogleEvents(accessToken);

    // If token expired, refresh it
    if (eventsResponse.status === 401 && refreshToken) {
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken
        })
      });

      if (!refreshResponse.ok) {
        return res.status(400).json({
          success: false,
          message: 'Google Calendar session expired. Please reconnect in Account settings.'
        });
      }

      const newTokenData = await refreshResponse.json();
      accessToken = newTokenData.access_token;

      await query('UPDATE activeusers SET google_calendar_access_token = ? WHERE id = ?', [accessToken, userId]);

      eventsResponse = await fetchGoogleEvents(accessToken);
    }

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('[Calendar] Google Calendar sync failed:', errorText);
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch events from Google Calendar. Your account may need to be reconnected.'
      });
    }

    const eventsData = await eventsResponse.json();
    const googleEvents = eventsData.items || [];

    let created = 0;
    let updated = 0;

    for (const event of googleEvents) {
      // Skip cancelled events
      if (event.status === 'cancelled') continue;

      const externalId = event.id;
      const title = event.summary || 'Google Calendar Event';
      const description = event.description || null;
      const location = event.location || null;

      // Handle all-day vs timed events
      const isAllDay = !!(event.start?.date);
      const startTime = isAllDay
        ? new Date(event.start.date + 'T00:00:00').toISOString()
        : new Date(event.start.dateTime).toISOString();
      const endTime = isAllDay
        ? new Date(event.end.date + 'T00:00:00').toISOString()
        : new Date(event.end.dateTime).toISOString();

      const externalUrl = event.htmlLink || null;

      const result = await query(
        `INSERT INTO calendar_events
          (user_id, title, description, location, start_time, end_time, all_day, event_type, color, visibility, source, external_id, external_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'meeting', '#4285F4', 'private', 'google', ?, ?)
         ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          location = VALUES(location),
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          all_day = VALUES(all_day),
          external_url = VALUES(external_url),
          deleted_at = IF(hidden_by_user = 1, deleted_at, NULL)`,
        [userId, title, description, location, startTime, endTime, isAllDay ? 1 : 0, externalId, externalUrl]
      );

      if (result.affectedRows === 1) created++;
      else if (result.affectedRows === 2) updated++;
    }

    // Mark stale Google events as deleted
    const activeIds = googleEvents.filter(e => e.status !== 'cancelled').map(e => e.id);
    if (activeIds.length > 0) {
      const placeholders = activeIds.map(() => '?').join(',');
      await query(
        `UPDATE calendar_events SET deleted_at = NOW()
         WHERE user_id = ? AND source = 'google' AND deleted_at IS NULL
           AND start_time >= ? AND start_time <= ?
           AND external_id NOT IN (${placeholders})`,
        [userId, timeMin, timeMax, ...activeIds]
      );
    }

    res.json({ success: true, synced: googleEvents.length, created, updated });
  } catch (error) {
    console.error('[Calendar] Error syncing Google Calendar:', error);
    res.status(500).json({ error: 'Failed to sync Google Calendar events' });
  }
});

// POST /api/calendar/sync-outlook - Sync Outlook Calendar events
router.post('/sync-outlook', async (req, res) => {
  try {
    const userId = req.userId;
    const { start, end } = req.body;

    const userRows = await query(
      'SELECT outlook_calendar_access_token, outlook_calendar_refresh_token FROM activeusers WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0 || !userRows[0].outlook_calendar_access_token) {
      return res.status(400).json({ success: false, message: 'No Outlook Calendar account linked' });
    }

    let accessToken = userRows[0].outlook_calendar_access_token;
    const refreshToken = userRows[0].outlook_calendar_refresh_token;

    const now = new Date();
    const startDateTime = start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endDateTime = end || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    // Helper to fetch events
    const fetchOutlookEvents = async (token) => {
      const params = new URLSearchParams({
        startDateTime,
        endDateTime,
        '$top': '250',
        '$select': 'id,subject,body,location,start,end,isAllDay,webLink,isCancelled'
      });

      return fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
    };

    let eventsResponse = await fetchOutlookEvents(accessToken);

    // If token expired, refresh it
    if (eventsResponse.status === 401 && refreshToken) {
      const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
      const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;

      const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: OUTLOOK_CLIENT_ID,
          client_secret: OUTLOOK_CLIENT_SECRET,
          refresh_token: refreshToken,
          scope: 'Calendars.Read User.Read offline_access'
        })
      });

      if (!refreshResponse.ok) {
        return res.status(400).json({
          success: false,
          message: 'Outlook Calendar session expired. Please reconnect in Account settings.'
        });
      }

      const newTokenData = await refreshResponse.json();
      accessToken = newTokenData.access_token;
      const newRefreshToken = newTokenData.refresh_token;

      await query(
        'UPDATE activeusers SET outlook_calendar_access_token = ?, outlook_calendar_refresh_token = ? WHERE id = ?',
        [accessToken, newRefreshToken || refreshToken, userId]
      );

      eventsResponse = await fetchOutlookEvents(accessToken);
    }

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('[Calendar] Outlook Calendar sync failed:', errorText);
      return res.status(400).json({
        success: false,
        message: 'Failed to fetch events from Outlook Calendar. Your account may need to be reconnected.'
      });
    }

    const eventsData = await eventsResponse.json();
    const outlookEvents = eventsData.value || [];

    let created = 0;
    let updated = 0;

    for (const event of outlookEvents) {
      if (event.isCancelled) continue;

      const externalId = event.id;
      const title = event.subject || 'Outlook Calendar Event';
      const description = event.body?.content ? event.body.content.replace(/<[^>]*>/g, '').substring(0, 500) : null;
      const location = event.location?.displayName || null;
      const isAllDay = !!event.isAllDay;

      const startTime = new Date(event.start.dateTime + 'Z').toISOString();
      const endTime = new Date(event.end.dateTime + 'Z').toISOString();
      const externalUrl = event.webLink || null;

      const result = await query(
        `INSERT INTO calendar_events
          (user_id, title, description, location, start_time, end_time, all_day, event_type, color, visibility, source, external_id, external_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'meeting', '#0078D4', 'private', 'outlook', ?, ?)
         ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          location = VALUES(location),
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          all_day = VALUES(all_day),
          external_url = VALUES(external_url),
          deleted_at = IF(hidden_by_user = 1, deleted_at, NULL)`,
        [userId, title, description, location, startTime, endTime, isAllDay ? 1 : 0, externalId, externalUrl]
      );

      if (result.affectedRows === 1) created++;
      else if (result.affectedRows === 2) updated++;
    }

    // Mark stale Outlook events as deleted
    const activeIds = outlookEvents.filter(e => !e.isCancelled).map(e => e.id);
    if (activeIds.length > 0) {
      const placeholders = activeIds.map(() => '?').join(',');
      await query(
        `UPDATE calendar_events SET deleted_at = NOW()
         WHERE user_id = ? AND source = 'outlook' AND deleted_at IS NULL
           AND start_time >= ? AND start_time <= ?
           AND external_id NOT IN (${placeholders})`,
        [userId, startDateTime, endDateTime, ...activeIds]
      );
    }

    res.json({ success: true, synced: outlookEvents.length, created, updated });
  } catch (error) {
    console.error('[Calendar] Error syncing Outlook Calendar:', error);
    res.status(500).json({ error: 'Failed to sync Outlook Calendar events' });
  }
});

// POST /api/calendar/sync-ical - Sync events from all iCal subscriptions
router.post('/sync-ical', async (req, res) => {
  try {
    const userId = req.userId;
    const { start, end } = req.body;

    // Get user's personal iCal subscriptions + all org-wide feeds
    const subs = await query(
      `SELECT id, url, label, color, visibility FROM calendar_ical_subscriptions
       WHERE user_id = ? OR visibility = 'organization'`,
      [userId]
    );

    if (!subs || subs.length === 0) {
      return res.status(400).json({ success: false, message: 'No iCal subscriptions configured' });
    }

    const now = new Date();
    const rangeStart = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), -7);
    const rangeEnd = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 2, 14);

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSynced = 0;
    const errors = [];

    for (const sub of subs) {
      let icalUrl = sub.url;
      if (icalUrl.startsWith('webcal://')) {
        icalUrl = icalUrl.replace('webcal://', 'https://');
      }

      let events;
      try {
        events = await ical.async.fromURL(icalUrl);
      } catch (fetchErr) {
        console.error(`[Calendar] Failed to fetch iCal feed (sub ${sub.id}):`, fetchErr.message);
        errors.push(`Failed to fetch "${sub.label}"`);
        continue;
      }

      let created = 0;
      let updated = 0;
      const activeExternalIds = [];

      // Expand all events including recurring (RRULE) into individual occurrences
      const expandedEvents = expandIcalEvents(events, rangeStart, rangeEnd);
      const isOrgFeed = sub.visibility === 'organization';
      const eventVisibility = isOrgFeed ? 'organization' : 'private';

      for (const evt of expandedEvents) {
        const externalId = isOrgFeed ? `ical-org-${sub.id}-${evt.uid}` : `ical-${sub.id}-${evt.uid}`;

        activeExternalIds.push(externalId);

        const result = await query(
          `INSERT INTO calendar_events
            (user_id, title, description, location, start_time, end_time, all_day, event_type, color, visibility, source, external_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'meeting', ?, ?, 'ical', ?)
           ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = VALUES(description),
            location = VALUES(location),
            start_time = VALUES(start_time),
            end_time = VALUES(end_time),
            all_day = VALUES(all_day),
            color = VALUES(color),
            visibility = VALUES(visibility),
            deleted_at = IF(hidden_by_user = 1, deleted_at, NULL)`,
          [userId, evt.title, evt.description, evt.location, evt.start, evt.end, evt.allDay ? 1 : 0, sub.color || '#17a2b8', eventVisibility, externalId]
        );

        if (result.affectedRows === 1) created++;
        else if (result.affectedRows === 2) updated++;
      }

      // Mark stale events for this subscription as deleted
      if (activeExternalIds.length > 0) {
        const likePattern = isOrgFeed ? `ical-org-${sub.id}-%` : `ical-${sub.id}-%`;
        const placeholders = activeExternalIds.map(() => '?').join(',');
        await query(
          `UPDATE calendar_events SET deleted_at = NOW()
           WHERE user_id = ? AND source = 'ical' AND deleted_at IS NULL
             AND external_id LIKE ?
             AND start_time >= ? AND start_time <= ?
             AND external_id NOT IN (${placeholders})`,
          [userId, likePattern, rangeStart.toISOString(), rangeEnd.toISOString(), ...activeExternalIds]
        );
      }

      // Update last_synced_at
      await query('UPDATE calendar_ical_subscriptions SET last_synced_at = NOW() WHERE id = ?', [sub.id]);

      totalCreated += created;
      totalUpdated += updated;
      totalSynced += activeExternalIds.length;
    }

    res.json({
      success: true,
      synced: totalSynced,
      created: totalCreated,
      updated: totalUpdated,
      feedsSynced: subs.length - errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Calendar] Error syncing iCal:', error);
    res.status(500).json({ error: 'Failed to sync iCal events' });
  }
});

// ==========================================
// Admin iCal Management Endpoints
// ==========================================

// Helper to check admin role
const isAdmin = (req) => {
  const role = req.user?.Role;
  return role === 'Admin' || role === 'admin' || role === 'superadmin' || role === 'SuperAdmin';
};

// GET /api/calendar/admin/ical/my-subs - Get admin's personal iCal subscriptions for import use
router.get('/admin/ical/my-subs', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const subs = await query(
      `SELECT id, url, label, color FROM calendar_ical_subscriptions
       WHERE user_id = ? AND (visibility IS NULL OR visibility = 'private')
       ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json({ success: true, subscriptions: subs });
  } catch (error) {
    console.error('[Calendar Admin] Error fetching personal subs:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// GET /api/calendar/admin/ical/list - List all org-wide iCal subscriptions
router.get('/admin/ical/list', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const subs = await query(
      `SELECT id, user_id, url, label, color, visibility, created_by_name, last_synced_at, created_at
       FROM calendar_ical_subscriptions
       WHERE visibility = 'organization'
       ORDER BY created_at DESC`
    );

    res.json({ success: true, subscriptions: subs });
  } catch (error) {
    console.error('[Calendar Admin] Error listing org iCal feeds:', error);
    res.status(500).json({ error: 'Failed to list org iCal feeds' });
  }
});

// POST /api/calendar/admin/ical/subscribe - Add an org-wide iCal feed
router.post('/admin/ical/subscribe', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const { url, label, color } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ message: 'URL is required' });

    const icalUrl = url.trim();
    if (!icalUrl.startsWith('http://') && !icalUrl.startsWith('https://') && !icalUrl.startsWith('webcal://')) {
      return res.status(400).json({ message: 'URL must start with http://, https://, or webcal://' });
    }

    // Check max org feeds
    const countRows = await query(
      'SELECT COUNT(*) as cnt FROM calendar_ical_subscriptions WHERE visibility = ?',
      ['organization']
    );
    if (countRows[0].cnt >= 20) {
      return res.status(400).json({ message: 'Maximum 20 organization feeds allowed' });
    }

    // Get admin name
    const adminUser = await query('SELECT lagnname FROM activeusers WHERE id = ? LIMIT 1', [req.userId]);
    const adminName = adminUser?.[0]?.lagnname || 'Admin';

    const result = await query(
      `INSERT INTO calendar_ical_subscriptions (user_id, url, label, color, visibility, created_by_name)
       VALUES (?, ?, ?, ?, 'organization', ?)`,
      [req.userId, icalUrl, label?.trim() || 'Organization Calendar', color || '#17a2b8', adminName]
    );

    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('[Calendar Admin] Error creating org iCal feed:', error);
    res.status(500).json({ error: 'Failed to create org iCal feed' });
  }
});

// DELETE /api/calendar/admin/ical/:id - Remove an org-wide iCal feed
router.delete('/admin/ical/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const subId = req.params.id;

    // Verify it's an org feed
    const sub = await query(
      'SELECT id FROM calendar_ical_subscriptions WHERE id = ? AND visibility = ?',
      [subId, 'organization']
    );
    if (!sub || sub.length === 0) {
      return res.status(404).json({ message: 'Organization feed not found' });
    }

    // Soft-delete associated calendar events
    await query(
      `UPDATE calendar_events SET deleted_at = NOW()
       WHERE source = 'ical' AND external_id LIKE ? AND deleted_at IS NULL`,
      [`ical-org-${subId}-%`]
    );

    // Delete the subscription
    await query('DELETE FROM calendar_ical_subscriptions WHERE id = ?', [subId]);

    res.json({ success: true });
  } catch (error) {
    console.error('[Calendar Admin] Error deleting org iCal feed:', error);
    res.status(500).json({ error: 'Failed to delete org iCal feed' });
  }
});

// POST /api/calendar/admin/ical/preview - Preview events from an iCal URL
router.post('/admin/ical/preview', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const { url, start, end } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ message: 'URL is required' });

    let icalUrl = url.trim();
    if (icalUrl.startsWith('webcal://')) {
      icalUrl = icalUrl.replace('webcal://', 'https://');
    }

    let events;
    try {
      events = await ical.async.fromURL(icalUrl);
    } catch (fetchErr) {
      console.error('[Calendar Admin] Failed to fetch iCal preview:', fetchErr.message);
      return res.status(400).json({ message: 'Failed to fetch iCal feed. Check the URL and try again.' });
    }

    // Default: past 7 days + 6 months out (needed for recurring event expansion)
    const now = new Date();
    const rangeStart = start ? new Date(start) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rangeEnd = end ? new Date(end) : new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const parsed = expandIcalEvents(events, rangeStart, rangeEnd);

    res.json({ success: true, events: parsed, total: parsed.length });
  } catch (error) {
    console.error('[Calendar Admin] Error previewing iCal:', error);
    res.status(500).json({ error: 'Failed to preview iCal feed' });
  }
});

// POST /api/calendar/admin/ical/import - Import selected events to users or org-wide
router.post('/admin/ical/import', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

    const { events, target, userIds, color } = req.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'No events to import' });
    }

    if (!target || !['organization', 'users'].includes(target)) {
      return res.status(400).json({ message: 'Target must be "organization" or "users"' });
    }

    if (target === 'users' && (!userIds || !Array.isArray(userIds) || userIds.length === 0)) {
      return res.status(400).json({ message: 'userIds required when target is "users"' });
    }

    const eventColor = color || '#17a2b8';
    let created = 0;

    if (target === 'organization') {
      // Create org-wide events owned by admin
      for (const evt of events) {
        await query(
          `INSERT INTO calendar_events
            (user_id, title, description, location, start_time, end_time, all_day, event_type, color, visibility, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'meeting', ?, 'organization', 'manual')`,
          [
            req.userId, evt.title, evt.description || null, evt.location || null,
            evt.start, evt.end, evt.allDay ? 1 : 0, eventColor
          ]
        );
        created++;
      }
    } else {
      // Create events for specific users
      for (const userId of userIds) {
        for (const evt of events) {
          await query(
            `INSERT INTO calendar_events
              (user_id, title, description, location, start_time, end_time, all_day, event_type, color, visibility, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'meeting', ?, 'private', 'manual')`,
            [
              userId, evt.title, evt.description || null, evt.location || null,
              evt.start, evt.end, evt.allDay ? 1 : 0, eventColor
            ]
          );
          created++;
        }
      }
    }

    res.json({ success: true, created, message: `Imported ${events.length} event(s)` });
  } catch (error) {
    console.error('[Calendar Admin] Error importing events:', error);
    res.status(500).json({ error: 'Failed to import events' });
  }
});

module.exports = router;
