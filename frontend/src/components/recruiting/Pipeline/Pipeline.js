import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import { toast } from 'react-hot-toast';
import { FaRegCopy, FaCheck, FaQrcode, FaDownload } from 'react-icons/fa';
import { FiGrid, FiList, FiUsers, FiCheckCircle, FiClock, FiTrendingUp, FiBarChart2 } from 'react-icons/fi';
import QRCode from 'qrcode';
import api from '../../../api';
import PipelineProgress from './PipelineProgress';
import PipelineKanban from './PipelineKanban';
import PipelineSettings from './PipelineSettings';
import PipelineAnalytics from './PipelineAnalytics';
import './Pipeline.css';

const Pipeline = () => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const userId = user?.userId;

  // View state
  const [activeView, setActiveView] = useState('progress');
  const [progressViewMode, setProgressViewMode] = useState('table');
  const [onboardingCopied, setOnboardingCopied] = useState(false);
  const [activeKpiFilter, setActiveKpiFilter] = useState(null);
  const [kpiData, setKpiData] = useState({
    totalRecruits: 0,
    needsAob: 0,
    needsCheckin: 0,
    completedThisWeek: 0,
    loading: true
  });

  // === Shared pipeline state (lifted from PipelineProgress + PipelineKanban) ===
  const [stages, setStages] = useState([]);
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTeam, setShowTeam] = useState(true);
  const [stageChecklistItems, setStageChecklistItems] = useState({}); // { stageName: [items] }
  const [recruitProgress, setRecruitProgress] = useState({}); // { recruitId: [progress] }
  const [smsBalance, setSmsBalance] = useState(0);

  // Determine user permissions
  const isAgent = user?.clname === 'AGT';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  const isAdmin = user?.Role === 'Admin';
  const canViewTeam = isManager || isAdmin;
  const canAccessSettings = user?.Role === 'Admin' || ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);

  // Get hierarchy IDs for filtering
  const hierarchyIds = useMemo(() => {
    if (isAdmin || !canViewTeam) return [];
    return getHierarchyForComponent('ids');
  }, [isAdmin, canViewTeam, getHierarchyForComponent]);

  // Get user IDs for KPIs (always team view regardless of toggle)
  const getKpiUserIds = () => {
    if (isAgent) return [user.userId];
    if (canViewTeam) return [...hierarchyIds, user.userId];
    return [user.userId];
  };

  // Get user IDs respecting team/personal toggle (for recruit data)
  const getUserIds = () => {
    if (isAgent) return [user.userId];
    if (canViewTeam && showTeam) return [...hierarchyIds, user.userId];
    return [user.userId];
  };

  // Onboarding portal link
  const onboardingLink = userId === "26911"
    ? `https://agents.ariaslife.com/onboarding/login`
    : `https://agents.ariaslife.com/onboarding/login?hm=${userId}`;

  const handleCopyOnboarding = () => {
    navigator.clipboard.writeText(onboardingLink).then(() => {
      setOnboardingCopied(true);
      setTimeout(() => setOnboardingCopied(false), 4000);
    });
  };

  // Affiliate recruiting link
  const [affiliateCopied, setAffiliateCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const affiliateLink = userId === "26911"
    ? "https://agents.ariaslife.com/careers"
    : `https://agents.ariaslife.com/careers?hm=${userId}`;

  useEffect(() => {
    QRCode.toDataURL(affiliateLink, { width: 200, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR code:', err));
  }, [affiliateLink]);

  const handleCopyAffiliate = () => {
    navigator.clipboard.writeText(affiliateLink).then(() => {
      setAffiliateCopied(true);
      setTimeout(() => setAffiliateCopied(false), 4000);
    });
  };

  const handleCopyQR = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 4000);
    } catch {
      navigator.clipboard.writeText(affiliateLink).then(() => {
        setQrCopied(true);
        setTimeout(() => setQrCopied(false), 4000);
      });
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.download = `recruiting-qr-code-${userId}.png`;
    link.href = qrCodeUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // === Shared fetch functions ===

  const buildStageOrder = (stageList) => {
    const pipelineStages = stageList.filter(s => !s.is_terminal);
    let currentStage = pipelineStages.find(s => !s.position_after);
    if (!currentStage) return pipelineStages;

    const orderedStages = [];
    const visited = new Set();

    while (currentStage && !visited.has(currentStage.stage_name)) {
      orderedStages.push(currentStage);
      visited.add(currentStage.stage_name);
      currentStage = pipelineStages.find(s =>
        s.position_after === currentStage.stage_name &&
        !visited.has(s.stage_name)
      );
    }

    pipelineStages.forEach(stage => {
      if (!visited.has(stage.stage_name)) {
        orderedStages.push(stage);
      }
    });

    return orderedStages;
  };

  const fetchStages = async () => {
    try {
      const response = await api.get('/recruitment/stages');
      if (response.data.success) {
        const sortedStages = buildStageOrder(response.data.data);
        setStages(sortedStages);
      }
    } catch (error) {
      console.error('Error fetching stages:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let recruitsResponse;
      if (isAdmin) {
        recruitsResponse = await api.get('/recruitment/recruits');
      } else {
        const userIds = getUserIds();
        if (userIds.length === 1) {
          recruitsResponse = await api.get(`/recruitment/recruits/agent/${userIds[0]}`);
        } else {
          recruitsResponse = await api.post('/recruitment/recruits/team', { userIds });
        }
      }

      // Deduplicate by recruit ID (JOINs in backend can produce duplicate rows)
      const rawRecruits = Array.isArray(recruitsResponse.data) ? recruitsResponse.data : [];
      const seen = new Set();
      const uniqueRecruits = rawRecruits.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      setRecruits(uniqueRecruits);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      setRecruits([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshSingleRecruit = async (recruitId) => {
    try {
      const res = await api.get(`/recruitment/recruits/${recruitId}/full`);
      if (res.data) {
        setRecruits(prev => prev.map(r => r.id === recruitId ? res.data : r));
      }
    } catch (err) {
      console.error('Error refreshing recruit:', err);
    }
  };

  const fetchChecklistData = async () => {
    try {
      // Build per-stage requests in parallel
      const stagesWithRecruits = stages
        .map(stage => ({
          stage,
          recruitIds: [...new Set(recruits.filter(r => r.step === stage.stage_name).map(r => r.id))]
        }))
        .filter(s => s.recruitIds.length > 0);

      const allRecruitIds = [...new Set(stagesWithRecruits.flatMap(s => s.recruitIds))];

      const [itemsResults, progressResponse] = await Promise.all([
        Promise.all(
          stagesWithRecruits.map(({ stage, recruitIds }) =>
            api.get(`/recruitment/stages/${encodeURIComponent(stage.stage_name)}/checklist-items`, {
              params: { recruitIds: recruitIds.join(',') }
            }).then(res => ({ stageName: stage.stage_name, data: res.data }))
          )
        ),
        allRecruitIds.length > 0
          ? api.post('/recruitment/recruits/checklist/bulk', { recruitIds: allRecruitIds })
          : Promise.resolve({ data: { success: true, data: {} } })
      ]);

      const stageItems = {};
      for (const { stageName, data } of itemsResults) {
        if (data.success) {
          stageItems[stageName] = data.data || [];
        }
      }

      setStageChecklistItems(stageItems);
      setRecruitProgress(progressResponse.data.success ? progressResponse.data.data : {});
    } catch (error) {
      console.error('Error fetching checklist data:', error);
    }
  };

  const fetchSmsBalance = async () => {
    try {
      const response = await api.get('/recruitment/sms/credits');
      if (response.data?.success) {
        setSmsBalance(response.data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching SMS balance:', error);
    }
  };

  const handleRecruitAdded = (newRecruit) => {
    if (newRecruit && newRecruit.id) {
      setRecruits(prev => [newRecruit, ...prev]);
    } else {
      fetchData();
    }
  };

  // === Effects ===

  // Fetch stages and SMS balance on mount
  useEffect(() => {
    fetchStages();
    fetchSmsBalance();
  }, []);

  // Fetch recruits when user/hierarchy loads or team toggle changes
  useEffect(() => {
    if (!user?.userId) return;
    if (hierarchyLoading) return;
    if (canViewTeam && showTeam && hierarchyIds.length === 0 && !isAdmin) return;
    fetchData();
  }, [user?.userId, showTeam, hierarchyLoading, hierarchyIds, canViewTeam, isAdmin]);

  // Fetch checklist data when stages/recruits change (ref-based to avoid unnecessary refetches)
  const prevRecruitIdsRef = useRef('');
  useEffect(() => {
    if (stages.length === 0 || recruits.length === 0) return;
    const recruitIdKey = recruits.map(r => `${r.id}:${r.step}`).sort().join(',');
    if (recruitIdKey === prevRecruitIdsRef.current) return;
    prevRecruitIdsRef.current = recruitIdKey;
    fetchChecklistData();
  }, [stages, recruits]);

  // Fetch KPI data
  useEffect(() => {
    const fetchKPIs = async () => {
      if (!user?.userId) return;
      if (hierarchyLoading) return;
      if (canViewTeam && hierarchyIds.length === 0 && !isAdmin) return;

      try {
        const userIds = isAdmin ? null : getKpiUserIds();
        const params = userIds ? { userIds: userIds.join(',') } : {};
        const response = await api.get('/recruitment/kpis', { params });

        if (response.data.success) {
          setKpiData({
            totalRecruits: response.data.totalRecruits || 0,
            needsAob: response.data.needsAob || 0,
            needsCheckin: response.data.needsCheckin || 0,
            completedThisWeek: response.data.completedThisWeek || 0,
            loading: false
          });
        }
      } catch (error) {
        console.error('Error fetching KPIs:', error);
        setKpiData(prev => ({ ...prev, loading: false }));
      }
    };

    fetchKPIs();
    const interval = setInterval(fetchKPIs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hierarchyLoading, user?.userId, hierarchyIds, canViewTeam, isAdmin]);

  // Shared props for children
  const sharedProps = {
    stages,
    recruits,
    setRecruits,
    loading,
    showTeam,
    setShowTeam,
    stageChecklistItems,
    recruitProgress,
    refreshSingleRecruit,
    fetchData,
    onRecruitAdded: handleRecruitAdded,
    smsBalance,
    fetchSmsBalance,
    getUserIds,
  };

  return (
    <div >
      {/* Header with navigation */}
      <div className="pipeline-header">
        <div className="pipeline-header-actions">
          {/* Progress / Settings toggle - only for users with settings access */}
          {canAccessSettings && (
            <div className="pipeline-view-toggle">
              <button
                className={`view-toggle-btn ${activeView === 'progress' ? 'active' : ''}`}
                onClick={() => setActiveView('progress')}
                title="Pipeline Progress"
              >
                <FiList size={18} />
                <span>Progress</span>
              </button>
              <button
                className={`view-toggle-btn ${activeView === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveView('settings')}
                title="Settings"
              >
                <FiGrid size={18} />
                <span>Settings</span>
              </button>
            </div>
          )}

          {/* Table / Kanban toggle - visible to all users on progress view */}
          {activeView === 'progress' && (
            <div className="pipeline-view-toggle">
              <button
                className={`view-toggle-btn ${progressViewMode === 'table' ? 'active' : ''}`}
                onClick={() => setProgressViewMode('table')}
                title="Table View"
              >
                <FiList size={18} />
              </button>
              <button
                className={`view-toggle-btn ${progressViewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setProgressViewMode('kanban')}
                title="Kanban View"
              >
                <FiGrid size={18} />
              </button>
              <button
                className={`view-toggle-btn ${progressViewMode === 'analytics' ? 'active' : ''}`}
                onClick={() => setProgressViewMode('analytics')}
                title="Analytics"
              >
                <FiBarChart2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Links Section */}
      <div className="pipeline-links-grid">
        {/* Affiliate Recruiting Link */}
        <div style={{
          background: 'var(--card-bg)',
          padding: '16px 20px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <p style={{ fontSize: '14px', display: 'inline-flex', alignItems: 'center', marginBottom: '10px', color: 'var(--text-primary)' }}>
            My Affiliate Link
            <span onClick={handleCopyAffiliate} style={{ marginLeft: '10px', cursor: 'pointer', color: 'var(--text-primary)' }}>
              {affiliateCopied ? <FaCheck color="green" /> : <FaRegCopy />}
            </span>
          </p>
          <a href={affiliateLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--link-color)', wordBreak: 'break-all', fontSize: '13px' }}>
            {affiliateLink}
          </a>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px' }}>
            <button onClick={handleCopyQR} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: qrCopied ? 'green' : 'var(--text-secondary)', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {qrCopied ? <FaCheck size={12} /> : <FaQrcode size={12} />}
              {qrCopied ? 'Copied!' : 'Copy QR'}
            </button>
            <button onClick={handleDownloadQR} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FaDownload size={12} />
              Download QR
            </button>
          </div>
        </div>

        {/* Onboarding Portal Link */}
        <div style={{
          background: 'var(--card-bg)',
          padding: '16px 20px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <p style={{ fontSize: '14px', display: 'inline-flex', alignItems: 'center', marginBottom: '10px', color: 'var(--text-primary)' }}>
            Onboarding Portal Link
            <span onClick={handleCopyOnboarding} style={{ marginLeft: '10px', cursor: 'pointer', color: 'var(--text-primary)' }}>
              {onboardingCopied ? <FaCheck color="green" /> : <FaRegCopy />}
            </span>
          </p>
          <a href={onboardingLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--link-color)', wordBreak: 'break-all', fontSize: '13px' }}>
            {onboardingLink}
          </a>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '0' }}>
            Share this link with new hires to access their onboarding checklist
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      {activeView === 'progress' && progressViewMode !== 'analytics' && (
        <div className="pipeline-kpi-cards">
          <div
            className="pipeline-kpi-card"
            onClick={() => setActiveKpiFilter(null)}
            style={{ cursor: 'pointer' }}
          >
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <FiUsers size={24} />
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total Recruits</div>
              <div className="kpi-value">
                {kpiData.loading ? '...' : kpiData.totalRecruits}
              </div>
            </div>
          </div>

          <div
            className={`pipeline-kpi-card ${activeKpiFilter === 'needs-aob' ? 'kpi-card-active' : ''}`}
            onClick={() => setActiveKpiFilter(activeKpiFilter === 'needs-aob' ? null : 'needs-aob')}
            style={{ cursor: 'pointer' }}
          >
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <FiTrendingUp size={24} />
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Needs AOB Sent</div>
              <div className="kpi-value">
                {kpiData.loading ? '...' : kpiData.needsAob}
              </div>
            </div>
          </div>

          <div
            className={`pipeline-kpi-card ${activeKpiFilter === 'needs-checkin' ? 'kpi-card-active' : ''}`}
            onClick={() => setActiveKpiFilter(activeKpiFilter === 'needs-checkin' ? null : 'needs-checkin')}
            style={{ cursor: 'pointer' }}
          >
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <FiClock size={24} />
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Needs Check-in</div>
              <div className="kpi-value">
                {kpiData.loading ? '...' : kpiData.needsCheckin}
              </div>
            </div>
          </div>

          <div
            className={`pipeline-kpi-card ${activeKpiFilter === 'completed-this-week' ? 'kpi-card-active' : ''}`}
            onClick={() => setActiveKpiFilter(activeKpiFilter === 'completed-this-week' ? null : 'completed-this-week')}
            style={{ cursor: 'pointer' }}
          >
            <div className="kpi-icon" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
              <FiCheckCircle size={24} />
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Completed This Week</div>
              <div className="kpi-value">
                {kpiData.loading ? '...' : kpiData.completedThisWeek}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="pipeline-content">
        {activeView === 'progress' ? (
          progressViewMode === 'kanban' ? (
            <PipelineKanban {...sharedProps} kpiFilter={activeKpiFilter} />
          ) : progressViewMode === 'analytics' ? (
            <PipelineAnalytics {...sharedProps} />
          ) : (
            <PipelineProgress {...sharedProps} kpiFilter={activeKpiFilter} />
          )
        ) : (
          <PipelineSettings />
        )}
      </div>
    </div>
  );
};

export default Pipeline;
