import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FiSearch, FiArrowLeft, FiArrowRight, FiUsers, FiUser, FiCheckCircle, FiClock, FiXCircle, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { debounce } from 'lodash';
import { useAuth } from "../../context/AuthContext";
import { useUserHierarchy } from "../../hooks/useUserHierarchy";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import api from "../../api";
import "../dashboard/TeamLeaderboard.css";

const RefSales = () => {
  const { user } = useAuth();
  const { hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const [tableData, setTableData] = useState([]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [monthOptions, setMonthOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState("mine");
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState(null);

  // Determine user hierarchy access
  const isAdmin = user?.Role === 'Admin';
  const isAppAdmin = isAdmin && user?.teamRole === 'app';
  const hasHierarchyAccess = useMemo(() => {
    const clname = (user?.clname || '').toUpperCase();
    return ['SA', 'GA', 'MGA', 'RGA'].includes(clname);
  }, [user?.clname]);

  // Get allowed IDs from cached hierarchy data
  const allowedIds = useMemo(() => {
    if (isAdmin || isAppAdmin) return [];
    if (hasHierarchyAccess) {
      const ids = getHierarchyForComponent('ids');
      const userId = user?.userId || user?.id;
      if (userId && !ids.includes(userId)) {
        return [...ids, userId];
      }
      return ids;
    }
    return [];
  }, [isAdmin, isAppAdmin, hasHierarchyAccess, getHierarchyForComponent, user?.userId, user?.id]);

  const allowedIdsSet = useMemo(() => new Set(allowedIds.map(id => String(id))), [allowedIds]);

  // Debounced search
  const debouncedSetSearch = useCallback(
    debounce((term) => {
      setDebouncedSearchTerm(term);
      setIsSearching(false);
    }, 150),
    []
  );

  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    }
    debouncedSetSearch(searchTerm);
    return () => debouncedSetSearch.cancel();
  }, [searchTerm, debouncedSearchTerm, debouncedSetSearch]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Fetch month options
  useEffect(() => {
    const fetchMonthOptions = async () => {
      try {
        const response = await api.get("/refvalidation/month-options");
        if (response.data.success) {
          setMonthOptions(response.data.data);
        }
      } catch (error) {
        console.error("RefSales - Error fetching month options:", error);
        setMonthOptions([{
          value: currentMonth,
          label: new Date(`${currentMonth}-01T00:00:00`).toLocaleDateString('default', { month: 'long', year: 'numeric' })
        }]);
      }
    };
    fetchMonthOptions();
  }, [currentMonth]);

  // Fetch refvalidation data
  useEffect(() => {
    if (!selectedMonth) return;
    if (hasHierarchyAccess && hierarchyLoading) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/refvalidation/all", {
          params: {
            month: selectedMonth,
            admin_name: "all",
            true_ref: "all"
          }
        });

        if (response.data.success) {
          setTableData(response.data.data);
        }
      } catch (error) {
        console.error("RefSales - Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, hasHierarchyAccess, hierarchyLoading]);

  // Filter data for "mine" vs "team" views
  const filteredData = useMemo(() => {
    const userId = user?.userId || user?.id;
    let filtered;

    if (viewMode === "mine") {
      filtered = tableData.filter(row => String(row.agent_id) === String(userId));
    } else {
      if (isAdmin || isAppAdmin) {
        filtered = tableData;
      } else if (hasHierarchyAccess && allowedIdsSet.size > 0) {
        filtered = tableData.filter(row => allowedIdsSet.has(String(row.agent_id)));
      } else {
        filtered = tableData.filter(row => String(row.agent_id) === String(userId));
      }
    }

    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        (row.lagnname || '').toLowerCase().includes(searchLower) ||
        (row.client_name || '').toLowerCase().includes(searchLower) ||
        (row.ref_detail || '').toLowerCase().includes(searchLower) ||
        (row.notes || '').toLowerCase().includes(searchLower) ||
        (row.zip_code || '').toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [tableData, viewMode, user, isAdmin, isAppAdmin, hasHierarchyAccess, allowedIdsSet, debouncedSearchTerm]);

  // Stats based on current view
  const stats = useMemo(() => {
    const totalSubmitted = filteredData.length;
    const trueRefs = filteredData.filter(row => row.true_ref === 'Y').length;
    const notTrueRefs = filteredData.filter(row => row.true_ref === 'N').length;
    const pending = filteredData.filter(row => !row.true_ref || row.true_ref === '').length;
    return { totalSubmitted, trueRefs, notTrueRefs, pending };
  }, [filteredData]);

  // Group by agent for team view
  const groupedByAgent = useMemo(() => {
    if (viewMode !== 'team') return [];

    const agentMap = {};
    filteredData.forEach(row => {
      const key = String(row.agent_id || 'unknown');
      if (!agentMap[key]) {
        agentMap[key] = {
          agentId: key,
          agentName: row.lagnname || 'Unknown',
          rows: [],
          trueRefs: 0,
          notTrueRefs: 0,
          pending: 0
        };
      }
      agentMap[key].rows.push(row);
      if (row.true_ref === 'Y') agentMap[key].trueRefs++;
      else if (row.true_ref === 'N') agentMap[key].notTrueRefs++;
      else agentMap[key].pending++;
    });

    return Object.values(agentMap).sort((a, b) => b.trueRefs - a.trueRefs);
  }, [filteredData, viewMode]);

  // Month navigation
  const goToPreviousMonth = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    if (currentIndex < monthOptions.length - 1) {
      setSelectedMonth(monthOptions[currentIndex + 1].value);
    }
  };

  const goToNextMonth = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    if (currentIndex > 0) {
      setSelectedMonth(monthOptions[currentIndex - 1].value);
    }
  };

  const canGoToPrevious = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    return currentIndex < monthOptions.length - 1;
  };

  const canGoToNext = () => {
    const currentIndex = monthOptions.findIndex(option => option.value === selectedMonth);
    return currentIndex > 0;
  };

  // Status badge
  const StatusBadge = ({ value }) => {
    if (value === 'Y') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <FiCheckCircle size={12} /> Approved
        </span>
      );
    }
    if (value === 'N') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <FiXCircle size={12} /> Not Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <FiClock size={12} /> Pending
      </span>
    );
  };

  // Flat table columns (mine view + expanded child rows)
  const flatColumnCount = 8;

  // Render a single ref detail row (used in both mine view and team expanded)
  const renderRefRow = (row, index) => (
    <tr
      key={row.id || row.uuid || index}
      className={`border-b border-border transition-colors ${
        row.true_ref === 'Y'
          ? 'bg-green-500/5 hover:bg-green-500/10'
          : row.true_ref === 'N'
            ? 'bg-red-500/5 hover:bg-red-500/10'
            : 'hover:bg-accent'
      }`}
    >
      <td className="py-3">
        <StatusBadge value={row.true_ref} />
      </td>
      <td className="py-3">
        <span className="text-sm text-foreground">{row.client_name || '-'}</span>
      </td>
      <td className="py-3 hidden sm:table-cell">
        <span className="text-sm text-foreground">{row.ref_detail || '-'}</span>
      </td>
      <td className="py-3 hidden md:table-cell">
        <span className="text-sm text-muted-foreground">{row.zip_code || '-'}</span>
      </td>
      <td className="py-3 hidden lg:table-cell">
        {row.existing_policy === 'Y' ? (
          <span className="text-sm text-green-600 font-medium">Yes</span>
        ) : row.existing_policy === 'N' ? (
          <span className="text-sm text-red-600 font-medium">No</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-3 hidden lg:table-cell">
        {row.trial === 'Y' ? (
          <span className="text-sm text-green-600 font-medium">Yes</span>
        ) : row.trial === 'N' ? (
          <span className="text-sm text-red-600 font-medium">No</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </td>
      <td className="py-3 hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">
          {row.date_app_checked
            ? new Date(row.date_app_checked).toLocaleDateString("en-US", {
                month: "2-digit", day: "2-digit", year: "numeric"
              })
            : row.created_at
              ? new Date(row.created_at).toLocaleDateString("en-US", {
                  month: "2-digit", day: "2-digit", year: "numeric"
                })
              : '-'}
        </span>
      </td>
      <td className="py-3 hidden md:table-cell">
        <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
          {row.notes || '-'}
        </span>
      </td>
    </tr>
  );

  if (isLoading || (hierarchyLoading && hasHierarchyAccess)) {
    return (
      <Card className="bg-card border-border">
        <CardContent>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-48" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="grid grid-cols-8 gap-3 items-center border-b border-border pb-3">
                  <Skeleton className="h-4 col-span-1" />
                  <Skeleton className="h-4 col-span-2" />
                  <Skeleton className="h-4 col-span-2" />
                  <Skeleton className="h-4 col-span-1" />
                  <Skeleton className="h-4 col-span-1" />
                  <Skeleton className="h-4 col-span-1" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        {/* Row 1: Filter buttons + Month navigation */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setViewMode("mine")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'mine'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground hover:bg-accent'
              }`}
            >
              <FiUser className="h-3.5 w-3.5" /> My Refs
            </button>
            <button
              onClick={() => setViewMode("team")}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-l border-border transition-colors ${
                viewMode === 'team'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground hover:bg-accent'
              }`}
            >
              <FiUsers className="h-3.5 w-3.5" /> Team
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousMonth}
              disabled={!canGoToPrevious()}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Month"
            >
              <FiArrowLeft className="h-4 w-4" />
            </button>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-border text-sm bg-card text-foreground"
            >
              {monthOptions.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
            <button
              onClick={goToNextMonth}
              disabled={!canGoToNext()}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Month"
            >
              <FiArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Record count */}
          <span className="ml-auto text-xs text-muted-foreground">
            {viewMode === 'team'
              ? `${groupedByAgent.length} agent${groupedByAgent.length !== 1 ? 's' : ''} · ${filteredData.length} record${filteredData.length !== 1 ? 's' : ''}`
              : `${filteredData.length} record${filteredData.length !== 1 ? 's' : ''}`
            }
          </span>
        </div>

        {/* Row 2: Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-accent/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.trueRefs}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <FiCheckCircle className="h-3 w-3" /> Ref Sales
            </p>
          </div>
          <div className="bg-accent/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <FiClock className="h-3 w-3" /> Pending
            </p>
          </div>
          <div className="bg-accent/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.notTrueRefs}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <FiXCircle className="h-3 w-3" /> Not Approved
            </p>
          </div>
          <div className="bg-accent/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.totalSubmitted}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Submitted</p>
          </div>
        </div>

        {/* Row 3: Search bar */}
        <div className="relative mb-4">
          <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isSearching ? 'text-primary' : 'text-muted-foreground'}`} />
          <input
            type="text"
            placeholder="Search by agent, client, ref detail, notes, or zip..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        {/* Row 4: Table */}
        <div className="overflow-x-auto">
          <table className="w-full team-leaderboard-table">
            <thead>
              <tr className="border-b border-border">
                {viewMode === 'team' && (
                  <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground" style={{ width: '28px' }}></th>
                )}
                <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">
                  {viewMode === 'team' ? 'Agent' : 'Status'}
                </th>
                {viewMode === 'team' ? (
                  <>
                    <th className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground">
                      <span className="text-green-600">Sales</span>
                    </th>
                    <th className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      <span className="text-yellow-600">Pending</span>
                    </th>
                    <th className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      <span className="text-red-600">Denied</span>
                    </th>
                    <th className="pb-3 pt-0 text-right text-xs font-medium text-muted-foreground">Total</th>
                  </>
                ) : (
                  <>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground">Client Name</th>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Ref Detail</th>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Zip</th>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Existing Policy</th>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Trial</th>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                    <th className="pb-3 pt-0 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Notes</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {/* TEAM VIEW: Grouped rows */}
              {viewMode === 'team' && (
                groupedByAgent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No results match your search.' : 'No ref records found for this month.'}
                    </td>
                  </tr>
                ) : (
                  groupedByAgent.map((group, gIndex) => {
                    const isExpanded = expandedAgentId === group.agentId;
                    return (
                      <React.Fragment key={group.agentId}>
                        {/* Agent summary row */}
                        <tr
                          onClick={() => setExpandedAgentId(isExpanded ? null : group.agentId)}
                          className="border-b border-border hover:bg-accent transition-colors cursor-pointer"
                        >
                          <td className="py-3 pl-1" style={{ width: '28px' }}>
                            {isExpanded ? (
                              <FiChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <FiChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="py-3">
                            <span className="text-sm font-semibold text-foreground">{group.agentName}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm font-bold text-green-600">{group.trueRefs}</span>
                          </td>
                          <td className="py-3 text-right hidden sm:table-cell">
                            <span className="text-sm font-medium text-yellow-600">{group.pending}</span>
                          </td>
                          <td className="py-3 text-right hidden sm:table-cell">
                            <span className="text-sm font-medium text-red-600">{group.notTrueRefs}</span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm font-medium text-muted-foreground">{group.rows.length}</span>
                          </td>
                        </tr>

                        {/* Expanded detail rows */}
                        {isExpanded && (
                          <tr className="bg-accent/30">
                            <td colSpan={6} className="p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full team-leaderboard-table">
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="pb-2 pt-2 pl-10 text-left text-xs font-medium text-muted-foreground">Status</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground">Client Name</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Ref Detail</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Zip</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Existing Policy</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Trial</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                                      <th className="pb-2 pt-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.rows.map((row, rIndex) => (
                                      <tr
                                        key={row.id || row.uuid || rIndex}
                                        className={`border-b border-border/50 transition-colors ${
                                          row.true_ref === 'Y'
                                            ? 'bg-green-500/5 hover:bg-green-500/10'
                                            : row.true_ref === 'N'
                                              ? 'bg-red-500/5 hover:bg-red-500/10'
                                              : 'hover:bg-accent/50'
                                        }`}
                                      >
                                        <td className="py-2.5 pl-10">
                                          <StatusBadge value={row.true_ref} />
                                        </td>
                                        <td className="py-2.5">
                                          <span className="text-sm text-foreground">{row.client_name || '-'}</span>
                                        </td>
                                        <td className="py-2.5 hidden sm:table-cell">
                                          <span className="text-sm text-foreground">{row.ref_detail || '-'}</span>
                                        </td>
                                        <td className="py-2.5 hidden md:table-cell">
                                          <span className="text-sm text-muted-foreground">{row.zip_code || '-'}</span>
                                        </td>
                                        <td className="py-2.5 hidden lg:table-cell">
                                          {row.existing_policy === 'Y' ? (
                                            <span className="text-sm text-green-600 font-medium">Yes</span>
                                          ) : row.existing_policy === 'N' ? (
                                            <span className="text-sm text-red-600 font-medium">No</span>
                                          ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 hidden lg:table-cell">
                                          {row.trial === 'Y' ? (
                                            <span className="text-sm text-green-600 font-medium">Yes</span>
                                          ) : row.trial === 'N' ? (
                                            <span className="text-sm text-red-600 font-medium">No</span>
                                          ) : (
                                            <span className="text-sm text-muted-foreground">-</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 hidden sm:table-cell">
                                          <span className="text-sm text-muted-foreground">
                                            {row.date_app_checked
                                              ? new Date(row.date_app_checked).toLocaleDateString("en-US", {
                                                  month: "2-digit", day: "2-digit", year: "numeric"
                                                })
                                              : row.created_at
                                                ? new Date(row.created_at).toLocaleDateString("en-US", {
                                                    month: "2-digit", day: "2-digit", year: "numeric"
                                                  })
                                                : '-'}
                                          </span>
                                        </td>
                                        <td className="py-2.5 hidden md:table-cell">
                                          <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                                            {row.notes || '-'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )
              )}

              {/* MINE VIEW: Flat rows */}
              {viewMode === 'mine' && (
                filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={flatColumnCount} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No results match your search.' : 'No ref records found for this month.'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, index) => renderRefRow(row, index))
                )
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RefSales;
