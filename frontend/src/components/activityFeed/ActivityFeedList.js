import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import api from '../../api';
import { getCardForType } from './cards/EventCardRegistry';
import RightDetails from '../utils/RightDetails';
import './ActivityFeedList.css';

const PULL_THRESHOLD = 80; // px to trigger refresh

const ActivityFeedList = ({ scope = 'org', onRegisterAddEvent }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [activeUserIds, setActiveUserIds] = useState([]);
  const [rightDetailsData, setRightDetailsData] = useState(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const listRef = useRef(null);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const wheelAccumRef = useRef(0);
  const wheelTimerRef = useRef(null);
  const refreshingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);

  // Register addEvent callback with parent
  const addEvent = useCallback((event) => {
    setEvents(prev => [event, ...prev]);
  }, []);

  useEffect(() => {
    if (onRegisterAddEvent) onRegisterAddEvent(addEvent);
  }, [onRegisterAddEvent, addEvent]);

  const fetchEvents = useCallback(async (cursor = null) => {
    const params = { limit: 20, scope };
    if (cursor) params.before = cursor;

    const response = await api.get('/activity-feed', { params });
    return response.data;
  }, [scope]);

  // Refresh from top (used by pull-to-refresh)
  const handleRefreshRef = useRef(null);
  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    try {
      setRefreshing(true);
      setError(null);
      const result = await fetchEvents();
      setEvents(result.data);
      setHasMore(result.pagination.hasMore);
      setNextCursor(result.pagination.nextCursor);
      if (result.activeUserIds) setActiveUserIds(result.activeUserIds);
    } catch (err) {
      console.error('[ActivityFeedList] Error refreshing:', err);
      setError('Failed to refresh activity feed.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchEvents]);
  handleRefreshRef.current = handleRefresh;

  // Re-fetch when scope changes
  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      try {
        setLoading(true);
        setError(null);
        setEvents([]);
        setNextCursor(null);
        const result = await fetchEvents();
        if (cancelled) return;
        setEvents(result.data);
        setHasMore(result.pagination.hasMore);
        setNextCursor(result.pagination.nextCursor);
        if (result.activeUserIds) setActiveUserIds(result.activeUserIds);
      } catch (err) {
        if (cancelled) return;
        console.error('[ActivityFeedList] Error loading events:', err);
        setError('Failed to load activity feed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitial();
    return () => { cancelled = true; };
  }, [fetchEvents]);

  // Listen for real-time new_close events via WebSocket
  useEffect(() => {
    const handleNewClose = (e) => {
      const newEvent = e.detail;
      if (!newEvent || !newEvent.id) return;
      setEvents(prev => {
        if (prev.some(ev => ev.id === newEvent.id)) return prev;
        return [newEvent, ...prev];
      });
    };

    window.addEventListener('new_close', handleNewClose);
    return () => window.removeEventListener('new_close', handleNewClose);
  }, []);

  // Pull-to-refresh: touch (mobile) + scroll wheel (desktop)
  // Uses refs to avoid re-running effect on every pullDistance change
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const isAtTop = () => {
      let node = el;
      while (node) {
        if (node.scrollTop > 0) return false;
        node = node.parentElement;
      }
      return true;
    };

    // --- Touch handlers (mobile) ---
    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (isAtTop()) {
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) {
        const dampened = Math.min(dy * 0.5, 140);
        setPullDistance(dampened);
        setIsPulling(true);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistanceRef.current >= PULL_THRESHOLD && !refreshingRef.current) {
        handleRefreshRef.current();
      }
      setPullDistance(0);
      setIsPulling(false);
    };

    // --- Scroll wheel handler (desktop) ---
    const onWheel = (e) => {
      if (refreshingRef.current) return;
      if (!isAtTop()) { wheelAccumRef.current = 0; return; }

      // Only accumulate upward scrolls (negative deltaY = scroll up)
      if (e.deltaY < 0) {
        wheelAccumRef.current += Math.abs(e.deltaY);
        const dampened = Math.min(wheelAccumRef.current * 0.3, 140);
        setPullDistance(dampened);
        setIsPulling(true);

        // Reset accumulator after a pause in scrolling
        clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = setTimeout(() => {
          if (wheelAccumRef.current * 0.3 >= PULL_THRESHOLD && !refreshingRef.current) {
            handleRefreshRef.current();
          }
          wheelAccumRef.current = 0;
          setPullDistance(0);
          setIsPulling(false);
        }, 200);
      } else {
        // Scrolling down — reset
        wheelAccumRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      clearTimeout(wheelTimerRef.current);
    };
  }, []); // stable — uses refs for all mutable values

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const result = await fetchEvents(nextCursor);
      setEvents(prev => [...prev, ...result.data]);
      setHasMore(result.pagination.hasMore);
      setNextCursor(result.pagination.nextCursor);
      if (result.activeUserIds) setActiveUserIds(result.activeUserIds);
    } catch (err) {
      console.error('[ActivityFeedList] Error loading more:', err);
      setError('Failed to load more events.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleReact = async (eventId, reaction) => {
    // Optimistic update
    setEvents(prev => prev.map(event => {
      if (event.id !== eventId) return event;
      const currentReactions = event.reactions || { counts: {}, userReactions: [], reactors: {} };
      const isActive = currentReactions.userReactions.includes(reaction);
      const newCounts = { ...currentReactions.counts };
      const newUserReactions = isActive
        ? currentReactions.userReactions.filter(r => r !== reaction)
        : [...currentReactions.userReactions, reaction];

      newCounts[reaction] = (newCounts[reaction] || 0) + (isActive ? -1 : 1);
      if (newCounts[reaction] <= 0) delete newCounts[reaction];

      return { ...event, reactions: { ...currentReactions, counts: newCounts, userReactions: newUserReactions } };
    }));

    try {
      const response = await api.post('/activity-feed/reactions', { eventId, reaction });
      if (response.data.success) {
        const { counts, userReactions, reactors } = response.data.data;
        setEvents(prev => prev.map(event => {
          if (event.id !== eventId) return event;
          return { ...event, reactions: { counts, userReactions, reactors } };
        }));
      }
    } catch (err) {
      console.error('[ActivityFeedList] Error toggling reaction:', err);
    }
  };

  const handleProfileClick = (actor) => {
    setRightDetailsData({
      __isAgentProfile: true,
      id: actor.id,
      lagnname: actor.name,
      displayName: actor.name,
      clname: actor.class,
      profpic: actor.profilePic,
      managerActive: 'y'
    });
  };

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const pullReady = pullProgress >= 1;

  // Compute the first (chronologically earliest) close event per calendar day
  const firstBloodIds = (() => {
    const dayFirst = {};
    for (const event of events) {
      if (event.type !== 'close') continue;
      const dayStr = new Date(event.timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
      if (!dayFirst[dayStr] || new Date(event.timestamp) < new Date(dayFirst[dayStr].timestamp)) {
        dayFirst[dayStr] = { id: event.id, timestamp: event.timestamp };
      }
    }
    return new Set(Object.values(dayFirst).map(e => e.id));
  })();

  if (loading) {
    return (
      <div className={`activity-feed-list${isPulling ? ' is-pulling' : ''}`} ref={listRef}>
        <div className="activity-feed-loading">Loading activity...</div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={`activity-feed-list${isPulling ? ' is-pulling' : ''}`} ref={listRef}>
        <div className="activity-feed-error">{error}</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`activity-feed-list${isPulling ? ' is-pulling' : ''}`} ref={listRef}>
        <div className="activity-feed-empty">No activity yet.</div>
      </div>
    );
  }

  return (
    <div className={`activity-feed-list${isPulling ? ' is-pulling' : ''}`} ref={listRef}>
      {/* Pull-to-refresh indicator */}
      {(isPulling || refreshing) && (
        <div
          className={`pull-to-refresh-indicator ${refreshing ? 'refreshing' : ''} ${pullReady ? 'ready' : ''}`}
          style={!refreshing ? { height: pullDistance, opacity: pullProgress } : undefined}
        >
          <FiRefreshCw
            className={`pull-to-refresh-icon ${refreshing ? 'spinning' : ''}`}
            style={!refreshing ? { transform: `rotate(${pullProgress * 360}deg)` } : undefined}
          />
          <span className="pull-to-refresh-text">
            {refreshing ? 'Refreshing...' : pullReady ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      )}

      {events.map((event, index) => {
        const CardComponent = getCardForType(event.type);
        if (!CardComponent) return null;

        // Date separator logic
        const eventDate = new Date(event.timestamp);
        const today = new Date();
        const eventDateStr = eventDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
        const prevEvent = index > 0 ? events[index - 1] : null;
        const prevDateStr = prevEvent
          ? new Date(prevEvent.timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
          : null;
        const showSeparator = index === 0 || eventDateStr !== prevDateStr;

        let dateLabel = '';
        if (showSeparator) {
          const todayStr = today.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

          if (eventDateStr === todayStr) {
            dateLabel = 'Today';
          } else if (eventDateStr === yesterdayStr) {
            dateLabel = 'Yesterday';
          } else {
            dateLabel = eventDate.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'long', month: 'long', day: 'numeric'
            });
          }
        }

        return (
          <React.Fragment key={event.id}>
            {showSeparator && (
              <div className="activity-feed-date-separator">
                <div className="activity-feed-date-line" />
                <span className="activity-feed-date-label">{dateLabel}</span>
                <div className="activity-feed-date-line" />
              </div>
            )}
            <CardComponent
              event={event}
              onReact={handleReact}
              onProfileClick={handleProfileClick}
              activeUserIds={activeUserIds}
              isFirstBlood={firstBloodIds.has(event.id)}
            />
          </React.Fragment>
        );
      })}

      {error && events.length > 0 && (
        <div className="activity-feed-error">{error}</div>
      )}

      {hasMore && (
        <button
          className="activity-feed-load-more"
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading...' : 'Load More'}
        </button>
      )}

      {rightDetailsData && (
        <RightDetails
          data={rightDetailsData}
          fromPage="Agent"
          onClose={() => setRightDetailsData(null)}
        />
      )}
    </div>
  );
};

export default ActivityFeedList;
