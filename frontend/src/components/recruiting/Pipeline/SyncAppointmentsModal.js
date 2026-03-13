import React, { useState, useEffect, useRef } from 'react';
import api from '../../../api';
import './SyncAppointmentsModal.css';

const SyncAppointmentsModal = ({ isOpen, onClose, recruit }) => {
  // Handle both single recruit and array of recruits
  const recruits = Array.isArray(recruit) ? recruit : [recruit].filter(Boolean);
  const isBatch = recruits.length > 1;
  
  console.log('[AIL Sync Modal] 🚀 Modal initialized', {
    isOpen,
    recruitCount: recruits.length,
    isBatch,
    recruitIds: recruits.map(r => r.id)
  });
  
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [showCredentials, setShowCredentials] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(null); // null, 'running', 'waiting_for_user', 'success', 'error'
  const [currentStep, setCurrentStep] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState('');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: recruits.length, completed: [], failed: [] });
  const [verificationCode, setVerificationCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const pollingInterval = useRef(null);

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    try {
      const savedCreds = localStorage.getItem('ailSyncCredentials');
      if (savedCreds) {
        const parsed = JSON.parse(savedCreds);
        setCredentials(parsed);
        setRememberCredentials(true);
        console.log('[AIL Sync Modal] 💾 Loaded saved credentials');
      }
    } catch (e) {
      console.error('[AIL Sync Modal] Error loading saved credentials:', e);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    console.log('[AIL Sync Modal] Component mounted');
    return () => {
      console.log('[AIL Sync Modal] Component unmounting, cleaning up polling');
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Poll for status updates
  useEffect(() => {
    if (!sessionId) {
      console.log('[AIL Sync Modal] No sessionId, skipping polling setup');
      return;
    }

    console.log('[AIL Sync Modal] 📡 Starting status polling for session:', sessionId);

    const pollStatus = async () => {
      try {
        console.log('[AIL Sync Modal] 🔄 Polling status...');
        const res = await api.get(`/ail-sync/status/${sessionId}`);
        
        console.log('[AIL Sync Modal] 📊 Status update received:', {
          status: res.data.status,
          currentStep: res.data.currentStep,
          hasScreenshot: !!res.data.screenshot,
          error: res.data.error,
          batchProgress: res.data.batchProgress
        });
        
        if (res.data.success) {
          setStatus(res.data.status);
          setCurrentStep(res.data.currentStep || '');
          
          if (res.data.screenshot) {
            console.log('[AIL Sync Modal] 📸 Screenshot updated');
            setScreenshot(res.data.screenshot);
          }
          
          if (res.data.error) {
            console.error('[AIL Sync Modal] ❌ Error from backend:', res.data.error);
            setError(res.data.error);
          }
          
          // Update batch progress if available
          if (res.data.batchProgress) {
            console.log('[AIL Sync Modal] 📈 Batch progress update:', res.data.batchProgress);
            setBatchProgress(res.data.batchProgress);
          }

          // Stop polling if completed or errored (but keep polling if waiting_for_user)
          if (res.data.status === 'success' || res.data.status === 'error') {
            console.log('[AIL Sync Modal] ✅ Sync completed, stopping polling. Final status:', res.data.status);
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
              pollingInterval.current = null;
            }
          } else if (res.data.status === 'waiting_for_user') {
            console.log('[AIL Sync Modal] ⏸️ Waiting for user to enter verification code...');
            // Keep polling - don't stop
          }
        }
      } catch (err) {
        console.error('[AIL Sync Modal] ❌ Error polling status:', err);
      }
    };

    // Poll every 2 seconds
    pollingInterval.current = setInterval(pollStatus, 2000);
    console.log('[AIL Sync Modal] ⏰ Polling interval set (every 2 seconds)');
    
    // Initial poll
    pollStatus();

    return () => {
      if (pollingInterval.current) {
        console.log('[AIL Sync Modal] Cleaning up polling interval');
        clearInterval(pollingInterval.current);
      }
    };
  }, [sessionId]);

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');

    console.log('[AIL Sync Modal] 🚀 Starting sync...');
    console.log('[AIL Sync Modal] Credentials check:', {
      hasUsername: !!credentials.username,
      hasPassword: !!credentials.password,
      username: credentials.username ? `${credentials.username.substring(0, 3)}***` : 'empty'
    });

    // Validate recruits array
    if (!recruits || recruits.length === 0) {
      console.error('[AIL Sync Modal] ❌ No recruits provided');
      setError('No recruits selected. Please close and try again.');
      return;
    }

    // Validate all recruits have IDs
    const recruitIds = recruits.map(r => r?.id).filter(Boolean);
    if (recruitIds.length === 0) {
      console.error('[AIL Sync Modal] ❌ No valid recruit IDs found');
      setError('Invalid recruit data. Please close and try again.');
      return;
    }

    if (!credentials.username || !credentials.password) {
      console.warn('[AIL Sync Modal] ⚠️ Missing credentials');
      setError('Please enter both username and password');
      return;
    }

    const requestData = {
      recruitIds, // Use filtered array of valid IDs
      credentials,
      isBatch
    };

    // Save or clear credentials based on checkbox
    if (rememberCredentials) {
      try {
        localStorage.setItem('ailSyncCredentials', JSON.stringify(credentials));
        console.log('[AIL Sync Modal] 💾 Saved credentials to localStorage');
      } catch (e) {
        console.error('[AIL Sync Modal] Error saving credentials:', e);
      }
    } else {
      localStorage.removeItem('ailSyncCredentials');
      console.log('[AIL Sync Modal] 🗑️ Cleared saved credentials');
    }

    console.log('[AIL Sync Modal] 📤 Sending sync request:', {
      recruitIds: requestData.recruitIds,
      recruitCount: requestData.recruitIds.length,
      isBatch: requestData.isBatch,
      endpoint: '/ail-sync/start'
    });

    try {
      const res = await api.post('/ail-sync/start', requestData);

      console.log('[AIL Sync Modal] 📥 Sync response received:', {
        success: res.data.success,
        sessionId: res.data.sessionId,
        message: res.data.message
      });

      if (res.data.success) {
        console.log('[AIL Sync Modal] ✅ Sync started successfully');
        setSessionId(res.data.sessionId);
        setShowCredentials(false);
        setStatus('running');
        const initialStep = isBatch ? `Starting batch sync for ${recruits.length} recruits...` : 'Starting automation...';
        setCurrentStep(initialStep);
        console.log('[AIL Sync Modal] Initial step:', initialStep);
      } else {
        console.error('[AIL Sync Modal] ❌ Sync failed:', res.data.message);
        setError(res.data.message || 'Failed to start sync');
      }
    } catch (err) {
      console.error('[AIL Sync Modal] ❌ Error starting sync:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      setError(err.response?.data?.message || 'Failed to start sync');
    }
  };

  const handleSubmitVerificationCode = async (e) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }
    
    console.log('[AIL Sync Modal] 📲 Submitting verification code...');
    setSubmittingCode(true);
    setError('');
    
    try {
      const res = await api.post('/ail-sync/verify-code', {
        sessionId,
        verificationCode
      });
      
      if (res.data.success) {
        console.log('[AIL Sync Modal] ✅ Verification code submitted');
        setVerificationCode('');
        // Status will update via polling
      } else {
        console.error('[AIL Sync Modal] ❌ Failed to submit code:', res.data.message);
        setError(res.data.message || 'Failed to submit verification code');
      }
    } catch (err) {
      console.error('[AIL Sync Modal] ❌ Error submitting code:', err);
      setError(err.response?.data?.message || 'Failed to submit verification code');
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleClose = () => {
    console.log('[AIL Sync Modal] 🔚 Closing modal', {
      sessionId,
      finalStatus: status,
      hadPolling: !!pollingInterval.current
    });
    
    if (pollingInterval.current) {
      console.log('[AIL Sync Modal] Stopping polling on close');
      clearInterval(pollingInterval.current);
    }
    onClose();
  };

  if (!isOpen) {
    console.log('[AIL Sync Modal] Modal is closed, not rendering');
    return null;
  }

  console.log('[AIL Sync Modal] 🎨 Rendering modal', {
    showCredentials,
    status,
    currentStep,
    hasScreenshot: !!screenshot,
    batchProgress
  });

  return (
    <div className="sync-modal-overlay" onClick={handleClose}>
      <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sync-modal-header">
          <h2>🔄 Sync to AIL Appointments</h2>
          <button 
            className="sync-modal-close" 
            onClick={handleClose}
            disabled={status === 'running'}
          >
            ×
          </button>
        </div>

        <div className="sync-modal-body">
          {showCredentials ? (
            // Credentials Form
            <div className="credentials-section">
              <div className="recruit-info">
                <h3>{isBatch ? `Syncing ${recruits.length} Recruits` : 'Syncing Recruit'}</h3>
                {isBatch ? (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px' }}>
                    {recruits.map((r, idx) => (
                      <div key={r.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                        <p><strong>{idx + 1}.</strong> {r.recruit_first} {r.recruit_last}</p>
                      </div>
                    ))}
                  </div>
                ) : recruits[0] ? (
                  <>
                    <p><strong>Name:</strong> {recruits[0].recruit_first} {recruits[0].recruit_last}</p>
                    {recruits[0].email && <p><strong>Email:</strong> {recruits[0].email}</p>}
                    {recruits[0].phone && <p><strong>Phone:</strong> {recruits[0].phone}</p>}
                  </>
                ) : null}
              </div>

              <form onSubmit={handleStart} className="credentials-form">
                <h3>AIL Portal Credentials</h3>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    placeholder="Your AIL username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    placeholder="Your AIL password"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={rememberCredentials}
                      onChange={(e) => setRememberCredentials(e.target.checked)}
                      style={{ marginRight: '8px', cursor: 'pointer' }}
                    />
                    Remember my credentials (stored locally)
                  </label>
                </div>

                {error && (
                  <div className="error-message">
                    ⚠️ {error}
                  </div>
                )}

                <button type="submit" className="btn-primary">
                  Start Sync
                </button>
              </form>
            </div>
          ) : (
            // Live View
            <div className="live-view-section">
              {/* Browser Viewport */}
              <div className="browser-viewport">
                {screenshot ? (
                  <img src={screenshot} alt="Live automation view" />
                ) : (
                  <div className="viewport-placeholder">
                    <div className="loading-spinner"></div>
                    <p>Initializing browser...</p>
                  </div>
                )}
              </div>

              {/* Status Section */}
              <div className="status-section">
                <div className={`status-indicator ${status}`}>
                  {status === 'running' && (
                    <>
                      <div className="spinner"></div>
                      <span>In Progress</span>
                    </>
                  )}
                  {status === 'waiting_for_user' && (
                    <>
                      <div className="spinner" style={{ borderTopColor: '#f5a623' }}></div>
                      <span style={{ color: '#f5a623' }}>⏸️ User Action Required</span>
                    </>
                  )}
                  {status === 'success' && (
                    <>
                      <span className="status-icon">✓</span>
                      <span>Success</span>
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      <span className="status-icon">⚠</span>
                      <span>Error</span>
                    </>
                  )}
                </div>
                
                {/* Batch Progress */}
                {isBatch && batchProgress.total > 0 && (
                  <div className="batch-progress" style={{ margin: '12px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span>Progress: {batchProgress.current} / {batchProgress.total}</span>
                      <span>
                        ✓ {batchProgress.completed.length} | 
                        ⚠ {batchProgress.failed.length}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${(batchProgress.current / batchProgress.total) * 100}%`, 
                        height: '100%', 
                        backgroundColor: batchProgress.failed.length > 0 ? '#f5a623' : '#00558c',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
                
                <div className="current-step">
                  {currentStep || 'Waiting...'}
                </div>

                {/* User Action Required Banner with Code Input */}
                {status === 'waiting_for_user' && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fff3cd',
                    border: '2px solid #f5a623',
                    borderRadius: '8px',
                    marginTop: '16px'
                  }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#856404', fontSize: '16px' }}>
                      📱 Verification Code Required
                    </h4>
                    <p style={{ margin: '0 0 12px 0', color: '#856404', fontSize: '14px' }}>
                      A verification code has been sent to your phone via text message.
                      Please enter it below:
                    </p>
                    
                    <form onSubmit={handleSubmitVerificationCode} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength="6"
                        style={{
                          flex: 1,
                          padding: '10px',
                          fontSize: '16px',
                          border: '2px solid #f5a623',
                          borderRadius: '4px',
                          textAlign: 'center',
                          letterSpacing: '4px',
                          fontWeight: 'bold'
                        }}
                        autoFocus
                        disabled={submittingCode}
                      />
                      <button
                        type="submit"
                        disabled={submittingCode || !verificationCode.trim()}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: submittingCode ? '#ccc' : '#00558c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: submittingCode ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}
                      >
                        {submittingCode ? 'Submitting...' : 'Submit'}
                      </button>
                    </form>
                    
                    <p style={{ margin: '8px 0 0 0', color: '#856404', fontSize: '12px', fontStyle: 'italic' }}>
                      The sync will automatically continue once the code is verified.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="error-banner">
                    {error}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {(status === 'success' || status === 'error') && (
                <div className="action-buttons">
                  <button className="btn-primary" onClick={handleClose}>
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncAppointmentsModal;

