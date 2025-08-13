import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import InPageNotification from './InPageNotification';

const InPageNotificationContainer = () => {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const showNotification = useCallback((notificationData) => {
    const newNotification = {
      id: notificationData.id || Date.now() + Math.random(),
      title: notificationData.title,
      message: notificationData.message || notificationData.body,
      link_url: notificationData.link_url,
      timestamp: Date.now()
    };

    setNotifications(prev => {
      // Limit to 3 notifications at once
      const updated = [newNotification, ...prev.slice(0, 2)];
      return updated;
    });
  }, []);

  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const handleNavigate = useCallback((url) => {
    navigate(url);
  }, [navigate]);

  // Expose the showNotification function globally
  React.useEffect(() => {
    window.showInPageNotification = showNotification;
    return () => {
      delete window.showInPageNotification;
    };
  }, [showNotification]);

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 9999 }}>
      {notifications.map((notification, index) => (
        <div 
          key={notification.id}
          style={{ 
            position: 'absolute',
            top: `${20 + (index * 80)}px`,
            right: '20px'
          }}
        >
          <InPageNotification
            notification={notification}
            onClose={() => removeNotification(notification.id)}
            onNavigate={handleNavigate}
          />
        </div>
      ))}
    </div>
  );
};

export default InPageNotificationContainer; 