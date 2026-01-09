import React, { useState, useEffect, useRef } from 'react';
import api from '../../../api';
import './SyncAppointmentsModal.css'; // Reuse the same styles

const AOBExportModal = ({ isOpen, onClose, onComplete }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [rememberCredentials, setRememberCredentials] = useState(false);
  const [showCredentials, setShowCredentials] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(null); // null, 'running', 'waiting_for_user', 'success', 'error'
  const [currentStep, setCurrentStep] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [submittingCode, setSubmittingCode] = useState(false);
  const [recordsInserted, setRecordsInserted] = useState(0);
  const [recordsSkipped, setRecordsSkipped] = useState(0);
  const [recordsLinked, setRecordsLinked] = useState(0);
  const [recordsProcessed, setRecordsProcessed] = useState(0);
  const pollingInterval = useRef(null);

  console.log('[AOB Export Modal] 🚀 Modal initialized', { isOpen });

  // Load saved credentials from localStorage on mount
  useEffect(() => {
    try {
      const savedCreds = localStorage.getItem('ailSyncCredentials');
      if (savedCreds) {
        const parsed = JSON.parse(savedCreds);
        setCredentials(parsed);
        setRememberCredentials(true);
        console.log('[AOB Export Modal] 💾 Loaded saved credentials');
      }
    } catch (e) {
      console.error('[AOB Export Modal] Error loading saved credentials:', e);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    console.log('[AOB Export Modal] Component mounted');
    return () => {
      console.log('[AOB Export Modal] Component unmounting, cleaning up polling');
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Poll for status updates
  useEffect(() => {
    if (!sessionId) {
      console.log('[AOB Export Modal] No sessionId, skipping polling setup');
      return;
    }

    console.log('[AOB Export Modal] 📡 Starting status polling for session:', sessionId);

    const pollStatus = async () => {
      try {
        console.log('[AOB Export Modal] 🔄 Polling status...');
        const res = await api.get(`/ail-sync/status/${sessionId}`);
        
        console.log('[AOB Export Modal] 📊 Status update received:', {
          status: res.data.status,
          currentStep: res.data.currentStep,
          hasScreenshot: !!res.data.screenshot,
          error: res.data.error,
          inserted: res.data.inserted,
          recordsProcessed: res.data.recordsProcessed
        });
        
        if (res.data.success) {
          const newStatus = res.data.status;
          const newStep = res.data.currentStep || '';
          
          console.log('[AOB Export Modal] 🔄 Updating state:', {
            oldStatus: status,
            newStatus,
            oldStep: currentStep,
            newStep
          });
          
          setStatus(newStatus);
          setCurrentStep(newStep);
          
          if (res.data.screenshot) {
            console.log('[AOB Export Modal] 📸 Screenshot updated');
            setScreenshot(res.data.screenshot);
          }
          
          if (res.data.error) {
            console.error('[AOB Export Modal] ❌ Error from backend:', res.data.error);
            setError(res.data.error);
          }

          // Update progress stats
          if (res.data.inserted !== undefined) {
            console.log('[AOB Export Modal] 📝 Records inserted:', res.data.inserted);
            setRecordsInserted(res.data.inserted);
          }
          if (res.data.skipped !== undefined) {
            setRecordsSkipped(res.data.skipped);
          }
          if (res.data.linked !== undefined) {
            setRecordsLinked(res.data.linked);
          }
          if (res.data.recordsProcessed !== undefined) {
            console.log('[AOB Export Modal] 📝 Records processed:', res.data.recordsProcessed);
            setRecordsProcessed(res.data.recordsProcessed);
          }

          // Stop polling if completed or errored (but keep polling if waiting_for_user)
          if (res.data.status === 'success' || res.data.status === 'error') {
            console.log('[AOB Export Modal] ✅ Export completed, stopping polling. Final status:', res.data.status);
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
            }
            
            // Call onComplete callback if provided
            if (onComplete && res.data.status === 'success') {
              onComplete();
            }
          }
        }
      } catch (err) {
        console.error('[AOB Export Modal] Polling error:', err);
        // Don't stop polling on network errors, might be temporary
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 2 seconds
    pollingInterval.current = setInterval(pollStatus, 2000);

    return () => {
      console.log('[AOB Export Modal] Cleaning up polling interval');
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [sessionId, onComplete]);

  const handleStart = async () => {
    if (!credentials.username || !credentials.password) {
      setError('Please enter both username and password');
      return;
    }

    console.log('[AOB Export Modal] 🚀 Starting AOB export...');

    // Save credentials if checkbox is checked
    if (rememberCredentials) {
      localStorage.setItem('ailSyncCredentials', JSON.stringify(credentials));
      console.log('[AOB Export Modal] 💾 Credentials saved to localStorage');
    } else {
      localStorage.removeItem('ailSyncCredentials');
      console.log('[AOB Export Modal] 🗑️ Credentials removed from localStorage');
    }

    try {
      console.log('[AOB Export Modal] 🚀 Starting export process...');
      
      setShowCredentials(false);
      setStatus('starting');
      setCurrentStep('Initializing export...');
      setError('');
      setScreenshot(null);
      setRecordsInserted(0);
      setRecordsSkipped(0);
      setRecordsLinked(0);
      setRecordsProcessed(0);

      console.log('[AOB Export Modal] 📤 Sending start request...');
      const res = await api.post('/ail-sync/aob-export-start', {
        username: credentials.username,
        password: credentials.password
      });

      console.log('[AOB Export Modal] ✅ Start response received:', {
        success: res.data.success,
        sessionId: res.data.sessionId
      });

      if (res.data.success) {
        setSessionId(res.data.sessionId);
        setStatus('running');
        setCurrentStep('Export started, waiting for updates...');
        console.log('[AOB Export Modal] ✨ Session ID set, polling will begin');
      } else {
        setError(res.data.error || 'Failed to start export');
        setStatus('error');
      }
    } catch (err) {
      console.error('[AOB Export Modal] ❌ Start error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to start export');
      setStatus('error');
    }
  };

  const handleSubmitVerificationCode = async () => {
    if (!verificationCode.trim()) {
      setError('Please enter verification code');
      return;
    }

    console.log('[AOB Export Modal] 📲 Submitting verification code...');
    setSubmittingCode(true);
    setError('');

    try {
      const res = await api.post(`/ail-sync/submit-mfa/${sessionId}`, {
        code: verificationCode
      });

      console.log('[AOB Export Modal] ✅ MFA code submitted:', res.data);

      if (res.data.success) {
        setVerificationCode('');
        setStatus('running');
        // Polling will continue and pick up the updated status
      } else {
        setError(res.data.error || 'Failed to submit code');
      }
    } catch (err) {
      console.error('[AOB Export Modal] ❌ MFA submission error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to submit verification code');
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleClose = () => {
    console.log('[AOB Export Modal] 🚪 Closing modal');
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    setShowCredentials(true);
    setSessionId(null);
    setStatus(null);
    setCurrentStep('');
    setScreenshot(null);
    setError('');
    setVerificationCode('');
    setRecordsInserted(0);
    setRecordsSkipped(0);
    setRecordsLinked(0);
    setRecordsProcessed(0);
    onClose();
  };

  if (!isOpen) return null;

  console.log('[AOB Export Modal] 🎨 Rendering modal', {
    showCredentials,
    status,
    currentStep,
    hasScreenshot: !!screenshot,
    recordsInserted,
    recordsProcessed,
    error
  });

  return (
    <div className="sync-modal-overlay" onClick={handleClose}>
      <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sync-modal-header">
          <h2>Export AOB Updates</h2>
          <button 
            className="sync-modal-close" 
            onClick={handleClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="sync-modal-body">
          {showCredentials ? (
            // Credentials Form
            <div className="credentials-section">
              <form onSubmit={(e) => { e.preventDefault(); handleStart(); }} className="credentials-form">
                <h3>AIL Portal Credentials</h3>
                <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Enter your credentials to export Application Processing Status data.
                </p>

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
                  Start Export
                </button>
              </form>
            </div>
          ) : (
            // Live View (matches SyncAppointmentsModal layout)
            <div className="live-view-section">
              {/* Browser Viewport - PROMINENT DISPLAY */}
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
                <div className={`status-indicator ${status || 'starting'}`}>
                  {(status === 'starting' || !status) && (
                    <>
                      <div className="spinner"></div>
                      <span>Starting...</span>
                    </>
                  )}
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
                
                {/* Progress stats */}
                {recordsProcessed > 0 && (
                  <div style={{ margin: '12px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px', fontSize: '13px' }}>
                      <span>Processed: <strong>{recordsProcessed}</strong></span>
                      <span>Inserted: <strong>{recordsInserted}</strong></span>
                      <span>Skipped: <strong>{recordsSkipped}</strong></span>
                      <span>Linked: <strong>{recordsLinked}</strong></span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${recordsProcessed > 0 ? (recordsInserted / recordsProcessed) * 100 : 0}%`, 
                        height: '100%', 
                        backgroundColor: '#00558c',
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
                    
                    <form onSubmit={(e) => { e.preventDefault(); handleSubmitVerificationCode(); }} style={{ display: 'flex', gap: '8px' }}>
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
                      The export will automatically continue once the code is verified.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="error-banner">
                    {error}
                  </div>
                )}

                {/* Success message */}
                {status === 'success' && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#d4edda',
                    border: '2px solid #28a745',
                    borderRadius: '8px',
                    marginTop: '16px',
                    color: '#155724'
                  }}>
                    <strong>✅ Export completed successfully!</strong>
                    <div style={{ marginTop: '8px', fontSize: '14px' }}>
                      <div>📝 {recordsInserted} new records inserted</div>
                      <div>⏭️ {recordsSkipped} duplicates skipped</div>
                      <div>🔗 {recordsLinked} linked to pipeline</div>
                    </div>
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

export default AOBExportModal;

