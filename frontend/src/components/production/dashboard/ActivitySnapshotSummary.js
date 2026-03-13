/**
 * Activity Snapshot Summary Component
 * 
 * Shows reporting statistics and activity totals for the selected time period
 */

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import { FiUsers, FiTrendingUp, FiFileText, FiBarChart2, FiActivity, FiClock, FiPhone, FiCalendar, FiDollarSign, FiAward } from 'react-icons/fi';
import { NameFormats } from '../../../utils/nameFormatter';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import api from '../../../api';
import './ActivitySnapshotSummary.css';
import '../../dashboard/TeamLeaderboard.css'; // Reuse table styles

const ActivitySnapshotSummary = ({ dateRange, viewScope, userRole: propUserRole, user: propUser }) => {
  const { user: contextUser } = useContext(AuthContext);
  const user = propUser || contextUser;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAgents: 0,
    reportedAgents: 0,
    lastReportTime: null,
    agentMetrics: [],
    totals: {
      calls: 0,
      appts: 0,
      sits: 0,
      sales: 0,
      alp: 0,
      refs: 0
    }
  });

  const userRole = (propUserRole || user?.clname)?.toUpperCase();
  const showPersonalView = viewScope === 'personal';
  const isTeamLevel = ['SA', 'GA', 'MGA', 'RGA'].includes(userRole);
  
  // Sorting state for metrics table
  const [metricsSortColumn, setMetricsSortColumn] = useState('totalDays'); // 'totalDays', 'currentStreak', 'lastReport'
  const [metricsSortDirection, setMetricsSortDirection] = useState('desc'); // 'asc' or 'desc'

  // Handle metrics table sorting
  const handleMetricsSort = (column) => {
    if (metricsSortColumn === column) {
      setMetricsSortDirection(metricsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setMetricsSortColumn(column);
      setMetricsSortDirection('desc');
    }
  };

  // Sort agent metrics based on current sort settings
  const sortedAgentMetrics = React.useMemo(() => {
    if (!stats.agentMetrics || stats.agentMetrics.length === 0) return [];
    
    return [...stats.agentMetrics].sort((a, b) => {
      let aValue, bValue;
      
      if (metricsSortColumn === 'totalDays') {
        aValue = a.totalDays;
        bValue = b.totalDays;
      } else if (metricsSortColumn === 'currentStreak') {
        // For streak, prefer current streak, then longest streak
        aValue = a.currentStreak > 0 ? a.currentStreak : a.longestStreak;
        bValue = b.currentStreak > 0 ? b.currentStreak : b.longestStreak;
      } else if (metricsSortColumn === 'lastReport') {
        aValue = a.daysSinceReport;
        bValue = b.daysSinceReport;
      }
      
      if (metricsSortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }, [stats.agentMetrics, metricsSortColumn, metricsSortDirection]);

  const reportingPercentage = stats.totalAgents > 0 
    ? Math.round((stats.reportedAgents / stats.totalAgents) * 100)
    : 0;

  useEffect(() => {
    if (dateRange?.start && dateRange?.end && user?.userId) {
      if (showPersonalView || !isTeamLevel) {
        fetchPersonalStats();
      } else {
        fetchTeamStats();
      }
    }
  }, [dateRange, user?.userId, isTeamLevel, showPersonalView, viewScope]);

  const fetchTeamStats = async () => {
    try {
      setLoading(true);

      // Fetch hierarchy to get total agent count
      const [hierRes, actRes] = await Promise.all([
        api.post('/auth/searchByUserIdLite', { userId: user.userId }),
        api.get('/dailyActivity/all')
      ]);

      if (!hierRes.data?.success) {
        throw new Error('Failed to fetch hierarchy');
      }

      const hierarchyUsers = hierRes.data.data || [];
      
      // Filter agents based on viewScope
      let agents;
      
      if (userRole === 'RGA') {
        if (viewScope === 'mga') {
          // MGA view: Show only direct MGA team (same as if user was an MGA)
          // This is the user's direct downline (excluding other MGAs)
          agents = hierarchyUsers.filter(u => {
            const role = String(u.clname || '').toUpperCase();
            const userMGA = String(u.mga || '').toUpperCase();
            const currentUserName = String(user.lagnname || '').toUpperCase();
            
            // Include AGTs, SAs, GAs that have this RGA's name as their MGA
            return ['AGT', 'SA', 'GA'].includes(role) && userMGA === currentUserName;
          });
        } else if (viewScope === 'rga') {
          // RGA view: Show all agents under all MGAs in hierarchy
          agents = hierarchyUsers.filter(u => {
            const role = String(u.clname || '').toUpperCase();
            return ['AGT', 'SA', 'GA'].includes(role);
          });
        } else {
          // Default team view for RGA
          agents = hierarchyUsers.filter(u => {
            const role = String(u.clname || '').toUpperCase();
            return ['AGT', 'SA', 'GA'].includes(role);
          });
        }
      } else {
        // For SA, GA, MGA: show their direct team
        agents = hierarchyUsers.filter(u => {
          const role = String(u.clname || '').toUpperCase();
          return ['AGT', 'SA', 'GA'].includes(role);
        });
      }

      const totalAgents = agents.length;

      // Get set of hierarchy userIds (from activeusers.id)
      // The field is 'id' not 'userId' from searchByUserIdLite
      // Normalize to numbers to handle type mismatches
      const hierarchyUserIds = new Set(
        agents
          .map(a => a.id)  // Changed from a.userId to a.id
          .filter(id => id != null)
          .map(id => parseInt(id))
          .filter(id => !isNaN(id))
      );

      // Get all activity data
      const allActivity = actRes.data?.data || [];

      // Filter activity within date range (for reporting percentage calculation)
      const startDate = new Date(dateRange.start + 'T00:00:00');
      const endDate = new Date(dateRange.end + 'T23:59:59');
      
      const filteredActivity = allActivity.filter(a => {
        const activityDate = new Date(a.reportDate);
        return activityDate >= startDate && activityDate <= endDate;
      });

      // Count unique userIds from filtered date range (for reporting percentage)
      const reportedUserIdsInRange = new Set();
      filteredActivity.forEach(a => {
        const activityUserId = a.userId ? parseInt(a.userId) : null;
        if (activityUserId && hierarchyUserIds.has(activityUserId)) {
          reportedUserIdsInRange.add(activityUserId);
        }
      });

      // For metrics columns, use ALL activity data (not filtered by date range)
      let lastReportDate = null;
      const allUserActivityMap = new Map(); // userId -> Set of dates (all time)

      allActivity.forEach(a => {
        // Normalize userId to number for comparison
        const activityUserId = a.userId ? parseInt(a.userId) : null;
        
        // Only count if userId exists and is in our hierarchy
        if (activityUserId && hierarchyUserIds.has(activityUserId)) {
          // Track dates for metrics calculation (all time)
          if (!allUserActivityMap.has(activityUserId)) {
            allUserActivityMap.set(activityUserId, new Set());
          }
          const dateStr = new Date(a.reportDate).toISOString().split('T')[0];
          allUserActivityMap.get(activityUserId).add(dateStr);

          // Track most recent report (all time)
          const reportDate = new Date(a.reportDate);
          if (!lastReportDate || reportDate > lastReportDate) {
            lastReportDate = reportDate;
          }
        }
      });

      // Count = unique userIds from Daily_Activity that match hierarchy in date range
      const reportedCount = reportedUserIdsInRange.size;

      // Calculate reporting metrics for all agents (using all-time data)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const agentMetrics = agents.map(agent => {
        const agentId = parseInt(agent.id);
        const agentName = agent.lagnname || 'Unknown';
        const agentDisplayName = NameFormats.FIRST_LAST_SUFFIX(agentName);
        const agentProfpic = agent.profpic || null;
        const activityDates = allUserActivityMap.get(agentId);

        if (!activityDates || activityDates.size === 0) {
          // Agent hasn't reported at all in the period
        return {
          id: agentId,
          name: agentName,
          displayName: agentDisplayName,
          profpic: agentProfpic,
          totalDays: 0,
          currentStreak: 0,
          longestStreak: 0,
          isStreakActive: false,
          daysSinceReport: Infinity, // No reports ever
          lastReportDisplay: 'No reports'
        };
        }

        // Total days reported
        const totalDays = activityDates.size;

        // Calculate current streak (consecutive days from today going backward)
        let currentStreak = 0;
        let checkDate = new Date(today);
        
        while (currentStreak < 365) { // Max 1 year back
          const dateStr = checkDate.toISOString().split('T')[0];
          if (activityDates.has(dateStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        // Calculate longest streak ever
        const sortedDates = Array.from(activityDates).sort();
        let longestStreak = 0;
        let tempStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00');
          const currDate = new Date(sortedDates[i] + 'T00:00:00');
          const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

          if (dayDiff === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        // Days since last report
        const lastReportDate = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00');
        const daysSince = Math.floor((today - lastReportDate) / (1000 * 60 * 60 * 24));
        
        let lastReportDisplay;
        if (daysSince === 0) {
          lastReportDisplay = 'Today';
        } else if (daysSince === 1) {
          lastReportDisplay = 'Yesterday';
        } else {
          lastReportDisplay = `${daysSince} days ago`;
        }

        return {
          id: agentId,
          name: agentName,
          displayName: agentDisplayName,
          profpic: agentProfpic,
          totalDays,
          currentStreak,
          longestStreak,
          isStreakActive: currentStreak > 0,
          daysSinceReport: daysSince,
          lastReportDisplay
        };
      });

      // Return unsorted metrics - will be sorted in the component based on user selection
      const allAgentMetrics = agentMetrics;

      // Calculate totals
      const totals = filteredActivity.reduce((acc, a) => {
        acc.calls += parseInt(a.calls) || 0;
        acc.appts += parseInt(a.appts) || 0;
        acc.sits += parseInt(a.sits) || 0;
        acc.sales += parseInt(a.sales) || 0;
        acc.alp += parseFloat(a.alp) || 0;
        acc.refs += parseInt(a.refs) || 0;
        return acc;
      }, {
        calls: 0,
        appts: 0,
        sits: 0,
        sales: 0,
        alp: 0,
        refs: 0
      });

      setStats({
        totalAgents,
        reportedAgents: reportedCount,
        lastReportTime: lastReportDate,
        agentMetrics: allAgentMetrics,
        totals
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonalStats = async () => {
    try {
      setLoading(true);

      const response = await api.get(
        `/dailyActivity/user-summary?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      
      const result = response.data;

      if (result.success && Array.isArray(result.data)) {
        // Calculate totals
        const totals = result.data.reduce((acc, a) => {
          acc.calls += parseInt(a.calls) || 0;
          acc.appts += parseInt(a.appts) || 0;
          acc.sits += parseInt(a.sits) || 0;
          acc.sales += parseInt(a.sales) || 0;
          acc.alp += parseFloat(a.alp) || 0;
          acc.refs += parseInt(a.refs) || 0;
          return acc;
        }, {
          calls: 0,
          appts: 0,
          sits: 0,
          sales: 0,
          alp: 0,
          refs: 0
        });

        // Find most recent report
        let lastReportDate = null;
        result.data.forEach(a => {
          if (a.reportDate) {
            const reportDate = new Date(a.reportDate);
            if (!lastReportDate || reportDate > lastReportDate) {
              lastReportDate = reportDate;
            }
          }
        });

        const daysWithActivity = result.data.filter(a => 
          a.calls || a.appts || a.sits || a.sales || a.alp || a.refs
        ).length;

        setStats({
          totalAgents: 1, // Personal view
          reportedAgents: daysWithActivity > 0 ? 1 : 0,
          lastReportTime: lastReportDate,
          agentMetrics: [],
          totals
        });
      }
    } catch (error) {
      console.error('Error fetching personal stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="activity-snapshot-summary loading">
        <div className="loading-spinner"></div>
        <p>Loading activity summary...</p>
      </div>
    );
  }

  return (
    <div className="activity-snapshot-summary">
      <div className="summary-cards">
        {/* Agent Reporting Card - Compact */}
        {isTeamLevel && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Agent Reporting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="reporting-stat">
                <div className="stat-value">
                  {stats.reportedAgents}/{stats.totalAgents}
                </div>
                <div className="stat-label">Agents Reported</div>
              </div>
              <div className="reporting-bar">
                <div 
                  className="reporting-progress"
                  style={{ width: `${reportingPercentage}%` }}
                ></div>
              </div>
              <div className="reporting-percentage">{reportingPercentage}% reporting rate</div>
            </CardContent>
          </Card>
        )}

        {/* Activity Totals Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Period Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="totals-grid">
              <div className="total-item">
                <FiPhone className="total-icon" />
                <div className="total-label">Calls</div>
                <div className="total-value">{formatNumber(stats.totals.calls)}</div>
              </div>
              <div className="total-item">
                <FiCalendar className="total-icon" />
                <div className="total-label">Appts</div>
                <div className="total-value">{formatNumber(stats.totals.appts)}</div>
              </div>
              <div className="total-item">
                <FiUsers className="total-icon" />
                <div className="total-label">Sits</div>
                <div className="total-value">{formatNumber(stats.totals.sits)}</div>
              </div>
              <div className="total-item">
                <FiAward className="total-icon" />
                <div className="total-label">Sales</div>
                <div className="total-value">{formatNumber(stats.totals.sales)}</div>
              </div>
              <div className="total-item">
                <FiDollarSign className="total-icon" />
                <div className="total-label">ALP</div>
                <div className="total-value">{formatCurrency(stats.totals.alp)}</div>
              </div>
              <div className="total-item">
                <FiUsers className="total-icon" />
                <div className="total-label">Refs</div>
                <div className="total-value">{formatNumber(stats.totals.refs)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <button 
              className="btn btn-primary btn-block"
              onClick={() => window.location.href = '/production?section=activity-goals'}
            >
              View Full Report
            </button>
            {isTeamLevel && (
              <button 
                className="btn btn-outline-secondary btn-block"
                style={{ marginTop: '0.5rem' }}
                onClick={() => window.location.href = '/production?section=leaderboard'}
              >
                View Leaderboard
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Metrics Card - 2/5 Width */}
      {isTeamLevel && (
        <div className="summary-cards-bottom">
          <Card className="bg-card border-border agent-metrics-card">
            <CardHeader>
              <CardTitle className="text-lg">Agent Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full team-leaderboard-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">
                        Agent
                      </th>
                      <th 
                        className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => handleMetricsSort('totalDays')}
                        title="Click to sort by Total Days Reported"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Total Days</span>
                          {metricsSortColumn === 'totalDays' && (
                            metricsSortDirection === 'desc' ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 14l5-5 5 5H7z" fill="currentColor"/>
                              </svg>
                            )
                          )}
                        </div>
                      </th>
                      <th 
                        className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => handleMetricsSort('currentStreak')}
                        title="Click to sort by Reporting Streak"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Streak</span>
                          {metricsSortColumn === 'currentStreak' && (
                            metricsSortDirection === 'desc' ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 14l5-5 5 5H7z" fill="currentColor"/>
                              </svg>
                            )
                          )}
                        </div>
                      </th>
                      <th 
                        className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => handleMetricsSort('lastReport')}
                        title="Click to sort by Last Reported"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Last Reported</span>
                          {metricsSortColumn === 'lastReport' && (
                            metricsSortDirection === 'desc' ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 14l5-5 5 5H7z" fill="currentColor"/>
                              </svg>
                            )
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgentMetrics.map((agent) => {
                      const displayStreak = agent.currentStreak > 0 ? agent.currentStreak : agent.longestStreak;
                      const streakLabel = displayStreak === 1 ? 'day' : 'days';
                      
                      return (
                        <tr key={agent.id}>
                          <td className="py-3">
                            <div className="min-w-0 flex items-center gap-2">
                              {agent.profpic ? (
                                <img 
                                  src={agent.profpic} 
                                  alt={agent.displayName} 
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                                  {agent.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">
                                  {agent.displayName}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm font-bold text-foreground">
                              {agent.totalDays} {agent.totalDays === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={`text-sm font-bold ${
                              agent.isStreakActive ? 'text-green-500' : 
                              (displayStreak > 0 ? 'text-red-500' : 'text-muted-foreground')
                            }`}>
                              {displayStreak > 0 
                                ? `${displayStreak} ${streakLabel}${!agent.isStreakActive ? ' (prev)' : ''}` 
                                : 'No streak'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className={`text-sm font-bold ${
                              agent.daysSinceReport > 3 ? 'text-red-500' : 'text-foreground'
                            }`}>
                              {agent.lastReportDisplay}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ActivitySnapshotSummary;
