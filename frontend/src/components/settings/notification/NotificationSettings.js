import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import NotificationToggle from './NotificationToggle';
import NotificationHistory from './NotificationHistory';
import NotificationSchedule from './NotificationSchedule';
import AdminNotifications from './AdminNotifications';

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { 
    pushEnabled, 
    subscribeToPushNotifications, 
    unsubscribeFromPushNotifications,
    notifications,
    loading,
    error: notificationError,
    dismissNotification,
    wsConnected,
    markAsRead,
    fetchNotifications,
  } = useNotifications();
  const { isAdmin: isAdminFromContext, user } = useAuth();
  
  // Check if user is admin with teamRole="app" - should have access to admin notifications
  const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
  
  const isAdmin = isAdminFromContext || (user && (user.id === 92 || user.userId === 92 || user.user_id === 92)) || isAppAdmin;
  
  // Debug logging for admin notification access
  console.log('🔔 NotificationSettings: Admin access check', {
    userRole: user?.Role,
    teamRole: user?.teamRole,
    isAdminFromContext,
    isAppAdmin,
    finalIsAdmin: isAdmin,
    adminNotificationsVisible: isAdmin
  });
  const [permission, setPermission] = useState('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState(null);
  const [isCheckingForNew, setIsCheckingForNew] = useState(false);
  const [hasDbSubscription, setHasDbSubscription] = useState(false);
  
  // New state for notification groups and scheduled notifications
  const [notificationGroups, setNotificationGroups] = useState([]);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  
  // Create ref for previous notifications to compare with new ones
  const prevNotificationsRef = useRef(notifications);

  useEffect(() => {
    // Check notification permission status
    if ('Notification' in window) {
      const currentPermission = Notification.permission;
      console.log('Current notification permission:', currentPermission);
      setPermission(currentPermission);
    }

    // Check if user has a subscription in the database
    const checkSubscriptionStatus = async () => {
      try {
        const response = await api.get('/notifications/subscription-status');
        console.log('Subscription status:', response.data);
        
        if (response.data.hasSubscription) {
          setHasDbSubscription(true);
          
          // If user has a subscription in DB but not in browser and permission is granted,
          // attempt to recreate the browser subscription
          if (!pushEnabled && Notification.permission === 'granted') {
            console.log('DB subscription exists but browser subscription missing - recreating');
            setIsSubscribing(true);
            try {
              await subscribeToPushNotifications();
            } finally {
              setIsSubscribing(false);
            }
          }
        }
      } catch (err) {
        console.error('Error checking subscription status:', err);
      }
    };
    
    checkSubscriptionStatus();
  }, [isAdmin, pushEnabled, subscribeToPushNotifications]);

  // Update ref when notifications change
  useEffect(() => {
    prevNotificationsRef.current = notifications;
  }, [notifications]);

  // Function to check for new notifications without disturbing component state
  const checkForNewNotifications = async () => {
    if (isCheckingForNew) return; // Prevent concurrent checks
    
    try {
      setIsCheckingForNew(true);
      
      await fetchNotifications();
      
      // The context will handle updating notifications state
      // The component only needs to re-render if there are new notifications      
    } catch (err) {
      console.error('Error checking for new notifications:', err);
    } finally {
      setIsCheckingForNew(false);
    }
  };
  
  // Set up periodic checking for new notifications (reduced since WebSocket handles real-time)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      // Only poll if WebSocket is not connected
      if (!wsConnected) {
        console.log('WebSocket not connected, checking for notifications via polling');
        checkForNewNotifications();
      }
    }, 300000); // Check every 5 minutes (reduced from 30 seconds)
    
    return () => clearInterval(checkInterval);
  }, [wsConnected]);

  const handleToggleNotifications = async () => {
    try {
      setError(null);
      setIsSubscribing(true);
      
      if (!pushEnabled) {
        // Request permission first
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        setPermission(permission);
        
        if (permission === 'granted') {
          console.log('Permission granted, subscribing to push notifications...');
          const success = await subscribeToPushNotifications();
          if (!success) {
            setError('Failed to enable notifications. Please try again.');
          }
        } else {
          setError('Notification permission denied');
        }
      } else {
        console.log('Unsubscribing from push notifications...');
        await unsubscribeFromPushNotifications();
      }
    } catch (err) {
      console.error('Error toggling notifications:', err);
      setError('An error occurred while updating notification settings');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setError(null);
      
      console.log('Sending test notification...');
      const response = await api.post('/notifications/test');
      
      if (response.data.success) {
        setError({ type: 'success', message: 'Test notification sent successfully!' });
        // Check for the new notification right away
        setTimeout(() => checkForNewNotifications(), 1000);
      } else {
        setError({ type: 'error', message: response.data.error || 'Failed to send test notification' });
      }
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError({ 
        type: 'error', 
        message: err.response?.data?.error || 'Failed to send test notification'
      });
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate if link is provided
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  // Function to fetch notification groups (admin and app admin only)
  const fetchNotificationGroups = async () => {
    if (!isAdmin) return;
    
    try {
      const response = await api.get('/notifications/admin/groups');
      if (response.data.success) {
        setNotificationGroups(response.data.groups || []);
      }
    } catch (error) {
      console.error('Error fetching notification groups:', error);
    }
  };
  
  // Function to fetch scheduled notifications (admin and app admin only)
  const fetchScheduledNotifications = async () => {
    if (!isAdmin) return;
    
    try {
      setLoadingScheduled(true);
      const response = await api.get('/notifications/scheduled');
      setScheduledNotifications(response.data || []);
      
      // Also refresh regular notifications to see newly sent notifications
      checkForNewNotifications();
    } catch (error) {
      console.error('Error fetching scheduled notifications:', error);
    } finally {
      setLoadingScheduled(false);
    }
  };
  
  // Load notification groups and scheduled notifications on component mount (admin and app admin only)
  useEffect(() => {
    if (isAdmin) {
      fetchNotificationGroups();
      fetchScheduledNotifications();
    }
  }, [isAdmin]);

  return (
    <div className="settings-section">
      {error && (
        <div className={`settings-alert ${error.type === 'success' ? 'settings-alert-success' : 'settings-alert-error'}`}>
          {error.message}
        </div>
      )}
      
      <NotificationToggle
        pushEnabled={pushEnabled}
        permission={permission}
        isSubscribing={isSubscribing}
        onToggle={handleToggleNotifications}
        onTest={handleTestNotification}
        hasDbSubscription={hasDbSubscription}
      />

      <NotificationHistory
        notifications={notifications}
        loading={loading || isCheckingForNew}
        error={notificationError}
        onNotificationClick={handleNotificationClick}
        onDismiss={dismissNotification}
        onRefresh={checkForNewNotifications}
      />
      
      {/* Admin Notification Settings - visible to admins and app admins */}
      {isAdmin && (
        <>
          <AdminNotifications />
        </>
      )}
    </div>
  );
};

export default NotificationSettings; 