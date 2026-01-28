/**
 * Team Leaderboard Component
 * 
 */

import React, { useState, useRef } from 'react';
import { FiChevronDown, FiChevronRight, FiFilter } from 'react-icons/fi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
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

  // Debug logging
  React.useEffect(() => {
    console.log('🎯 [TeamLeaderboard] Component render:', {
      agentsCount: agents.length,
      loading,
      title,
      dateRange,
      sampleAgent: agents[0]
    });
  }, [agents, loading]);

  // Fetch list of users with Discord sales when filter is enabled
  React.useEffect(() => {
    const fetchUsersWithDiscordSales = async () => {
      if (!showDiscordOnly || !dateRange.start || !dateRange.end) {
        return;
      }

      setLoadingDiscordFilter(true);
      try {
        console.log('🔍 [TeamLeaderboard] Fetching users with Discord sales for date range:', dateRange);
        
        // Fetch all Discord sales for the date range
        const response = await api.get(`/discord/sales/all-users?startDate=${dateRange.start}&endDate=${dateRange.end}`);
        
        if (response.data.success && Array.isArray(response.data.data)) {
          // Extract unique user IDs
          const userIds = new Set(response.data.data.map(sale => sale.user_id).filter(id => id));
          console.log('📊 [TeamLeaderboard] Users with Discord sales:', userIds.size, 'users');
          setUsersWithDiscordSales(userIds);
        } else {
          setUsersWithDiscordSales(new Set());
        }
      } catch (error) {
        console.error('❌ [TeamLeaderboard] Error fetching Discord sales users:', error);
        setUsersWithDiscordSales(new Set());
      } finally {
        setLoadingDiscordFilter(false);
      }
    };

    fetchUsersWithDiscordSales();
  }, [showDiscordOnly, dateRange.start, dateRange.end]);

  // Format date range for display
  const getDateRangeText = () => {
    if (!dateRange || (!dateRange.start && !dateRange.end)) {
      return 'Top performing agents by total annual premium';
    }

    const formatShortDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    if (dateRange.start && dateRange.end) {
      return `Top performing agents by total annual premium (${formatShortDate(dateRange.start)} - ${formatShortDate(dateRange.end)})`;
    } else if (dateRange.start) {
      return `Top performing agents by total annual premium (from ${formatShortDate(dateRange.start)})`;
    } else if (dateRange.end) {
      return `Top performing agents by total annual premium (until ${formatShortDate(dateRange.end)})`;
    }

    return 'Top performing agents by total annual premium';
  };

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
          console.log('🔍 [TeamLeaderboard] Fetching discord sales for agent:', {
            userId: agent.userId,
            agentName: agent.agent_name,
            dateRange
          });

          try {
            const requestUrl = `/discord/sales/user-sales?startDate=${dateRange.start}&endDate=${dateRange.end}&userId=${agent.userId}`;
            const response = await api.get(requestUrl);
            
            console.log('📦 [TeamLeaderboard] Discord sales response:', response.data);

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

              console.log('📊 [TeamLeaderboard] Grouped discord sales:', groupedSales);

              setDiscordSalesData(prev => ({
                ...prev,
                [agentKey]: groupedSales
              }));
            }
          } catch (error) {
            console.error('❌ [TeamLeaderboard] Error fetching discord sales:', error);
          }
        }
      } catch (error) {
        console.error('Error loading agent details:', error);
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

  // Filter and sort agents based on Discord sales filter and sort settings
  const filteredAgents = React.useMemo(() => {
    let result = agents;
    
    // Apply Discord filter if active
    if (showDiscordOnly) {
      result = result.filter(agent => {
        const userId = agent.userId || agent.id;
        return usersWithDiscordSales.has(userId);
      });
    }
    
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
  }, [agents, showDiscordOnly, usersWithDiscordSales, sortColumn, sortDirection]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{getDateRangeText()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{getDateRangeText()}</CardDescription>
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
              <CardTitle>{title}</CardTitle>
              <CardDescription>{getDateRangeText()}</CardDescription>
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
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {getDateRangeText()}
              {showDiscordOnly && (
                <span className="ml-2 text-xs">
                  • Showing {filteredAgents.length} of {agents.length} agents
                </span>
              )}
            </CardDescription>
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
                {showGoals && (
                  <th className="hidden lg:table-cell pb-3 pt-0 text-right text-xs font-medium text-muted-foreground">
                    Goal Progress
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent, index) => {
                const agentKey = agent.id || agent.userId || agent.lagnname;
                const isExpanded = expandedAgentId === agentKey;
                const details = agentDetails[agentKey];

                return (
                  <React.Fragment key={agentKey}>
                    <tr
                      onClick={() => handleRowClick(agent)}
                      className="border-b border-border hover:bg-accent transition-colors cursor-pointer"
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
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {agent.agent_name}
                          </p>
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
                      <td className="hidden sm:table-cell py-3 text-right">
                        <span className="text-sm font-bold text-foreground">
                          {formatCurrency(agent.reported_alp || 0)}
                        </span>
                      </td>
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
                        <td colSpan={showGoals ? 6 : 5} className="px-4 py-6">
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
            </tbody>
          </table>
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

              {/* Active Filters Summary */}
              {showDiscordOnly && (
                <div style={{
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
            </div>

            {/* Clear All Filters Button */}
            {showDiscordOnly && (
              <div style={{ 
                marginTop: '0.75rem', 
                paddingTop: '0.75rem', 
                borderTop: '1px solid var(--border)' 
              }}>
                <button
                  onClick={() => {
                    setShowDiscordOnly(false);
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
  </> 
  );
};

export default TeamLeaderboard;
