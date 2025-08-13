import React, { useState, useEffect, useRef } from 'react';
import { useNotificationContext } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import NotificationToggle from './NotificationToggle';
import NotificationHistory from './NotificationHistory';
import NotificationSchedule from './NotificationSchedule';
import AdminNotifications from './AdminNotifications';
import NotificationDiagnostic from './NotificationDiagnostic';

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { 
    pushEnabled, 
    subscribeToPushNotifications, 
    unsubscribeFromPushNotifications,
    forceRefreshSubscription,
    cleanupStaleSubscription,
    notifications,
    fetchNotifications,
    markAsRead,
    dismissNotification,
    isLoading: loading,
    error: notificationError,
    wsConnected,
    isIOSPWA,
    isIOSSafari,
    isPushSupported,
    getNotificationSupportMessage
  } = useNotificationContext();
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
  const [permission, setPermission] = useState(Notification.permission);
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
        console.log('🔍 Checking subscription status for user...');
        const response = await api.get('/notifications/subscription-status');
        console.log('📊 Subscription status response:', response.data);
        
        if (response.data.hasSubscription) {
          console.log('✅ User has subscription in database');
          setHasDbSubscription(true);
          
          // If user has a subscription in DB but not in browser and permission is granted,
          // this indicates a subscription mismatch that needs to be fixed
          if (!pushEnabled && Notification.permission === 'granted') {
            console.log('⚠️ SUBSCRIPTION MISMATCH: DB has subscription but browser does not');
            
            // Check if there's actually a browser subscription
            if ('serviceWorker' in navigator && 'PushManager' in window) {
              try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                if (registrations.length > 0) {
                  const subscription = await registrations[0].pushManager.getSubscription();
                  if (!subscription) {
                    console.log('🔧 No browser subscription found - offering to fix mismatch');
                    setError({
                      type: 'warning',
                      message: 'Your notification subscription is out of sync. Click "Fix Subscription Mismatch" to restore notifications.',
                      action: 'fix_mismatch'
                    });
                  }
                }
              } catch (err) {
                console.error('Error checking browser subscription:', err);
              }
            }
          } else if (!pushEnabled && Notification.permission === 'default') {
            console.log('📋 DB subscription exists but permission not granted yet');
            setError({
              type: 'info', 
              message: 'You previously had notifications enabled. Click the toggle to restore them.'
            });
          } else if (pushEnabled) {
            console.log('✅ Both DB and browser subscriptions are active');
            setError(null);
          }
        } else {
          console.log('ℹ️ No subscription found in database');
          setHasDbSubscription(false);
          setError(null);
        }
      } catch (err) {
        console.error('❌ Error checking subscription status:', err);
        setError({
          type: 'error',
          message: 'Unable to check notification status: ' + (err.response?.data?.error || err.message)
        });
      }
    };
    
    if (user?.userId) {
      checkSubscriptionStatus();
    }
  }, [user?.userId, pushEnabled]);

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

  // Check for updates to notification permission
  useEffect(() => {
    const checkPermission = () => {
      setPermission(Notification.permission);
    };
    
    // Check periodically for permission changes
    const checkInterval = setInterval(checkPermission, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  // Show appropriate message for iOS users
  const getIOSMessage = () => {
    if (isIOSSafari) {
      return {
        type: 'info',
        message: getNotificationSupportMessage()
      };
    }
    if (isIOSPWA && !pushEnabled && permission === 'default') {
      return {
        type: 'info', 
        message: 'Tap "Enable Notifications" below to receive push notifications on your iPhone.'
      };
    }
    if (isIOSPWA && permission === 'denied') {
      return {
        type: 'warning',
        message: 'Notifications are disabled. Go to iPhone Settings > Atlas > Notifications to enable them.'
      };
    }
    return null;
  };

  const handleToggleNotifications = async () => {
    try {
      setError(null);
      setIsSubscribing(true);
      
      if (!isPushSupported) {
        setError({ type: 'error', message: getNotificationSupportMessage() });
        return;
      }
      
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
            setError({ type: 'error', message: 'Failed to enable notifications. Please try again.' });
          } else {
            setError({ type: 'success', message: 'Notifications enabled successfully!' });
          }
        } else if (permission === 'denied') {
          if (isIOSPWA) {
            setError({ 
              type: 'error', 
              message: 'Notifications were denied. You can enable them in iPhone Settings > Atlas > Notifications.' 
            });
          } else {
            setError({ type: 'error', message: 'Notification permission denied. Please enable in your browser settings.' });
          }
        }
      } else {
        console.log('Unsubscribing from push notifications...');
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setError({ type: 'success', message: 'Notifications disabled successfully.' });
        } else {
          setError({ type: 'error', message: 'Failed to disable notifications. Please try again.' });
        }
      }
    } catch (err) {
      console.error('Error toggling notifications:', err);
      setError({ type: 'error', message: 'An error occurred while updating notification settings' });
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

  const handleFixSubscriptionMismatch = async () => {
    try {
      setError(null);
      setIsSubscribing(true);
      
      console.log('🔧 Attempting to fix subscription mismatch...');
      const success = await forceRefreshSubscription();
      
      if (success) {
        setError({ 
          type: 'success', 
          message: 'Subscription mismatch fixed! Notifications should now work properly.' 
        });
      } else {
        setError({ 
          type: 'error', 
          message: 'Failed to fix subscription mismatch. Please try toggling notifications off and on.' 
        });
      }
    } catch (err) {
      console.error('Error fixing subscription mismatch:', err);
      setError({ 
        type: 'error', 
        message: 'An error occurred while fixing the subscription mismatch.' 
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="settings-section">
      {error && (
        <div className={`settings-alert ${error.type === 'success' ? 'settings-alert-success' : error.type === 'warning' ? 'settings-alert-warning' : 'settings-alert-error'}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{error.message}</span>
            {error.action === 'fix_mismatch' && (
              <button 
                onClick={handleFixSubscriptionMismatch}
                disabled={isSubscribing}
                style={{
                  marginLeft: '10px',
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
                {isSubscribing ? 'Fixing...' : 'Fix Subscription Mismatch'}
              </button>
            )}
          </div>
        </div>
      )}
      
      <h2>Notification Settings</h2>
        
        {/* iOS-specific messaging */}
        {getIOSMessage() && (
          <div className={`alert alert-${getIOSMessage().type}`} style={{ marginBottom: '20px' }}>
            <div className="alert-content">
              <span className="alert-icon">
                {getIOSMessage().type === 'info' && '📱'}
                {getIOSMessage().type === 'warning' && '⚠️'}
                {getIOSMessage().type === 'error' && '❌'}
              </span>
              <span>{getIOSMessage().message}</span>
            </div>
          </div>
        )}

        {/* Push Notifications */}
        <div className="setting-section">
    
          <div className="setting-item">
       
            <div className="setting-control">
              {isPushSupported ? (
                <NotificationToggle
                  pushEnabled={pushEnabled}
                  permission={permission}
                  isSubscribing={isSubscribing}
                  onToggle={handleToggleNotifications}
                  onTest={handleTestNotification}
                  hasDbSubscription={hasDbSubscription}
                  forceRefreshSubscription={forceRefreshSubscription}
                />
              ) : (
                <span className="not-supported">Not Available</span>
              )}
            </div>
          </div>
        </div>
      
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
      
      {/* Diagnostic component for troubleshooting - show for admins or during development */}
      {(isAdmin || process.env.NODE_ENV === 'development') && (
        <NotificationDiagnostic />
      )}
    </div>
  );
};

export default NotificationSettings; 