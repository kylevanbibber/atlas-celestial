import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNotificationContext } from '../../../context/NotificationContext';
import api from '../../../api';

const NotificationDiagnostic = () => {
  const { user } = useAuth();
  const { isPushSupported, pushEnabled, wsConnected, isReconnecting, forceRefreshSubscription } = useNotificationContext();
  const [diagnostics, setDiagnostics] = useState({});
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  const detectSubscriptionMismatch = () => {
    if (!diagnostics.serverSubscription || !diagnostics.browserSubscription) return false;
    
    const hasDbSubscription = diagnostics.serverSubscription.hasSubscription;
    const hasBrowserSubscription = diagnostics.browserSubscription.exists;
    const permissionGranted = diagnostics.permission === 'granted';
    
    return hasDbSubscription && !hasBrowserSubscription && permissionGranted;
  };

  const fixSubscriptionMismatch = async () => {
    setFixing(true);
    try {
      console.log('🔧 Attempting to fix subscription mismatch from diagnostic...');
      const success = await forceRefreshSubscription();
      if (success) {
        alert('✅ Subscription mismatch fixed! Refreshing diagnostics...');
        setTimeout(() => {
          runDiagnostic();
        }, 1000);
      } else {
        alert('❌ Failed to fix subscription mismatch. Please check the console for errors.');
      }
    } catch (error) {
      console.error('Error fixing subscription:', error);
      alert('❌ Error fixing subscription: ' + error.message);
    } finally {
      setFixing(false);
    }
  };

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

      // WebSocket status
      results.websocket = {
        connected: wsConnected,
        isReconnecting: isReconnecting,
        url: process.env.NODE_ENV === "production" 
          ? "wss://atlas-celest-backend-3bb2fea96236.herokuapp.com/ws/notifications"
          : "ws://localhost:5001/ws/notifications"
      };

      // iOS PWA specific checks
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // Detect iPhone on iOS 13+
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const isIOSPWA = isIOS && isStandalone;
      
      results.iosPWA = {
        isIOS: isIOS,
        isStandalone: isStandalone,
        isIOSPWA: isIOSPWA,
        userAgent: navigator.userAgent,
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
      };

      // Document visibility state
      results.visibility = {
        visibilityState: document.visibilityState,
        hidden: document.hidden,
        hasFocus: document.hasFocus()
      };

      // Service worker status
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          results.serviceWorker = {
            registrations: registrations.length,
            active: registrations.length > 0 && registrations[0].active?.state,
            scope: registrations.length > 0 ? registrations[0].scope : null,
            controllerPresent: !!navigator.serviceWorker.controller
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
        
        // Get detailed VAPID validation
        try {
          const vapidValidation = await api.get('/notifications/debug-vapid');
          results.vapidValidation = vapidValidation.data;
        } catch (vapidErr) {
          results.vapidValidationError = vapidErr.response?.data?.error || vapidErr.message;
        }
      } catch (err) {
        results.vapidError = err.response?.data?.error || err.message;
      }

      // Environment info
      results.environment = {
        userAgent: navigator.userAgent,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        isIOS: isIOS, // Use the same detection logic as above
        pushEnabled: pushEnabled,
        timestamp: new Date().toISOString()
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
        Use this information to troubleshoot notification issues. 
        {wsConnected ? (
          <span style={{ color: '#28a745' }}> ✅ WebSocket Connected</span>
        ) : (
          <span style={{ color: '#dc3545' }}> ❌ WebSocket Disconnected</span>
        )}
        {isReconnecting && <span style={{ color: '#ffc107' }}> 🔄 Reconnecting...</span>}
      </p>
      
      {/* Subscription Mismatch Detection */}
      {detectSubscriptionMismatch() && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          color: '#856404',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>
            ⚠️ <strong>Subscription Mismatch Detected!</strong> Database has subscription but browser doesn't.
          </span>
          <button
            onClick={fixSubscriptionMismatch}
            disabled={fixing}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ffc107',
              color: '#212529',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {fixing ? 'Fixing...' : 'Fix Now'}
          </button>
        </div>
      )}

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