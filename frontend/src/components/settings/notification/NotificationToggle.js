import React, { useState } from 'react';
import { FiBell, FiAlertCircle } from 'react-icons/fi';

const NotificationToggle = ({ 
  pushEnabled, 
  permission, 
  isSubscribing, 
  onToggle, 
  onTest,
  hasDbSubscription
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
    return pushEnabled ? 'Notifications are enabled' : 'Notifications are disabled';
  };

  const handleTestNotification = async () => {
    try {
      setTestLoading(true);
      await onTest();
    } finally {
      setTestLoading(false);
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
          <div style={{ color: '#e67e22', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
            <FiAlertCircle style={{ marginRight: '5px' }} />
            Your browser subscription needs to be restored.
          </div>
        )}
        {getStatusMessage()}
      </div>



    </>
  );
};

export default NotificationToggle; 