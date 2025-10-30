import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/utils/LoadingSpinner';

const ZoomCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [message, setMessage] = useState('Connecting your Zoom account...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code and state from URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        // Check if user denied authorization
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

        // Send code and state to backend
        const response = await api.post('/account/zoom/oauth/callback', { code, state });

        if (response.data.success) {
          setStatus('success');
          setMessage('Zoom account connected successfully!');
          // Redirect to account settings after 2 seconds
          setTimeout(() => navigate('/utilities?section=account'), 2000);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Failed to connect Zoom account');
          setTimeout(() => navigate('/utilities?section=account'), 3000);
        }
      } catch (error) {
        console.error('Error in Zoom OAuth callback:', error);
        setStatus('error');
        setMessage('An error occurred while connecting your Zoom account');
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
        boxShadow: '0 2 8px rgba(0,0,0,0.1)'
      }}>
        {status === 'processing' && (
          <>
            <LoadingSpinner />
            <h2 style={{ marginTop: '20px', color: 'var(--text-primary)' }}>
              Connecting Zoom
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              background: '#10b981',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '40px',
              color: 'white'
            }}>
              ✓
            </div>
            <h2 style={{ color: '#10b981', marginBottom: '10px' }}>
              Success!
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '10px' }}>
              Redirecting you back to settings...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '80px',
              height: '80px',
              background: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '40px',
              color: 'white'
            }}>
              ✕
            </div>
            <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>
              Connection Failed
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '10px' }}>
              Redirecting you back to settings...
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ZoomCallback;

