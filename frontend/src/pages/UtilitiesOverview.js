import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiUsers, FiBarChart2, FiBell, FiCalendar, FiAward, FiActivity, FiSend, FiArrowRight } from 'react-icons/fi';
import StatCard from '../components/utils/StatCard';
import api from '../api';
import './ProductionOverview.css';

const UtilitiesOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  const isSGANonAdmin = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname) && user?.Role !== 'Admin';
  const isKyle = user?.lagnname?.toUpperCase().includes('VANBIBBER') || user?.userId === 92;
  const isAdmin = user?.isAdmin;

  // Fetch utilities stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [notificationsResponse, hierarchyResponse] = await Promise.all([
          api.get('/notifications/unread-count').catch(() => ({ data: { count: 0 } })),
          api.get('/hierarchy/team-size').catch(() => ({ data: null }))
        ]);

        setStats({
          notifications: notificationsResponse.data?.count || 0,
          teamSize: hierarchyResponse.data?.size || 0
        });
      } catch (error) {
        console.error('Error fetching utilities stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const sections = [
    ...(!isAppAdmin && !isSGANonAdmin ? [{
      id: 'account',
      title: 'Account',
      description: 'Manage your account settings and preferences',
      icon: <FiUser />,
      path: '/utilities?section=account',
      color: '#3b82f6'
    }] : []),
    ...(isAdmin || !isAppAdmin ? [{
      id: 'oneonone',
      title: '1-on-1',
      description: 'Schedule and manage one-on-one meetings',
      icon: <FiUsers />,
      path: '/utilities?section=oneonone',
      color: '#10b981'
    }] : []),
    {
      id: 'pnp',
      title: 'P&P',
      description: 'Policies and procedures documentation',
      icon: <FiBarChart2 />,
      path: '/utilities?section=pnp',
      color: '#06b6d4'
    },
    {
      id: 'hierarchy',
      title: 'Hierarchy',
      description: 'View and manage organizational hierarchy',
      icon: <FiUsers />,
      path: '/utilities?section=hierarchy',
      color: '#8b5cf6'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Manage your notification preferences',
      icon: <FiBell />,
      path: '/utilities?section=notifications',
      color: '#f59e0b'
    },
    ...(isAdmin || isAppAdmin ? [{
      id: 'date-overrides',
      title: 'Date Overrides',
      description: 'Manage date overrides and exceptions',
      icon: <FiCalendar />,
      path: '/utilities?section=date-overrides',
      color: '#ec4899'
    }] : []),
    ...(isAdmin || isAppAdmin ? [{
      id: 'competitions',
      title: 'Competitions',
      description: 'Create and manage competitions',
      icon: <FiAward />,
      path: '/utilities?section=competitions',
      color: '#14b8a6'
    }] : []),
    ...(isKyle ? [{
      id: 'analytics',
      title: 'Analytics',
      description: 'View detailed analytics and insights',
      icon: <FiActivity />,
      path: '/utilities?section=analytics',
      color: '#f97316'
    }] : []),
    ...(isAdmin && isAppAdmin ? [{
      id: 'email-campaigns',
      title: 'Email Campaigns',
      description: 'Manage email campaigns and communications',
      icon: <FiSend />,
      path: '/utilities?section=email-campaigns',
      color: '#6366f1'
    }] : [])
  ];

  return (
    <div className="overview-page">
      <div className="overview-content">

        {/* Stats Cards */}
        <div className="stats-grid">
          {!isAppAdmin && !isSGANonAdmin && (
            <StatCard
              title="Account Status"
              subtitle={`as of ${new Date().toLocaleDateString()}`}
              value="Active"
              progress={100}
              color="#3b82f6"
              onClick={() => navigate('/utilities?section=account')}
            />
          )}

          <StatCard
            title="Notifications"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.notifications || '0'}
            color="#f59e0b"
            onClick={() => navigate('/utilities?section=notifications')}
          />

          <StatCard
            title="Team Size"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.teamSize || '0'}
            trend={loading ? 0 : stats?.teamGrowth || 3}
            trendLabel="over last month"
            color="#8b5cf6"
            onClick={() => navigate('/utilities?section=hierarchy')}
          />

          <StatCard
            title="P&P Status"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value="Current"
            progress={100}
            color="#06b6d4"
            onClick={() => navigate('/utilities?section=pnp')}
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

export default UtilitiesOverview;

