import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to manage presentation popup window
 * @param {string} url - URL to open in the popup
 * @param {string} name - Name of the window
 * @returns {Object} - Window control functions and state
 */
export const usePresentationWindow = (url = '/presentation-setup', name = 'PresentationSetup') => {
  const [popupWindow, setPopupWindow] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const checkIntervalRef = useRef(null);
  const messageChannelRef = useRef(null);

  // Calculate window position and size (73% of screen width, 78% height at bottom)
  const getWindowFeatures = useCallback(() => {
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    
    // 73% of screen width, 78% of screen height
    const width = Math.floor(screenWidth * 0.73);
    const height = Math.floor(screenHeight * 0.78);
    
    // Position at bottom left
    const left = 0;
    const top = screenHeight - height;
    
    return `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  }, []);

  // Open the popup window
  const openWindow = useCallback(() => {
    if (popupWindow && !popupWindow.closed) {
      // Window is already open, just focus it
      popupWindow.focus();
      
      // Also try to reopen scripts window if it's closed
      reopenScriptsWindow();
      return;
    }

    const features = getWindowFeatures();
    const newWindow = window.open(url, name, features);
    
    if (newWindow) {
      setPopupWindow(newWindow);
      setIsOpen(true);
      
      // Monitor if popup is closed
      const interval = setInterval(() => {
        if (newWindow.closed) {
          setPopupWindow(null);
          setIsOpen(false);
          clearInterval(interval);
        }
      }, 1000);
      
      checkIntervalRef.current = interval;
      
      // Also try to reopen scripts window if needed
      reopenScriptsWindow();
    } else {
      console.warn('Popup blocked or failed to open');
      alert('Please allow popups for this site to use the presentation feature.');
    }
  }, [url, name, getWindowFeatures, popupWindow]);

  // Function to reopen scripts window if it's closed
  const reopenScriptsWindow = useCallback(() => {
    // Check if there's an active presentation by looking for data in sessionStorage
    const presentationData = sessionStorage.getItem('presentationData');
    if (!presentationData) return;

    // Try to find the scripts window
    const scriptsWindow = window.open('', 'PresentationScripts');
    
    // If window doesn't exist or is closed, open it
    if (!scriptsWindow || scriptsWindow.closed || scriptsWindow.location.href === 'about:blank') {
      const screenWidth = window.screen.availWidth;
      const screenHeight = window.screen.availHeight;
      
      // Scripts panel is exactly 25% width
      const scriptsWidth = Math.floor(screenWidth * 0.25);
      const scriptsHeight = screenHeight;
      
      // Position aligned to the right side of the screen
      const scriptsLeft = screenWidth - scriptsWidth;
      const scriptsTop = 0;
      
      const scriptsUrl = `${window.location.origin}/presentation-scripts`;
      window.open(
        scriptsUrl,
        'PresentationScripts',
        `width=${scriptsWidth},height=${scriptsHeight},left=${scriptsLeft},top=${scriptsTop},resizable=yes,scrollbars=yes`
      );
      
      console.log('[PresentationWindow] Reopened scripts window');
    } else {
      // Window exists, just focus it
      scriptsWindow.focus();
    }
  }, []);

  // Close the popup window
  const closeWindow = useCallback(() => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    setIsOpen(false);
    
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, [popupWindow]);

  // Send message to popup
  const sendMessage = useCallback((data) => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.postMessage(data, window.location.origin);
    }
  }, [popupWindow]);

  // Initialize BroadcastChannel for multi-window communication
  useEffect(() => {
    const channel = new BroadcastChannel('presentation-channel');
    messageChannelRef.current = channel;
    
    // Listen for messages from popup
    channel.onmessage = (event) => {
      console.log('[Main Window] Received message:', event.data);
      // Handle messages from popup if needed
    };
    
    return () => {
      channel.close();
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (messageChannelRef.current) {
        messageChannelRef.current.close();
      }
    };
  }, []);

  return {
    isOpen,
    openWindow,
    closeWindow,
    sendMessage,
    popupWindow
  };
};

