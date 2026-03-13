import React, { useState, useEffect, useCallback } from 'react';
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

  // Weekly report history state
  const [reportRuns, setReportRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsTotal, setRunsTotal] = useState(0);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runRecipients, setRunRecipients] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [expandedRecipient, setExpandedRecipient] = useState(null);

  // Email Log state
  const [logBatches, setLogBatches] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logTotal, setLogTotal] = useState(0);
  const [logSourceFilter, setLogSourceFilter] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchRecipients, setBatchRecipients] = useState([]);
  const [batchRecipientsLoading, setBatchRecipientsLoading] = useState(false);
  const [batchRecipientsTotal, setBatchRecipientsTotal] = useState(0);
  const [batchStatusFilter, setBatchStatusFilter] = useState('all');
  const [batchSearch, setBatchSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'list') {
      fetchCampaigns();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'weekly') {
      fetchReportRuns();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'email-log') {
      fetchLogBatches();
    }
  }, [activeTab, logSourceFilter]);

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

  const fetchReportRuns = async () => {
    try {
      setRunsLoading(true);
      const response = await api.get('/email-campaigns/weekly-report-runs?limit=50');
      setReportRuns(response.data.runs || []);
      setRunsTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error fetching report runs:', err);
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchRunRecipients = useCallback(async (runId, status = 'all', search = '') => {
    try {
      setRecipientsLoading(true);
      const params = new URLSearchParams({ limit: '200' });
      if (status && status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      
      const response = await api.get(`/email-campaigns/weekly-report-runs/${runId}/recipients?${params}`);
      setRunRecipients(response.data.recipients || []);
      setRecipientsTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error fetching run recipients:', err);
    } finally {
      setRecipientsLoading(false);
    }
  }, []);

  // Email Log fetch functions
  const fetchLogBatches = async () => {
    try {
      setLogLoading(true);
      const params = new URLSearchParams({ limit: '50' });
      if (logSourceFilter) params.append('source', logSourceFilter);
      const response = await api.get(`/email-campaigns/email-log?${params}`);
      setLogBatches(response.data.batches || []);
      setLogTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error fetching email log:', err);
    } finally {
      setLogLoading(false);
    }
  };

  const fetchBatchRecipients = useCallback(async (batchId, status = 'all', search = '') => {
    try {
      setBatchRecipientsLoading(true);
      const params = new URLSearchParams({ limit: '200' });
      if (status && status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      const response = await api.get(`/email-campaigns/email-log/${batchId}/recipients?${params}`);
      setBatchRecipients(response.data.recipients || []);
      setBatchRecipientsTotal(response.data.total || 0);
    } catch (err) {
      console.error('Error fetching batch recipients:', err);
    } finally {
      setBatchRecipientsLoading(false);
    }
  }, []);

  const handleSelectBatch = (batch) => {
    setSelectedBatch(batch);
    setBatchStatusFilter('all');
    setBatchSearch('');
    fetchBatchRecipients(batch.id);
  };

  const handleBatchStatusChange = (status) => {
    setBatchStatusFilter(status);
    if (selectedBatch) {
      fetchBatchRecipients(selectedBatch.id, status, batchSearch);
    }
  };

  const handleBatchSearch = (search) => {
    setBatchSearch(search);
    if (selectedBatch) {
      fetchBatchRecipients(selectedBatch.id, batchStatusFilter, search);
    }
  };

  const getSourceLabel = (source) => {
    const labels = {
      daily_reminder: 'Daily Reminder',
      weekly_report: 'Weekly Report',
      campaign: 'Campaign',
      verification: 'Verification',
      manual: 'Manual'
    };
    return labels[source] || source;
  };

  const handleSelectRun = (run) => {
    setSelectedRun(run);
    setRecipientFilter('all');
    setRecipientSearch('');
    setExpandedRecipient(null);
    fetchRunRecipients(run.id);
  };

  const handleRecipientFilterChange = (status) => {
    setRecipientFilter(status);
    if (selectedRun) {
      fetchRunRecipients(selectedRun.id, status, recipientSearch);
    }
  };

  const handleRecipientSearch = (search) => {
    setRecipientSearch(search);
    if (selectedRun) {
      fetchRunRecipients(selectedRun.id, recipientFilter, search);
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
      failed: 'status-failed',
      running: 'status-sending',
      completed: 'status-sent',
      pending: 'status-scheduled'
    };

    return (
      <span className={`status-badge ${statusColors[status] || ''}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return '—';
    const ms = new Date(end) - new Date(start);
    if (ms < 1000) return '<1s';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const getTriggeredByLabel = (run) => {
    if (run.triggered_by === 'cron') return '⏰ Scheduled';
    if (run.triggered_by === 'manual') return `👤 Manual${run.triggered_by_name ? ` (${run.triggered_by_name})` : ''}`;
    if (run.triggered_by === 'test') return `🧪 Test${run.triggered_by_name ? ` (${run.triggered_by_name})` : ''}`;
    return run.triggered_by;
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

      // Refresh run history
      fetchReportRuns();
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
    if (!window.confirm('This will send weekly reports to ALL active MGAs, RGAs, SAs, and GAs. Continue?')) {
      return;
    }

    try {
      const response = await api.post('/email-campaigns/send-all-weekly-reports');
      alert(response.data.message);
      // Refresh runs after a brief delay
      setTimeout(() => fetchReportRuns(), 2000);
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

  const renderRunHistory = () => {
    if (runsLoading && reportRuns.length === 0) {
      return <div className="loading">Loading report history...</div>;
    }

    if (reportRuns.length === 0) {
      return (
        <div className="empty-state">
          <h3>No weekly reports sent yet</h3>
          <p>Reports will appear here after the next scheduled run (Monday 9:00 AM ET) or when you trigger one manually.</p>
        </div>
      );
    }

    return (
      <div className="run-history">
        <div className="run-history-header">
          <h3>Send History</h3>
          <button className="btn-small btn-outline" onClick={fetchReportRuns} disabled={runsLoading}>
            {runsLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
        <div className="runs-table-container">
          <table className="campaigns-table runs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Triggered By</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reportRuns.map((run) => (
                <tr 
                  key={run.id} 
                  className={`run-row ${selectedRun?.id === run.id ? 'selected' : ''}`}
                  onClick={() => handleSelectRun(run)}
                >
                  <td className="run-date">{formatDate(run.started_at)}</td>
                  <td>{getTriggeredByLabel(run)}</td>
                  <td>{getStatusBadge(run.status)}</td>
                  <td className="run-stat">{run.total_recipients}</td>
                  <td className="run-stat run-success">{run.success_count}</td>
                  <td className="run-stat run-fail">{run.fail_count > 0 ? run.fail_count : '—'}</td>
                  <td className="run-duration">{formatDuration(run.started_at, run.completed_at)}</td>
                  <td>
                    <button className="btn-small btn-outline" onClick={(e) => { e.stopPropagation(); handleSelectRun(run); }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRunDetail = () => {
    if (!selectedRun) return null;

    // Parse summary for role breakdown
    let summary = null;
    try {
      summary = typeof selectedRun.summary === 'string' ? JSON.parse(selectedRun.summary) : selectedRun.summary;
    } catch (e) { /* ignore */ }

    return (
      <div className="run-detail">
        <div className="run-detail-header">
          <div>
            <h3>Run Details — {formatDate(selectedRun.started_at)}</h3>
            <div className="run-detail-meta">
              {getStatusBadge(selectedRun.status)} &nbsp;
              {getTriggeredByLabel(selectedRun)} &nbsp;•&nbsp; 
              Duration: {formatDuration(selectedRun.started_at, selectedRun.completed_at)}
            </div>
          </div>
          <button className="btn-small btn-outline" onClick={() => { setSelectedRun(null); setRunRecipients([]); }}>
            ✕ Close
          </button>
        </div>

        {/* Summary cards */}
        <div className="run-summary-cards">
          <div className="summary-card">
            <div className="summary-card-value">{selectedRun.total_recipients}</div>
            <div className="summary-card-label">Total Recipients</div>
          </div>
          <div className="summary-card summary-card-success">
            <div className="summary-card-value">{selectedRun.success_count}</div>
            <div className="summary-card-label">Sent</div>
          </div>
          <div className="summary-card summary-card-fail">
            <div className="summary-card-value">{selectedRun.fail_count}</div>
            <div className="summary-card-label">Failed</div>
          </div>
          {selectedRun.total_recipients > 0 && (
            <div className="summary-card">
              <div className="summary-card-value">
                {Math.round((selectedRun.success_count / selectedRun.total_recipients) * 100)}%
              </div>
              <div className="summary-card-label">Success Rate</div>
            </div>
          )}
        </div>

        {/* Role breakdown */}
        {summary && (
          <div className="role-breakdown">
            <h4>Breakdown by Role</h4>
            <div className="role-breakdown-grid">
              {Object.entries(summary).map(([role, counts]) => {
                const total = (counts.success || 0) + (counts.fail || 0);
                if (total === 0) return null;
                return (
                  <div key={role} className="role-card">
                    <div className="role-card-name">{role}</div>
                    <div className="role-card-stats">
                      <span className="role-success">✓ {counts.success || 0}</span>
                      {counts.fail > 0 && <span className="role-fail">✕ {counts.fail}</span>}
                      <span className="role-total">/ {total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recipient list */}
        <div className="recipients-section">
          <div className="recipients-header">
            <h4>Recipients ({recipientsTotal})</h4>
            <div className="recipients-filters">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={recipientSearch}
                onChange={(e) => handleRecipientSearch(e.target.value)}
                className="form-input recipient-search-input"
              />
              <div className="filter-pills">
                {['all', 'sent', 'failed'].map((s) => (
                  <button
                    key={s}
                    className={`filter-pill ${recipientFilter === s ? 'active' : ''}`}
                    onClick={() => handleRecipientFilterChange(s)}
                  >
                    {s === 'all' ? 'All' : s === 'sent' ? '✓ Sent' : '✕ Failed'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {recipientsLoading ? (
            <div className="loading">Loading recipients...</div>
          ) : runRecipients.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <p>No recipients found{recipientFilter !== 'all' || recipientSearch ? ' matching filters' : ''}.</p>
            </div>
          ) : (
            <div className="recipients-table-container">
              <table className="campaigns-table recipients-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Sent At</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {runRecipients.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr className={`recipient-row ${r.status === 'failed' ? 'row-failed' : ''}`}>
                        <td className="recipient-name">{r.lagnname}</td>
                        <td>{r.clname}</td>
                        <td className="recipient-email">{r.email}</td>
                        <td>{getStatusBadge(r.status)}</td>
                        <td>{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                        <td>
                          {r.report_data && (
                            <button
                              className="btn-small btn-outline"
                              onClick={() => setExpandedRecipient(expandedRecipient === r.id ? null : r.id)}
                            >
                              {expandedRecipient === r.id ? 'Hide' : 'Data'}
                            </button>
                          )}
                          {r.status === 'failed' && r.error_message && (
                            <span className="error-tooltip" title={r.error_message}>⚠️</span>
                          )}
                        </td>
                      </tr>
                      {expandedRecipient === r.id && r.report_data && (
                        <tr className="expanded-data-row">
                          <td colSpan="6">
                            <div className="report-data-grid">
                              {(() => {
                                let data;
                                try {
                                  data = typeof r.report_data === 'string' ? JSON.parse(r.report_data) : r.report_data;
                                } catch (e) {
                                  return <p>Unable to parse report data</p>;
                                }
                                return (
                                  <>
                                    <div className="data-item">
                                      <span className="data-label">Codes MTD</span>
                                      <span className="data-value">{data.codesMTD ?? '—'}</span>
                                    </div>
                                    <div className="data-item">
                                      <span className="data-label">Hires MTD</span>
                                      <span className="data-value">{data.hiresMTD != null ? Math.round(data.hiresMTD) : '—'}</span>
                                    </div>
                                    <div className="data-item">
                                      <span className="data-label">Pending (45d)</span>
                                      <span className="data-value">{data.pendingNotCoded ?? '—'}</span>
                                    </div>
                                    <div className="data-item">
                                      <span className="data-label">Hire:Code Ratio</span>
                                      <span className="data-value">{data.hireToCodeRatio != null ? data.hireToCodeRatio.toFixed(2) : '—'}</span>
                                    </div>
                                    <div className="data-item">
                                      <span className="data-label">MGA Team ALP</span>
                                      <span className="data-value">{formatCurrency(data.mgaTeamALP)}</span>
                                    </div>
                                    {data.rgaTeamALP != null && data.rgaTeamALP !== 0 && (
                                      <div className="data-item">
                                        <span className="data-label">RGA Team ALP</span>
                                        <span className="data-value">{formatCurrency(data.rgaTeamALP)}</span>
                                      </div>
                                    )}
                                    <div className="data-item">
                                      <span className="data-label">Personal Prod</span>
                                      <span className="data-value">{formatCurrency(data.personalProduction)}</span>
                                    </div>
                                    <div className="data-item">
                                      <span className="data-label">Codes Last Mo</span>
                                      <span className="data-value">{data.codesLastMonth ?? '—'}</span>
                                    </div>
                                    <div className="data-item">
                                      <span className="data-label">VIPs Last Mo</span>
                                      <span className="data-value">{data.vipsLastMonth ?? '—'}</span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmailLog = () => {
    return (
      <div className="email-log-section">
        <div className="email-log-header">
          <h2>Email Communications Log</h2>
          <div className="email-log-controls">
            <select
              className="form-input source-filter-select"
              value={logSourceFilter}
              onChange={(e) => setLogSourceFilter(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="daily_reminder">Daily Reminder</option>
              <option value="weekly_report">Weekly Report</option>
              <option value="campaign">Campaign</option>
              <option value="verification">Verification</option>
            </select>
            <button className="btn-small btn-outline" onClick={fetchLogBatches} disabled={logLoading}>
              {logLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {logLoading && logBatches.length === 0 ? (
          <div className="loading">Loading email log...</div>
        ) : logBatches.length === 0 ? (
          <div className="empty-state">
            <h3>No emails logged yet</h3>
            <p>Email sends will appear here once the system starts logging them.</p>
          </div>
        ) : (
          <div className="runs-table-container">
            <table className="campaigns-table runs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Subject</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Total</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className={`run-row ${selectedBatch?.id === batch.id ? 'selected' : ''}`}
                    onClick={() => handleSelectBatch(batch)}
                  >
                    <td className="run-date">{formatDate(batch.started_at)}</td>
                    <td>
                      <span className={`source-badge source-${batch.source}`}>
                        {getSourceLabel(batch.source)}
                      </span>
                    </td>
                    <td className="batch-subject">{batch.subject}</td>
                    <td className="run-stat run-success">{batch.sent_count}</td>
                    <td className="run-stat run-fail">{batch.failed_count > 0 ? batch.failed_count : '—'}</td>
                    <td className="run-stat">{batch.total_count}</td>
                    <td className="run-duration">{formatDuration(batch.started_at, batch.completed_at)}</td>
                    <td>
                      <button className="btn-small btn-outline" onClick={(e) => { e.stopPropagation(); handleSelectBatch(batch); }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedBatch && (
          <div className="run-detail">
            <div className="run-detail-header">
              <div>
                <h3>{selectedBatch.subject}</h3>
                <div className="run-detail-meta">
                  <span className={`source-badge source-${selectedBatch.source}`}>
                    {getSourceLabel(selectedBatch.source)}
                  </span>
                  &nbsp;•&nbsp; {formatDate(selectedBatch.started_at)}
                  &nbsp;•&nbsp; Duration: {formatDuration(selectedBatch.started_at, selectedBatch.completed_at)}
                </div>
              </div>
              <button className="btn-small btn-outline" onClick={() => { setSelectedBatch(null); setBatchRecipients([]); }}>
                Close
              </button>
            </div>

            <div className="run-summary-cards">
              <div className="summary-card">
                <div className="summary-card-value">{selectedBatch.total_count}</div>
                <div className="summary-card-label">Total</div>
              </div>
              <div className="summary-card summary-card-success">
                <div className="summary-card-value">{selectedBatch.sent_count}</div>
                <div className="summary-card-label">Sent</div>
              </div>
              <div className="summary-card summary-card-fail">
                <div className="summary-card-value">{selectedBatch.failed_count}</div>
                <div className="summary-card-label">Failed</div>
              </div>
              {selectedBatch.total_count > 0 && (
                <div className="summary-card">
                  <div className="summary-card-value">
                    {Math.round((selectedBatch.sent_count / selectedBatch.total_count) * 100)}%
                  </div>
                  <div className="summary-card-label">Success Rate</div>
                </div>
              )}
            </div>

            <div className="recipients-section">
              <div className="recipients-header">
                <h4>Recipients ({batchRecipientsTotal})</h4>
                <div className="recipients-filters">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={batchSearch}
                    onChange={(e) => handleBatchSearch(e.target.value)}
                    className="form-input recipient-search-input"
                  />
                  <div className="filter-pills">
                    {['all', 'sent', 'failed'].map((s) => (
                      <button
                        key={s}
                        className={`filter-pill ${batchStatusFilter === s ? 'active' : ''}`}
                        onClick={() => handleBatchStatusChange(s)}
                      >
                        {s === 'all' ? 'All' : s === 'sent' ? 'Sent' : 'Failed'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {batchRecipientsLoading ? (
                <div className="loading">Loading recipients...</div>
              ) : batchRecipients.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p>No recipients found{batchStatusFilter !== 'all' || batchSearch ? ' matching filters' : ''}.</p>
                </div>
              ) : (
                <div className="recipients-table-container">
                  <table className="campaigns-table recipients-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Sent At</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRecipients.map((r) => (
                        <tr key={r.id} className={`recipient-row ${r.status === 'failed' ? 'row-failed' : ''}`}>
                          <td className="recipient-name">{r.recipient_name || '—'}</td>
                          <td className="recipient-email">{r.recipient_email}</td>
                          <td>{getStatusBadge(r.status)}</td>
                          <td>{r.sent_at ? formatDate(r.sent_at) : '—'}</td>
                          <td>
                            {r.status === 'failed' && r.error_message && (
                              <span className="error-tooltip" title={r.error_message}>
                                {r.error_message.substring(0, 40)}{r.error_message.length > 40 ? '...' : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="email-campaigns-page">
      <div className="page-header">
        <h1>Email Communications</h1>
        <p>Manage campaigns, view reports, and track all outbound emails</p>
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
        <button
          className={`tab ${activeTab === 'email-log' ? 'active' : ''}`}
          onClick={() => setActiveTab('email-log')}
        >
          Email Log
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
              Automated weekly reports are sent every Monday at 9:00 AM ET to all active MGAs, RGAs, SAs, and GAs.
            </p>

            {/* Actions row */}
            <div className="weekly-actions-row">
              <div className="weekly-reports-card weekly-action-card">
                <h3>🧪 Test Single Report</h3>
                <p>Send a test weekly report to a specific user</p>
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
                    {sendingTest ? 'Sending...' : 'Send Test'}
                  </button>
                </div>
                {testResult && (
                  <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                    <strong>{testResult.success ? '✅' : '❌'}</strong> {testResult.message}
                  </div>
                )}
              </div>

              <div className="weekly-reports-card weekly-action-card">
                <h3>📤 Send All Reports</h3>
                <p>Manually trigger weekly reports for all active MGAs, RGAs, SAs, and GAs</p>
                <button
                  onClick={handleSendAllWeeklyReports}
                  className="btn-danger"
                >
                  Send All Reports Now
                </button>
                <p className="warning-text">
                  ⚠️ This will send emails to all eligible recipients
                </p>
              </div>
            </div>

            {/* Run history */}
            {renderRunHistory()}

            {/* Selected run detail */}
            {renderRunDetail()}
          </div>
        )}
        {activeTab === 'email-log' && renderEmailLog()}
      </div>
    </div>
  );
};

export default EmailCampaigns;
