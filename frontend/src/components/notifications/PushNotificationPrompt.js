import React, { useState, useEffect, useCallback } from 'react';
import { FiBell, FiX } from 'react-icons/fi';
import { useNotificationContext } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const PROMPT_DISMISSED_KEY = 'pushNotificationPromptDismissed';
const PROMPT_COOLDOWN_KEY = 'pushNotificationPromptCooldown';
const COOLDOWN_DAYS = 7; // Don't show again for 7 days if dismissed

const PushNotificationPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const { isAuthenticated } = useAuth();
  const {
    pushEnabled,
    isPushSupported,
    isIOSSafari,
    subscribeToPushNotifications,
    getNotificationSupportMessage
  } = useNotificationContext();

  const shouldShowPrompt = useCallback(() => {
    // Don't show if not authenticated or push already enabled
    if (!isAuthenticated || pushEnabled) return false;

    // Don't show if push not supported
    if (!isPushSupported) return false;

    // Don't show in iOS Safari (they need to add to home screen first)
    if (isIOSSafari) return false;

    // Don't show if already denied — we can't request again
    if ('Notification' in window && Notification.permission === 'denied') return false;

    // Check if user permanently dismissed (this session or cooldown)
    const dismissed = sessionStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed === 'session') return false;

    // Check cooldown
    const cooldownUntil = localStorage.getItem(PROMPT_COOLDOWN_KEY);
    if (cooldownUntil) {
      const cooldownDate = new Date(cooldownUntil);
      if (new Date() < cooldownDate) return false;
      // Cooldown expired, remove it
      localStorage.removeItem(PROMPT_COOLDOWN_KEY);
    }

    return true;
  }, [isAuthenticated, pushEnabled, isPushSupported, isIOSSafari]);

  useEffect(() => {
    if (!shouldShowPrompt()) return;

    // Show prompt after a short delay so the page settles first
    const timer = setTimeout(() => {
      setVisible(true);
      // Trigger entrance animation
      requestAnimationFrame(() => {
        setAnimating(true);
      });
    }, 3000); // 3 second delay after login

    return () => clearTimeout(timer);
  }, [shouldShowPrompt]);

  // If push gets enabled externally, hide the prompt
  useEffect(() => {
    if (pushEnabled && visible) {
      handleClose();
    }
  }, [pushEnabled]);

  const handleClose = useCallback(() => {
    setAnimating(false);
    setTimeout(() => {
      setVisible(false);
    }, 300); // Wait for exit animation
  }, []);

  const handleDismiss = useCallback(() => {
    // Set cooldown so we don't nag again for COOLDOWN_DAYS
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() + COOLDOWN_DAYS);
    localStorage.setItem(PROMPT_COOLDOWN_KEY, cooldownDate.toISOString());
    // Also dismiss for this session
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'session');
    handleClose();
  }, [handleClose]);

  const handleEnable = useCallback(async () => {
    setIsEnabling(true);
    try {
      const success = await subscribeToPushNotifications();
      if (success) {
        handleClose();
      }
    } catch (err) {
      console.error('Error enabling push notifications:', err);
    } finally {
      setIsEnabling(false);
    }
  }, [subscribeToPushNotifications, handleClose]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: `translateX(-50%) translateY(${animating ? '0' : '20px'})`,
        opacity: animating ? 1 : 0,
        transition: 'all 0.3s ease-out',
        zIndex: 10000,
        width: '90%',
        maxWidth: '440px',
        background: 'var(--card-bg, #ffffff)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)',
        border: '1px solid var(--border-color, #e0e0e0)',
        overflow: 'hidden',
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--button-primary-bg, #00558c), #0088cc)',
        }}
      />

      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Bell icon */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--button-primary-bg, #00558c), #0088cc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FiBell size={20} color="#ffffff" />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #333)' }}>
              Enable Notifications
            </h4>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: 'var(--text-secondary, #6c757d)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <FiX size={16} />
            </button>
          </div>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary, #6c757d)', lineHeight: '1.4' }}>
            Stay up to date with important alerts, team updates, and more — even when you're not on the app.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleEnable}
              disabled={isEnabling}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: 'var(--button-primary-bg, #00558c)',
                color: '#ffffff',
                cursor: isEnabling ? 'wait' : 'pointer',
                opacity: isEnabling ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isEnabling ? 'Enabling...' : 'Turn On'}
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid var(--border-color, #e0e0e0)',
                background: 'transparent',
                color: 'var(--text-secondary, #6c757d)',
                cursor: 'pointer',
              }}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;
