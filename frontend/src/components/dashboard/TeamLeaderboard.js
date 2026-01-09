/**
 * Team Leaderboard Component
 * 
 */

import React, { useState } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import './TeamLeaderboard.css';

const TeamLeaderboard = ({
  agents = [],
  title = "Agent Leaderboard",
  dateRange = { start: '', end: '' },
  loading = false,
  onAgentClick = null,
  showDetails = true,
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
  const [loadingDetails, setLoadingDetails] = useState(false);

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
    if (showDetails && !agentDetails[agentKey] && onAgentClick) {
      setLoadingDetails(true);
      try {
        const details = await onAgentClick(agent);
        setAgentDetails(prev => ({
          ...prev,
          [agentKey]: details
        }));
      } catch (error) {
        console.error('Error loading agent details:', error);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

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

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{getDateRangeText()}</CardDescription>
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
                <th className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground">
                  Premium
                </th>
                <th className="hidden lg:table-cell pb-3 pt-0 text-right text-xs font-medium text-muted-foreground">
                  Goal Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, index) => {
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
                          {agent.monthlyGoal && (
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
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-accent/50">
                        <td colSpan={5} className="px-4 py-6">
                          {loadingDetails ? (
                            <div className="text-center py-4">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                              <p className="mt-2 text-sm text-muted-foreground">Loading details...</p>
                            </div>
                          ) : details ? (
                            <div className="space-y-4 sm:space-y-6">
                              {/* Goal Summary - Show if goal exists */}
                              {agent.monthlyGoal && (
                                <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs sm:text-sm text-muted-foreground">Monthly Goal Progress</p>
                                    <span className={`text-sm font-bold ${
                                      agent.goalProgress >= 100 ? 'text-green-500' :
                                      agent.goalProgress >= 75 ? 'text-blue-500' :
                                      agent.goalProgress >= 50 ? 'text-yellow-500' :
                                      'text-red-500'
                                    }`}>
                                      {agent.goalProgress}%
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3 mt-3">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Goal</p>
                                      <p className="text-sm font-semibold text-foreground">
                                        {formatCurrency(agent.monthlyGoal)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Achieved</p>
                                      <p className="text-sm font-semibold text-foreground">
                                        {formatCurrency(agent.total_premium)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Remaining</p>
                                      <p className="text-sm font-semibold text-foreground">
                                        {formatCurrency(agent.goalRemaining || 0)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3 h-3 bg-border rounded-full overflow-hidden">
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
                                </div>
                              )}
                              
                              {/* Summary Cards */}
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                                <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Total Policies</p>
                                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                                    {details.total_policies || agent.policy_count || 0}
                                  </p>
                                </div>
                                <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Total Premium</p>
                                  <p className="text-xl sm:text-2xl font-bold text-primary">
                                    {formatCurrency(details.total_premium || agent.total_premium || 0)}
                                  </p>
                                </div>
                                <div className="bg-background p-3 sm:p-4 rounded-lg border border-border col-span-2 lg:col-span-1">
                                  <p className="text-xs sm:text-sm text-muted-foreground">Average AP</p>
                                  <p className="text-xl sm:text-2xl font-bold text-green-600">
                                    {formatCurrency(details.average_premium || 0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">Per policy</p>
                                </div>
                              </div>

                              {/* Breakdown Section */}
                              {(details.by_type || details.by_carrier || details.by_lead) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                  {details.by_type && details.by_type.length > 0 && (
                                    <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                      <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">By Insurance Type</h4>
                                      <div className="space-y-1.5 sm:space-y-2">
                                        {details.by_type.map((item, i) => (
                                          <div key={i} className="flex justify-between text-xs sm:text-sm gap-2">
                                            <span className="text-muted-foreground truncate">
                                              {item.type || item.insurance_type || 'Unknown'}
                                            </span>
                                            <span className="font-medium whitespace-nowrap">
                                              {formatCurrency(item.premium || item.total_premium || 0)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {details.by_carrier && details.by_carrier.length > 0 && (
                                    <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                      <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">By Carrier</h4>
                                      <div className="space-y-1.5 sm:space-y-2">
                                        {details.by_carrier.map((item, i) => (
                                          <div key={i} className="flex justify-between text-xs sm:text-sm gap-2">
                                            <span className="text-muted-foreground truncate">
                                              {item.carrier || 'Unknown'}
                                            </span>
                                            <span className="font-medium whitespace-nowrap">
                                              {formatCurrency(item.premium || item.total_premium || 0)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {details.by_lead && details.by_lead.length > 0 && (
                                    <div className="bg-background p-3 sm:p-4 rounded-lg border border-border">
                                      <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">By Lead Type</h4>
                                      <div className="space-y-1.5 sm:space-y-2">
                                        {details.by_lead.map((item, i) => (
                                          <div key={i} className="flex justify-between text-xs sm:text-sm gap-2">
                                            <span className="text-muted-foreground truncate">
                                              {item.lead_type || 'Unknown'}
                                            </span>
                                            <span className="font-medium whitespace-nowrap">
                                              {formatCurrency(item.premium || item.total_premium || 0)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">
                              Failed to load details
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
  );
};

export default TeamLeaderboard;
