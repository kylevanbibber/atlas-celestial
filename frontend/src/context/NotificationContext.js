import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import api from '../api';
import { playNotificationSound } from '../utils/notificationSound';

// WebSocket URL configuration - matches API configuration
const getWebSocketUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return "wss://atlas-celest-backend-3bb2fea96236.herokuapp.com/ws/notifications";
  } else {
    return "ws://localhost:5001/ws/notifications";
  }
};

// Create context with default value
const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  operationLoading: {
    markingRead: new Set(),
    dismissing: new Set(),
    markingAllRead: false
  },
  error: null,
  fetchNotifications: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  dismissNotification: () => {},
  dismissAllNotifications: () => {},
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
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pushSubscription, setPushSubscription] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);
  
  // Loading states for individual operations
  const [operationLoading, setOperationLoading] = useState({
    markingRead: new Set(),
    dismissing: new Set(),
    markingAllRead: false
  });

  // Additional state for UI features
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60000);
  const [lastFetched, setLastFetched] = useState(new Date());

  // ✨ MOVED: WebSocket connection state (moved before fetchNotifications to fix initialization order)
  const [wsConnection, setWsConnection] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isAppVisible, setIsAppVisible] = useState(!document.hidden);
  const [lastPongReceived, setLastPongReceived] = useState(Date.now());

  // Helper function to detect if running as iOS PWA
  const isIOSPWA = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iOS 13+ detection
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    return isIOS && isStandalone;
  }, []);

  // Helper function to detect if running in Safari on iOS
  const isIOSSafari = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iOS 13+ detection
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
    const isNotStandalone = !window.matchMedia('(display-mode: standalone)').matches && !window.navigator.standalone;
    return isIOS && isSafari && isNotStandalone;
  }, []);

  // Check if push notifications are supported in current environment
  const isPushSupported = useCallback(() => {
    // Check basic support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    // iOS Safari doesn't support push notifications (only PWA does)
    if (isIOSSafari()) {
      return false;
    }

    return true;
  }, [isIOSSafari]);

  // Helper message for unsupported scenarios
  const getNotificationSupportMessage = useCallback(() => {
    if (isIOSSafari()) {
      return "To enable push notifications on iPhone, tap the Share button and select 'Add to Home Screen' to install this app.";
    }
    if (!isPushSupported()) {
      return "Push notifications are not supported in this browser.";
    }
    return null;
  }, [isIOSSafari, isPushSupported]);

  // Fetch VAPID public key
  useEffect(() => {
    const fetchVapidKey = async () => {
      try {
        const response = await api.get('/notifications/vapid-key');
        
        if (response.data?.publicKey) {
          setVapidPublicKey(response.data.publicKey);
          
          // Store the subscription status for later use
          if (response.data.hasSubscription) {
            // We'll handle this after all functions are defined
          }
        } else {
          setError('Failed to initialize push notifications: Invalid server response');
        }
      } catch (err) {
        setError('Failed to initialize push notifications: ' + (err.response?.data?.error || err.message));
      }
    };

    if (isAuthenticated) {
      fetchVapidKey();
    }
  }, [isAuthenticated]);

  // Fetch notifications with smart caching
  const fetchNotifications = useCallback(async (includeRead = false, forceRefresh = false) => {
    if (!isAuthenticated || !token) {
      return;
    }

    // ✨ SMART CACHING: Check if we should skip the fetch
    if (!forceRefresh && shouldUseCachedData()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/notifications?includeRead=${includeRead}`);
      
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token, wsConnected, lastFetched, notifications.length]);

  // Helper function to determine if we should use cached data
  const shouldUseCachedData = useCallback(() => {
    // If no data cached, we need to fetch
    if (notifications.length === 0 && !lastFetched) {
      return false;
    }
    
    // If WebSocket is connected, data is fresh via real-time updates
    if (wsConnected) {
      return true;
    }
    
    // If WebSocket is disconnected, check staleness
    if (lastFetched) {
      const timeSinceLastFetch = Date.now() - lastFetched.getTime();
      const twoMinutes = 2 * 60 * 1000;
      
      if (timeSinceLastFetch < twoMinutes) {
        return true;
      } else {
        return false;
      }
    }
    
    return false;
  }, [wsConnected, lastFetched, notifications.length]);

  // Force refresh function for manual refreshes
  const forceRefreshNotifications = useCallback(() => {
    return fetchNotifications(false, true);
  }, [fetchNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!isAuthenticated || !token) return;

    // Set loading state for this specific notification
    setOperationLoading(prev => ({
      ...prev,
      markingRead: new Set([...prev.markingRead, notificationId])
    }));

    // 🚀 OPTIMISTIC UPDATE: Update UI immediately for better UX
    
    // Store the original notification in case we need to rollback
    let originalNotification = null;
    
    // Update local state immediately (optimistic update)
    setNotifications(prevNotifications => {
      const updatedNotifications = prevNotifications.map(notification => {
        if (notification.id === notificationId) {
          originalNotification = notification; // Store original for potential rollback
          return { ...notification, is_read: true };
        }
        return notification;
      });
      
      return updatedNotifications;
    });

    // Update unread count immediately if the notification was unread
    let wasUnread = false;
    setUnreadCount(prev => {
      if (originalNotification && !originalNotification.is_read) {
        wasUnread = true;
        const newCount = Math.max(0, prev - 1);
        return newCount;
      }
      return prev;
    });

    // Now perform the backend call
    try {
      const response = await api.put(`/notifications/${notificationId}/read`);
      
      // Backend call succeeded - no need to update UI again since we already did optimistically
      
    } catch (err) {
      
      // 🔄 ROLLBACK: Backend failed, revert the optimistic changes
      if (originalNotification) {
        setNotifications(prevNotifications =>
          prevNotifications.map(notification =>
            notification.id === notificationId
              ? originalNotification // Restore original state
              : notification
          )
        );
        
        // Restore unread count if we decremented it
        if (wasUnread) {
          setUnreadCount(prev => prev + 1);
        }
      }
      
      // Still refresh from backend to ensure we have the correct state
      fetchNotifications();
    } finally {
      // Clear loading state for this notification
      setOperationLoading(prev => {
        const newMarkingRead = new Set(prev.markingRead);
        newMarkingRead.delete(notificationId);
        return {
          ...prev,
          markingRead: newMarkingRead
        };
      });
    }
  }, [isAuthenticated, token, fetchNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    // 🚀 OPTIMISTIC UPDATE: Update UI immediately for better UX
    
    // Store original state for potential rollback
    let originalNotifications = null;
    let originalUnreadCount = 0;
    
    // Update local state immediately (optimistic update)
    setNotifications(prevNotifications => {
      originalNotifications = prevNotifications; // Store for rollback
      const updatedNotifications = prevNotifications.map(notification => ({ 
        ...notification, 
        is_read: true 
      }));
      
      return updatedNotifications;
    });

    // Update unread count immediately
    setUnreadCount(prev => {
      originalUnreadCount = prev;
      return 0;
    });

    // Now perform the backend call
    try {
      await api.put('/notifications/read-all');
      
      // Backend call succeeded - no need to update UI again since we already did optimistically
      
    } catch (err) {
      
      // 🔄 ROLLBACK: Backend failed, revert the optimistic changes
      if (originalNotifications) {
        setNotifications(originalNotifications);
        setUnreadCount(originalUnreadCount);
      }
      
      // Still refresh from backend to ensure we have the correct state
      fetchNotifications();
    }
  }, [isAuthenticated, token, fetchNotifications]);

  // Dismiss notification
  const dismissNotification = useCallback(async (notificationId) => {
    if (!isAuthenticated || !token) return;

    // 🚀 OPTIMISTIC UPDATE: Update UI immediately for better UX
    
    // Store original state for potential rollback
    let originalNotification = null;
    let wasUnread = false;
    
    // Update local state immediately (optimistic update)
    setNotifications(prevNotifications => {
      const updatedNotifications = prevNotifications.map(notification => {
        if (notification.id === notificationId) {
          originalNotification = notification; // Store original for potential rollback
          wasUnread = !notification.is_read; // Check if it was unread before dismissing
          return { ...notification, is_dismissed: true, is_read: true }; // Dismissing also marks as read
        }
        return notification;
      });
      
      return updatedNotifications;
    });

    // Update unread count immediately if notification was unread
    let originalUnreadCount = 0;
    if (wasUnread) {
      setUnreadCount(prev => {
        originalUnreadCount = prev;
        const newCount = Math.max(0, prev - 1);
        return newCount;
      });
    }

    // Now perform the backend call
    try {
      await api.put(`/notifications/${notificationId}/dismiss`);
      
      // Backend call succeeded - no need to update UI again since we already did optimistically
      
    } catch (err) {
      
      // 🔄 ROLLBACK: Backend failed, revert the optimistic changes
      if (originalNotification) {
        setNotifications(prevNotifications =>
          prevNotifications.map(notification =>
            notification.id === notificationId
              ? originalNotification // Restore original state
              : notification
          )
        );
        
        // Restore unread count if we decremented it
        if (wasUnread) {
          setUnreadCount(prev => prev + 1);
        }
      }
      
      // Still refresh from backend to ensure we have the correct state
      fetchNotifications();
    }
  }, [isAuthenticated, token, fetchNotifications]);

  // Dismiss all notifications
  const dismissAllNotifications = useCallback(async () => {
    if (!isAuthenticated || !token) return;

    try {
      // Mark all as read first, then dismiss
      await api.put('/notifications/read-all');
      
      // For now, we'll dismiss each notification individually since there's no bulk dismiss endpoint
      // In a production app, you'd want a bulk dismiss endpoint for better performance
      const currentNotifications = notifications.filter(n => !n.is_dismissed);
      
      for (const notification of currentNotifications) {
        await api.put(`/notifications/${notification.id}/dismiss`);
      }

      // Update local state - mark all as dismissed and read
      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({ 
          ...notification, 
          is_dismissed: true, 
          is_read: true 
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      // Fallback: refresh notifications to get accurate state
      fetchNotifications();
    }
  }, [isAuthenticated, token, notifications, fetchNotifications]);

  // Subscribe to push notifications
  const subscribeToPushNotifications = useCallback(async () => {
    try {
      if (!isPushSupported()) {
        const message = getNotificationSupportMessage();
        setError(message);
        return false;
      }
      
      if (!vapidPublicKey) {
        setError('Push notifications are not properly configured. Please contact support.');
        return false;
      }
      
      setError(null);
      
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration) {
        setError('Service worker not available. Please refresh the page and try again.');
        return false;
      }
      
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Check current permission status
        const permission = await Notification.permission;
        
        if (permission === 'denied') {
          setError('Please enable notifications in your browser settings');
          return false;
        }
        
        if (permission === 'default') {
          // Request permission first
          const newPermission = await Notification.requestPermission();
          if (newPermission !== 'granted') {
            setError('Please allow notifications to enable push notifications');
            return false;
          }
        }

        // Create a new subscription with retry logic for iOS PWA
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        if (!applicationServerKey) {
          setError('Invalid server configuration. Please contact support.');
          return false;
        }

        // Retry logic for iOS PWA issues
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!subscription && retryCount < maxRetries) {
          try {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey
            });
            
            break;
            
          } catch (subscribeError) {
            retryCount++;
            
            if (retryCount >= maxRetries) {
              let errorMessage = 'Failed to create push subscription. ';
              
              if (subscribeError.name === 'NotSupportedError') {
                errorMessage += 'Push notifications are not supported in this browser.';
              } else if (subscribeError.name === 'NotAllowedError') {
                errorMessage += 'Push notifications are blocked. Please enable them in your browser settings.';
              } else if (isIOSPWA()) {
                errorMessage += 'Please try closing and reopening the app from your home screen.';
              } else {
                errorMessage += 'Please try refreshing the page and enabling notifications again.';
              }
              
              setError(errorMessage);
              return false;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!subscription) {
          setError('Unable to create push subscription after multiple attempts.');
          return false;
        }
        
      } else {
        
        // Validate the existing subscription
        try {
          // Test if the subscription is still valid by checking its properties
          if (!subscription.endpoint || !subscription.keys) {
            // Unsubscribe the invalid one
            await subscription.unsubscribe();
            
            // Create a new subscription
            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey
            });
            
          }
        } catch (validationError) {
          setError('Existing subscription is invalid. Please try disabling and re-enabling notifications.');
          return false;
        }
      }
      
      setPushSubscription(subscription);
      
      // Save the subscription on the server with retry logic
      if (isAuthenticated && user?.userId) {
        
        try {
          const response = await api.post('/notifications/subscribe', {
            subscription: JSON.stringify(subscription),
            userId: user.userId
          });
          
          if (response.data.success) {
            // Verify the subscription was saved by checking status
            try {
              const statusResponse = await api.get('/notifications/subscription-status');
              if (statusResponse.data.hasSubscription) {
                return true;
              } else {
                setError('Subscription was created but not properly saved. Please try again.');
                return false;
              }
            } catch (verifyError) {
              // Don't fail completely if verification fails
              return true;
            }
            
          } else {
            throw new Error('Server response indicated failure');
          }
          
        } catch (saveError) {
          let errorMessage = 'Failed to save subscription: ';
          if (saveError.response?.status === 401) {
            errorMessage += 'Please log in again.';
          } else if (saveError.response?.status >= 500) {
            errorMessage += 'Server error. Please try again later.';
          } else {
            errorMessage += (saveError.response?.data?.error || saveError.message);
          }
          
          setError(errorMessage);
          return false;
        }
      } else {
        setError('Please log in to enable push notifications.');
        return false;
      }
      
    } catch (error) {
      let errorMessage = 'Failed to enable push notifications: ';
      if (error.name === 'NotSupportedError') {
        errorMessage += 'Not supported in this browser.';
      } else if (error.name === 'NotAllowedError') {
        errorMessage += 'Permission denied.';
      } else if (isIOSPWA()) {
        errorMessage += 'Please try restarting the app.';
      } else {
        errorMessage += (error.message || 'Unknown error occurred.');
      }
      
      setError(errorMessage);
      return false;
    }
  }, [vapidPublicKey, isPushSupported, getNotificationSupportMessage, isAuthenticated, user?.userId, isIOSPWA]);

  // Unsubscribe from push notifications
  const unsubscribeFromPushNotifications = useCallback(async () => {
    try {
      if (!isPushSupported()) {
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
        }
        
        setPushSubscription(null);
        return result;
      }
      
      return false;
    } catch (err) {
      return false;
    }
  }, [isAuthenticated, user, isPushSupported]);

  // Connection health check - detect stale connections
  useEffect(() => {
    if (!wsConnected || !isAuthenticated) return;

    const healthCheckInterval = setInterval(() => {
      const timeSinceLastPong = Date.now() - lastPongReceived;
      const isStale = timeSinceLastPong > 90000; // 90 seconds without pong = stale

      if (isStale && !document.hidden) {
        if (wsConnection) {
          wsConnection.close();
        }
        setWsConnected(false);
        setReconnectAttempts(0); // Reset attempts for fresh start
      }
    }, 60000); // Check every minute

    return () => clearInterval(healthCheckInterval);
  }, [wsConnected, isAuthenticated, lastPongReceived, wsConnection]);

  // Handle app visibility changes (iOS PWA lifecycle)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsAppVisible(visible);
      
      
      if (visible && isAuthenticated) {
        // If WebSocket is disconnected and we're authenticated, try to reconnect
        if (!wsConnected && !isReconnecting) {
          // Reset reconnect attempts when app becomes visible
          setReconnectAttempts(0);
          
          // Trigger reconnection after a short delay
          setTimeout(() => {
            if (!wsConnected && isAuthenticated && !isReconnecting) {
              setReconnectAttempts(1); // This will trigger the reconnection effect
            }
          }, 1000);
        }
        
        // Also refresh notifications when app becomes visible
        // ✨ OPTIMIZED: Only fetch if WebSocket is not connected since WebSocket keeps us in sync
        setTimeout(() => {
          if (!wsConnected) {
            fetchNotifications();
          }
        }, 500);
      }
    };

    const handleFocus = () => {
      handleVisibilityChange();
    };

    const handleBlur = () => {
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // iOS PWA specific events
    window.addEventListener('pageshow', handleVisibilityChange);
    window.addEventListener('pagehide', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pageshow', handleVisibilityChange);
      window.removeEventListener('pagehide', handleBlur);
    };
  }, [wsConnected, isReconnecting, isAuthenticated, fetchNotifications]);

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
          
          // Create WebSocket connection using the same URL logic as API
          const wsUrl = getWebSocketUrl();
          
          try {
            // Close any existing connection first
            if (wsConnection && wsConnection.readyState !== WebSocket.CLOSED) {
              wsConnection.close();
            }
            
            setIsReconnecting(true);
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
              setWsConnected(true);
              setWsError(null);
              setReconnectAttempts(0);
              setIsReconnecting(false);
              setLastPongReceived(Date.now());
              
              // If this is a reconnection after the app was in background, show a brief message
              if (reconnectAttempts > 0) {
                // Show brief in-page notification about reconnection
                if (window.showInPageNotification && !document.hidden) {
                  setTimeout(() => {
                    window.showInPageNotification({
                      title: 'Connection Restored',
                      message: 'Real-time notifications are working again.',
                      id: 'reconnection-' + Date.now()
                    });
                  }, 1000);
                }
              }
              
              // Send authentication
              ws.send(JSON.stringify({ 
                type: 'auth', 
                token: token 
              }));
            };

            ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'auth_success') {
                } else if (data.type === 'auth_error') {
                  setWsError('Authentication failed');
                  ws.close();
                } else if (data.type === 'notification') {
                  // Validate payload to prevent blank notifications
                  const raw = data && data.notification ? data.notification : {};
                  const hasRequired = raw && raw.id && raw.title && raw.message;
                  if (!hasRequired) {
                    return;
                  }
                  
                  // ✨ OPTIMIZED: Directly add the new notification to state instead of refetching all
                  const newNotification = {
                    ...raw,
                    is_read: false,
                    is_dismissed: false
                  };
                  
                  setNotifications(prevNotifications => {
                    // Check if notification already exists (prevent duplicates)
                    const exists = prevNotifications.some(n => n.id === newNotification.id);
                    if (exists) {
                      return prevNotifications;
                    }
                    
                    // Add new notification to the beginning of the array (newest first)
                    return [newNotification, ...prevNotifications];
                  });
                  
                  // Update unread count immediately
                  setUnreadCount(prevCount => {
                    const newCount = prevCount + 1;
                    return newCount;
                  });
                  
                  // Show in-page notification if tab is active
                  if (document.visibilityState === 'visible' && !document.hidden) {
                    if (window.showInPageNotification) {
                      window.showInPageNotification(data.notification);
                    }
                    // Play notification sound for WebSocket notifications too
                    playNotificationSound();
                  }
                  
                } else if (data.type === 'notification_read') {
                  
                  // ✨ OPTIMIZED: Update specific notification's read status directly
                  setNotifications(prevNotifications => 
                    prevNotifications.map(notification => 
                      notification.id === data.notificationId
                        ? { ...notification, is_read: true }
                        : notification
                    )
                  );
                  
                  // Update unread count if notification was previously unread
                  setUnreadCount(prevCount => {
                    const notification = notifications.find(n => n.id === data.notificationId);
                    if (notification && !notification.is_read) {
                      const newCount = Math.max(0, prevCount - 1);
                      return newCount;
                    }
                    return prevCount;
                  });
                  
                } else if (data.type === 'all_notifications_read') {
                  // ✨ OPTIMIZED: Mark all notifications as read directly
                  setNotifications(prevNotifications => 
                    prevNotifications.map(notification => 
                      ({ ...notification, is_read: true })
                    )
                  );
                  
                  // Reset unread count to 0
                  setUnreadCount(0);
                  
                } else if (data.type === 'notification_dismissed') {
                  // ✨ OPTIMIZED: Remove dismissed notification from state directly
                  setNotifications(prevNotifications => {
                    const updatedNotifications = prevNotifications.filter(n => n.id !== data.notificationId);
                    return updatedNotifications;
                  });
                  
                  // Update unread count if dismissed notification was unread
                  setUnreadCount(prevCount => {
                    const notification = notifications.find(n => n.id === data.notificationId);
                    if (notification && !notification.is_read) {
                      const newCount = Math.max(0, prevCount - 1);
                      return newCount;
                    }
                    return prevCount;
                  });
                  
                } else if (data.type === 'ping') {
                  ws.send(JSON.stringify({ type: 'pong' }));
                  setLastPongReceived(Date.now()); // Update last pong received time
                }
              } catch (error) {
                // Error parsing WebSocket message
              }
            };

            ws.onclose = (event) => {
              setWsConnected(false);
              setIsReconnecting(false);
              
              // Don't attempt immediate reconnection if app is hidden/in background
              // This is especially important for iOS PWAs
              const isAppInBackground = document.hidden || document.visibilityState === 'hidden';
              
              if (isAppInBackground) {
                return;
              }
              
              // Only attempt to reconnect if still authenticated and not intentional close
              if (event.code !== 1000 && isAuthenticated && reconnectAttempts < 3) {
                const backoffDelay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 5000);
                
                setTimeout(() => {
                  // Double-check app is still visible before reconnecting
                  if (!document.hidden && isAuthenticated) {
                    setReconnectAttempts(prev => prev + 1);
                  }
                }, backoffDelay);
              } else if (reconnectAttempts >= 3) {
                setWsError('WebSocket connection failed. Using polling fallback.');
                setIsReconnecting(false);
              }
            };

            ws.onerror = (error) => {
              setWsConnected(false);
              setWsError(`Connection failed to ${wsUrl}. Backend server may not be running.`);
              setIsReconnecting(false);
            };

            setWsConnection(ws);
          } catch (error) {
            setWsError(`Failed to connect to WebSocket server at ${wsUrl}. Please ensure the backend server is running.`);
            setIsReconnecting(false);
          }
        }
      }, 1000); // 1 second delay
      
      // Fallback polling (only if WebSocket fails or for redundancy)
      const fallbackInterval = setInterval(() => {
        // Only poll if WebSocket is not connected, app is visible, and user is authenticated
        if (!wsConnected && isAuthenticated && !document.hidden) {
          fetchNotifications();
        }
      }, 30000); // Every 30 seconds when WebSocket is down and app is visible
      
      return () => {
        clearTimeout(wsTimeout);
        clearInterval(fallbackInterval);
      };
    }
  }, [isAuthenticated, token, reconnectAttempts, wsConnected, isReconnecting, fetchNotifications]); // Added reconnectAttempts dependency for reconnection logic

  // Separate effect for handling WebSocket cleanup on logout
  useEffect(() => {
    if (!isAuthenticated && wsConnection) {
      wsConnection.close(1000, 'User logout');
      setWsConnection(null);
      setWsConnected(false);
      setReconnectAttempts(0);
      setIsReconnecting(false);
    }
  }, [isAuthenticated, wsConnection]);

  // Handle reconnection attempts
  useEffect(() => {
    if (reconnectAttempts > 0 && reconnectAttempts < 3 && isAuthenticated && !wsConnected && !isReconnecting) {
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
      // Wait for service worker to become active if it's installing
      if (registration.installing) {
        await new Promise((resolve) => {
          const installing = registration.installing;
          const handleStateChange = (event) => {
            if (event.target.state === 'activated') {
              installing.removeEventListener('statechange', handleStateChange);
              resolve();
            }
          };
          installing.addEventListener('statechange', handleStateChange);
        });
      }
      
      // For iOS PWAs, add additional wait time to ensure everything is ready
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      
      if (isIOS && isPWA) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Check for existing push subscription with retry logic for iOS
      try {
        let subscription = null;
        let retries = 3;
        
        while (!subscription && retries > 0) {
          try {
            subscription = await registration.pushManager.getSubscription();
            if (!subscription && retries > 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          retries--;
        }
        
        if (subscription) {
          setPushSubscription(subscription);
        }
      } catch (err) {
        // Error checking push subscription
      }
    }

    // Async function to setup service worker
    async function setupServiceWorker() {
      // Check if the browser supports service workers and push notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        // Special handling for iOS
        if (isIOSPWA()) {
          // iOS PWA detected - using optimized setup
        } else if (isIOSSafari()) {
          setError('Push notifications are only available when this app is added to your iPhone home screen. Tap the Share button and select "Add to Home Screen".');
          return;
        }
        
        try {
          let registration = null;
          
          // For iOS PWAs, we need to wait a bit for the service worker to be fully ready
          if (isIOSPWA()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Try multiple registration paths for iOS PWA compatibility
          const possiblePaths = ['/service-worker.js', './service-worker.js'];
          
          // First, check for existing registrations
          const existingRegistrations = await navigator.serviceWorker.getRegistrations();
          if (existingRegistrations.length > 0) {
            registration = existingRegistrations[0];
            
            // Make sure the registration is active
            if (registration.active) {
              await handleServiceWorkerRegistration(registration);
            } else {
              await new Promise((resolve) => {
                if (registration.installing) {
                  const installing = registration.installing;
                  const handleStateChange = (event) => {
                    if (event.target.state === 'activated') {
                      installing.removeEventListener('statechange', handleStateChange);
                      resolve();
                    }
                  };
                  installing.addEventListener('statechange', handleStateChange);
                } else {
                  resolve();
                }
              });
              await handleServiceWorkerRegistration(registration);
            }
          } else {
            // Try to register with different paths
            for (const path of possiblePaths) {
              try {
                registration = await navigator.serviceWorker.register(path, {
                  scope: '/',
                  updateViaCache: 'none' // Important for PWAs
                });
                
                // Wait for the service worker to be ready
                await navigator.serviceWorker.ready;
                await handleServiceWorkerRegistration(registration);
                break;
              } catch (error) {
                // Failed to register with this path, try next
              }
            }
          }
          
          if (!registration) {
            setError('Failed to set up push notifications. Please try refreshing the page.');
          }
          
          // Set up message listener for service worker messages
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
              switch (event.data.type) {
                case 'NEW_NOTIFICATION':
                  // Refresh notifications when new one arrives
                  fetchNotifications();
                  break;
                  
                case 'SHOW_IN_PAGE_NOTIFICATION':
                  // Show in-page notification if tab is active
                  if (document.visibilityState === 'visible' && !document.hidden) {
                    if (window.showInPageNotification) {
                      window.showInPageNotification(event.data.notification);
                    }
                    // Play notification sound
                    playNotificationSound();
                    
                    // Send acknowledgment back to service worker
                    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({
                        type: 'IN_PAGE_NOTIFICATION_HANDLED',
                        notificationId: event.data.notification.id,
                        timestamp: Date.now()
                      });
                    }
                  } else if (event.data.fallbackToBrowser) {
                    // If app is not visible and this was an iOS PWA test, tell service worker to show browser notification
                    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_BROWSER_NOTIFICATION_FALLBACK',
                        notification: event.data.notification,
                        timestamp: Date.now()
                      });
                    }
                  }
                  break;
                  
                case 'CHECK_VISIBILITY':
                  // Respond with current tab visibility state
                  // The service worker will handle this by checking client.focused
                  break;
                  
                case 'NOTIFICATION_CLICKED':
                  // Handle notification click if needed
                  
                  // If there's a URL in the notification data, navigate to it
                  if (event.data.url && event.data.url !== '/') {
                    navigate(event.data.url);
                  }
                  
                  // Mark the notification as read if we have the ID
                  if (event.data.data?.id) {
                    markAsRead(event.data.data.id);
                  }
                  break;
                  
                case 'NAVIGATE_TO':
                  // Handle navigation requests from service worker
                  if (event.data.url) {
                    navigate(event.data.url);
                  }
                  break;
                  
                case 'NOTIFICATION_ERROR':
                  // Notification error from service worker
                  break;
                  
                default:
                  // Unknown message from service worker
              }
            });
          }
          
        } catch (error) {
          // Provide helpful error messages for different scenarios
          if (isIOSPWA()) {
            setError('Failed to set up notifications. Please try closing and reopening the app.');
          } else if (isIOSSafari()) {
            setError('To receive push notifications on iPhone, please add this app to your home screen first.');
          } else {
            setError('Failed to set up push notifications. Please check your browser settings and try again.');
          }
        }
      } else {
        setError('Push notifications are not supported in this browser.');
      }
    }

    setupServiceWorker();
    
    // Cleanup function to unsubscribe when component unmounts or user logs out
    return () => {
      if (!isAuthenticated) {
        unsubscribeFromPushNotifications();
      }
    };
  }, [isAuthenticated, user, unsubscribeFromPushNotifications, isIOSPWA, isIOSSafari, fetchNotifications, setError, navigate, markAsRead]);

  // Check for database subscription and browser sync status
  useEffect(() => {
    const checkSubscriptionSync = async () => {
      if (!vapidPublicKey || !isAuthenticated) return;
      
      // Add delay for iOS PWAs to ensure everything is loaded
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      
      if (isIOS && isPWA) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      try {
        // Check if user has a subscription in the database
        const response = await api.get('/notifications/subscription-status');
        
        if (response.data.hasSubscription) {
          // Check if there's a browser subscription
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
              // Use getRegistrations instead of ready for better iOS PWA compatibility
              const registrations = await navigator.serviceWorker.getRegistrations();
              if (registrations.length === 0) {
                return;
              }
              
              const registration = registrations[0];
              const existingSubscription = await registration.pushManager.getSubscription();
              
              if (!existingSubscription && Notification.permission === 'granted') {
                // Browser allows notifications but subscription is missing - recreate it
                subscribeToPushNotifications();
              } else if (existingSubscription) {
                // We have both database record and browser subscription
                setPushSubscription(existingSubscription);
              }
            } catch (err) {
              // Error checking service worker registration
            }
          }
        }
      } catch (err) {
        // Error syncing subscription status
      }
    };
    
    // Add a longer delay before running the sync check
    const timeoutId = setTimeout(checkSubscriptionSync, 2000);
    return () => clearTimeout(timeoutId);
  }, [vapidPublicKey, isAuthenticated, subscribeToPushNotifications]);

  // Clean up stale subscriptions - useful when DB and browser are out of sync
  const cleanupStaleSubscription = useCallback(async () => {
    try {
      // First, try to unsubscribe from any existing browser subscription
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          try {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
              await subscription.unsubscribe();
            }
          } catch (err) {
            // Could not unsubscribe existing subscription
          }
        }
      }
      
      // Clear local state
      setPushSubscription(null);
      
      // Delete subscription from server
      if (isAuthenticated && user?.userId) {
        try {
          await api.post('/notifications/unsubscribe', { userId: user.userId });
        } catch (err) {
          // Could not clean up server subscription
        }
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }, [isAuthenticated, user?.userId]);

  // Force fresh subscription - cleans up and creates new
  const forceRefreshSubscription = useCallback(async () => {
    setError(null);
    
    if (!isPushSupported()) {
      setError('Push notifications are not supported in this browser.');
      return false;
    }
    
    if (!vapidPublicKey) {
      setError('Push notifications are not properly configured.');
      return false;
    }
    
    try {
      // First clean up any stale subscriptions
      await cleanupStaleSubscription();
      
      // Wait a moment for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now create a fresh subscription
      const success = await subscribeToPushNotifications();
      
      if (success) {
        setError(null);
        return true;
      } else {
        setError('Failed to create fresh subscription after cleanup.');
        return false;
      }
      
    } catch (error) {
      setError('Failed to refresh subscription: ' + (error.message || 'Unknown error'));
      return false;
    }
  }, [isPushSupported, vapidPublicKey, subscribeToPushNotifications, cleanupStaleSubscription]);

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    fetchNotifications,
    forceRefreshNotifications, // ✨ Add force refresh function
    isLoading: loading,
    operationLoading, // Add loading states for individual operations
    error,
    setError,
    wsConnected,
    isReconnecting,
    showConnectionStatus,
    setShowConnectionStatus,
    // ✨ Add connection status indicators
    connectionStatus: {
      connected: wsConnected,
      realTime: wsConnected,
      fallbackMode: !wsConnected && isAuthenticated,
      statusText: wsConnected ? 'Real-time connected' : (isAuthenticated ? 'Using polling mode' : 'Disconnected')
    },
    wsError,
    reconnectAttempts,
    pushEnabled: !!pushSubscription,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    forceRefreshSubscription,
    cleanupStaleSubscription,
    refreshInterval,
    setRefreshInterval,
    lastFetched,
    dismissAllNotifications, // Add the new function to the context value
    // Add iOS-specific helper functions for components
    isIOSPWA: isIOSPWA(),
    isIOSSafari: isIOSSafari(),
    isPushSupported: isPushSupported(),
    // Helper message for unsupported scenarios
    getNotificationSupportMessage: getNotificationSupportMessage
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Create and export the hook
const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export { NotificationProvider, useNotificationContext };
export default NotificationContext; 