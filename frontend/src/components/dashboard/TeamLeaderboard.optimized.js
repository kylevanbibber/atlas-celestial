/**
 * Team Leaderboard Component (Optimized)
 * 
 * Refactored to use smaller sub-components for better maintainability
 */

import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiFilter } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import api from '../../api';
import LeaderboardFilterMenu from './LeaderboardFilterMenu';
import DiscordSalesSummary from './DiscordSalesSummary';
import { formatCurrency } from '../../utils/dashboardHelpers';
import './TeamLeaderboard.css';

const TeamLeaderboard = ({
  agents = [],
  title = "Agent Leaderboard",
  dateRange = { start: '', end: '' },
  loading = false,
  onAgentClick = null,
  showDetails = true,
  showGoals = true,
  viewScope = null,
  currentUser = null,
  onLoadMore = null,
  hasMore = false,
  formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}) => {
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [agentDetails, setAgentDetails] = useState({});
  const [discordSalesData, setDiscordSalesData] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showDiscordOnly, setShowDiscordOnly] = useState(false);
  const [usersWithDiscordSales, setUsersWithDiscordSales] = useState(new Set());
  const [loadingDiscordFilter, setLoadingDiscordFilter] = useState(false);
  const [sortColumn, setSortColumn] = useState('official_alp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterButtonRef = useRef(null);
  const [displayCount, setDisplayCount] = useState(50);
  const loadMoreRef = useRef(null);
  const [goalFilter, setGoalFilter] = useState('all');

  const showReportedAlpColumn = viewScope !== 'mga' && viewScope !== 'rga';

  const tableColumnCount =
    4 + // Rank, Agent, MGA, Official ALP
    (showReportedAlpColumn ? 1 : 0) +
    (showGoals ? 1 : 0);

  const getDisplayTitle = () => {
    if (viewScope === 'personal') {
      return 'Personal Production';
    } else if (viewScope === 'mga') {
      return 'MGA Production Rankings';
    } else if (viewScope === 'rga') {
      return 'RGA Production Rankings';
    }
    return title;
  };

  const displayTitle = getDisplayTitle();

  // Calculate career stage based on ESID (same logic as HierarchyMGAUtilitiesTable)
  const calculateCareerStage = (esid) => {
    if (!esid) return { isF6: false, isVIPEligible: false, careerMonths: null };
    try {
      const esidDate = new Date(esid);
      if (isNaN(esidDate.getTime())) {
        return { isF6: false, isVIPEligible: false, careerMonths: null };
      }
      const currentDate = new Date();
      const yearDiff = currentDate.getFullYear() - esidDate.getFullYear();
      const monthDiff = currentDate.getMonth() - esidDate.getMonth();
      const totalMonthsDiff = (yearDiff * 12) + monthDiff;
      const isF6 = totalMonthsDiff < 6;
      const isVIPEligible = totalMonthsDiff >= 1 && totalMonthsDiff <= 3;
      return { isF6, isVIPEligible, careerMonths: totalMonthsDiff };
    } catch (error) {
      return { isF6: false, isVIPEligible: false, careerMonths: null };
    }
  };

  // Fetch list of users with Discord sales when filter is enabled
  React.useEffect(() => {
    const fetchUsersWithDiscordSales = async () => {
      if (!showDiscordOnly || !dateRange.start || !dateRange.end) {
        return;
      }

      setLoadingDiscordFilter(true);
      try {
        const response = await api.get(`/discord/sales/all-users?startDate=${dateRange.start}&endDate=${dateRange.end}`);
        
        if (response.data.success && Array.isArray(response.data.data)) {
          const userIds = new Set(response.data.data.map(sale => sale.user_id).filter(id => id));
          setUsersWithDiscordSales(userIds);
        } else {
          setUsersWithDiscordSales(new Set());
        }
      } catch (error) {
        setUsersWithDiscordSales(new Set());
      } finally {
        setLoadingDiscordFilter(false);
      }
    };

    fetchUsersWithDiscordSales();
  }, [showDiscordOnly, dateRange.start, dateRange.end]);

  const handleRowClick = async (agent) => {
    const agentKey = agent.id || agent.userId || agent.lagnname;
    
    if (expandedAgentId === agentKey) {
      setExpandedAgentId(null);
      return;
    }

    setExpandedAgentId(agentKey);
    
    if (showDetails && !agentDetails[agentKey]) {
      setLoadingDetails(true);
      try {
        let details = null;
        if (onAgentClick) {
          details = await onAgentClick(agent);
          setAgentDetails(prev => ({
            ...prev,
            [agentKey]: details
          }));
        }

        if (agent.userId && dateRange && dateRange.start && dateRange.end) {
          try {
            const requestUrl = `/discord/sales/user-sales?startDate=${dateRange.start}&endDate=${dateRange.end}&userId=${agent.userId}`;
            const response = await api.get(requestUrl);

            if (response.data.success && Array.isArray(response.data.data)) {
              const groupedSales = {};
              response.data.data.forEach(sale => {
                let dateKey;
                if (sale.sale_date) {
                  dateKey = sale.sale_date;
                } else if (sale.ts) {
                  dateKey = sale.ts.split(' ')[0];
                } else {
                  return;
                }

                if (!groupedSales[dateKey]) {
                  groupedSales[dateKey] = [];
                }
                groupedSales[dateKey].push(sale);
              });

              setDiscordSalesData(prev => ({
                ...prev,
                [agentKey]: groupedSales
              }));
            }
          } catch (error) {
            // Error fetching discord sales
          }
        }
      } catch (error) {
        // Error loading agent details
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const filteredAgents = React.useMemo(() => {
    let result = agents;
    
    if (showDiscordOnly) {
      result = result.filter(agent => {
        const userId = agent.userId || agent.id;
        return usersWithDiscordSales.has(userId);
      });
    }
    
    if (goalFilter === 'set') {
      result = result.filter(agent => agent.monthlyGoal && agent.monthlyGoal > 0);
    } else if (goalFilter === 'notset') {
      result = result.filter(agent => !agent.monthlyGoal || agent.monthlyGoal <= 0);
    }
    
    result = [...result].sort((a, b) => {
      let aValue, bValue;
      
      if (sortColumn === 'official_alp') {
        aValue = a.total_premium || 0;
        bValue = b.total_premium || 0;
      } else if (sortColumn === 'reported_alp') {
        aValue = a.reported_alp || 0;
        bValue = b.reported_alp || 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    return result;
  }, [agents, showDiscordOnly, usersWithDiscordSales, goalFilter, sortColumn, sortDirection]);

  useEffect(() => {
    setDisplayCount(50);
  }, [agents, showDiscordOnly, goalFilter, sortColumn, sortDirection]);

  useEffect(() => {
    if (!showReportedAlpColumn && sortColumn === 'reported_alp') {
      setSortColumn('official_alp');
      setSortDirection('desc');
    }
  }, [showReportedAlpColumn, sortColumn]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    const hasMoreToShow = onLoadMore ? hasMore : displayCount < filteredAgents.length;
    
    if (!currentRef || !hasMoreToShow) {
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          if (onLoadMore) {
            onLoadMore();
          } else {
            setDisplayCount(prev => Math.min(prev + 50, filteredAgents.length));
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [displayCount, filteredAgents.length, onLoadMore, hasMore, loading]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{displayTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-24" />
            </div>

            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-3 items-center border-b border-border pb-3"
                >
                  <Skeleton className="h-4 col-span-1" />
                  <Skeleton className="h-4 col-span-5" />
                  <Skeleton className="h-4 col-span-2 hidden md:block" />
                  <Skeleton className="h-4 col-span-3 md:col-span-2 justify-self-end" />
                  <Skeleton className="h-4 col-span-3 hidden sm:block justify-self-end" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{displayTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No performance data available
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showDiscordOnly && filteredAgents.length === 0 && !loadingDiscordFilter) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{displayTitle}</CardTitle>
            </div>
            <button
              onClick={() => setShowDiscordOnly(false)}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="Show all agents"
            >
              <span className="flex items-center gap-2">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M3 6h18M3 12h18M3 18h18" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M9 11l3 3 8-8" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                Discord Only
              </span>
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No agents with Discord sales found for this date range.
            <button
              onClick={() => setShowDiscordOnly(false)}
              className="block mx-auto mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/80 transition-colors"
            >
              Clear Filter
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{displayTitle}</CardTitle>
          </div>
          <button
            ref={filterButtonRef}
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              showDiscordOnly || isFilterMenuOpen
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-accent text-accent-foreground hover:bg-accent/80'
            }`}
            title="Filter options"
          >
            <span className="flex items-center gap-2">
              <FiFilter className="h-4 w-4" />
              <span>Filter</span>
              {showDiscordOnly && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-primary-foreground text-primary">
                  1
                </span>
              )}
            </span>
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full team-leaderboard-table">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">
                  Rank
                </th>
                <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">
                  Agent
                </th>
                <th className="hidden md:table-cell pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">
                  MGA
                </th>
                <th 
                  className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort('official_alp')}
                  title="Click to sort by Official ALP"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Official ALP</span>
                    {sortColumn === 'official_alp' && (
                      sortDirection === 'desc' ? (
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
                {!showReportedAlpColumn ? null : (
                  <th 
                    className="hidden sm:table-cell pb-3 pt-0 text-right text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('reported_alp')}
                    title="Click to sort by Reported ALP"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Reported ALP</span>
                      {sortColumn === 'reported_alp' && (
                        sortDirection === 'desc' ? (
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
                )}
                {showGoals && (
                  <th className="hidden lg:table-cell pb-3 pt-0 text-right text-xs font-medium text-muted-foreground">
                    Goal Progress
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAgents.slice(0, displayCount).map((agent, index) => {
                const agentKey = agent.id || agent.userId || agent.lagnname;
                const isExpanded = expandedAgentId === agentKey;
                
                const isCurrentUser = currentUser && agent.userId && (
                  agent.userId === currentUser.userId ||
                  agent.userId === currentUser.id ||
                  agent.lagnname === currentUser.lagnname
                );

                return (
                  <React.Fragment key={agentKey}>
                    <tr
                      onClick={() => handleRowClick(agent)}
                      className={`border-b border-border hover:bg-accent transition-colors cursor-pointer ${
                        isCurrentUser ? 'bg-primary/10 hover:bg-primary/15' : ''
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {isExpanded ? (
                            <FiChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <FiChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span
                            className={`text-sm font-bold ${
                              index === 0
                                ? 'text-yellow-500'
                                : index === 1
                                ? 'text-gray-400'
                                : index === 2
                                ? 'text-orange-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            #{index + 1}
                          </span>
                          {index === 0 && <span className="text-sm">🏆</span>}
                          {index === 1 && <span className="text-sm">🥈</span>}
                          {index === 2 && <span className="text-sm">🥉</span>}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="min-w-0 flex items-center gap-2">
                          {agent.profile_picture ? (
                            <img 
                              src={agent.profile_picture} 
                              alt={agent.agent_name}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          {!agent.profile_picture && (
                            <div 
                              className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0"
                              style={{ display: agent.profile_picture ? 'none' : 'flex' }}
                            >
                              {agent.agent_name ? agent.agent_name.charAt(0).toUpperCase() : '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {agent.agent_name}
                              </p>
                              {/* F6 Badge - show if agent is within first 6 months */}
                              {(() => {
                                const { isF6 } = calculateCareerStage(agent.esid);
                                if (isF6) {
                                  return (
                                    <span 
                                      className="status-badge f6"
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        backgroundColor: '#fbbf24',
                                        color: '#78350f',
                                        border: '1px solid #f59e0b',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title="First 6 months"
                                    >
                                      F6
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          <p className="md:hidden text-xs text-muted-foreground mt-1">
                            {agent.mga_name ? (
                              <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">
                                {agent.mga_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </p>
                          {showGoals && agent.monthlyGoal && (
                            <div className="lg:hidden mt-1 flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Goal:</span>
                              <span className={`text-xs font-medium ${
                                agent.goalProgress >= 100 ? 'text-green-500' :
                                agent.goalProgress >= 75 ? 'text-blue-500' :
                                agent.goalProgress >= 50 ? 'text-yellow-500' :
                                'text-red-500'
                              }`}>
                                {agent.goalProgress}%
                              </span>
                            </div>
                          )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell py-3">
                        {agent.mga_name ? (
                          <span className="px-2 py-1 bg-primary/20 text-primary rounded-md text-xs">
                            {agent.mga_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(agent.total_premium || 0)}
                        </span>
                      </td>
                      {showReportedAlpColumn && (
                        <td className="hidden sm:table-cell py-3 text-right">
                          <span className="text-sm font-bold text-foreground">
                            {formatCurrency(agent.reported_alp || 0)}
                          </span>
                        </td>
                      )}
                      {showGoals && (
                        <td className="hidden lg:table-cell py-3 text-right">
                          {agent.monthlyGoal ? (
                            <div className="flex flex-col items-end gap-1">
                              {agent.total_premium > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${
                                        agent.goalProgress >= 100 ? 'bg-green-500' :
                                        agent.goalProgress >= 75 ? 'bg-blue-500' :
                                        agent.goalProgress >= 50 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(agent.goalProgress, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    agent.goalProgress >= 100 ? 'text-green-500' :
                                    agent.goalProgress >= 75 ? 'text-blue-500' :
                                    agent.goalProgress >= 50 ? 'text-yellow-500' :
                                    'text-red-500'
                                  }`}>
                                    {agent.goalProgress}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No production</span>
                              )}
                              <div className="w-full">
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(agent.monthlyGoal)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      )}
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-accent/50">
                        <td colSpan={tableColumnCount} className="px-4 py-6">
                          {loadingDetails ? (
                            <div className="text-center py-4">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                              <p className="mt-2 text-sm text-muted-foreground">Loading details...</p>
                            </div>
                          ) : (
                            <div className="space-y-4 sm:space-y-6">
                              <DiscordSalesSummary 
                                discordSalesData={discordSalesData} 
                                agentKey={agentKey} 
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {(onLoadMore ? hasMore : displayCount < filteredAgents.length) && (
                <tr ref={loadMoreRef}>
                  <td colSpan={tableColumnCount} style={{ height: '1px', padding: 0 }}></td>
                </tr>
              )}
            </tbody>
          </table>
          
          {(onLoadMore ? hasMore : displayCount < filteredAgents.length) && (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">
                {onLoadMore ? (
                  loading ? 'Loading more agents...' : `Showing ${filteredAgents.length} agents`
                ) : (
                  `Showing ${displayCount} of ${filteredAgents.length} agents`
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Filter Menu Dropdown */}
    <LeaderboardFilterMenu
      isFilterMenuOpen={isFilterMenuOpen}
      setIsFilterMenuOpen={setIsFilterMenuOpen}
      filterButtonRef={filterButtonRef}
      showDiscordOnly={showDiscordOnly}
      setShowDiscordOnly={setShowDiscordOnly}
      loadingDiscordFilter={loadingDiscordFilter}
      goalFilter={goalFilter}
      setGoalFilter={setGoalFilter}
      filteredAgentsCount={filteredAgents.length}
      totalAgentsCount={agents.length}
    />
  </> 
  );
};

export default TeamLeaderboard;
