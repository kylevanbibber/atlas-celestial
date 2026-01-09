import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiActivity, FiTarget, FiAward, FiTrendingUp, FiList, FiPercent, FiCheckCircle, FiStar, FiArrowRight } from 'react-icons/fi';
import StatCard from '../components/utils/StatCard';
import api from '../api';
import './ProductionOverview.css';

const ProductionOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  const isSGANonAdmin = ['SA', 'GA', 'MGA', 'RGA'].includes(user?.clname) && user?.Role !== 'Admin';
  
  const shouldHideDailyActivity = isAppAdmin || isSGANonAdmin;
  const shouldHideGoals = isAppAdmin || isSGANonAdmin;
  const hasProductionTrackerAccess = user?.isAdmin || isAppAdmin;
  const hideVerificationForSGA = isSGANonAdmin;

  // Fetch production stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Fetch various production metrics
        const [dailyResponse, goalsResponse, leaderboardResponse] = await Promise.all([
          api.get('/dailyActivity/recent').catch(() => ({ data: null })),
          api.get('/production/goals/summary').catch(() => ({ data: null })),
          api.get('/production/leaderboard/summary').catch(() => ({ data: null }))
        ]);

        setStats({
          daily: dailyResponse.data,
          goals: goalsResponse.data,
          leaderboard: leaderboardResponse.data
        });
      } catch (error) {
        console.error('Error fetching production stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const sections = [
    ...(!shouldHideDailyActivity ? [{
      id: 'daily-activity',
      title: 'Daily Activity',
      description: 'Track and submit your daily production activities',
      icon: <FiActivity />,
      path: '/production?section=daily-activity',
      color: '#3b82f6'
    }] : []),
    ...(!shouldHideGoals ? [{
      id: 'goals',
      title: 'Goals',
      description: 'View and manage your production goals',
      icon: <FiTarget />,
      path: '/production?section=goals',
      color: '#10b981'
    }] : []),
    {
      id: 'leaderboard',
      title: 'Leaderboard',
      description: 'See how you rank against your peers',
      icon: <FiAward />,
      path: '/production?section=leaderboard',
      color: '#f59e0b'
    },
    ...(hasProductionTrackerAccess ? [{
      id: 'production-tracker',
      title: 'Production Tracker',
      description: 'Comprehensive production tracking and analytics',
      icon: <FiTrendingUp />,
      path: '/production?section=production-tracker',
      color: '#8b5cf6'
    }] : []),
    ...(isAppAdmin ? [{
      id: 'release',
      title: 'Release',
      description: 'Manage release notes and updates',
      icon: <FiList />,
      path: '/production?section=release',
      color: '#06b6d4'
    }] : []),
    {
      id: 'scorecard',
      title: 'Scorecard',
      description: 'View your comprehensive performance scorecard',
      icon: <FiPercent />,
      path: '/production?section=scorecard',
      color: '#ec4899'
    },
    ...(!hideVerificationForSGA ? [{
      id: 'verification',
      title: 'Verification',
      description: 'Verify and validate production submissions',
      icon: <FiCheckCircle />,
      path: '/production?section=verification',
      color: '#14b8a6'
    }] : []),
    {
      id: 'vips',
      title: 'Codes & VIPs',
      description: 'Manage special codes and VIP clients',
      icon: <FiStar />,
      path: '/production?section=vips',
      color: '#f97316'
    }
  ];

  return (
    <div className="overview-page">
      <div className="overview-content">

        {/* Stats Cards */}
        <div className="stats-grid">
          {!shouldHideDailyActivity && (
            <StatCard
              title="Daily Activity"
              subtitle={`as of ${new Date().toLocaleDateString()}`}
              value={loading ? '...' : stats?.daily?.todayCount || '0'}
              target="10"
              progress={loading ? 0 : ((stats?.daily?.todayCount || 0) / 10) * 100}
              trend={loading ? 0 : stats?.daily?.trend || 12}
              trendLabel="over last month"
              color="#3b82f6"
              onClick={() => navigate('/production?section=daily-activity')}
            />
          )}

          {!shouldHideGoals && (
            <StatCard
              title="Monthly Goal"
              subtitle={`as of ${new Date().toLocaleDateString()}`}
              value={loading ? '...' : `$${(stats?.goals?.current || 0).toLocaleString()}`}
              target={`$${(stats?.goals?.target || 0).toLocaleString()}`}
              progress={loading ? 0 : stats?.goals?.percentage || 0}
              trend={loading ? 0 : stats?.goals?.trend || 15}
              trendLabel="over last month"
              color="#10b981"
              onClick={() => navigate('/production?section=goals')}
            />
          )}

          <StatCard
            title="Leaderboard Rank"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : stats?.leaderboard?.rank ? `#${stats.leaderboard.rank}` : '-'}
            progress={loading ? 0 : stats?.leaderboard?.percentile || 0}
            trend={loading ? 0 : stats?.leaderboard?.trend || -3}
            trendLabel="change this month"
            color="#f59e0b"
            onClick={() => navigate('/production?section=leaderboard')}
          />

          <StatCard
            title="Performance Score"
            subtitle={`as of ${new Date().toLocaleDateString()}`}
            value={loading ? '...' : `${stats?.scorecard?.score || 0}%`}
            progress={loading ? 0 : stats?.scorecard?.score || 0}
            trend={loading ? 0 : stats?.scorecard?.trend || 5}
            trendLabel="over last month"
            color="#ec4899"
            onClick={() => navigate('/production?section=scorecard')}
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

export default ProductionOverview;

