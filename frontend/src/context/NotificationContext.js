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
  pushEnabled: false,
  wsConnected: false,
  wsError: null,
  isReconnecting: false,
  reconnectAttempts: 0
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
      console.log('Service worker state:', navigator.serviceWorker.controller?.state);
      console.log('Available registrations:', await navigator.serviceWorker.getRegistrations());
      
      // Get registration from a registered service worker with timeout
      let registration;
      try {
        console.log('Waiting for service worker to be ready...');
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service worker ready timeout after 10 seconds')), 10000)
        );
        
        // Race between service worker ready and timeout
        registration = await Promise.race([
          navigator.serviceWorker.ready,
          timeoutPromise
        ]);
        
        console.log('Service worker registration:', registration);
        console.log('Service worker active state:', registration.active?.state);
        
        if (!registration.active) {
          throw new Error('Service worker is not active');
        }
        
      } catch (error) {
        console.error('Error getting service worker ready:', error);
        throw new Error('Service worker failed to become ready: ' + error.message);
      }
      
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

  // WebSocket connection state
  const [wsConnection, setWsConnection] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Note: WebSocket connection logic is now inline in useEffect to avoid dependency loops

  // Fetch notifications on mount and when auth state changes
  useEffect(() => {
    if (isAuthenticated && token) {
      // Initial fetch
      fetchNotifications();
      
      // Connect to WebSocket for real-time updates with a small delay to prevent resource exhaustion
      const wsTimeout = setTimeout(() => {
        if (!wsConnected && !isReconnecting && isAuthenticated && token && reconnectAttempts === 0) {
          // Inline WebSocket connection to avoid dependency loops
          try {
            // Close any existing connection first
            if (wsConnection && wsConnection.readyState !== WebSocket.CLOSED) {
              wsConnection.close();
            }

            // Create WebSocket connection
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.hostname;
            const wsPort = process.env.NODE_ENV === 'production' ? window.location.port : '5001';
            const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/notifications`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            setIsReconnecting(true);
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
              console.log('🔗 WebSocket connected for notifications');
              setWsConnected(true);
              setWsError(null);
              setReconnectAttempts(0);
              setIsReconnecting(false);
              
              // Send authentication
              console.log('🔐 Sending WebSocket authentication...');
              ws.send(JSON.stringify({ 
                type: 'auth', 
                token: token 
              }));
            };

            ws.onmessage = (event) => {
              try {
                console.log('🔔 WebSocket message received:', event.data);
                const data = JSON.parse(event.data);
                console.log('🔔 Parsed WebSocket data:', data);
                
                if (data.type === 'auth_success') {
                  console.log('✅ WebSocket authentication successful');
                } else if (data.type === 'auth_error') {
                  console.error('❌ WebSocket authentication failed:', data.message);
                  setWsError('Authentication failed');
                  ws.close();
                } else if (data.type === 'notification') {
                  console.log('🔔 Received real-time notification:', data.notification);
                  console.log('🔄 Calling fetchNotifications() to update UI...');
                  fetchNotifications().then(() => {
                    console.log('✅ fetchNotifications() completed successfully');
                  }).catch(err => {
                    console.error('❌ fetchNotifications() failed:', err);
                  });
                } else if (data.type === 'ping') {
                  console.log('🏓 Responding to ping');
                  ws.send(JSON.stringify({ type: 'pong' }));

                } else {
                  console.log('❓ Unknown WebSocket message type:', data.type);
                }
              } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
              }
            };

            ws.onclose = (event) => {
              console.log('WebSocket disconnected', event.code, event.reason);
              setWsConnected(false);
              setIsReconnecting(false);
              
              // Only attempt to reconnect if still authenticated and not intentional close
              if (event.code !== 1000 && isAuthenticated && reconnectAttempts < 5) {
                const backoffDelay = Math.min(2000 * Math.pow(2, reconnectAttempts), 10000);
                console.log(`Will attempt to reconnect WebSocket in ${backoffDelay/1000} seconds... (attempt ${reconnectAttempts + 1}/5)`);
                
                setTimeout(() => {
                  setReconnectAttempts(prev => prev + 1);
                }, backoffDelay);
              } else if (reconnectAttempts >= 5) {
                console.log('Max reconnection attempts reached. Stopping reconnection.');
                setWsError('Connection failed after multiple attempts');
                setIsReconnecting(false);
              }
            };

            ws.onerror = (error) => {
              console.error('WebSocket error:', error);
              setWsConnected(false);
              setWsError('Connection error');
              setIsReconnecting(false);
            };

            setWsConnection(ws);
          } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            setWsError('Failed to connect');
            setIsReconnecting(false);
          }
        }
      }, 1000); // 1 second delay
      
      // Fallback polling (only if WebSocket fails or for redundancy)
      const fallbackInterval = setInterval(() => {
        if (!wsConnected) {
          console.log('WebSocket not connected, using fallback polling');
          fetchNotifications();
        }
      }, 120000); // Every 2 minutes as fallback
      
      return () => {
        clearTimeout(wsTimeout);
        clearInterval(fallbackInterval);
      };
    }
  }, [isAuthenticated, token, reconnectAttempts]); // Added reconnectAttempts dependency for reconnection logic

  // Separate effect for handling WebSocket cleanup on logout
  useEffect(() => {
    if (!isAuthenticated && wsConnection) {
      console.log('User logged out, disconnecting WebSocket');
      wsConnection.close(1000, 'User logout');
      setWsConnection(null);
      setWsConnected(false);
      setReconnectAttempts(0);
      setIsReconnecting(false);
    }
  }, [isAuthenticated, wsConnection]);

  // Handle reconnection attempts
  useEffect(() => {
    if (reconnectAttempts > 0 && reconnectAttempts < 5 && isAuthenticated && !wsConnected && !isReconnecting) {
      console.log(`Triggering reconnection attempt ${reconnectAttempts}`);
      // Trigger the main connection effect to retry
      const retryTimeout = setTimeout(() => {
        if (isAuthenticated && !wsConnected && !isReconnecting) {
          // Reset to trigger the main useEffect
          setReconnectAttempts(0);
        }
      }, 100);
      
      return () => clearTimeout(retryTimeout);
    }
  }, [reconnectAttempts, isAuthenticated, wsConnected, isReconnecting]);

  // Setup service worker for push notifications
  useEffect(() => {
    if (!isAuthenticated || !user?.userId) return;

    // Helper function to handle service worker registration
    async function handleServiceWorkerRegistration(registration) {
      console.log('✅ Service worker registered successfully:', registration);
      console.log('🔧 Registration state:', registration.installing, registration.waiting, registration.active);
      
      // Wait for service worker to become active if it's installing
      if (registration.installing) {
        console.log('🔧 Service worker is installing, waiting for activation...');
        await new Promise((resolve) => {
          registration.installing.addEventListener('statechange', function() {
            console.log('🔧 Service worker state changed to:', this.state);
            if (this.state === 'activated') {
              resolve();
            }
          });
        });
      }
      
      // Check for existing push subscription
      try {
        const subscription = await registration.pushManager.getSubscription();
        console.log('🔔 Found existing push subscription:', subscription);
        if (subscription) {
          setPushSubscription(subscription);
        }
      } catch (err) {
        console.error('❌ Error checking push subscription:', err);
      }
    }

    // Async function to setup service worker
    async function setupServiceWorker() {
      // Check if the browser supports service workers and push notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        console.log('🔧 Setting up service worker...');
        
        try {
          // Check if service worker is already registered
          const existingRegistration = await navigator.serviceWorker.getRegistration('/service-worker.js');
          if (existingRegistration) {
            console.log('🔧 Service worker already registered:', existingRegistration);
            // Use existing registration
            await handleServiceWorkerRegistration(existingRegistration);
            return;
          }
          
          // Register service worker for push notifications
          console.log('🔧 Registering new service worker...');
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          await handleServiceWorkerRegistration(registration);
          
        } catch (error) {
          console.error('❌ Service worker setup failed:', error);
        }
      } else {
        console.warn('⚠️ Service Worker or Push Manager not supported');
      }
    }

    setupServiceWorker();
    
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
    pushEnabled: !!pushSubscription,
    wsConnected,
    wsError,
    isReconnecting,
    reconnectAttempts
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