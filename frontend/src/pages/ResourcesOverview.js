import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiFileText, FiClipboard, FiList, FiActivity, FiMail, FiArrowRight, FiTrendingUp } from 'react-icons/fi';
import StatCard from '../components/utils/StatCard';
import api from '../api';
import './ProductionOverview.css';

const ResourcesOverview = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const canViewRefs = hasPermission('view_refs');
  const canSeeTrialToolkit = !['AGT', 'SA', 'GA', 'MGA', 'RGA'].includes(user?.clname);

  // Fetch resources stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [reportsResponse, leadsResponse, licenseResponse] = await Promise.all([
          api.get('/reports/count').catch(() => ({ data: { count: 0 } })),
          api.get('/leads/stats').catch(() => ({ data: null })),
          api.get('/licensing/status').catch(() => ({ data: null }))
        ]);

        setStats({
          reports: reportsResponse.data?.count || 0,
          leads: leadsResponse.data,
          license: licenseResponse.data
        });
      } catch (error) {
        console.error('Error fetching resources stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const sections = [
    {
      id: 'reports',
      title: 'Reports',
      description: 'View and generate production reports',
      icon: <FiFileText />,
      path: '/resources?active=reports',
      color: '#3b82f6'
    },
    ...(canViewRefs ? [{
      id: 'refs',
      title: 'Refs Collected',
      description: 'Access reference materials and documentation',
      icon: <FiClipboard />,
      path: '/resources?active=refs',
      color: '#10b981'
    }] : []),
    {
      id: 'ref-sales',
      title: 'Ref Sales',
      description: 'View your ref sales status for the month',
      icon: <FiTrendingUp />,
      path: '/resources?active=ref-sales',
      color: '#6366f1'
    },
    {
      id: 'release',
      title: 'Release',
      description: 'View release notes and updates',
      icon: <FiList />,
      path: '/resources?active=release',
      color: '#06b6d4'
    },
    ...(canSeeTrialToolkit ? [{
      id: 'trial-toolkit',
      title: 'Trial Toolkit',
      description: 'Tools and resources for trial management',
      icon: <FiActivity />,
      path: '/resources?active=trial-toolkit',
      color: '#8b5cf6'
    }] : []),
    {
      id: 'leads',
      title: 'Leads',
      description: 'Manage and track your leads',
      icon: <FiMail />,
      path: '/resources?active=leads',
      color: '#f59e0b'
    },
    {
      id: 'licensing',
      title: 'Licensing',
      description: 'Manage licensing information and requirements',
      icon: <FiFileText />,
      path: '/resources?active=licensing',
      color: '#ec4899'
    }
  ];

  return (
    <div className="overview-page">
      <div className="overview-content">

        {/* Stats Cards */}
        <div className="stats-grid">
          <StatCard
            title="Available Reports"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.reports || '0'}
            color="#3b82f6"
            onClick={() => navigate('/resources?active=reports')}
          />

          <StatCard
            title="Active Leads"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.leads?.active || '0'}
            target={stats?.leads?.total || undefined}
            progress={loading ? 0 : stats?.leads?.conversionRate || 0}
            trend={loading ? 0 : stats?.leads?.trend || 8}
            trendLabel="over last month"
            color="#f59e0b"
            onClick={() => navigate('/resources?active=leads')}
          />

          {canViewRefs && (
            <StatCard
              title="Reference Materials"
              subtitle={`as of ${new Date().toLocaleDateString()}`}
              value={loading ? '...' : stats?.refs?.count || '-'}
              color="#10b981"
              onClick={() => navigate('/resources?active=refs')}
            />
          )}

          <StatCard
            title="License Status"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.license?.status || 'Active'}
            progress={loading ? 0 : 100}
            color="#ec4899"
            onClick={() => navigate('/resources?active=licensing')}
          />
        </div>

        {/* Quick Actions / Section Navigation */}
        <div className="overview-section">
          <h2>Quick Access</h2>
          <div className="overview-grid">
            {sections.map((section) => (
              <div
                key={section.id}
                className="overview-card"
                onClick={() => navigate(section.path)}
                style={{ '--card-color': section.color }}
              >
                <div className="overview-card-icon" style={{ color: section.color }}>
                  {section.icon}
                </div>
                <div className="overview-card-content">
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
                <div className="overview-card-arrow">
                  <FiArrowRight />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourcesOverview;

