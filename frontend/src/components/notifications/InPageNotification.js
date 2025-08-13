import React, { useState, useEffect } from 'react';
import { FiX, FiBell, FiExternalLink } from 'react-icons/fi';
import './InPageNotification.css';

const InPageNotification = ({ notification, onClose, onNavigate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (notification) {
      // Small delay to trigger animation
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (notification) {
      // Auto-close after 6 seconds
      const autoCloseTimer = setTimeout(() => {
        handleClose();
      }, 6000);

      return () => clearTimeout(autoCloseTimer);
    }
  }, [notification]);

  const handleClose = () => {
    setIsRemoving(true);
    setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose();
      }, 300);
    }, 200);
  };

  const handleClick = () => {
    if (notification.link_url && notification.link_url !== '/') {
      console.log('🔗 In-page notification clicked, navigating to:', notification.link_url);
      onNavigate(notification.link_url);
    }
    handleClose();
  };

  if (!notification) return null;

  return (
    <div 
      className={`in-page-notification ${isVisible ? 'visible' : ''} ${isRemoving ? 'removing' : ''}`}
      onClick={handleClick}
      style={{ cursor: notification.link_url ? 'pointer' : 'default' }}
    >
      <div className="notification-icon">
        <FiBell />
      </div>
      
      <div className="notification-content">
        <div className="notification-title">
          {notification.title || 'New Notification'}
        </div>
        <div className="notification-message">
          {notification.message || notification.body || ''}
        </div>
        {notification.link_url && (
          <div className="notification-action">
            <FiExternalLink size={12} />
            <span>Click to view</span>
          </div>
        )}
      </div>
      
      <button 
        className="notification-close"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        aria-label="Close notification"
      >
        <FiX />
      </button>
    </div>
  );
};

export default InPageNotification; 