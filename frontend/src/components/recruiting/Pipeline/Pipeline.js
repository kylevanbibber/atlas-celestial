import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useUserHierarchy } from '../../../hooks/useUserHierarchy';
import { toast } from 'react-hot-toast';
import { FaRegCopy, FaCheck } from 'react-icons/fa';
import { FiGrid, FiList, FiUsers, FiCheckCircle, FiClock, FiTrendingUp } from 'react-icons/fi';
import api from '../../../api';
import PipelineProgress from './PipelineProgress';
import PipelineKanban from './PipelineKanban';
import PipelineSettings from './PipelineSettings';
import './Pipeline.css';

const Pipeline = () => {
  const { user } = useAuth();
  const { hierarchyData, hierarchyLoading, getHierarchyForComponent } = useUserHierarchy();
  const userId = user?.userId;
  const [activeView, setActiveView] = useState('progress'); // 'progress' | 'kanban' | 'settings'
  const [progressViewMode, setProgressViewMode] = useState('table'); // 'table' | 'kanban'
  const [onboardingCopied, setOnboardingCopied] = useState(false);
  const [kpiData, setKpiData] = useState({
    totalRecruits: 0,
    needsAob: 0,
    needsCheckin: 0,
    completedThisWeek: 0,
    loading: true
  });
  const [activeKpiFilter, setActiveKpiFilter] = useState(null); // 'needs-aob' | 'needs-checkin' | null
  
  // Determine user permissions
  const isAgent = user?.clname === 'AGT';
  const isManager = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  const isAdmin = user?.Role === 'Admin';
  const canViewTeam = isManager || isAdmin;
  
  // Determine if user has admin/manager access to settings
  const canAccessSettings = user?.Role === 'Admin' || ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);
  
  // Determine if user should see the pipeline header (Admin or teamRole = 'app')
  const showPipelineHeader = user?.Role === 'Admin' || user?.teamRole === 'app';
  
  // Get hierarchy IDs for filtering
  const hierarchyIds = useMemo(() => {
    if (isAdmin || !canViewTeam) return [];
    return getHierarchyForComponent('ids');
  }, [isAdmin, canViewTeam, getHierarchyForComponent]);
  
  // Get user IDs to fetch (always include hierarchy for KPIs)
  const getUserIds = () => {
    if (isAgent) {
      return [user.userId];
    }
    if (canViewTeam) {
      return [...hierarchyIds, user.userId];
    }
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

  // Fetch KPI data
  useEffect(() => {
    const fetchKPIs = async () => {
      // Don't fetch until user is loaded
      if (!user?.userId) return;
      
      // If hierarchy is still loading, wait
      if (hierarchyLoading) return;
      
      // If we need hierarchy data, wait until it's ready
      if (canViewTeam && hierarchyIds.length === 0 && !isAdmin) {
        console.log('[Pipeline] Waiting for hierarchy data before fetching KPIs...');
        return;
      }
      
      try {
        const userIds = isAdmin ? null : getUserIds();
        console.log('[Pipeline] Fetching KPIs for userIds:', userIds);
        
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
    // Refresh KPIs every 5 minutes
    const interval = setInterval(fetchKPIs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hierarchyLoading, user?.userId, hierarchyIds, canViewTeam, isAdmin]);

  return (
    <div >
      {/* Header with navigation - show for Admin/teamRole='app' OR for MGA/RGA with settings access */}
      {(showPipelineHeader || (canAccessSettings && ['MGA', 'RGA'].includes(user?.clname))) && (
        <div className="pipeline-header">
          
          <div className="pipeline-header-actions">
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
            
            {/* View mode toggle - show only when on progress view */}
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {activeView === 'progress' && (
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

      {/* Onboarding Portal Link Section */}
      <div style={{ 
        background: 'var(--card-bg)', 
        padding: '20px', 
        margin: '20px 0',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <p style={{ fontSize: '14px', display: 'inline-flex', alignItems: 'center', marginBottom: '10px', color: 'var(--text-primary)' }}>
          Onboarding Portal Link 
          <span onClick={handleCopyOnboarding} style={{ marginLeft: '10px', cursor: 'pointer', color: 'var(--text-primary)' }}>
            {onboardingCopied ? <FaCheck color="green" /> : <FaRegCopy />}
          </span>
        </p>
        <a href={onboardingLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: 'var(--link-color)' }}>
          {onboardingLink}
        </a>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px', marginBottom: '0' }}>
          Share this link with new hires to access their onboarding checklist
        </p>
      </div>

      {/* Main content */}
      <div className="pipeline-content">
        {activeView === 'progress' ? (
          progressViewMode === 'kanban' ? (
            <PipelineKanban kpiFilter={activeKpiFilter} />
          ) : (
            <PipelineProgress kpiFilter={activeKpiFilter} />
          )
        ) : (
          <PipelineSettings />
        )}
      </div>
    </div>
  );
};

export default Pipeline;

