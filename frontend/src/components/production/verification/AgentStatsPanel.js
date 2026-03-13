import { useState, useEffect, useMemo } from 'react';
import api from '../../../api';
import { FiUser, FiMail, FiPhone, FiCalendar, FiX, FiAlertTriangle } from 'react-icons/fi';
import './AgentStatsPanel.css';

const StatItem = ({ label, value, color }) => (
    <div className="asp-stat-item">
        <span className="asp-stat-value" style={color ? { color } : {}}>{value}</span>
        <span className="asp-stat-label">{label}</span>
    </div>
);

const AgentStatsPanel = ({ selectedAgent, periodTabCounts, periodVerifyData, computeDiscrepancyReasons, onClose }) => {
    const [agentProfile, setAgentProfile] = useState(null);
    const [allTimeVerifyData, setAllTimeVerifyData] = useState([]);
    const [allTimeClientData, setAllTimeClientData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedAgent) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [profileRes, allTimeRes] = await Promise.all([
                    api.get(`/verify/agent-profile/${encodeURIComponent(selectedAgent)}`),
                    api.get(`/verify/agent-alltime/${encodeURIComponent(selectedAgent)}`)
                ]);

                if (profileRes.data.success) setAgentProfile(profileRes.data.data);
                else setAgentProfile(null);

                if (allTimeRes.data.success) {
                    setAllTimeVerifyData(allTimeRes.data.verifyData || []);
                    setAllTimeClientData(allTimeRes.data.verifyClientData || []);
                }
            } catch (err) {
                console.error('Error fetching agent stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedAgent]);

    // All-time stats computed using the same discrepancy logic as VerifyTable
    const allTimeStats = useMemo(() => {
        if (!allTimeVerifyData.length) return { verified: 0, discrepancy: 0, unverified: 0, queued: 0, avgPremium: 0, totalSurveys: 0 };

        let verified = 0, discrepancy = 0, unverified = 0, queued = 0;
        let totalPremium = 0;

        allTimeVerifyData.forEach(verifyRow => {
            totalPremium += parseFloat(verifyRow.total_annual_premium || 0);

            const clientRow = allTimeClientData.find(c => c.application_id === verifyRow.application_id);

            if (!clientRow) {
                if (verifyRow.status === 'Queued') queued++;
                else unverified++;
            } else {
                const reasons = computeDiscrepancyReasons(verifyRow, clientRow);
                if (reasons.length > 0) discrepancy++;
                else verified++;
            }
        });

        return {
            verified,
            discrepancy,
            unverified,
            queued,
            totalSurveys: allTimeVerifyData.length,
            avgPremium: allTimeVerifyData.length > 0
                ? Math.round(totalPremium / allTimeVerifyData.length)
                : 0
        };
    }, [allTimeVerifyData, allTimeClientData, computeDiscrepancyReasons]);

    // Period stats from already-computed tabCounts + avg premium from period data
    const periodStats = useMemo(() => {
        const totalPremium = (periodVerifyData || []).reduce(
            (sum, row) => sum + parseFloat(row.total_annual_premium || 0), 0
        );
        const total = (periodTabCounts.queued || 0) + (periodTabCounts.unverified || 0) +
            (periodTabCounts.verified || 0) + (periodTabCounts.discrepancy || 0);
        return {
            ...periodTabCounts,
            totalSurveys: total,
            avgPremium: periodVerifyData.length > 0
                ? Math.round(totalPremium / periodVerifyData.length)
                : 0
        };
    }, [periodTabCounts, periodVerifyData]);

    // Duplicate client names from all-time data
    const duplicateClients = useMemo(() => {
        const nameMap = {};
        allTimeVerifyData.forEach(row => {
            const name = (row.client_name || '').trim().toLowerCase();
            if (!name) return;
            if (!nameMap[name]) nameMap[name] = [];
            nameMap[name].push({
                application_id: row.application_id,
                created_at: row.created_at,
                total_annual_premium: row.total_annual_premium,
                client_name: row.client_name
            });
        });
        return Object.entries(nameMap)
            .filter(([, entries]) => entries.length > 1)
            .map(([, entries]) => ({ name: entries[0].client_name, count: entries.length }))
            .sort((a, b) => b.count - a.count);
    }, [allTimeVerifyData]);

    const formatName = (lagnname) => {
        if (!lagnname) return '';
        const parts = lagnname.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
        // lagnname is typically "LAST FIRST MIDDLE" -> "First Last"
        if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
        return parts[0];
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="asp-panel">
            <div className="asp-header">
                <span className="asp-chip">Agent Stats</span>
                <button className="asp-close-btn" onClick={onClose} title="Close panel">
                    <FiX size={16} />
                </button>
            </div>

            {loading ? (
                <div className="asp-loading">Loading agent data...</div>
            ) : (
                <>
                    {/* Agent Profile */}
                    <div className="asp-profile">
                        <div className="asp-avatar">
                            {agentProfile?.profpic ? (
                                <img src={agentProfile.profpic} alt={selectedAgent} />
                            ) : (
                                <div className="asp-avatar-placeholder"><FiUser size={28} /></div>
                            )}
                        </div>
                        <h3 className="asp-name">{formatName(selectedAgent)}</h3>
                        {agentProfile?.clname && (
                            <span className="asp-role">{agentProfile.clname}</span>
                        )}
                        <div className="asp-meta">
                            {agentProfile?.mga && (
                                <div className="asp-meta-row">
                                    <span className="asp-meta-label">MGA</span>
                                    <span className="asp-meta-value">{agentProfile.mga}</span>
                                </div>
                            )}
                            {agentProfile?.rga && (
                                <div className="asp-meta-row">
                                    <span className="asp-meta-label">RGA</span>
                                    <span className="asp-meta-value">{agentProfile.rga}</span>
                                </div>
                            )}
                            {agentProfile?.email && (
                                <div className="asp-meta-row">
                                    <FiMail size={12} />
                                    <span className="asp-meta-value">{agentProfile.email}</span>
                                </div>
                            )}
                            {agentProfile?.phone && (
                                <div className="asp-meta-row">
                                    <FiPhone size={12} />
                                    <span className="asp-meta-value">{agentProfile.phone}</span>
                                </div>
                            )}
                            {agentProfile?.esid && (
                                <div className="asp-meta-row">
                                    <FiCalendar size={12} />
                                    <span className="asp-meta-value">{formatDate(agentProfile.esid)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Period Stats */}
                    <div className="asp-section">
                        <h4 className="asp-section-title">Selected Period</h4>
                        <div className="asp-stats-grid">
                            <StatItem label="Verified" value={periodStats.verified} color="#22c55e" />
                            <StatItem label="Discrepancy" value={periodStats.discrepancy} color="#ef4444" />
                            <StatItem label="Unverified" value={periodStats.unverified} color="#6b7280" />
                            <StatItem label="Queued" value={periodStats.queued} color="#f59e0b" />
                            <StatItem label="Avg Premium" value={`$${periodStats.avgPremium.toLocaleString()}`} />
                            <StatItem label="Total" value={periodStats.totalSurveys} />
                        </div>
                    </div>

                    {/* All Time Stats */}
                    <div className="asp-section">
                        <h4 className="asp-section-title">All Time</h4>
                        <div className="asp-stats-grid">
                            <StatItem label="Verified" value={allTimeStats.verified} color="#22c55e" />
                            <StatItem label="Discrepancy" value={allTimeStats.discrepancy} color="#ef4444" />
                            <StatItem label="Unverified" value={allTimeStats.unverified} color="#6b7280" />
                            <StatItem label="Queued" value={allTimeStats.queued} color="#f59e0b" />
                            <StatItem label="Avg Premium" value={`$${allTimeStats.avgPremium.toLocaleString()}`} />
                            <StatItem label="Total" value={allTimeStats.totalSurveys} />
                        </div>
                    </div>

                    {/* Duplicate Client Names */}
                    {duplicateClients.length > 0 && (
                        <div className="asp-section">
                            <h4 className="asp-section-title">
                                <FiAlertTriangle size={14} />
                                Duplicate Names ({duplicateClients.length})
                            </h4>
                            <div className="asp-duplicates">
                                {duplicateClients.map(dup => (
                                    <div key={dup.name} className="asp-duplicate-item">
                                        <span className="asp-duplicate-name">{dup.name}</span>
                                        <span className="asp-duplicate-count">{dup.count}x</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AgentStatsPanel;
