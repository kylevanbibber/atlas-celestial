import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../api';

// Create context with default value
const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  fetchNotifications: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  dismissNotification: () => {},
  subscribeToPushNotifications: () => {},
  unsubscribeFromPushNotifications: () => {},
  pushEnabled: false
});

// Function to convert the base64 VAPID key to a Uint8Array
function urlBase64ToUint8Array(base64String) {
  if (!base64String) return null;
  
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Create the provider component
const NotificationProvider = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pushSubscription, setPushSubscription] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  // Fetch VAPID public key
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        console.log('Fetching VAPID key...');
        const response = await api.get('/notifications/vapid-key');
        console.log('VAPID key response:', response.data);
        
        if (response.data?.publicKey) {
          console.log('Setting VAPID public key');
          setVapidPublicKey(response.data.publicKey);
          
          // Store the subscription status for later use
          if (response.data.hasSubscription) {
            console.log('User has subscription in database');
            // We'll handle this after all functions are defined
          }
        } else {
          console.error('Invalid VAPID key response:', response.data);
          setError('Failed to initialize push notifications: Invalid server response');
        }
      } catch (err) {
        console.error('Error fetching VAPID key:', err);
        setError('Failed to initialize push notifications: ' + (err.response?.data?.error || err.message));
      }
    };

    if (isAuthenticated) {
      console.log('User is authenticated, fetching VAPID key');
      fetchVapidKey();
    } else {
      console.log('User is not authenticated, skipping VAPID key fetch');
    }
  }, [isAuthenticated]);

  // Fetch notifications
  const fetchNotifications = useCallback(async (includeRead = false) => {
    if (!isAuthenticated || !token) {
      console.log('Not authenticated or missing token, skipping notification fetch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Making notification request with auth token');
      const response = await api.get(`/notifications?includeRead=${includeRead}`);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!isAuthenticated || !token) return;

    try {
      await api.put(`/notifications/${notificationId}/read`);

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: true }
            : notification
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [isAuthenticated, token]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    try {
      await api.put('/notifications/read-all');

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({ ...notification, is_read: true }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [isAuthenticated, token]);

  // Dismiss notification
  const dismissNotification = useCallback(async (notificationId) => {
    if (!isAuthenticated || !token) return;

    try {
      await api.put(`/notifications/${notificationId}/dismiss`);

      // Update local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notification => 
          notification.id === notificationId
            ? { ...notification, is_dismissed: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  }, [isAuthenticated, token]);

  // Subscribe to push notifications
  const subscribeToPushNotifications = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return false;
      }

      if (!vapidPublicKey) {
        console.error('VAPID public key not available');
        return false;
      }

      console.log('Getting service worker registration...');
      // Get registration from a registered service worker
      const registration = await navigator.serviceWorker.ready;
      console.log('Service worker registration:', registration);
      
      // Get the existing subscription if available
      console.log('Checking for existing push subscription...');
      let subscription = await registration.pushManager.getSubscription();
      console.log('Existing subscription:', subscription);
      
      if (!subscription) {
        // Check current permission status
        const permission = await Notification.permission;
        console.log('Current notification permission:', permission);
        
        if (permission === 'denied') {
          console.log('Notification permission denied');
          setError('Please enable notifications in your browser settings');
          return false;
        }
        
        if (permission === 'default') {
          // Request permission first
          console.log('Requesting notification permission...');
          const newPermission = await Notification.requestPermission();
          console.log('New permission status:', newPermission);
          if (newPermission !== 'granted') {
            console.log('Notification permission denied');
            setError('Please allow notifications to enable push notifications');
            return false;
          }
        }

        // Create a new subscription
        console.log('Creating new push subscription...');
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        if (!applicationServerKey) {
          console.error('Failed to convert VAPID key');
          return false;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        
        console.log('Created new push subscription:', subscription);
      } else {
        console.log('Using existing push subscription');
      }
      
      setPushSubscription(subscription);
      
      // Save the subscription on the server
      if (isAuthenticated && user?.userId) {
        console.log('Saving subscription to server...');
        await api.post('/notifications/subscribe', {
          subscription: JSON.stringify(subscription),
          userId: user.userId
        });
        console.log('Push subscription saved on server');
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      setError('Failed to enable push notifications: ' + err.message);
      return false;
    }
  }, [isAuthenticated, user, vapidPublicKey]);

  // Unsubscribe from push notifications
  const unsubscribeFromPushNotifications = useCallback(async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
      }
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const result = await subscription.unsubscribe();
        
        // Remove subscription from server
        if (result && isAuthenticated && user?.userId) {
          await api.post('/notifications/unsubscribe', {
            subscription: JSON.stringify(subscription),
            userId: user.userId
          });
          console.log('Unsubscribed from push notifications');
        }
        
        setPushSubscription(null);
        return result;
      }
      
      return false;
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
      return false;
    }
  }, [isAuthenticated, user]);

  // Fetch notifications on mount and when auth state changes
  useEffect(() => {
    if (isAuthenticated && token) {
      // Initial fetch
      fetchNotifications();
      
      // Setup polling to periodically check for new notifications (every 1 minute)
      const intervalId = setInterval(() => {
        fetchNotifications();
      }, 60000);
      
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticated, token, fetchNotifications]);

  // Setup service worker for push notifications
  useEffect(() => {
    if (!isAuthenticated || !user?.userId) return;

    // Check if the browser supports service workers and push notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      // Register service worker for push notifications
      navigator.serviceWorker.register('/service-worker.js')
        .then(async registration => {
          console.log('Service worker registered:', registration);
          
          // Check for existing push subscription
          try {
            const subscription = await registration.pushManager.getSubscription();
            console.log('Found existing push subscription:', subscription);
            if (subscription) {
              setPushSubscription(subscription);
            }
          } catch (err) {
            console.error('Error checking push subscription:', err);
          }
        })
        .catch(error => {
          console.error('Service worker registration failed:', error);
        });
    }
    
    // Cleanup function to unsubscribe when component unmounts or user logs out
    return () => {
      if (!isAuthenticated) {
        unsubscribeFromPushNotifications();
      }
    };
  }, [isAuthenticated, user, unsubscribeFromPushNotifications]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handler = (event) => {
        if (event.data && event.data.type === 'NEW_NOTIFICATION') {
          console.log('Received NEW_NOTIFICATION message from service worker');
          fetchNotifications();
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    }
  }, [fetchNotifications]);

  // Check for database subscription and browser sync status
  useEffect(() => {
    const checkSubscriptionSync = async () => {
      if (!vapidPublicKey || !isAuthenticated) return;
      
      try {
        // Check if user has a subscription in the database
        const response = await api.get('/notifications/subscription-status');
        
        if (response.data.hasSubscription) {
          console.log('Found subscription in database, checking browser status');
          
          // Check if there's a browser subscription
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();
            
            if (!existingSubscription && Notification.permission === 'granted') {
              // Browser allows notifications but subscription is missing - recreate it
              console.log('Permission granted but subscription missing - recreating subscription');
              subscribeToPushNotifications();
            } else if (existingSubscription) {
              // We have both database record and browser subscription
              console.log('Found existing browser subscription');
              setPushSubscription(existingSubscription);
            }
          }
        }
      } catch (err) {
        console.error('Error syncing subscription status:', err);
      }
    };
    
    checkSubscriptionSync();
  }, [vapidPublicKey, isAuthenticated, subscribeToPushNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    pushEnabled: !!pushSubscription
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Create and export the hook
const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export { NotificationProvider, useNotifications };
export default NotificationContext; 