/**
 * Premium Voice Engine
 * Uses Deepgram (STT) + ElevenLabs (TTS) via WebSocket for low-latency voice
 */

import { createMicCapture, int16ToBase64 } from './audio/micCapture';
import { createAIOutputPlayer } from './audio/aiOutputTap';
import { createEchoDetector, createFingerprintGenerator } from './audio/fingerprint';
import { createBargeInController, INTERRUPT_STATE } from './audio/bargeInController';
import { createMetricsCollector, isDebugAudioEnabled } from './metrics';

// Turn states (mirrored from server)
const TURN_STATE = {
  IDLE: 'IDLE',
  AI_SPEAKING: 'AI_SPEAKING',
  USER_SPEAKING: 'USER_SPEAKING',
  USER_INTERRUPTING: 'USER_INTERRUPTING',
  PROCESSING: 'PROCESSING'
};

/**
 * Create Premium Voice Engine instance
 * @param {Object} options
 * @param {string} options.wsUrl - WebSocket URL
 * @param {string} options.token - Auth token
 * @returns {Object} - Voice engine instance
 */
export function createPremiumVoiceEngine(options = {}) {
  const {
    wsUrl,
    token
  } = options;

  // Core state
  let ws = null;
  let isConnected = false;
  let isAuthenticated = false;
  let sessionId = null;
  let turnState = TURN_STATE.IDLE;
  let premiumAvailable = false;

  // Audio components
  let micCapture = null;
  let aiPlayer = null;
  let echoDetector = null;
  let bargeInController = null;
  let fingerprintGenerator = null;

  // Metrics
  const metrics = createMetricsCollector();

  // Callbacks
  let callbacks = {
    onTranscript: null,
    onAssistantText: null,
    onAssistantAudio: null,
    onTurnStateChange: null,
    onError: null,
    onSessionReady: null,
    onSessionEnded: null,
    onMetricsUpdate: null,
    onConnectionChange: null
  };

  // Accumulated transcript
  let accumulatedTranscript = '';
  let lastTranscriptTime = 0;
  let transcriptTimeout = null;

  const engine = {
    /**
     * Check if premium features are available
     * @returns {boolean}
     */
    isPremiumAvailable: () => premiumAvailable,

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected: () => isConnected && isAuthenticated,

    /**
     * Get current turn state
     * @returns {string}
     */
    getTurnState: () => turnState,

    /**
     * Get metrics
     * @returns {Object}
     */
    getMetrics: () => metrics.getMetrics(),

    /**
     * Connect to voice WebSocket
     * @returns {Promise<boolean>}
     */
    connect: async () => {
      return new Promise((resolve, reject) => {
        try {
          // Determine WebSocket URL
          const baseUrl = wsUrl || getDefaultWsUrl();
          console.log('[PremiumVoice] Connecting to:', baseUrl);
          ws = new WebSocket(baseUrl);

          ws.onopen = () => {
            console.log('[PremiumVoice] WebSocket connected, sending auth...');
            isConnected = true;
            callbacks.onConnectionChange?.(true);
            
            // Send auth
            ws.send(JSON.stringify({
              type: 'auth',
              token: token
            }));
            console.log('[PremiumVoice] Auth message sent');
          };

          ws.onmessage = (event) => {
            handleMessage(JSON.parse(event.data));
          };

          ws.onerror = (error) => {
            console.error('[PremiumVoice] WebSocket error - is backend running?', error);
            callbacks.onError?.(error);
            reject(new Error('WebSocket connection failed - check if backend is running'));
          };

          ws.onclose = () => {
            console.log('[PremiumVoice] WebSocket closed');
            isConnected = false;
            isAuthenticated = false;
            callbacks.onConnectionChange?.(false);
          };

          // Wait for auth response (reduced to 3 seconds for faster fallback)
          const authTimeout = setTimeout(() => {
            if (!isAuthenticated) {
              console.warn('[PremiumVoice] Auth timeout - backend may not be running or configured');
              reject(new Error('Auth timeout'));
            }
          }, 3000);

          // Store auth callback
          const originalAuthHandler = (data) => {
            if (data.type === 'auth_success') {
              clearTimeout(authTimeout);
              isAuthenticated = true;
              premiumAvailable = data.premiumAvailable;
              console.log('[PremiumVoice] Authenticated, premium:', premiumAvailable);
              resolve(true);
            } else if (data.type === 'auth_error') {
              clearTimeout(authTimeout);
              reject(new Error(data.message));
            }
          };
          callbacks._authHandler = originalAuthHandler;

        } catch (err) {
          reject(err);
        }
      });
    },

    /**
     * Disconnect from WebSocket
     */
    disconnect: () => {
      if (ws) {
        ws.close();
        ws = null;
      }
      isConnected = false;
      isAuthenticated = false;
      cleanup();
    },

    /**
     * Start voice session
     * @param {number} sessionId - Roleplay session ID
     * @returns {Promise<void>}
     */
    startSession: async (newSessionId) => {
      if (!isConnected || !isAuthenticated) {
        throw new Error('Not connected');
      }

      sessionId = newSessionId;
      metrics.startSession();

      // Initialize audio components
      await initializeAudio();

      // Send start session to server
      send({ 
        type: 'start_session', 
        sessionId: newSessionId 
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Session start timeout'));
        }, 10000);

        callbacks._sessionReadyHandler = (data) => {
          clearTimeout(timeout);
          turnState = data.turnState || TURN_STATE.IDLE;
          resolve();
        };
      });
    },

    /**
     * Stop voice session
     */
    stopSession: () => {
      send({ type: 'end_session' });
      cleanup();
      sessionId = null;
    },

    /**
     * Start listening (start mic capture)
     */
    startListening: async () => {
      if (!micCapture) {
        await initializeAudio();
      }
      
      await micCapture.start();
      metrics.recordFirstAudioSent();
    },

    /**
     * Stop listening
     */
    stopListening: () => {
      micCapture?.stop();
    },

    /**
     * Mute microphone
     */
    muteMic: () => {
      micCapture?.mute();
    },

    /**
     * Unmute microphone
     */
    unmuteMic: () => {
      micCapture?.unmute();
    },

    /**
     * Check if mic is muted
     * @returns {boolean}
     */
    isMicMuted: () => micCapture?.isMuted() || false,

    /**
     * Set speaker volume
     * @param {number} volume - 0-1
     */
    setVolume: (volume) => {
      aiPlayer?.setVolume(volume);
    },

    /**
     * Mute speaker
     */
    muteSpeaker: () => {
      aiPlayer?.setVolume(0);
    },

    /**
     * Unmute speaker
     */
    unmuteSpeaker: () => {
      aiPlayer?.setVolume(1);
    },

    /**
     * Manually send user final text
     * @param {string} text
     */
    sendUserFinal: (text) => {
      if (!text?.trim()) return;
      
      metrics.recordUserFinalSent();
      send({
        type: 'user_final',
        text: text.trim()
      });

      // Reset accumulated transcript
      accumulatedTranscript = '';
    },

    /**
     * Trigger interruption
     */
    interrupt: () => {
      send({ type: 'interrupt' });
      aiPlayer?.stop();
      bargeInController?.forceConfirm();
    },

    /**
     * Register callbacks
     * @param {Object} newCallbacks
     */
    on: (newCallbacks) => {
      Object.assign(callbacks, newCallbacks);
    },

    /**
     * Check if AI is speaking
     * @returns {boolean}
     */
    isAISpeaking: () => turnState === TURN_STATE.AI_SPEAKING,

    /**
     * Check if user is speaking
     * @returns {boolean}
     */
    isUserSpeaking: () => turnState === TURN_STATE.USER_SPEAKING,

    /**
     * Get engine type
     * @returns {string}
     */
    getType: () => 'premium'
  };

  /**
   * Initialize audio components
   */
  async function initializeAudio() {
    // Echo detector for self-listening prevention
    echoDetector = createEchoDetector();
    fingerprintGenerator = createFingerprintGenerator();

    // AI audio player with fingerprinting
    aiPlayer = createAIOutputPlayer({
      onFingerprint: (fp) => {
        echoDetector.addAIFingerprint(fp);
      },
      onPlaybackStart: () => {
        if (isDebugAudioEnabled()) {
          console.log('[PremiumVoice] AI playback started');
        }
      },
      onPlaybackEnd: () => {
        if (isDebugAudioEnabled()) {
          console.log('[PremiumVoice] AI playback ended');
        }
      }
    });

    // Barge-in controller
    bargeInController = createBargeInController({
      onPossibleInterrupt: () => {
        // Duck AI volume
        aiPlayer?.duck(0.15, 50);
        
        if (isDebugAudioEnabled()) {
          console.log('[PremiumVoice] Possible interrupt - ducking');
        }
      },
      onConfirmedInterrupt: (data) => {
        // Stop AI and notify server
        aiPlayer?.stop();
        send({ type: 'interrupt' });
        metrics.recordBargeIn(true, data.latencyMs);
        
        if (isDebugAudioEnabled()) {
          console.log('[PremiumVoice] Confirmed interrupt:', data.latencyMs, 'ms');
        }
      },
      onInterruptRejected: () => {
        // Restore volume
        aiPlayer?.restore(200);
        metrics.recordBargeIn(false);
        
        if (isDebugAudioEnabled()) {
          console.log('[PremiumVoice] Interrupt rejected');
        }
      },
      gainNode: aiPlayer?.getGainNode(),
      debugMode: isDebugAudioEnabled()
    });

    // Microphone capture
    micCapture = createMicCapture({
      onAudioData: (pcm16) => {
        // Send to server
        if (ws && ws.readyState === WebSocket.OPEN) {
          const base64 = int16ToBase64(pcm16);
          send({ type: 'audio', data: base64 });
        }

        // Generate fingerprint for echo detection
        const fp = fingerprintGenerator.generate(pcm16);
        const echoResult = echoDetector.checkEcho(fp);

        // If AI is speaking, feed to barge-in controller
        if (turnState === TURN_STATE.AI_SPEAKING) {
          bargeInController.setEnabled(true);
        } else {
          bargeInController.setEnabled(false);
        }
      },
      onRmsLevel: (rms) => {
        // Feed RMS to barge-in controller
        const echoSim = echoDetector.checkEcho(
          fingerprintGenerator.generate(new Int16Array(1))
        ).similarity;
        
        bargeInController?.processRms(rms, echoSim);

        // Debug logging
        if (isDebugAudioEnabled()) {
          metrics.logDebug({
            turnState,
            rms: rms.toFixed(3),
            echoSim: echoSim.toFixed(2),
            bargeInState: bargeInController?.getState()
          });
        }
      },
      onError: (err) => {
        console.error('[PremiumVoice] Mic error:', err);
        callbacks.onError?.(err);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  function handleMessage(data) {
    const { type } = data;

    // Handle auth callback
    if (callbacks._authHandler && (type === 'auth_success' || type === 'auth_error')) {
      callbacks._authHandler(data);
      return;
    }

    // Handle session ready callback
    if (callbacks._sessionReadyHandler && type === 'session_ready') {
      callbacks._sessionReadyHandler(data);
      callbacks.onSessionReady?.(data);
      return;
    }

    switch (type) {
      case 'turn_state':
        handleTurnStateChange(data);
        break;

      case 'transcript':
        handleTranscript(data);
        break;

      case 'assistant_token':
        metrics.recordFirstToken();
        callbacks.onAssistantText?.(data.token, data.fullText);
        break;

      case 'assistant_chunk':
        callbacks.onAssistantText?.(null, data.text);
        break;

      case 'assistant_audio':
        if (!metrics.getMetrics().firstAudioReceived) {
          metrics.recordFirstAudio();
        }
        aiPlayer?.queueAudio(data.data);
        callbacks.onAssistantAudio?.(data.data);
        break;

      case 'assistant_complete':
        metrics.recordAssistantComplete();
        callbacks.onAssistantText?.(null, data.fullText, true);
        break;

      case 'interrupt_confirmed':
        bargeInController?.reset();
        if (data.bargeInLatencyMs) {
          metrics.recordBargeIn(true, data.bargeInLatencyMs);
        }
        break;

      case 'speech_during_ai':
        // User spoke during AI - barge-in controller will handle
        break;

      case 'utterance_end':
        // End of utterance detected by Deepgram
        finalizeUserSpeech();
        break;

      case 'session_ended':
        cleanup();
        callbacks.onSessionEnded?.();
        break;

      case 'metrics':
        callbacks.onMetricsUpdate?.(data.data);
        break;

      case 'error':
        console.error('[PremiumVoice] Server error:', data.message);
        callbacks.onError?.(new Error(data.message));
        break;

      case 'ping':
        send({ type: 'pong' });
        break;

      default:
        if (isDebugAudioEnabled()) {
          console.log('[PremiumVoice] Unknown message:', type);
        }
    }
  }

  /**
   * Handle turn state change
   */
  function handleTurnStateChange(data) {
    const previousState = turnState;
    turnState = data.state;

    // Update barge-in controller
    if (turnState === TURN_STATE.AI_SPEAKING) {
      bargeInController?.setEnabled(true);
    } else {
      bargeInController?.setEnabled(false);
      bargeInController?.reset();
    }

    // Restore volume if not AI speaking
    if (previousState === TURN_STATE.AI_SPEAKING && turnState !== TURN_STATE.AI_SPEAKING) {
      aiPlayer?.restore(100);
    }

    callbacks.onTurnStateChange?.(turnState, previousState);

    if (isDebugAudioEnabled()) {
      console.log('[PremiumVoice] Turn state:', previousState, '->', turnState);
    }
  }

  /**
   * Handle transcript from server
   */
  function handleTranscript(data) {
    const { text, isFinal, confidence, isGated } = data;

    metrics.recordTranscript({ text, isFinal, confidence });

    // If gated (during AI speaking), don't accumulate
    if (isGated) {
      return;
    }

    // Accumulate transcript
    if (text) {
      if (isFinal) {
        accumulatedTranscript += (accumulatedTranscript ? ' ' : '') + text;
        lastTranscriptTime = Date.now();
        
        // Start/reset finalization timeout
        clearTimeout(transcriptTimeout);
        transcriptTimeout = setTimeout(() => {
          finalizeUserSpeech();
        }, 1500); // 1.5 second silence
      }
    }

    // Notify callback with current state
    callbacks.onTranscript?.({
      text: accumulatedTranscript || text,
      interim: !isFinal ? text : null,
      isFinal,
      confidence
    });
  }

  /**
   * Finalize user speech and send to AI
   */
  function finalizeUserSpeech() {
    clearTimeout(transcriptTimeout);
    
    if (accumulatedTranscript.trim()) {
      engine.sendUserFinal(accumulatedTranscript);
    }
  }

  /**
   * Send message to WebSocket
   */
  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Cleanup resources
   */
  function cleanup() {
    clearTimeout(transcriptTimeout);
    micCapture?.stop();
    aiPlayer?.cleanup();
    bargeInController?.reset();
    echoDetector?.clear();
    
    micCapture = null;
    aiPlayer = null;
    bargeInController = null;
    echoDetector = null;
    fingerprintGenerator = null;
    
    accumulatedTranscript = '';
    turnState = TURN_STATE.IDLE;
    metrics.reset();
  }

  return engine;
}

/**
 * Get default WebSocket URL based on environment
 */
function getDefaultWsUrl() {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction 
    ? 'atlas-celest-backend-3bb2fea96236.herokuapp.com'
    : 'localhost:5001';
  const protocol = isProduction ? 'wss' : 'ws';
  return `${protocol}://${host}/ws/voice`;
}

export { TURN_STATE };

export default {
  createPremiumVoiceEngine,
  TURN_STATE
};

