import React, { useState, useEffect } from 'react';
import { FiX, FiRefreshCw } from 'react-icons/fi';
import { DateTime } from 'luxon';
import { NOTIFICATION_TYPES } from '../../common/NotificationCenter';
import './NotificationHistory.css';

// Format relative time (defensive)
const formatRelativeTime = (timestamp) => {
  try {
    if (!timestamp || typeof timestamp !== 'string') return 'Just now';
    let dateTime;
    if (timestamp && timestamp.includes('T')) {
      dateTime = DateTime.fromISO(timestamp, { zone: 'America/New_York' });
    } else {
      const safeStr = String(timestamp || '').trim();
      const isoTime = safeStr ? safeStr.replace(' ', 'T') + '-04:00' : '';
      dateTime = DateTime.fromISO(isoTime);
    }
    if (!dateTime || !dateTime.isValid) return 'Just now';
    const now = DateTime.now().setZone('America/New_York');
    const diff = now.diff(dateTime, ['days', 'hours', 'minutes', 'seconds']);
    if (diff.days > 0) {
      return diff.days === 1 ? 'Yesterday' : `${diff.days} days ago`;
    } else if (diff.hours > 0) {
      return `${diff.hours} ${diff.hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diff.minutes > 0) {
      return `${Math.floor(diff.minutes)} ${Math.floor(diff.minutes) === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return 'Just now';
    }
  } catch (_) {
    return 'Just now';
  }
};

const NotificationHistory = ({ 
  notifications, 
  loading, 
  error, 
  onNotificationClick, 
  onDismiss,
  onRefresh 
}) => {
  // Only show loading state on initial load, not during refreshes
  const isInitialLoading = loading && notifications.length === 0;
  
  // Add state to track current time for auto-updating timestamps
  const [currentTime, setCurrentTime] = useState(DateTime.now());
  
  // Set up interval to update the time every minute
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(DateTime.now());
    }, 60000); // Update every minute
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  return (
    <div className="settings-card" style={{ marginTop: 32 }}>
      <div className="settings-card-header">
        <h2 className="settings-card-title">Notification History</h2>
        {onRefresh && (
          <button 
            className="refresh-button" 
            onClick={onRefresh}
            disabled={loading}
            title="Refresh notifications"
          >
            <FiRefreshCw 
              size={16} 
              className={loading ? 'icon-spin' : ''}
            />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
      </div>
      <div className="notification-list">
        {isInitialLoading ? (
          <div className="notification-loading">Loading notifications...</div>
        ) : error ? (
          <div className="notification-error">Failed to load notifications</div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty">No notifications</div>
        ) : (
          notifications
            .filter(n => !n.is_dismissed)
            .map(n => (
              <div 
                key={n.id} 
                className={`notification-item ${n.is_read ? 'read' : 'unread'}`}
                onClick={() => onNotificationClick(n)}
              >
                {n.image_url ? (
                  <div className="notification-icon">
                    <img 
                      src={n.image_url} 
                      alt="" 
                      style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                ) : (
                  <div className="notification-icon" style={{ color: NOTIFICATION_TYPES[n.type]?.color || NOTIFICATION_TYPES.info.color }}>
                    {(() => {
                      const IconComponent = NOTIFICATION_TYPES[n.type]?.icon || NOTIFICATION_TYPES.info.icon;
                      return <IconComponent size={20} />;
                    })()}
                  </div>
                )}
                <div className="notification-content">
                  <div className="notification-header">
                    <h4 className="notification-title">{n.title}</h4>
                    <span className="notification-time">{formatRelativeTime(n.created_at)}</span>
                  </div>
                  <p className="notification-message">{n.message}</p>
                </div>
                <button 
                  className="notification-dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(n.id);
                  }}
                >
                  <FiX size={20} />
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default NotificationHistory; 