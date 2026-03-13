import React, { useState } from 'react';
import { FiBell, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

const NotificationToggle = ({ 
  pushEnabled, 
  permission, 
  isSubscribing, 
  onToggle, 
  onTest,
  hasDbSubscription,
  forceRefreshSubscription
}) => {
  const [testLoading, setTestLoading] = useState(false);

  const getStatusMessage = () => {
    // If there's a database subscription but no browser subscription
    if (hasDbSubscription && !pushEnabled && permission !== 'denied') {
      return 'You have notifications enabled in our system but your browser subscription is missing. Turn on notifications to re-sync.';
    }
    
    if (permission === 'denied') {
      return 'Notifications are blocked. Please enable them in your browser settings.';
    }
    if (permission === 'default') {
      return 'Please enable notifications to receive updates.';
    }
    return pushEnabled ? '' : 'Notifications are disabled';
  };

  const handleTestNotification = async () => {
    try {
      setTestLoading(true);
      await onTest();
    } finally {
      setTestLoading(false);
    }
  };

  // Add refresh handler
  const handleRefresh = async () => {
    if (forceRefreshSubscription) {
      await forceRefreshSubscription();
    }
  };

  return (
    <>
      <div className="settings-row theme-settings-row">
        <label>Push Notifications</label>
        <div className="switch-container">
          <label className="switch">
            <input 
              type="checkbox" 
              checked={pushEnabled}
              onChange={onToggle}
              disabled={permission === 'denied' || isSubscribing}
            />
            <span className="slider"></span>
          </label>
          <span className="switch-label">
            {isSubscribing ? 'Updating...' : (pushEnabled ? 'On' : 'Off')}
          </span>
        </div>
      </div>
      
      <div className="settings-help-text">
        {hasDbSubscription && !pushEnabled && permission !== 'denied' && (
          <div style={{ 
            color: '#e67e22', 
            marginBottom: '8px', 
            display: 'flex', 
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: 'rgba(230, 126, 34, 0.1)',
            borderRadius: '4px',
            border: '1px solid #e67e22'
          }}>
            <FiAlertCircle style={{ marginRight: '5px', fontSize: '16px' }} />
            <span style={{ flex: 1 }}>
              Your browser subscription needs to be restored.
            </span>
            <button 
              onClick={handleRefresh}
              style={{ 
                marginLeft: '10px', 
                background: 'none', 
                border: '1px solid #e67e22', 
                color: '#e67e22', 
                padding: '4px 8px', 
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: '500'
              }}
              disabled={isSubscribing}
            >
              <FiRefreshCw style={{ marginRight: '4px' }} />
              {isSubscribing ? 'Fixing...' : 'Fix Now'}
            </button>
          </div>
        )}
        
        <div style={{ 
          color: permission === 'denied' ? '#e74c3c' : 
                pushEnabled ? '#27ae60' : '#7f8c8d',
          fontSize: '14px'
        }}>
          {getStatusMessage()}
        </div>
      </div>



    </>
  );
};

export default NotificationToggle; 