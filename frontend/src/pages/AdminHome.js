import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import WidgetCard from '../components/utils/WidgetCard';
import {
  FiClipboard,
  FiCheckCircle,
  FiMail,
  FiTrendingUp,
  FiFileText,
  FiAward,
  FiBarChart2
} from 'react-icons/fi';
import './Dashboard.css';

/**
 * Admin Home Page for teamRole = 'app' users
 *
 * This is the landing page for app admin users, providing quick access to:
 * - Ref Entry
 * - Verification
 * - Leads
 * - Promotion Tracking
 * - Reports
 */
const AdminHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Verify user has app team role
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';

  if (!isAppAdmin) {
    return (
      <div className="dashboard-container padded-content-sm">
        <div className="dashboard-cards-wrapper">
          <div className="error-message">
            <h3>Access Denied</h3>
            <p>This page is only accessible to app team administrators.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container padded-content-sm">
      <div className="dashboard-header">
        <h1>Admin Home</h1>
        <p>Welcome, {user?.name || user?.lagnname || 'Admin'}</p>
      </div>

      <div className="dashboard-cards-wrapper" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        {/* Ref Entry Widget */}
        <WidgetCard
          title="Ref Entry"
          value="Enter Refs"
          icon={FiClipboard}
          color="#4caf50"
          linkTo="/ref-entry"
          onClick={() => navigate('/ref-entry')}
          subText="Collect and manage referrals"
        />

        {/* Verification Widget */}
        <WidgetCard
          title="Verification"
          value="Verify Apps"
          icon={FiCheckCircle}
          color="#2196f3"
          linkTo="/production?section=verification"
          onClick={() => navigate('/production?section=verification')}
          subText="Manage application verification"
        />

        {/* Leads Widget */}
        <WidgetCard
          title="Leads"
          value="Manage Leads"
          icon={FiMail}
          color="#ff9800"
          linkTo="/resources?active=leads"
          onClick={() => navigate('/resources?active=leads')}
          subText="Lead pack distribution"
        />

        {/* Promotion Tracking Widget */}
        <WidgetCard
          title="Promotion Tracking"
          value="Track Promos"
          icon={FiTrendingUp}
          color="#9c27b0"
          linkTo="/promotion-tracking"
          onClick={() => navigate('/promotion-tracking')}
          subText="Monitor agent promotions"
        />

        {/* Reports Widget */}
        <WidgetCard
          title="Reports"
          value="View Reports"
          icon={FiFileText}
          color="#f44336"
          linkTo="/reports"
          onClick={() => navigate('/reports')}
          subText="Analytics and reporting"
        />

        {/* Leaderboard Widget */}
        <WidgetCard
          title="Leaderboard"
          value="View Rankings"
          icon={FiAward}
          color="#ffc107"
          linkTo="/production?section=leaderboard"
          onClick={() => navigate('/production?section=leaderboard')}
          subText="Agent production rankings"
        />

        {/* P&P Widget */}
        <WidgetCard
          title="P&P"
          value="Policies & Procedures"
          icon={FiBarChart2}
          color="#00bcd4"
          linkTo="/production?section=pnp"
          onClick={() => navigate('/production?section=pnp')}
          subText="Policies and procedures"
        />
      </div>
    </div>
  );
};

export default AdminHome;
