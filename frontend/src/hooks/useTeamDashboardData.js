/**
 * Custom hook for Team Dashboard data fetching
 * Extracts all data fetching logic from TeamDashboard component
 */

import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { parseLocalDate } from '../utils/dateRangeUtils';

export const useTeamDashboardData = ({ 
  user, 
  userRole, 
  viewScope, 
  viewMode, 
  dateRangeState, 
  timePeriod,
  personalStatsTimeframe 
}) => {
  // State management
  const [teamLeaderboardData, setTeamLeaderboardData] = useState([]);
  const [teamLeaderboardLoading, setTeamLeaderboardLoading] = useState(false);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(true);
  const [leaderboardAllUsers, setLeaderboardAllUsers] = useState([]);
  const [leaderboardAlpDataMap, setLeaderboardAlpDataMap] = useState(new Map());
  const [leaderboardAlpField, setLeaderboardAlpField] = useState('LVL_1_NET');
  const LEADERBOARD_PAGE_SIZE = 50;

  const [orgMetrics, setOrgMetrics] = useState(null);
  const [orgMetricsHistory, setOrgMetricsHistory] = useState(null);
  const [orgMetricsLoading, setOrgMetricsLoading] = useState(false);
  const [alpAsOfDate, setAlpAsOfDate] = useState(null);
  
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  const [personalComparison, setPersonalComparison] = useState(null);
  const [personalGoal, setPersonalGoal] = useState(null);
  const [personalOfficialAlp, setPersonalOfficialAlp] = useState(null);
  const [hasOfficialAlpData, setHasOfficialAlpData] = useState(false);
  
  const [mgaOfficialAlp, setMgaOfficialAlp] = useState(null);
  const [rgaOfficialAlp, setRgaOfficialAlp] = useState(null);
  const [hasMgaOfficialAlpData, setHasMgaOfficialAlpData] = useState(false);
  const [hasRgaOfficialAlpData, setHasRgaOfficialAlpData] = useState(false);

  const [ytdSummaryData, setYtdSummaryData] = useState({
    alpData: {},
    hiresData: {},
    associatesData: [],
    vipsData: [],
    mgaStartDate: null
  });

  const [breakdownData, setBreakdownData] = useState([]);
  const [refSalesBreakdown, setRefSalesBreakdown] = useState([]);

  // Abort controllers
  const teamLeaderboardAbortRef = useRef(null);

  // Re-export state and setters for parent component
  return {
    // State
    teamLeaderboardData,
    teamLeaderboardLoading,
    leaderboardHasMore,
    orgMetrics,
    orgMetricsHistory,
    orgMetricsLoading,
    alpAsOfDate,
    activityData,
    activityLoading,
    activityError,
    statsData,
    statsLoading,
    personalComparison,
    personalGoal,
    personalOfficialAlp,
    hasOfficialAlpData,
    mgaOfficialAlp,
    rgaOfficialAlp,
    hasMgaOfficialAlpData,
    hasRgaOfficialAlpData,
    ytdSummaryData,
    breakdownData,
    refSalesBreakdown,
    
    // Setters
    setTeamLeaderboardData,
    setPersonalGoal,
    setActivityData,
    setBreakdownData,
    setRefSalesBreakdown,
    setAlpAsOfDate,
    
    // Refs
    teamLeaderboardAbortRef,
    leaderboardPage,
    setLeaderboardPage,
    leaderboardAllUsers,
    setLeaderboardAllUsers,
    leaderboardAlpDataMap,
    setLeaderboardAlpDataMap,
    leaderboardAlpField,
    setLeaderboardAlpField,
    setLeaderboardHasMore,
    LEADERBOARD_PAGE_SIZE
  };
};
