/**
 * Ref Tracking Widget
 *
 * Shows a combined table with Refs Collected and Ref Sales columns.
 * Team view shows a per-agent table; personal view shows totals.
 * Accepts onToggleView/onPrevView/toggleLabel props for parent-managed toggle.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../../../api';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { NameFormats } from '../../../utils/nameFormatter';
import ViewDots from './ViewDots';

const hideScrollbarCSS = `
  .ref-tracking-list::-webkit-scrollbar { display: none; }
`;
if (typeof document !== 'undefined' && !document.getElementById('ref-tracking-list-style')) {
  const style = document.createElement('style');
  style.id = 'ref-tracking-list-style';
  style.textContent = hideScrollbarCSS;
  document.head.appendChild(style);
}

const RefTrackingWidget = ({ viewScope, userRole, teamUserIds = [], dateRange, userId, parentLoading, onToggleView, onPrevView, toggleLabel, viewIndex, viewCount }) => {
  const [loading, setLoading] = useState(true);
  const [refData, setRefData] = useState([]);

  useEffect(() => {
    // Wait for the parent hook to finish resolving teamUserIds for the current scope
    if (parentLoading) return;

    const fetchRefData = async () => {
      if (!dateRange?.start || !dateRange?.end) return;

      const isPersonal = viewScope === 'personal' || teamUserIds.length === 0;
      const ids = isPersonal ? (userId ? [userId] : []) : teamUserIds;
      if (ids.length === 0) {
        setRefData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.get('/refvalidation/dashboard-summary', {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end,
            userIds: ids.join(','),
          },
        });
        if (res.data.success) {
          setRefData(res.data.data || []);
        }
      } catch (err) {
        console.error('RefTrackingWidget: Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRefData();
  }, [dateRange, viewScope, teamUserIds, userId, parentLoading]);

  const isTeam = viewScope !== 'personal' && teamUserIds.length > 1;

  const totalCollected = useMemo(() => refData.reduce((s, r) => s + (r.refs_collected || 0), 0), [refData]);
  const totalSales = useMemo(() => refData.reduce((s, r) => s + (r.ref_sales || 0), 0), [refData]);

  const sortedAgents = useMemo(() => {
    return [...refData].sort((a, b) => (b.refs_collected || 0) - (a.refs_collected || 0));
  }, [refData]);

  const BATCH_SIZE = 8;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const listRef = useRef(null);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [refData]);

  const visibleAgents = useMemo(() => sortedAgents.slice(0, visibleCount), [sortedAgents, visibleCount]);
  const hasMore = visibleCount < sortedAgents.length;

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setVisibleCount(prev => Math.min(prev + BATCH_SIZE, sortedAgents.length));
    }
  }, [hasMore, sortedAgents.length]);

  if (loading) {
    return (
      <Card className="bg-card border-border" style={{ height: '100%' }}>
        <CardContent>
          <div className="activity-snapshot-summary loading" style={{ padding: '1rem' }}>
            <div className="loading-spinner"></div>
            <p>Loading refs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chevronStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: 4,
    color: 'var(--muted-foreground)',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.15s, background 0.15s',
  };

  const hoverIn = (e) => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.background = 'var(--accent)'; };
  const hoverOut = (e) => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'none'; };

  return (
    <Card className="bg-card border-border" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ paddingBottom: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={onPrevView || onToggleView} style={chevronStyle} title="Previous view" onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
            <FiChevronLeft size={16} />
          </button>
          <CardTitle className="text-lg">Ref Tracking</CardTitle>
          {onToggleView && (
            <button onClick={onToggleView} style={chevronStyle} title={toggleLabel || 'Next view'} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <FiChevronRight size={16} />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground" style={{ marginTop: 2 }}>
          {totalCollected} collected · {totalSales} sale{totalSales !== 1 ? 's' : ''}
        </p>
      </CardHeader>

      <CardContent style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isTeam ? (
          <>
            {/* Column headers */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border-color, #eee)' }}>
              <span style={{ flex: 1 }}>Agent</span>
              <span style={{ width: 60, textAlign: 'right' }}>Collected</span>
              <span style={{ width: 50, textAlign: 'right' }}>Sales</span>
            </div>
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="ref-tracking-list"
              style={{ overflowY: 'auto', flex: 1, maxHeight: 200, scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {sortedAgents.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #999)', fontSize: 13, paddingTop: '1rem' }}>
                  No ref data for this period
                </div>
              ) : (
                <>
                  {visibleAgents.map((agent) => {
                    const displayName = NameFormats.FIRST_LAST_SUFFIX(agent.lagnname || 'Unknown');
                    return (
                      <div
                        key={agent.agent_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 0',
                          fontSize: 12,
                          borderBottom: '1px solid var(--border-color, #eee)',
                        }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                          {displayName}
                        </span>
                        <span style={{ width: 60, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {agent.refs_collected || 0}
                        </span>
                        <span style={{ width: 50, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {agent.ref_sales || 0}
                        </span>
                      </div>
                    );
                  })}
                  {hasMore && (
                    <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                      Scroll for more...
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                {refData.length > 0 ? refData[0].refs_collected || 0 : 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 4 }}>Collected</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                {refData.length > 0 ? refData[0].ref_sales || 0 : 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 4 }}>Sales</div>
            </div>
          </div>
        )}
      </CardContent>
      <ViewDots count={viewCount} activeIndex={viewIndex} />
    </Card>
  );
};

export default RefTrackingWidget;
