/**
 * Team Leaderboard Component
 * 
 */

import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiChevronRight, FiFilter, FiSearch, FiX } from 'react-icons/fi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import AgentProfile from '../utils/AgentProfile';
import api from '../../api';
import './TeamLeaderboard.css';

const TeamLeaderboard = ({
  agents = [],
  title = "Agent Leaderboard",
  dateRange = { start: '', end: '' },
  loading = false,
  onAgentClick = null,
  showDetails = true,
  showGoals = true,
  viewScope = null, // 'personal', 'mga', 'rga', 'team'
  currentUser = null, // The currently logged in user
  onLoadMore = null, // Function to load more paginated data
  hasMore = false, // Whether there's more data to load
  formatCurrency = (val) => new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 0 
  }).format(val),
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
  const [sortColumn, setSortColumn] = useState('official_alp'); // 'official_alp' or 'reported_alp'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterButtonRef = useRef(null);
  const [displayCount, setDisplayCount] = useState(50); // Start showing 50 items
  const loadMoreRef = useRef(null); // Ref for intersection observer
  const [selectedAgentProfile, setSelectedAgentProfile] = useState(null); // For AgentProfile modal
  const [goalFilter, setGoalFilter] = useState('all'); // 'all', 'set', 'notset'
  const [searchQuery, setSearchQuery] = useState('');

  // Temporarily hide Reported ALP for MGA/RGA scopes (per request)
  const showReportedAlpColumn = viewScope !== 'mga' && viewScope !== 'rga';

  const tableColumnCount =
    4 + // Rank, Agent, MGA, Official ALP
    (showReportedAlpColumn ? 1 : 0) +
    (showGoals ? 1 : 0);

  // Determine the display title based on viewScope
  const getDisplayTitle = () => {
    if (viewScope === 'personal') {
      return 'Personal Production';
    } else if (viewScope === 'mga') {
      return 'MGA Production Rankings';
    } else if (viewScope === 'rga') {
      return 'RGA Production Rankings';
    }
    // Default to the provided title prop
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

  // Handle opening agent profile
  const handleOpenAgentProfile = async (agent) => {
    try {
      // Fetch full agent data from backend
      const response = await api.get(`/users/profile/${agent.lagnname}`);
      if (response.data && response.data.success) {
        setSelectedAgentProfile(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching agent profile:', error);
      // If API fails, use what we have from the leaderboard
      setSelectedAgentProfile({
        id: agent.id || agent.userId,
        lagnname: agent.lagnname,
        agent_name: agent.agent_name,
        email: agent.email,
        profpic: agent.profile_picture,
        esid: agent.esid,
        clname: currentUser?.clname || 'AGT', // Fallback
        managerActive: 'y' // Assume active if in leaderboard
      });
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
        // Fetch all Discord sales for the date range
        const response = await api.get(`/discord/sales/all-users?startDate=${dateRange.start}&endDate=${dateRange.end}`);
        
        if (response.data.success && Array.isArray(response.data.data)) {
          // Extract unique user IDs
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
    
    // If clicking the same row, collapse it
    if (expandedAgentId === agentKey) {
      setExpandedAgentId(null);
      return;
    }

    // Expand new row
    setExpandedAgentId(agentKey);
    
    // Load details if not already loaded
    if (showDetails && !agentDetails[agentKey]) {
      setLoadingDetails(true);
      try {
        // Fetch agent details from callback if provided
        let details = null;
        if (onAgentClick) {
          details = await onAgentClick(agent);
          setAgentDetails(prev => ({
            ...prev,
            [agentKey]: details
          }));
        }

        // Fetch discord sales data if we have userId and date range
        if (agent.userId && dateRange && dateRange.start && dateRange.end) {
          try {
            const requestUrl = `/discord/sales/user-sales?startDate=${dateRange.start}&endDate=${dateRange.end}&userId=${agent.userId}`;
            const response = await api.get(requestUrl);

            if (response.data.success && Array.isArray(response.data.data)) {
              // Group sales by date
              const groupedSales = {};
              response.data.data.forEach(sale => {
                // Handle both sale_date (if provided by API) or extract from ts
                let dateKey;
                if (sale.sale_date) {
                  dateKey = sale.sale_date;
                } else if (sale.ts) {
                  // Extract date from timestamp (YYYY-MM-DD)
                  dateKey = sale.ts.split(' ')[0];
                } else {
                  return; // Skip if no date information
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

  // Handle sort column change
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filter and sort agents based on Discord sales filter, goal filter, and sort settings
  const filteredAgents = React.useMemo(() => {
    let result = agents;

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(agent => {
        const name = (agent.agent_name || agent.lagnname || '').toLowerCase();
        const mga = (agent.mga_name || '').toLowerCase();
        return name.includes(q) || mga.includes(q);
      });
    }

    // Apply Discord filter if active
    if (showDiscordOnly) {
      result = result.filter(agent => {
        const userId = agent.userId || agent.id;
        return usersWithDiscordSales.has(userId);
      });
    }

    // Apply goal filter
    if (goalFilter === 'set') {
      result = result.filter(agent => agent.monthlyGoal && agent.monthlyGoal > 0);
    } else if (goalFilter === 'notset') {
      result = result.filter(agent => !agent.monthlyGoal || agent.monthlyGoal <= 0);
    }
    // If goalFilter === 'all', don't filter anything

    // Apply sorting
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
  }, [agents, searchQuery, showDiscordOnly, usersWithDiscordSales, goalFilter, sortColumn, sortDirection]);

  // Reset display count when agents or filters change
  useEffect(() => {
    setDisplayCount(50);
  }, [agents, searchQuery, showDiscordOnly, goalFilter, sortColumn, sortDirection]);

  // If Reported ALP column is hidden, ensure we aren't sorted by it
  useEffect(() => {
    if (!showReportedAlpColumn && sortColumn === 'reported_alp') {
      setSortColumn('official_alp');
      setSortDirection('desc');
    }
  }, [showReportedAlpColumn, sortColumn]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const currentRef = loadMoreRef.current;
    
    // If using pagination (onLoadMore provided), check hasMore instead of displayCount
    // Otherwise, check if we've displayed all filtered agents
    const hasMoreToShow = onLoadMore ? hasMore : displayCount < filteredAgents.length;
    
    if (!currentRef || !hasMoreToShow) {
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        // When the load more element is visible and there are more items to show
        if (entries[0].isIntersecting && !loading) {
          if (onLoadMore) {
            // Call parent's load more function (for paginated backend fetching)
            onLoadMore();
          } else {
            // Just show more of the already-loaded agents (existing behavior)
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

  // Show message if filter is active but no results
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
          <div className="flex items-center gap-2">
            <div className="team-leaderboard-search-wrapper">
              <FiSearch className="team-leaderboard-search-icon" />
              <input
                type="text"
                className="team-leaderboard-search-input"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="team-leaderboard-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  <FiX />
                </button>
              )}
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
                {/*
                  Reported ALP column intentionally hidden for MGA/RGA scopes for now.
                  Keep in code for quick re-enable later.
                */}
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
                const details = agentDetails[agentKey];
                
                // Check if this is the current user's row
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
                          {/* Profile Picture or Placeholder */}
                          {agent.profile_picture ? (
                            <img 
                              src={agent.profile_picture} 
                              alt={agent.agent_name}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAgentProfile(agent);
                              }}
                              onError={(e) => {
                                // Show placeholder if image fails to load
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          {!agent.profile_picture && (
                            <div 
                              className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ display: agent.profile_picture ? 'none' : 'flex' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAgentProfile(agent);
                              }}
                            >
                              {agent.agent_name ? agent.agent_name.charAt(0).toUpperCase() : '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <p 
                                  className="font-semibold text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenAgentProfile(agent);
                                  }}
                                >
                                  {agent.agent_name}
                                </p>
                                {/* F6 Badge - show if agent is within first 6 months */}
                                {(() => {
                                  const { isF6 } = calculateCareerStage(agent.esid);
                                  if (isF6) {
                                    return (
                                      <span 
                                        className="status-badge f6"
                                        title="First 6 months"
                                      >
                                        F6
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          {/* Show MGA on mobile (hidden in column) */}
                          <p className="md:hidden text-xs text-muted-foreground mt-1">
                            {agent.mga_name ? (
                              <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs">
                                {agent.mga_name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </p>
                          {/* Show goal progress on mobile (hidden on lg+) */}
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
                              {/* Discord Sales Section - Show first if available */}
                              {(() => {
                                const agentDiscordSales = discordSalesData[agentKey];
                                if (agentDiscordSales && Object.keys(agentDiscordSales).length > 0) {
                                  // Calculate totals and group by lead type
                                  let totalSales = 0;
                                  let totalAlp = 0;
                                  let totalRefs = 0;
                                  const byLeadType = {};

                                  Object.values(agentDiscordSales).forEach(salesForDate => {
                                    salesForDate.forEach(sale => {
                                      totalSales += 1;
                                      const alp = parseFloat(sale.alp) || 0;
                                      const refs = parseInt(sale.refs) || 0;
                                      totalAlp += alp;
                                      totalRefs += refs;

                                      // Group by lead type
                                      const leadType = sale.lead_type || 'unknown';
                                      if (!byLeadType[leadType]) {
                                        byLeadType[leadType] = { count: 0, alp: 0, refs: 0 };
                                      }
                                      byLeadType[leadType].count += 1;
                                      byLeadType[leadType].alp += alp;
                                      byLeadType[leadType].refs += refs;
                                    });
                                  });

                                  const avgAlp = totalSales > 0 ? totalAlp / totalSales : 0;
                                  const avgRefs = totalSales > 0 ? totalRefs / totalSales : 0;

                                  // Sort lead types by ALP descending
                                  const leadTypeArray = Object.entries(byLeadType)
                                    .map(([type, data]) => ({ type, ...data }))
                                    .sort((a, b) => b.alp - a.alp);

                                  return (
                                    <>
                                      <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                        <h4 className="text-xs sm:text-sm font-semibold mb-3">Discord Sales Summary</h4>
                                        
                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-4">
                                          <div className="bg-accent/50 p-2 sm:p-3 rounded">
                                            <p className="text-xs text-muted-foreground">Total Sales</p>
                                            <p className="text-xl sm:text-2xl font-bold text-foreground">{totalSales}</p>
                                          </div>
                                          <div className="bg-accent/50 p-2 sm:p-3 rounded">
                                            <p className="text-xs text-muted-foreground">Total Premium</p>
                                            <p className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(totalAlp)}</p>
                                          </div>
                                          <div className="bg-accent/50 p-2 sm:p-3 rounded col-span-2 lg:col-span-1">
                                            <p className="text-xs text-muted-foreground">Average ALP</p>
                                            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(avgAlp)}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Per sale</p>
                                          </div>
                                        </div>

                                        {/* Refs Summary */}
                                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                          <div className="bg-accent/50 p-2 sm:p-3 rounded">
                                            <p className="text-xs text-muted-foreground">Total Refs</p>
                                            <p className="text-lg font-bold text-foreground">{totalRefs}</p>
                                          </div>
                                          <div className="bg-accent/50 p-2 sm:p-3 rounded">
                                            <p className="text-xs text-muted-foreground">Average Refs</p>
                                            <p className="text-lg font-bold text-foreground">{avgRefs.toFixed(2)}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Per sale</p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* By Lead Type Breakdown */}
                                      {leadTypeArray.length > 0 && (
                                        <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                          <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">By Lead Type</h4>
                                          <div className="space-y-1.5 sm:space-y-2">
                                            {leadTypeArray.map((item, i) => (
                                              <div key={i} className="flex items-center justify-between text-xs sm:text-sm gap-2 p-2 bg-accent/30 rounded">
                                                <span className="text-muted-foreground truncate flex-1">
                                                  <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-xs font-medium">
                                                    {item.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                  </span>
                                                </span>
                                                <div className="flex items-center gap-3 text-xs">
                                                  <span className="text-muted-foreground">
                                                    {item.count} sale{item.count !== 1 ? 's' : ''}
                                                  </span>
                                                  <span className="font-medium whitespace-nowrap text-foreground">
                                                    {formatCurrency(item.alp)}
                                                  </span>
                                                  <span className="text-muted-foreground">
                                                    {item.refs} ref{item.refs !== 1 ? 's' : ''}
                                                  </span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                }
                                // Show message when no discord sales data
                                return (
                                  <div className="bg-background p-4 rounded-lg border border-border text-center">
                                    <p className="text-sm text-muted-foreground">
                                      No sales reported through discord for this agent.
                                    </p>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* Intersection Observer Trigger - invisible row to trigger loading more */}
              {(onLoadMore ? hasMore : displayCount < filteredAgents.length) && (
                <tr ref={loadMoreRef}>
                  <td colSpan={tableColumnCount} style={{ height: '1px', padding: 0 }}></td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Loading indicator when loading more */}
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
    {isFilterMenuOpen && (
      <>
        {/* Backdrop */}
        <div
          className="team-leaderboard-filter-backdrop"
          onClick={() => setIsFilterMenuOpen(false)}
        />
        
        {/* Dropdown Panel */}
        <div
          className="team-leaderboard-filter-menu"
          style={{
            top: filterButtonRef.current ? filterButtonRef.current.getBoundingClientRect().bottom + 8 : 0,
            right: '1rem'
          }}
        >
          <div className="team-leaderboard-filter-menu-content">
            <h3 className="team-leaderboard-filter-title">
              Filter Options
            </h3>

            {/* Discord Sales Filter */}
            <div className="team-leaderboard-filter-options">
              <label className={`team-leaderboard-filter-option ${showDiscordOnly ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={showDiscordOnly}
                  onChange={(e) => setShowDiscordOnly(e.target.checked)}
                  disabled={loadingDiscordFilter}
                />
                <div className="team-leaderboard-filter-option-text">
                  <div className="team-leaderboard-filter-option-title">
                    Discord Sales Only
                  </div>
                  <div className="team-leaderboard-filter-option-description">
                    Show only agents with Discord sales
                  </div>
                </div>
                {loadingDiscordFilter && (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2" 
                       style={{ borderColor: 'var(--primary)' }}
                  />
                )}
              </label>
            </div>

            {/* Goal Filter */}
            <div style={{ 
              marginTop: '0.75rem', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid var(--border)' 
            }}>
              <div style={{ 
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--foreground)'
              }}>
                Goal Status
              </div>
              <div className="team-leaderboard-filter-options">
                <label className={`team-leaderboard-filter-option ${goalFilter === 'all' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="goalFilter"
                    checked={goalFilter === 'all'}
                    onChange={() => setGoalFilter('all')}
                  />
                  <div className="team-leaderboard-filter-option-text">
                    <div className="team-leaderboard-filter-option-title">
                      All Agents
                    </div>
                    <div className="team-leaderboard-filter-option-description">
                      Show all agents regardless of goal status
                    </div>
                  </div>
                </label>

                <label className={`team-leaderboard-filter-option ${goalFilter === 'set' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="goalFilter"
                    checked={goalFilter === 'set'}
                    onChange={() => setGoalFilter('set')}
                  />
                  <div className="team-leaderboard-filter-option-text">
                    <div className="team-leaderboard-filter-option-title">
                      Goal Set
                    </div>
                    <div className="team-leaderboard-filter-option-description">
                      Show only agents with goals set
                    </div>
                  </div>
                </label>

                <label className={`team-leaderboard-filter-option ${goalFilter === 'notset' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="goalFilter"
                    checked={goalFilter === 'notset'}
                    onChange={() => setGoalFilter('notset')}
                  />
                  <div className="team-leaderboard-filter-option-text">
                    <div className="team-leaderboard-filter-option-title">
                      No Goal
                    </div>
                    <div className="team-leaderboard-filter-option-description">
                      Show only agents without goals set
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Active Filters Summary */}
            {(showDiscordOnly || goalFilter !== 'all') && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                textAlign: 'center'
              }}>
                Showing {filteredAgents.length} of {agents.length} agents
              </div>
            )}

            {/* Clear All Filters Button */}
            {(showDiscordOnly || goalFilter !== 'all') && (
              <div style={{ 
                marginTop: '0.75rem', 
                paddingTop: '0.75rem', 
                borderTop: '1px solid var(--border)' 
              }}>
                <button
                  onClick={() => {
                    setShowDiscordOnly(false);
                    setGoalFilter('all');
                    setIsFilterMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    )}

    {/* Agent Profile Modal */}
    {selectedAgentProfile && (
      <AgentProfile
        data={selectedAgentProfile}
        onClose={() => setSelectedAgentProfile(null)}
      />
    )}
  </> 
  );
};

export default TeamLeaderboard;
