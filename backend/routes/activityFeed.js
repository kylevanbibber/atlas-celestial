const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');

const REACTIONS = ['heart', 'like', 'fire', 'clap', 'money'];

// Parse currency strings like "$1,234.56" or "($100.00)" to numbers
function parseCurrency(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val);
  const cleaned = str.replace(/[$,)]/g, '').replace(/\(/, '-');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function toCloseEvent(row) {
  return {
    id: `close-${row.id}`,
    type: 'close',
    actor: {
      id: row.user_id,
      name: row.lagnname || 'Unknown',
      profilePic: row.profpic || null,
      class: row.clname || null
    },
    data: {
      alp: parseFloat(row.alp) || 0,
      refs: parseInt(row.refs, 10) || 0,
      leadType: row.lead_type || null,
      imageUrl: row.image_url || null
    },
    timestamp: row.ts
  };
}

// Helper: get team filter data (both user IDs for discord_sales and lagnnames for Weekly_ALP)
async function getTeamFilter(userId) {
  const userRows = await query(
    'SELECT id, lagnname, clname, mga FROM activeusers WHERE id = ? AND Active = "y" LIMIT 1',
    [userId]
  );
  if (!userRows.length) return null;

  const user = userRows[0];
  const { clname, lagnname, mga } = user;
  let teamRows;

  if (['AGT', 'SA', 'GA'].includes(clname)) {
    if (!mga) return { userIds: [userId], lagnnames: [lagnname] };
    teamRows = await query(
      'SELECT id, lagnname FROM activeusers WHERE mga = ? AND Active = "y"',
      [mga]
    );
  } else if (clname === 'MGA') {
    teamRows = await query(
      'SELECT id, lagnname FROM activeusers WHERE (mga = ? OR lagnname = ?) AND Active = "y"',
      [lagnname, lagnname]
    );
  } else if (clname === 'RGA') {
    const mgaRows = await query(
      `SELECT lagnname FROM MGAs
       WHERE (rga = ? OR legacy = ? OR tree = ?)
         AND (active = 'y' OR active IS NULL)
         AND (hide = 'n' OR hide IS NULL)`,
      [lagnname, lagnname, lagnname]
    );
    const mgaNames = mgaRows.map(r => r.lagnname);
    if (mgaNames.length === 0) return { userIds: [userId], lagnnames: [lagnname] };
    const ph = mgaNames.map(() => '?').join(',');
    teamRows = await query(
      `SELECT id, lagnname FROM activeusers
       WHERE (mga IN (${ph}) OR lagnname IN (${ph}) OR lagnname = ?)
         AND Active = 'y'`,
      [...mgaNames, ...mgaNames, lagnname]
    );
  } else {
    return null;
  }

  return {
    userIds: teamRows.map(r => r.id),
    lagnnames: [...new Set(teamRows.map(r => r.lagnname))]
  };
}

// Compute milestone events from Weekly_ALP (record weeks, first 4k, 8k weeks)
async function getMilestoneEvents(before, fetchLimit, teamLagnnames) {
  let teamFilter = '';
  let teamParams = [];

  if (teamLagnnames && teamLagnnames.length > 0) {
    const ph = teamLagnnames.map(() => '?').join(',');
    teamFilter = `AND w.LagnName IN (${ph})`;
    teamParams = [...teamLagnnames];
  }

  const PARSE_NET = `CAST(REPLACE(REPLACE(REPLACE(REPLACE(w.LVL_1_NET, '$', ''), ',', ''), '(', '-'), ')', '') AS DECIMAL(10,2))`;

  // Context query: each agent's max net and whether they had 4k+ BEFORE our 1-year window
  const contextSql = `
    SELECT w.LagnName,
      MAX(${PARSE_NET}) as prior_max,
      MAX(CASE WHEN ${PARSE_NET} >= 4000 THEN 1 ELSE 0 END) as had_4k
    FROM Weekly_ALP w
    WHERE w.REPORT = 'Weekly Recap'
      AND STR_TO_DATE(w.reportdate, '%m/%d/%Y') < DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
      ${teamFilter}
    GROUP BY w.LagnName
  `;

  // Recent weeks: last year of data, sorted by agent then date ASC for chronological processing
  const weeksSql = `
    SELECT w.LagnName, w.LVL_1_NET, w.reportdate, w.CL_Name, w.MGA_NAME,
           au.id as user_id, au.profpic, au.clname
    FROM Weekly_ALP w
    LEFT JOIN (
      SELECT lagnname, MIN(id) as id, MAX(profpic) as profpic, MAX(clname) as clname
      FROM activeusers WHERE Active = 'y'
      GROUP BY lagnname
    ) au ON w.LagnName = au.lagnname
    WHERE w.REPORT = 'Weekly Recap'
      AND STR_TO_DATE(w.reportdate, '%m/%d/%Y') >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
      ${teamFilter}
    ORDER BY w.LagnName, STR_TO_DATE(w.reportdate, '%m/%d/%Y') ASC
  `;

  const [contextRows, weekRows] = await Promise.all([
    query(contextSql, teamParams),
    query(weeksSql, teamParams)
  ]);

  // Build prior context map
  const priorContext = {};
  for (const row of contextRows) {
    priorContext[row.LagnName] = {
      priorMax: parseFloat(row.prior_max) || 0,
      had4k: parseInt(row.had_4k) === 1
    };
  }

  // Deduplicate: keep highest LVL_1_NET per (LagnName, reportdate)
  const deduped = new Map();
  for (const row of weekRows) {
    const key = `${row.LagnName}|${row.reportdate}`;
    const net = parseCurrency(row.LVL_1_NET);
    const existing = deduped.get(key);
    if (!existing || net > parseCurrency(existing.LVL_1_NET)) {
      deduped.set(key, row);
    }
  }

  // Group by agent
  const byAgent = {};
  for (const row of deduped.values()) {
    if (!byAgent[row.LagnName]) byAgent[row.LagnName] = [];
    byAgent[row.LagnName].push(row);
  }

  const events = [];
  const beforeDate = before ? new Date(before) : null;

  for (const [lagnname, weeks] of Object.entries(byAgent)) {
    const ctx = priorContext[lagnname] || { priorMax: 0, had4k: false };
    let runningMax = ctx.priorMax;
    let hadFirst4k = ctx.had4k;

    // Weeks are already sorted ASC by date from SQL
    for (const week of weeks) {
      const net = parseCurrency(week.LVL_1_NET);
      if (net <= 0) { runningMax = Math.max(runningMax, net); continue; }

      // Parse reportdate MM/DD/YYYY to Date
      const parts = week.reportdate.split('/');
      if (parts.length !== 3) { runningMax = Math.max(runningMax, net); continue; }
      const [m, d, y] = parts;
      const dateObj = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T23:59:59.000Z`);

      // Cursor filter: skip events at/after cursor, but still track state
      if (beforeDate && dateObj >= beforeDate) {
        runningMax = Math.max(runningMax, net);
        if (!hadFirst4k && net >= 4000) hadFirst4k = true;
        continue;
      }

      const isoTimestamp = dateObj.toISOString();
      const dateKey = `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
      const actor = {
        id: week.user_id || null,
        name: week.LagnName,
        profilePic: week.profpic || null,
        class: week.clname || week.CL_Name || null
      };

      // Record week: net > all previous weeks (must have previous data)
      if (net > runningMax && runningMax > 0) {
        events.push({
          id: `record_week-${week.user_id || 0}-${dateKey}`,
          type: 'record_week',
          actor,
          data: { amount: net, previousRecord: runningMax, weekDate: week.reportdate },
          timestamp: isoTimestamp,
          reactions: { counts: {}, userReactions: [], reactors: {} }
        });
      }

      // First 4k week
      if (!hadFirst4k && net >= 4000) {
        hadFirst4k = true;
        events.push({
          id: `first_4k-${week.user_id || 0}-${dateKey}`,
          type: 'first_4k_week',
          actor,
          data: { amount: net, weekDate: week.reportdate },
          timestamp: isoTimestamp,
          reactions: { counts: {}, userReactions: [], reactors: {} }
        });
      }

      // 8k week (Wall of Fame)
      if (net >= 8000) {
        events.push({
          id: `8k_week-${week.user_id || 0}-${dateKey}`,
          type: '8k_week',
          actor,
          data: { amount: net, weekDate: week.reportdate },
          timestamp: isoTimestamp,
          reactions: { counts: {}, userReactions: [], reactors: {} }
        });
      }

      runningMax = Math.max(runningMax, net);
    }
  }

  // Sort desc and limit
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events.slice(0, fetchLimit);
}

// Fetch tally session events from Dial.sessions (consolidated per user per day)
async function getTallySessionEvents(before, fetchLimit, teamUserIds) {
  try {
    let teamFilter = '';
    let params = [before, before];

    if (teamUserIds && teamUserIds.length > 0) {
      const ph = teamUserIds.map(() => '?').join(',');
      teamFilter = `AND au.id IN (${ph})`;
      params = [before, before, ...teamUserIds];
    }

    // Group sessions by user + day to avoid flooding the feed
    const sql = `
      SELECT MAX(s.id) as id,
             SUM(s.total_dials) as total_dials,
             SUM(s.session_duration) as session_duration,
             COUNT(*) as session_count,
             MAX(s.created_at) as created_at,
             MIN(au.id) as user_id, MAX(au.lagnname) as lagnname, MAX(au.clname) as clname, MAX(au.profpic) as profpic
      FROM Dial.sessions s
      INNER JOIN activeusers au ON au.tally_user_id = s.user_id AND au.Active = 'y'
      WHERE (s.created_at < ? OR ? IS NULL)
        AND s.total_dials > 0
        AND s.session_duration > 0
        ${teamFilter}
      GROUP BY au.id, DATE(s.created_at)
      ORDER BY MAX(s.created_at) DESC
      LIMIT ?
    `;
    const rows = await query(sql, [...params, fetchLimit + 1]);

    const events = rows.map(row => ({
      id: `tally_session-${row.id}`,
      type: 'tally_session',
      actor: {
        id: row.user_id,
        name: row.lagnname || 'Unknown',
        profilePic: row.profpic || null,
        class: row.clname || null
      },
      data: {
        totalDials: row.total_dials || 0,
        sessionDuration: row.session_duration || 0,
        sessionCount: row.session_count || 1,
        isActive: false
      },
      timestamp: row.created_at
    }));

    return events;
  } catch (error) {
    // If Dial database is unavailable, return empty (don't break the feed)
    console.error('[activity-feed] Error fetching tally sessions:', error.message);
    return [];
  }
}

// Enrich close events with daily sale number and running ALP total
async function enrichCloseEventsWithDailyContext(closeEvents, closeRows) {
  if (!closeRows || closeRows.length === 0) return;

  const saleIds = closeRows.map(r => r.id);
  const ph = saleIds.map(() => '?').join(',');

  const contextRows = await query(`
    SELECT ds.id,
      (SELECT COUNT(*) FROM discord_sales ds2
       WHERE ds2.user_id = ds.user_id AND DATE(ds2.ts) = DATE(ds.ts) AND ds2.ts <= ds.ts) as daily_sale_number,
      (SELECT COALESCE(SUM(ds2.alp), 0) FROM discord_sales ds2
       WHERE ds2.user_id = ds.user_id AND DATE(ds2.ts) = DATE(ds.ts) AND ds2.ts <= ds.ts) as daily_alp_total
    FROM discord_sales ds
    WHERE ds.id IN (${ph})
  `, saleIds);

  const contextMap = {};
  for (const row of contextRows) {
    contextMap[row.id] = {
      dailySaleNumber: row.daily_sale_number,
      dailyAlpTotal: parseFloat(row.daily_alp_total) || 0
    };
  }

  for (const event of closeEvents) {
    const saleId = parseInt(event.id.replace('close-', ''), 10);
    const ctx = contextMap[saleId];
    if (ctx) {
      event.data.dailySaleNumber = ctx.dailySaleNumber;
      event.data.dailyAlpTotal = ctx.dailyAlpTotal;
    }
  }
}

// Attach reactions to a list of events
async function attachReactions(events, userId) {
  if (events.length === 0) return;

  const eventIds = events.map(e => e.id);
  const placeholders = eventIds.map(() => '?').join(',');

  const [countRows, userRows, reactorRows] = await Promise.all([
    query(
      `SELECT event_id, reaction, COUNT(*) as count
       FROM activity_feed_reactions
       WHERE event_id IN (${placeholders})
       GROUP BY event_id, reaction`,
      eventIds
    ),
    query(
      `SELECT event_id, reaction
       FROM activity_feed_reactions
       WHERE event_id IN (${placeholders}) AND user_id = ?`,
      [...eventIds, userId]
    ),
    query(
      `SELECT afr.event_id, afr.reaction, au.lagnname
       FROM activity_feed_reactions afr
       LEFT JOIN activeusers au ON afr.user_id = au.id
       WHERE afr.event_id IN (${placeholders})
       ORDER BY afr.created_at ASC`,
      eventIds
    )
  ]);

  const countsMap = {};
  for (const row of countRows) {
    if (!countsMap[row.event_id]) countsMap[row.event_id] = {};
    countsMap[row.event_id][row.reaction] = row.count;
  }

  const userReactionsMap = {};
  for (const row of userRows) {
    if (!userReactionsMap[row.event_id]) userReactionsMap[row.event_id] = [];
    userReactionsMap[row.event_id].push(row.reaction);
  }

  const reactorsMap = {};
  for (const row of reactorRows) {
    if (!reactorsMap[row.event_id]) reactorsMap[row.event_id] = {};
    if (!reactorsMap[row.event_id][row.reaction]) reactorsMap[row.event_id][row.reaction] = [];
    reactorsMap[row.event_id][row.reaction].push(row.lagnname || 'Unknown');
  }

  for (const event of events) {
    event.reactions = {
      counts: countsMap[event.id] || {},
      userReactions: userReactionsMap[event.id] || [],
      reactors: reactorsMap[event.id] || {}
    };
  }
}

// GET /api/activity-feed
router.get('/', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const before = req.query.before || null;
    const scope = req.query.scope || 'org';
    const userId = req.user.userId || req.userId;

    // Get team filter data if scope=team
    let teamUserIds = null;
    let teamLagnnames = null;
    if (scope === 'team') {
      const teamFilter = await getTeamFilter(userId);
      if (teamFilter && teamFilter.userIds.length > 0) {
        teamUserIds = teamFilter.userIds;
        teamLagnnames = teamFilter.lagnnames;
      } else {
        return res.json({ success: true, data: [], activeUserIds: [], pagination: { hasMore: false, nextCursor: null, limit } });
      }
    }

    // --- Fetch close events ---
    let closeSqlFilter = '';
    let closeParams = [before, before];
    if (teamUserIds) {
      const ph = teamUserIds.map(() => '?').join(',');
      closeSqlFilter = `AND ds.user_id IN (${ph})`;
      closeParams = [before, before, ...teamUserIds];
    }

    const closeSql = `
      SELECT ds.id, ds.alp, ds.refs, ds.lead_type, ds.image_url, ds.user_id, ds.ts,
             au.lagnname, au.clname, au.profpic
      FROM discord_sales ds
      LEFT JOIN activeusers au ON ds.user_id = au.id
      WHERE (ds.ts < ? OR ? IS NULL)
      ${closeSqlFilter}
      ORDER BY ds.ts DESC
      LIMIT ?
    `;
    const closeRows = await query(closeSql, [...closeParams, limit + 1]);
    const closeEvents = closeRows.map(toCloseEvent);

    // Enrich close events with daily sale number and running ALP total
    await enrichCloseEventsWithDailyContext(closeEvents, closeRows);

    // --- Fetch milestone events ---
    const milestoneEvents = await getMilestoneEvents(before, limit + 1, teamLagnnames);

    // --- Fetch tally session events ---
    const tallyEvents = await getTallySessionEvents(before, limit + 1, teamUserIds);

    // --- Merge all events, sort by timestamp desc ---
    const allEvents = [...closeEvents, ...milestoneEvents, ...tallyEvents]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const hasMore = allEvents.length > limit;
    const pageEvents = hasMore ? allEvents.slice(0, limit) : allEvents;
    const nextCursor = hasMore && pageEvents.length > 0
      ? pageEvents[pageEvents.length - 1].timestamp
      : null;

    // Attach reactions to page events
    await attachReactions(pageEvents, userId);

    // Get active user IDs from WebSocket manager
    let activeUserIds = [];
    if (global.notificationManager) {
      activeUserIds = global.notificationManager.getActiveUserIds().map(id => parseInt(id, 10));
    }

    return res.json({
      success: true,
      data: pageEvents,
      activeUserIds,
      pagination: { hasMore, nextCursor, limit }
    });
  } catch (error) {
    console.error('[activity-feed] GET error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching activity feed' });
  }
});

// POST /api/activity-feed/reactions - Toggle a reaction
router.post('/reactions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.userId;
    const { eventId, reaction } = req.body;

    if (!eventId || !reaction) {
      return res.status(400).json({ success: false, message: 'eventId and reaction are required' });
    }
    if (!REACTIONS.includes(reaction)) {
      return res.status(400).json({ success: false, message: `Invalid reaction. Must be one of: ${REACTIONS.join(', ')}` });
    }

    const existing = await query(
      'SELECT id FROM activity_feed_reactions WHERE event_id = ? AND user_id = ? AND reaction = ?',
      [eventId, userId, reaction]
    );

    if (existing.length > 0) {
      await query(
        'DELETE FROM activity_feed_reactions WHERE event_id = ? AND user_id = ? AND reaction = ?',
        [eventId, userId, reaction]
      );
    } else {
      await query(
        'INSERT INTO activity_feed_reactions (event_id, user_id, reaction) VALUES (?, ?, ?)',
        [eventId, userId, reaction]
      );
    }

    const countRows = await query(
      'SELECT reaction, COUNT(*) as count FROM activity_feed_reactions WHERE event_id = ? GROUP BY reaction',
      [eventId]
    );
    const userRows = await query(
      'SELECT reaction FROM activity_feed_reactions WHERE event_id = ? AND user_id = ?',
      [eventId, userId]
    );
    const reactorRows = await query(
      `SELECT afr.reaction, au.lagnname
       FROM activity_feed_reactions afr
       LEFT JOIN activeusers au ON afr.user_id = au.id
       WHERE afr.event_id = ?
       ORDER BY afr.created_at ASC`,
      [eventId]
    );

    const counts = {};
    for (const row of countRows) {
      counts[row.reaction] = row.count;
    }

    const reactors = {};
    for (const row of reactorRows) {
      if (!reactors[row.reaction]) reactors[row.reaction] = [];
      reactors[row.reaction].push(row.lagnname || 'Unknown');
    }

    return res.json({
      success: true,
      data: {
        eventId,
        counts,
        userReactions: userRows.map(r => r.reaction),
        reactors
      }
    });
  } catch (error) {
    console.error('[activity-feed] POST reactions error:', error);
    return res.status(500).json({ success: false, message: 'Error toggling reaction' });
  }
});

module.exports = router;
