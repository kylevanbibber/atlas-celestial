import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNotificationContext } from '../../../context/NotificationContext';
import api from '../../../api';

const NotificationDiagnostic = () => {
  const { user } = useAuth();
  const { isPushSupported, pushEnabled } = useNotificationContext();
  const [diagnostics, setDiagnostics] = useState({});
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    const results = {};

    try {
      // Check browser support
      results.browserSupport = {
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        notifications: 'Notification' in window,
        isPushSupported: isPushSupported
      };

      // Check notification permission
      results.permission = Notification.permission;

      // Check service worker status
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          results.serviceWorker = {
            registrations: registrations.length,
            active: registrations.length > 0 && registrations[0].active?.state,
            scope: registrations.length > 0 ? registrations[0].scope : null
          };

          if (registrations.length > 0) {
            const subscription = await registrations[0].pushManager.getSubscription();
            results.browserSubscription = {
              exists: !!subscription,
              endpoint: subscription?.endpoint?.substring(0, 50) + '...',
              hasKeys: !!(subscription?.keys)
            };
          }
        } catch (err) {
          results.serviceWorkerError = err.message;
        }
      }

      // Check server status
      try {
        const serverStatus = await api.get('/notifications/subscription-status');
        results.serverSubscription = serverStatus.data;
      } catch (err) {
        results.serverError = err.response?.data?.error || err.message;
      }

      // Check VAPID key
      try {
        const vapidResponse = await api.get('/notifications/vapid-key');
        results.vapid = {
          hasKey: !!vapidResponse.data.publicKey,
          keyLength: vapidResponse.data.publicKey?.length || 0
        };
      } catch (err) {
        results.vapidError = err.response?.data?.error || err.message;
      }

      // Environment info
      results.environment = {
        userAgent: navigator.userAgent,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
        pushEnabled: pushEnabled
      };

    } catch (error) {
      results.generalError = error.message;
    }

    setDiagnostics(results);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const copyToClipboard = () => {
    const diagnosticText = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(diagnosticText);
    alert('Diagnostic information copied to clipboard!');
  };

  return (
    <div style={{ 
      background: '#f8f9fa', 
      padding: '16px', 
      borderRadius: '8px', 
      marginTop: '20px',
      border: '1px solid #dee2e6'
    }}>
      <h3>Push Notification Diagnostics</h3>
      <p style={{ color: '#6c757d', marginBottom: '16px' }}>
        Use this information to troubleshoot notification issues. Click "Copy" to share with support.
      </p>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <button 
          onClick={runDiagnostic} 
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Running...' : 'Refresh Diagnostics'}
        </button>
        <button 
          onClick={copyToClipboard}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Copy Results
        </button>
      </div>

      <pre style={{ 
        background: 'white', 
        padding: '12px', 
        borderRadius: '4px',
        fontSize: '12px',
        overflow: 'auto',
        maxHeight: '400px',
        border: '1px solid #dee2e6'
      }}>
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
    </div>
  );
};

export default NotificationDiagnostic; 