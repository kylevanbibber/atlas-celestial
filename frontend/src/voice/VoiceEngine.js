/**
 * Voice Engine Facade
 * Provides unified interface for voice functionality
 * Automatically chooses between Premium (Deepgram+ElevenLabs) and WebSpeech fallback
 */

import { createPremiumVoiceEngine, TURN_STATE as PREMIUM_TURN_STATE } from './PremiumVoiceEngine';
import { createWebSpeechFallbackEngine, TURN_STATE as WEBSPEECH_TURN_STATE } from './WebSpeechFallbackEngine';

// Export turn states
export const TURN_STATE = {
  ...PREMIUM_TURN_STATE,
  ...WEBSPEECH_TURN_STATE
};

// Voice mode types
export const VOICE_MODE = {
  PREMIUM: 'premium',
  WEBSPEECH: 'webspeech',
  AUTO: 'auto'
};

/**
 * Create Voice Engine with automatic mode selection
 * @param {Object} options
 * @param {string} options.token - Auth token for WebSocket
 * @param {string} options.mode - 'premium', 'webspeech', or 'auto' (default)
 * @param {Function} options.onMessage - Callback for sending messages (for webspeech mode)
 * @param {string} options.wsUrl - Optional WebSocket URL override
 * @returns {Object} - Voice engine instance
 */
export async function createVoiceEngine(options = {}) {
  const {
    token,
    mode = VOICE_MODE.AUTO,
    onMessage,
    wsUrl
  } = options;

  let engine = null;
  let currentMode = mode;
  let fallbackReason = null;

  // Callbacks that will be forwarded to the active engine
  const callbacks = {
    onTranscript: null,
    onAssistantText: null,
    onAssistantAudio: null,
    onTurnStateChange: null,
    onError: null,
    onSessionReady: null,
    onSessionEnded: null,
    onMetricsUpdate: null,
    onConnectionChange: null,
    onModeChange: null
  };

  /**
   * Try to initialize premium engine
   */
  async function tryPremiumEngine() {
    try {
      const premiumEngine = createPremiumVoiceEngine({
        token,
        wsUrl
      });

      await premiumEngine.connect();

      if (premiumEngine.isPremiumAvailable()) {
        return premiumEngine;
      } else {
        fallbackReason = 'Premium features not configured on server';
        premiumEngine.disconnect();
        return null;
      }
    } catch (err) {
      console.warn('[VoiceEngine] Premium connection failed:', err.message);
      fallbackReason = err.message;
      return null;
    }
  }

  /**
   * Initialize webspeech fallback engine
   */
  function createFallbackEngine() {
    return createWebSpeechFallbackEngine({
      onMessage
    });
  }

  /**
   * Initialize engine based on mode
   */
  async function initialize() {
    // Force webspeech mode
    if (mode === VOICE_MODE.WEBSPEECH || mode === 'webspeech') {
      engine = createFallbackEngine();
      currentMode = VOICE_MODE.WEBSPEECH;
      await engine.connect();
      return;
    }

    // Try premium if requested or auto mode
    if (mode === VOICE_MODE.PREMIUM || mode === 'premium' || 
        mode === VOICE_MODE.AUTO || mode === 'auto' || !mode) {
      
      // Try premium first
      const premiumEngine = await tryPremiumEngine();
      
      if (premiumEngine) {
        engine = premiumEngine;
        currentMode = VOICE_MODE.PREMIUM;
        return;
      }

      // Fall back to webspeech unless premium was explicitly requested
      const isPremiumExplicit = mode === VOICE_MODE.PREMIUM || mode === 'premium';
      
      if (!isPremiumExplicit) {
        console.log('[VoiceEngine] Falling back to WebSpeech:', fallbackReason);
        engine = createFallbackEngine();
        currentMode = VOICE_MODE.WEBSPEECH;
        await engine.connect();
        return;
      }

      // Premium explicitly requested but failed
      throw new Error(`Premium voice unavailable: ${fallbackReason}`);
    }

    // Default to webspeech for unknown modes
    console.log('[VoiceEngine] Unknown mode, using WebSpeech:', mode);
    engine = createFallbackEngine();
    currentMode = VOICE_MODE.WEBSPEECH;
    await engine.connect();
  }

  // Initialize
  try {
    await initialize();
  } catch (initErr) {
    console.error('[VoiceEngine] Initialize failed:', initErr.message);
    // Try one more time with just webspeech
    try {
      engine = createFallbackEngine();
      currentMode = VOICE_MODE.WEBSPEECH;
      await engine.connect();
      fallbackReason = initErr.message;
      console.log('[VoiceEngine] Recovered with WebSpeech fallback');
    } catch (fallbackErr) {
      console.error('[VoiceEngine] Fallback also failed:', fallbackErr.message);
      throw new Error(`Voice not available: ${fallbackErr.message}`);
    }
  }

  // Verify engine was initialized
  if (!engine) {
    throw new Error('Voice engine failed to initialize');
  }

  // Forward callbacks to engine
  function setupCallbacks() {
    if (!engine) return;

    engine.on({
      onTranscript: (data) => callbacks.onTranscript?.(data),
      onAssistantText: (token, fullText, isComplete) => 
        callbacks.onAssistantText?.(token, fullText, isComplete),
      onAssistantAudio: (data) => callbacks.onAssistantAudio?.(data),
      onTurnStateChange: (newState, prevState) => 
        callbacks.onTurnStateChange?.(newState, prevState),
      onError: (err) => callbacks.onError?.(err),
      onSessionReady: (data) => callbacks.onSessionReady?.(data),
      onSessionEnded: () => callbacks.onSessionEnded?.(),
      onMetricsUpdate: (data) => callbacks.onMetricsUpdate?.(data),
      onConnectionChange: (connected) => callbacks.onConnectionChange?.(connected)
    });
  }

  setupCallbacks();

  // Create facade object
  const facade = {
    /**
     * Get current voice mode
     * @returns {string}
     */
    getMode: () => currentMode,

    /**
     * Get fallback reason if using fallback
     * @returns {string|null}
     */
    getFallbackReason: () => fallbackReason,

    /**
     * Check if using premium mode
     * @returns {boolean}
     */
    isPremium: () => currentMode === VOICE_MODE.PREMIUM,

    /**
     * Check if premium features are available
     * @returns {boolean}
     */
    isPremiumAvailable: () => engine?.isPremiumAvailable?.() || false,

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected: () => engine?.isConnected() || false,

    /**
     * Get current turn state
     * @returns {string}
     */
    getTurnState: () => engine?.getTurnState() || TURN_STATE.IDLE,

    /**
     * Start voice session
     * @param {number} sessionId
     * @returns {Promise<void>}
     */
    startSession: async (sessionId) => {
      if (!engine) {
        console.error('[VoiceEngine] startSession called but engine is null');
        throw new Error('Voice engine not initialized. Please reload the page.');
      }
      console.log('[VoiceEngine] Starting session:', sessionId);
      return engine.startSession(sessionId);
    },

    /**
     * Stop voice session
     */
    stopSession: () => {
      engine?.stopSession();
    },

    /**
     * Start listening
     */
    startListening: async () => {
      return engine?.startListening();
    },

    /**
     * Stop listening
     */
    stopListening: () => {
      engine?.stopListening();
    },

    /**
     * Mute microphone
     */
    muteMic: () => {
      engine?.muteMic();
    },

    /**
     * Unmute microphone
     */
    unmuteMic: () => {
      engine?.unmuteMic();
    },

    /**
     * Check if mic is muted
     * @returns {boolean}
     */
    isMicMuted: () => engine?.isMicMuted() || false,

    /**
     * Set speaker volume
     * @param {number} volume - 0-1
     */
    setVolume: (volume) => {
      engine?.setVolume(volume);
    },

    /**
     * Mute speaker
     */
    muteSpeaker: () => {
      engine?.muteSpeaker();
    },

    /**
     * Unmute speaker
     */
    unmuteSpeaker: () => {
      engine?.unmuteSpeaker();
    },

    /**
     * Send user final text (for manual input or after transcript finalization)
     * @param {string} text
     */
    sendUserFinal: (text) => {
      engine?.sendUserFinal(text);
    },

    /**
     * Speak text (for webspeech mode or manual TTS)
     * @param {string} text
     * @returns {Promise<void>}
     */
    speak: async (text) => {
      if (engine?.speak) {
        return engine.speak(text);
      }
    },

    /**
     * Trigger interruption
     */
    interrupt: () => {
      engine?.interrupt();
    },

    /**
     * Register callbacks
     * @param {Object} newCallbacks
     */
    on: (newCallbacks) => {
      Object.assign(callbacks, newCallbacks);
      setupCallbacks();
    },

    /**
     * Check if AI is speaking
     * @returns {boolean}
     */
    isAISpeaking: () => engine?.isAISpeaking() || false,

    /**
     * Check if user is speaking
     * @returns {boolean}
     */
    isUserSpeaking: () => engine?.isUserSpeaking() || false,

    /**
     * Get engine type
     * @returns {string}
     */
    getType: () => engine?.getType() || 'none',

    /**
     * Get metrics
     * @returns {Object}
     */
    getMetrics: () => engine?.getMetrics() || {},

    /**
     * Switch to a different mode
     * @param {string} newMode - 'premium' or 'webspeech'
     * @returns {Promise<boolean>}
     */
    switchMode: async (newMode) => {
      if (newMode === currentMode) return true;

      // Cleanup current engine
      engine?.disconnect();

      if (newMode === VOICE_MODE.PREMIUM) {
        const premiumEngine = await tryPremiumEngine();
        if (premiumEngine) {
          engine = premiumEngine;
          currentMode = VOICE_MODE.PREMIUM;
          setupCallbacks();
          callbacks.onModeChange?.(VOICE_MODE.PREMIUM);
          return true;
        }
        return false;
      }

      if (newMode === VOICE_MODE.WEBSPEECH) {
        engine = createFallbackEngine();
        currentMode = VOICE_MODE.WEBSPEECH;
        await engine.connect();
        setupCallbacks();
        callbacks.onModeChange?.(VOICE_MODE.WEBSPEECH);
        return true;
      }

      return false;
    },

    /**
     * Disconnect and cleanup
     */
    disconnect: () => {
      engine?.disconnect();
      engine = null;
    }
  };

  return facade;
}

/**
 * Check if voice features are supported in this browser
 * @returns {boolean}
 */
export function isVoiceSupported() {
  const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasSpeechSynthesis = !!(window.speechSynthesis);
  const hasWebSocket = !!(window.WebSocket);
  const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);

  return hasSpeechRecognition && hasSpeechSynthesis && hasWebSocket && hasGetUserMedia;
}

/**
 * Get voice support details
 * @returns {Object}
 */
export function getVoiceSupportDetails() {
  return {
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    speechSynthesis: !!(window.speechSynthesis),
    webSocket: !!(window.WebSocket),
    getUserMedia: !!(navigator.mediaDevices?.getUserMedia),
    audioContext: !!(window.AudioContext || window.webkitAudioContext)
  };
}

export default {
  createVoiceEngine,
  isVoiceSupported,
  getVoiceSupportDetails,
  TURN_STATE,
  VOICE_MODE
};

