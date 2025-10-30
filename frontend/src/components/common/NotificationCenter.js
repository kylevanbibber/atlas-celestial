import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../../context/NotificationContext';
import { BsBell, BsBellFill, BsCheck2All, BsGear, BsTrash, BsX, BsArrowClockwise } from 'react-icons/bs';
import { FiInfo, FiCheckCircle, FiAlertTriangle, FiAlertCircle } from 'react-icons/fi';
import { DateTime } from 'luxon';
import api from '../../api';
import './NotificationCenter.css';

// Notification type icons and colors
export const NOTIFICATION_TYPES = {
  info: { color: 'var(--info-color, #0088cc)', icon: FiInfo },
  success: { color: 'var(--success-color, #28a745)', icon: FiCheckCircle },
  warning: { color: 'var(--warning-color, #ffc107)', icon: FiAlertTriangle },
  error: { color: 'var(--error-color, #dc3545)', icon: FiAlertCircle }
};

// Format relative time
const formatRelativeTime = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') {
    return 'Just now';
  }
  // Parse the timestamp with explicit timezone handling
  // If the timestamp is in MySQL format (YYYY-MM-DD HH:MM:SS) convert it to ISO
  let dateTime;
  if (timestamp && typeof timestamp === 'string' && timestamp.includes('T')) {
    // Already in ISO format
    dateTime = DateTime.fromISO(timestamp, { zone: 'America/New_York' });
  } else {
    // Convert from MySQL format to ISO
    const safeStr = String(timestamp || '').trim();
    const isoTime = safeStr ? safeStr.replace(' ', 'T') + '-04:00' : '';
    dateTime = DateTime.fromISO(isoTime);
  }
  
  const now = DateTime.now().setZone('America/New_York');
  const diff = now.diff(dateTime, ['days', 'hours', 'minutes', 'seconds']);
  
  if (!dateTime || !dateTime.isValid) {
    return 'Just now';
  }

  if (diff.days > 0) {
    return diff.days === 1 ? 'Yesterday' : `${diff.days} days ago`;
  } else if (diff.hours > 0) {
    return `${diff.hours} ${diff.hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diff.minutes > 0) {
    return `${Math.floor(diff.minutes)} ${Math.floor(diff.minutes) === 1 ? 'minute' : 'minutes'} ago`;
  } else {
    return 'Just now';
  }
};

const NotificationItem = ({ notification, onRead, onDismiss }) => {
  const navigate = useNavigate();
  const typeInfo = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.info;
  const IconComponent = typeInfo.icon;
  
  const handleClick = () => {
    // Mark as read
    if (!notification.is_read) {
      onRead(notification.id);
    }
    
    // Navigate if link is provided
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };
  
  return (
    <div 
      className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
      onClick={handleClick}
    >
      <div className="notification-icon" style={{ color: typeInfo.color }}>
        <IconComponent size={20} />
      </div>
      <div className="notification-content">
        <div className="notification-header">
          <h4 className="notification-title">{notification.title}</h4>
          <span className="notification-time">{formatRelativeTime(notification.created_at)}</span>
        </div>
        <p className="notification-message">{notification.message}</p>
      </div>
      <button 
        className="notification-dismiss"
        onClick={(e) => {
          e.stopPropagation();
          console.log('🗑️ [UI] Dismiss clicked for', notification?.id, notification);
          onDismiss(notification.id);
        }}
      >
        <BsX size={20} />
      </button>
    </div>
  );
};

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [hasInitiallyFetched, setHasInitiallyFetched] = useState(false);
  const {
    notifications = [],
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    dismissAllNotifications,
    fetchNotifications,
    forceRefreshNotifications, // ✨ Add force refresh function
    isLoading: loading,
    error,
    lastFetched,
    wsConnected
  } = useNotificationContext();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const toggleDropdown = () => {
    if (!isOpen) {
      // ✨ OPTIMIZED: Only fetch if we need to
      const shouldFetchResult = shouldFetchNotifications();
      
      if (shouldFetchResult.should) {
        console.log('🔄 [NOTIFICATION-CENTER] Fetching notifications because:', shouldFetchResult.reason);
        fetchNotifications();
      } else {
        console.log('⚡ [NOTIFICATION-CENTER] Using cached notifications - instant display!');
      }
      
      setHasInitiallyFetched(true);
    }
    setIsOpen(!isOpen);
  };
  
  // Helper function to determine if we should fetch notifications
  const shouldFetchNotifications = () => {
    // Always fetch on first open
    if (!hasInitiallyFetched) {
      return { should: true, reason: 'first time opening' };
    }
    
    // If we have no notifications and no error, fetch
    if (notifications.length === 0 && !error) {
      return { should: true, reason: 'no notifications in cache' };
    }
    
    // If WebSocket is disconnected and data is old, fetch
    if (!wsConnected && lastFetched) {
      const timeSinceLastFetch = Date.now() - lastFetched.getTime();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (timeSinceLastFetch > fiveMinutes) {
        return { should: true, reason: 'WebSocket disconnected and data is stale (>5min)' };
      }
    }
    
    // If there's an error and we don't have cached data, try to fetch
    if (error && notifications.length === 0) {
      return { should: true, reason: 'error state with no cached data' };
    }
    
    // Otherwise, use cached data for instant display
    return { should: false, reason: 'using cached data' };
  };
  
  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      await api.post('/notifications/test');
      // ✨ OPTIMIZED: Don't fetch here since WebSocket will update instantly
      console.log('🧪 [TEST] Test notification sent - WebSocket will handle real-time update');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      // Only fetch on error as fallback
      fetchNotifications();
    } finally {
      setTestingNotification(false);
    }
  };
  
  // Determine if we should show loading state
  const showLoading = loading && notifications.length === 0;
  
  return (
    <div className="notification-center" ref={dropdownRef}>
      <button 
        className="notification-bell"
        onClick={toggleDropdown}
        aria-label={`Notifications - ${unreadCount} unread`}
      >
        {unreadCount > 0 ? <BsBellFill /> : <BsBell />}
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>
      
      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header-bar">
            <h3>
              Notifications
              {wsConnected && (
                <span className="connection-indicator connected" title="Real-time connected">
                  ●
                </span>
              )}
            </h3>
            <div className="notification-actions">
              <button 
                className="notification-action-btn mark-all-read" 
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                title="Mark all as read"
              >
                <BsCheck2All size={16} />
              </button>
              <button 
                className="notification-action-btn clear-all" 
                onClick={dismissAllNotifications}
                disabled={notifications.filter(n => !n.is_dismissed).length === 0}
                title="Clear all notifications"
              >
                <BsTrash size={16} />
              </button>
              <button 
                className="notification-action-btn refresh" 
                onClick={() => {
                  console.log('🔄 [MANUAL] Manual refresh requested');
                  forceRefreshNotifications();
                }}
                title="Refresh notifications"
              >
                <BsArrowClockwise size={16} />
              </button>
              <button
                className="notification-action-btn settings"
                onClick={() => { navigate('/utilities?section=notifications'); setIsOpen(false); }}
                title="Notification settings"
              >
                <BsGear size={16} />
              </button>
            </div>
          </div>
          
          <div className="notification-list">
            {showLoading ? (
              <div className="notification-loading">Loading notifications...</div>
            ) : error && notifications.length === 0 ? (
              <div className="notification-error">Failed to load notifications</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">No notifications</div>
            ) : (
              notifications
                .filter(n => !n.is_dismissed)
                .map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onDismiss={dismissNotification}
                  />
                ))
            )}
          </div>

          <div className="notification-footer">
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter; 