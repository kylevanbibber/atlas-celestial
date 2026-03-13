import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/utils/LoadingSpinner';

const OutlookCalendarCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connecting your Outlook Calendar...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error) {
          setStatus('error');
          setMessage(`Authorization failed: ${error}`);
          setTimeout(() => navigate('/utilities?section=account'), 3000);
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization parameters');
          setTimeout(() => navigate('/utilities?section=account'), 3000);
          return;
        }

        const response = await api.post('/account/outlook-calendar/oauth/callback', { code, state });

        if (response.data.success) {
          setStatus('success');
          setMessage('Outlook Calendar connected successfully!');
          setTimeout(() => navigate('/utilities?section=account'), 2000);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Failed to connect Outlook Calendar');
          setTimeout(() => navigate('/utilities?section=account'), 3000);
        }
      } catch (error) {
        console.error('Error in Outlook Calendar OAuth callback:', error);
        setStatus('error');
        setMessage('An error occurred while connecting your Outlook Calendar');
        setTimeout(() => navigate('/utilities?section=account'), 3000);
      }
    };

    handleCallback();
  }, [location, navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '500px',
        padding: '40px',
        background: 'var(--card-background, #fff)',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {status === 'processing' && (
          <>
            <LoadingSpinner />
            <h2 style={{ marginTop: '20px', color: 'var(--text-primary)' }}>
              Connecting Outlook Calendar
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '80px', height: '80px', background: '#10b981', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '40px', color: 'white'
            }}>
              ✓
            </div>
            <h2 style={{ color: '#10b981', marginBottom: '10px' }}>Success!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '10px' }}>
              Redirecting you back to settings...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '80px', height: '80px', background: '#ef4444', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '40px', color: 'white'
            }}>
              ✕
            </div>
            <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>Connection Failed</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '10px' }}>
              Redirecting you back to settings...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default OutlookCalendarCallback;
