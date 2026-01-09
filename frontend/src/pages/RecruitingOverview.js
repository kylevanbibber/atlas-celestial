import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiTrello, FiArrowRight } from 'react-icons/fi';
import StatCard from '../components/utils/StatCard';
import api from '../api';
import './ProductionOverview.css';

const RecruitingOverview = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch recruiting stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await api.get('/recruiting/stats').catch(() => ({ data: null }));
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching recruiting stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const sections = [
    {
      id: 'applicants',
      title: 'Applicants',
      description: 'Manage and track all applicants in your pipeline',
      icon: <FiUsers />,
      path: '/recruiting?section=applicants',
      color: '#3b82f6'
    },
    {
      id: 'pipeline',
      title: 'Pipeline',
      description: 'Visual pipeline view of your recruiting process',
      icon: <FiTrello />,
      path: '/recruiting?section=pipeline',
      color: '#10b981'
    }
  ];

  return (
    <div className="overview-page">
      <div className="overview-content">

        {/* Stats Cards */}
        <div className="stats-grid">
          <StatCard
            title="Total Applicants"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.totalApplicants || '0'}
            trend={loading ? 0 : stats?.applicantsTrend || 10}
            trendLabel="over last month"
            color="#3b82f6"
            onClick={() => navigate('/recruiting?section=applicants')}
          />

          <StatCard
            title="Active Pipeline"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.activePipeline || '0'}
            target={stats?.pipelineTarget || undefined}
            progress={loading ? 0 : stats?.pipelineProgress || 0}
            trend={loading ? 0 : stats?.pipelineTrend || 5}
            trendLabel="over last month"
            color="#10b981"
            onClick={() => navigate('/recruiting?section=pipeline')}
          />

          <StatCard
            title="New This Month"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.newThisMonth || '0'}
            target={stats?.monthlyTarget || undefined}
            progress={loading ? 0 : ((stats?.newThisMonth || 0) / (stats?.monthlyTarget || 10)) * 100}
            trend={loading ? 0 : stats?.newTrend || 15}
            trendLabel="vs last month"
            color="#f59e0b"
            onClick={() => navigate('/recruiting?section=applicants')}
          />

          <StatCard
            title="Pending Action"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.pendingAction || '0'}
            color="#8b5cf6"
            onClick={() => navigate('/recruiting?section=pipeline')}
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

export default RecruitingOverview;

