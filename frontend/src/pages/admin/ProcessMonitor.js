import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FiActivity, FiRefreshCw, FiPlay, FiUpload, FiClock, FiList, FiAlertCircle, FiCheckCircle, FiLoader, FiRadio } from 'react-icons/fi';
import api from '../../api';
import './ProcessMonitor.css';

const ProcessMonitor = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [processes, setProcesses] = useState([]);
  const [healthStatus, setHealthStatus] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runsPagination, setRunsPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filterProcess, setFilterProcess] = useState('');

  // Action states
  const [triggeringProcess, setTriggeringProcess] = useState(null);
  const [uploadModal, setUploadModal] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rewatching, setRewatching] = useState(false);
  const fileInputRef = useRef(null);

  const hasAccess = hasPermission('admin');

  const fetchProcesses = useCallback(async () => {
    try {
      const response = await api.get('/process-monitor/processes');
      if (response.data.success) {
        setProcesses(response.data.processes);
      }
    } catch (error) {
      console.error('Error fetching processes:', error);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      setHealthStatus({ status: 'checking' });
      const response = await api.get('/process-monitor/status');
      setHealthStatus(response.data);
    } catch (error) {
      setHealthStatus({ status: 'unreachable', error: error.message });
    }
  }, []);

  const fetchRuns = useCallback(async (page = 1, processName = '') => {
    try {
      const params = { page, limit: 25 };
      if (processName) params.process_name = processName;
      const response = await api.get('/process-monitor/runs', { params });
      if (response.data.success) {
        setRuns(response.data.runs);
        setRunsPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching runs:', error);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProcesses(), fetchHealth(), fetchRuns(1, filterProcess)]);
    setLoading(false);
  }, [fetchProcesses, fetchHealth, fetchRuns, filterProcess]);

  useEffect(() => {
    if (hasAccess) loadAll();
  }, [hasAccess, loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProcesses(), fetchHealth(), fetchRuns(runsPagination.page, filterProcess)]);
    setRefreshing(false);
  };

  const handleRewatch = async () => {
    setRewatching(true);
    try {
      const response = await api.post('/process-monitor/rewatch');
      if (response.data.success) {
        const expiration = response.data.watch?.expiration;
        const expiresAt = expiration ? new Date(Number(expiration)).toLocaleString() : 'unknown';
        alert(`Gmail watch renewed successfully. Expires: ${expiresAt}`);
      } else {
        alert(`Rewatch failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Rewatch failed:', error);
      alert(`Failed to renew Gmail watch: ${error.response?.data?.error || error.message}`);
    } finally {
      setRewatching(false);
    }
  };

  const handleTrigger = async (process) => {
    if (!process.subject) return;
    setTriggeringProcess(process.name);
    try {
      await api.post('/process-monitor/trigger', { subject: process.subject });
      // Processing runs in background on the Python side — poll a few times
      // to catch when the run record appears in the DB
      let delay = 4000;
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, delay));
        await Promise.all([fetchProcesses(), fetchRuns(1, filterProcess)]);
        delay = 8000;
      }
    } catch (error) {
      console.error('Trigger failed:', error);
      alert(`Failed to trigger ${process.name}: ${error.response?.data?.error || error.message}`);
    } finally {
      setTriggeringProcess(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadModal) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      await api.post(`/process-monitor/upload/${encodeURIComponent(uploadModal.name)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setUploadModal(null);
      setUploadFile(null);
      setTimeout(() => {
        fetchProcesses();
        fetchRuns(1, filterProcess);
      }, 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFilterChange = (processName) => {
    setFilterProcess(processName);
    fetchRuns(1, processName);
  };

  const handlePageChange = (page) => {
    fetchRuns(page, filterProcess);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return '-';
    const ms = new Date(end) - new Date(start);
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getHealthLabel = () => {
    if (!healthStatus) return 'Checking...';
    if (healthStatus.status === 'checking') return 'Checking...';
    if (healthStatus.status === 'healthy') return 'Healthy';
    if (healthStatus.status === 'unreachable') return 'Unreachable';
    return 'Unhealthy';
  };

  const getHealthClass = () => {
    if (!healthStatus || healthStatus.status === 'checking') return 'checking';
    if (healthStatus.status === 'healthy') return 'healthy';
    return 'unhealthy';
  };

  if (!hasAccess) {
    return (
      <div className="pm-access-denied">
        <h2>Access Denied</h2>
        <p>You need admin permissions to view the Process Monitor.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="process-monitor-loading">Loading process monitor...</div>;
  }

  return (
    <div className="process-monitor">
      {/* Header */}
      <div className="process-monitor-header">
        <div className="process-monitor-header-left">
          <h1>
            <FiActivity />
            Web Processor Monitor
          </h1>
          <p className="process-monitor-subtitle">Monitor and control the Python email processor</p>
        </div>
        <div className="process-monitor-header-actions">
          <span className={`health-badge ${getHealthClass()}`}>
            <span className={`health-dot ${getHealthClass()}`} />
            {getHealthLabel()}
          </span>
          <button className={`rewatch-btn ${rewatching ? 'spinning' : ''}`} onClick={handleRewatch} disabled={rewatching}>
            <FiRadio />
            {rewatching ? 'Renewing...' : 'Renew Watch'}
          </button>
          <button className={`refresh-btn ${refreshing ? 'spinning' : ''}`} onClick={handleRefresh} disabled={refreshing}>
            <FiRefreshCw />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="process-monitor-tabs">
        <button className={`pm-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          <FiActivity /> Processes
        </button>
        <button className={`pm-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); fetchRuns(1, filterProcess); }}>
          <FiList /> Run History
        </button>
      </div>

      {/* Overview Tab - Process Cards */}
      {activeTab === 'overview' && (
        <div className="process-cards-grid">
          {processes.map((proc) => (
            <div className="process-card" key={proc.name}>
              <div className="process-card-header">
                <h3 className="process-card-title">{proc.name}</h3>
                {proc.lastRun && (
                  <span className={`status-badge ${proc.lastRun.status}`}>
                    {proc.lastRun.status === 'success' && <FiCheckCircle />}
                    {proc.lastRun.status === 'error' && <FiAlertCircle />}
                    {proc.lastRun.status === 'running' && <FiLoader />}
                    {proc.lastRun.status}
                  </span>
                )}
              </div>
              <p className="process-card-description">{proc.description}</p>
              <div className="process-card-processors">
                {proc.processors.map((p) => (
                  <span className="processor-tag" key={p}>{p}</span>
                ))}
              </div>

              {proc.lastRun ? (
                <div className="process-card-last-run">
                  <div className="last-run-row">
                    <span className="last-run-label">Last run</span>
                    <span className="last-run-value">{formatDate(proc.lastRun.started_at)}</span>
                  </div>
                  <div className="last-run-row">
                    <span className="last-run-label">Records</span>
                    <span className="last-run-value">{proc.lastRun.records_processed || 0}</span>
                  </div>
                  <div className="last-run-row">
                    <span className="last-run-label">Duration</span>
                    <span className="last-run-value">{formatDuration(proc.lastRun.started_at, proc.lastRun.completed_at)}</span>
                  </div>
                  <div className="last-run-row">
                    <span className="last-run-label">Trigger</span>
                    <span className={`trigger-badge ${proc.lastRun.trigger_type}`}>{proc.lastRun.trigger_type}</span>
                  </div>
                  {proc.lastRun.error_message && (
                    <div className="error-text" title={proc.lastRun.error_message}>
                      {proc.lastRun.error_message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-runs-yet">No runs recorded yet</div>
              )}

              <div className="process-card-actions">
                {proc.subject && (
                  <button
                    className="action-btn primary"
                    onClick={() => handleTrigger(proc)}
                    disabled={triggeringProcess === proc.name}
                  >
                    {triggeringProcess === proc.name ? <FiLoader /> : <FiPlay />}
                    {triggeringProcess === proc.name ? 'Running...' : 'Run Now'}
                  </button>
                )}
                {proc.acceptsUpload && (
                  <button className="action-btn" onClick={() => { setUploadModal(proc); setUploadFile(null); }}>
                    <FiUpload /> Upload File
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="run-history-section">
          <h2><FiClock /> Run History</h2>
          <div className="run-history-filters">
            <select
              className="filter-select"
              value={filterProcess}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">All Processes</option>
              {processes.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="run-history-table-wrapper">
            <table className="run-history-table">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Processor</th>
                  <th>Status</th>
                  <th>Records</th>
                  <th>Trigger</th>
                  <th>File</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No process runs found
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr key={run.id}>
                      <td style={{ fontWeight: 500 }}>{run.process_name}</td>
                      <td><span className="processor-tag">{run.processor}</span></td>
                      <td>
                        <span className={`status-badge ${run.status}`}>
                          {run.status === 'success' && <FiCheckCircle />}
                          {run.status === 'error' && <FiAlertCircle />}
                          {run.status === 'running' && <FiLoader />}
                          {run.status}
                        </span>
                      </td>
                      <td>{run.records_processed || 0}</td>
                      <td><span className={`trigger-badge ${run.trigger_type}`}>{run.trigger_type}</span></td>
                      <td>{run.file_name || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(run.started_at)}</td>
                      <td>{formatDuration(run.started_at, run.completed_at)}</td>
                      <td>
                        {run.error_message ? (
                          <span className="error-text" title={run.error_message}>{run.error_message}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {runsPagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(runsPagination.page - 1)}
                disabled={runsPagination.page <= 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {runsPagination.page} of {runsPagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(runsPagination.page + 1)}
                disabled={runsPagination.page >= runsPagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="upload-modal-overlay" onClick={() => { setUploadModal(null); setUploadFile(null); }}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Upload file for {uploadModal.name}</h3>
            <div
              className={`upload-drop-zone ${dragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) setUploadFile(file);
              }}
            >
              <FiUpload size={24} color="var(--text-secondary)" />
              {uploadFile ? (
                <p className="file-name">{uploadFile.name}</p>
              ) : (
                <p>Click or drag a file here</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={(e) => { if (e.target.files[0]) setUploadFile(e.target.files[0]); }}
              />
            </div>
            <div className="upload-modal-actions">
              <button className="action-btn" onClick={() => { setUploadModal(null); setUploadFile(null); }}>
                Cancel
              </button>
              <button
                className="action-btn primary"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessMonitor;
