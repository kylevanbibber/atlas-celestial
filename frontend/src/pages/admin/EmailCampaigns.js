import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import CampaignBuilder from '../../components/admin/CampaignBuilder';
import './EmailCampaigns.css';

const EmailCampaigns = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testLagnname, setTestLagnname] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (activeTab === 'list') {
      fetchCampaigns();
    }
  }, [activeTab]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await api.get('/email-campaigns');
      setCampaigns(response.data.campaigns || []);
      setError('');
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await api.delete(`/email-campaigns/${campaignId}`);
      fetchCampaigns();
    } catch (err) {
      console.error('Error deleting campaign:', err);
      alert('Failed to delete campaign');
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      draft: 'status-draft',
      scheduled: 'status-scheduled',
      sending: 'status-sending',
      sent: 'status-sent',
      failed: 'status-failed'
    };

    return (
      <span className={`status-badge ${statusColors[status] || ''}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleTestWeeklyReport = async () => {
    if (!testLagnname.trim()) {
      alert('Please enter an agent name (lagnname)');
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const response = await api.post('/email-campaigns/test-weekly-report', {
        lagnname: testLagnname.trim()
      });

      setTestResult({
        success: true,
        message: response.data.message,
        data: response.data.reportData
      });
    } catch (err) {
      console.error('Error sending test weekly report:', err);
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Failed to send test report'
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendAllWeeklyReports = async () => {
    if (!window.confirm('This will send weekly reports to ALL active MGAs and RGAs. Continue?')) {
      return;
    }

    try {
      const response = await api.post('/email-campaigns/send-all-weekly-reports');
      alert(response.data.message);
    } catch (err) {
      console.error('Error triggering weekly reports:', err);
      alert('Failed to trigger weekly reports');
    }
  };

  const renderCampaignsList = () => {
    if (loading) {
      return <div className="loading">Loading campaigns...</div>;
    }

    if (error) {
      return <div className="error-message">{error}</div>;
    }

    if (campaigns.length === 0) {
      return (
        <div className="empty-state">
          <h3>No campaigns yet</h3>
          <p>Create your first email campaign to get started.</p>
          <button 
            className="btn-primary"
            onClick={() => setActiveTab('create')}
          >
            Create Campaign
          </button>
        </div>
      );
    }

    return (
      <div className="campaigns-table-container">
        <table className="campaigns-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Sent/Failed</th>
              <th>Created</th>
              <th>Sent At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <div className="campaign-name">{campaign.name}</div>
                  <div className="campaign-subject">{campaign.subject}</div>
                </td>
                <td>{getStatusBadge(campaign.status)}</td>
                <td>{campaign.recipient_count || 0}</td>
                <td>
                  <span className="sent-count">{campaign.sent_count || 0}</span>
                  {campaign.failed_count > 0 && (
                    <span className="failed-count"> / {campaign.failed_count}</span>
                  )}
                </td>
                <td>{formatDate(campaign.created_at)}</td>
                <td>{formatDate(campaign.sent_at)}</td>
                <td>
                  <div className="action-buttons">
                    {campaign.status === 'draft' && (
                      <button
                        className="btn-small btn-danger"
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="email-campaigns-page">
      <div className="page-header">
        <h1>Email Campaigns</h1>
        <p>Manage and send email campaigns to users</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Campaigns
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Campaign
        </button>
        <button
          className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          Weekly Reports
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'list' && renderCampaignsList()}
        {activeTab === 'create' && (
          <CampaignBuilder
            onSuccess={() => {
              setActiveTab('list');
              fetchCampaigns();
            }}
            onCancel={() => setActiveTab('list')}
          />
        )}
        {activeTab === 'weekly' && (
          <div className="weekly-reports-section">
            <h2>Weekly Production Reports</h2>
            <p className="section-description">
              Automated weekly reports are sent every Monday at 9:00 AM ET to all active MGAs and RGAs.
              Use the tools below to test or manually trigger reports.
            </p>

            <div className="weekly-reports-card">
              <h3>Test Single Report</h3>
              <p>Send a test weekly report to a specific MGA/RGA</p>
              
              <div className="test-report-form">
                <input
                  type="text"
                  placeholder="Enter lagnname (e.g., SMITH JOHN)"
                  value={testLagnname}
                  onChange={(e) => setTestLagnname(e.target.value.toUpperCase())}
                  className="form-input"
                  disabled={sendingTest}
                />
                <button
                  onClick={handleTestWeeklyReport}
                  disabled={sendingTest || !testLagnname.trim()}
                  className="btn-primary"
                >
                  {sendingTest ? 'Sending...' : 'Send Test Report'}
                </button>
              </div>

              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                  <h4>{testResult.success ? '✅ Success' : '❌ Error'}</h4>
                  <p>{testResult.message}</p>
                  {testResult.success && testResult.data && (
                    <div className="report-data-preview">
                      <h5>Report Data:</h5>
                      <ul>
                        <li>Codes MTD: {testResult.data.codesMTD}</li>
                        <li>Pending (Not Coded): {testResult.data.pendingNotCoded}</li>
                        <li>Hires MTD: {testResult.data.hiresMTD?.toFixed(1)}</li>
                        <li>Hire to Code Ratio: {testResult.data.hireToCodeRatio?.toFixed(2)}</li>
                        <li>Team ALP MTD: ${testResult.data.mgaTeamALP?.toLocaleString()}</li>
                        {testResult.data.isRGA && (
                          <li>RGA Team ALP MTD: ${testResult.data.rgaTeamALP?.toLocaleString()}</li>
                        )}
                        <li>Personal Production: ${testResult.data.personalProduction?.toLocaleString()}</li>
                        <li>Codes Last Month: {testResult.data.codesLastMonth}</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="weekly-reports-card">
              <h3>Send All Weekly Reports</h3>
              <p>Manually trigger weekly reports for all active MGAs and RGAs</p>
              <button
                onClick={handleSendAllWeeklyReports}
                className="btn-danger"
              >
                Send All Reports Now
              </button>
              <p className="warning-text">
                ⚠️ This will send emails to all active MGAs and RGAs. Use with caution!
              </p>
            </div>

            <div className="weekly-reports-card">
              <h3>Schedule Information</h3>
              <p>📅 <strong>Frequency:</strong> Every Monday at 9:00 AM ET</p>
              <p>👥 <strong>Recipients:</strong> All active users with clname = 'MGA' or 'RGA'</p>
              <p>📊 <strong>Report Includes:</strong></p>
              <ul>
                <li>Codes MTD (current month associates)</li>
                <li>Pending cases not yet coded (last 45 days)</li>
                <li>Hire to Code Ratio (YTD, rolling 13-week average)</li>
                <li>Hires MTD</li>
                <li>Team ALP MTD (and RGA Team ALP for RGAs)</li>
                <li>Personal Production MTD</li>
                <li>Codes from last month</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailCampaigns;


