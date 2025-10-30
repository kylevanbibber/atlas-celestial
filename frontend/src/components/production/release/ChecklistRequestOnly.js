import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import api from "../../../api";
import { InlineSpinner, ButtonSpinner, PageSpinner } from "../../utils/LoadingSpinner";
import { formatUTCForDisplay } from "../../../utils/dateUtils";

const ChecklistRequestOnly = () => {
  const { user } = useAuth();
  const userId = user?.userId;
  const userRole = user?.clname;
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';

  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReleaseScheduled, setIsReleaseScheduled] = useState(false);
  const [onReleaseList, setOnReleaseList] = useState(false);
  const [releaseScheduledDate, setReleaseScheduledDate] = useState(null);
  const [totalRowsThisWeek, setTotalRowsThisWeek] = useState(0);
  const [countdown, setCountdown] = useState("");
  const [firstPackSent, setFirstPackSent] = useState(false);

  const getNextFridayMidnight = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilFriday = (6 - dayOfWeek + 7) % 7 || 7;
    const nextFridayMidnightUTC = new Date(now);
    nextFridayMidnightUTC.setUTCDate(now.getUTCDate() + daysUntilFriday);
    nextFridayMidnightUTC.setUTCHours(5, 1, 0, 0);
    return nextFridayMidnightUTC;
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - currentDay - 1);
    weekStart.setUTCHours(5, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setUTCHours(4, 59, 59, 999);
    return { weekStart, weekEnd };
  };

  const checkReleaseScheduled = async (targetUserId) => {
    if (!targetUserId) return;
    try {
      const response = await api.get('/release/check-release-scheduled', { params: { userId: targetUserId } });
      const result = response.data;
      const { weekStart, weekEnd } = getCurrentWeekRange();
      setIsReleaseScheduled(result.isScheduled);
      setReleaseScheduledDate(result.release_scheduled);
      setOnReleaseList(result.success);
      if (result.allRowsResult) {
        const rowsThisWeek = result.allRowsResult.filter((row) => {
          const submissionDate = new Date(row.time_submitted);
          const withinWeek = submissionDate >= weekStart && submissionDate <= weekEnd;
          const notScheduled = row.release_scheduled == null;
          const notPassed = row.passed == null;
          return withinWeek && notScheduled && notPassed;
        });
        setTotalRowsThisWeek(rowsThisWeek.length);
      } else {
        setTotalRowsThisWeek(0);
      }
    } catch (_) {
      setTotalRowsThisWeek(0);
      setOnReleaseList(false);
    }
  };

  const checkFirstPackStatus = async (targetUserId) => {
    try {
      const resp = await api.get('/release/leads-released');
      const rows = resp?.data?.data || [];
      const hasFirstPack = rows.some(r => String(r.userId) === String(targetUserId) && (r.type === '1st Pack' || r.type === 'First Pack') && (r.sent == 1 || r.sent === '1'));
      setFirstPackSent(hasFirstPack);
    } catch (_) {
      setFirstPackSent(false);
    }
  };

  useEffect(() => {
    const target = selectedAgent?.id || userId;
    if (!target) return;
    checkReleaseScheduled(target);
    checkFirstPackStatus(target);
  }, [selectedAgent?.id, userId]);

  useEffect(() => {
    const targetTime = getNextFridayMidnight();
    const updateCountdown = () => {
      const now = new Date();
      const diff = targetTime - now;
      if (diff <= 0) { setCountdown("Time's up!"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown(`${days > 0 ? `${days}d ` : ""}${hours}h ${minutes}m ${seconds}s`);
    };
    const t = setInterval(updateCountdown, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!userRole || !userId) return;
    if (userRole === "AGT") { setIsLoading(false); return; }
    const fetchAgents = async () => {
      try {
        setIsLoading(true);
        let response;
        if (userRole === "Admin" || isAppAdmin) {
          response = await api.get("/release/get-unreleased-users-checklist");
        } else {
          response = await api.post("/auth/searchByUserId", { userId });
        }
        if (response.data.success) setAgents(response.data.data);
      } catch (_) {}
      finally { setIsLoading(false); }
    };
    fetchAgents();
  }, [userRole, userId]);

  const handleAgentSelection = async (e) => {
    const selectedId = e.target.value;
    if (!selectedId) { setSelectedAgent(""); return; }
    const agent = agents.find(a => a.id === parseInt(selectedId, 10));
    setSelectedAgent(agent || "");
  };

  const handleScheduleReleaseCall = async () => {
    const targetUserId = selectedAgent?.id || userId;
    const agentName = selectedAgent ? (selectedAgent.lagnname || `${selectedAgent.first_name} ${selectedAgent.last_name}`) : 'your';
    try {
      setIsSaving(true);
      const response = await api.post('/release/schedule-release', { userId: targetUserId });
      if (response.data.success) {
        setOnReleaseList(true);
        alert(`Release call request submitted successfully for ${agentName}! Check back over the weekend to see the scheduled time for the upcoming week.`);
      } else {
        alert('Error scheduling release call: ' + response.data.message);
      }
    } catch (_) {
      alert('Error scheduling release call');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || !userId || !userRole || isLoading) {
    return <PageSpinner text="Loading..." />;
  }

  return (
    <div className="checklist-container">
      {userRole !== "AGT" && (
        <div className="agent-selection">
          <label htmlFor="agent-select">Select Agent:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              id="agent-select"
              value={selectedAgent?.id || ""}
              onChange={handleAgentSelection}
              aria-label="Select an agent"
              disabled={isLoading}
            >
              <option value="">-- Select an Agent --</option>
              {agents
                .filter(agent => agent.released === 0)
                .sort((a, b) => (a.lagnname || a.last_name || '').localeCompare(b.lagnname || b.last_name || ''))
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.lagnname || `${agent.first_name} ${agent.last_name}`}
                  </option>
                ))}
            </select>
            {isLoading && selectedAgent && (
              <InlineSpinner />
            )}
          </div>
        </div>
      )}

      {userRole === "AGT" && isReleaseScheduled && (
        <div className="release-schedule-info" style={{ textAlign: 'center' }}>
          <p><strong>🎯 Your Release Call is Scheduled!</strong></p>
          <p style={{ fontSize: '1rem', marginTop: '8px', marginBottom: '15px' }}>
            <strong>Release Date:</strong> {formatUTCForDisplay(releaseScheduledDate)}
          </p>
        </div>
      )}

      {!isReleaseScheduled && (
        <div className="progress-bar-container" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '15px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            📅  {Math.max(0, 24 - totalRowsThisWeek)}/24 spots remaining
          </div>
          {countdown && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              ⏰ Time remaining: {countdown}
            </div>
          )}
          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={handleScheduleReleaseCall}
              disabled={!((userRole === "AGT") || (["SA", "GA", "MGA", "RGA"].includes(userRole) && selectedAgent) || (isAppAdmin && selectedAgent)) || !firstPackSent || onReleaseList || isSaving}
              className="unlocked-link"
              style={{ 
                fontSize: '1rem', 
                padding: '8px 16px', 
                minHeight: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSaving ? <ButtonSpinner /> : 'Request to be Scheduled'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistRequestOnly;


