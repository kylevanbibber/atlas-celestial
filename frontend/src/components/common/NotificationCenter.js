import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { BsBell, BsBellFill, BsCheck2All, BsTrash, BsX, BsGear, BsBellSlash } from 'react-icons/bs';
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
  // Parse the timestamp with explicit timezone handling
  // If the timestamp is in MySQL format (YYYY-MM-DD HH:MM:SS) convert it to ISO
  let dateTime;
  if (timestamp.includes('T')) {
    // Already in ISO format
    dateTime = DateTime.fromISO(timestamp, { zone: 'America/New_York' });
  } else {
    // Convert from MySQL format to ISO
    const isoTime = timestamp.replace(' ', 'T') + '-04:00'; // Eastern Time offset
    dateTime = DateTime.fromISO(isoTime);
  }
  
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
  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification
  } = useNotifications();
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
      // When opening, fetch notifications
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };
  
  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      await api.post('/notifications/test');
      // Refresh notifications after test
      fetchNotifications();
    } catch (error) {
      console.error('Failed to send test notification:', error);
    } finally {
      setTestingNotification(false);
    }
  };
  
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
            <h3>Notifications</h3>
            <div className="notification-actions">
              <button 
                className="notification-action-btn mark-all-read" 
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <BsCheck2All size={16} />
                <span>Read All</span>
              </button>
              <button 
                className="notification-action-btn view-all" 
                onClick={() => { navigate('/settings?section=notifications'); setIsOpen(false); }}
              >
                <span>View All</span>
              </button>
              <button
                className="notification-action-btn settings"
                onClick={() => { navigate('/settings?section=notifications'); setIsOpen(false); }}
              >
                <BsGear size={16} />
              </button>
            </div>
          </div>
          
          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading notifications...</div>
            ) : error ? (
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