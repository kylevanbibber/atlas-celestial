/**
 * Web Speech Fallback Engine
 * Uses browser-native Web Speech APIs for voice (SpeechRecognition + SpeechSynthesis)
 * This wraps the existing implementation for compatibility with the VoiceEngine interface
 */

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Turn states (simplified for fallback)
const TURN_STATE = {
  IDLE: 'IDLE',
  AI_SPEAKING: 'AI_SPEAKING',
  USER_SPEAKING: 'USER_SPEAKING',
  PROCESSING: 'PROCESSING'
};

/**
 * Create Web Speech Fallback Engine
 * @param {Object} options
 * @param {Function} options.onMessage - Callback for sending messages to backend
 * @returns {Object} - Voice engine instance
 */
export function createWebSpeechFallbackEngine(options = {}) {
  const { onMessage } = options;

  // State
  let recognition = null;
  let synth = window.speechSynthesis;
  let turnState = TURN_STATE.IDLE;
  let isListening = false;
  let isSpeaking = false;
  let isMuted = false;
  let sessionActive = false;

  // Transcript accumulation
  let accumulatedTranscript = '';
  let lastSpeechTime = Date.now();
  let silenceCheckInterval = null;

  // Callbacks
  let callbacks = {
    onTranscript: null,
    onAssistantText: null,
    onAssistantAudio: null,
    onTurnStateChange: null,
    onError: null,
    onSessionReady: null,
    onSessionEnded: null
  };

  const engine = {
    /**
     * Check if premium features are available (always false for fallback)
     * @returns {boolean}
     */
    isPremiumAvailable: () => false,

    /**
     * Check if supported
     * @returns {boolean}
     */
    isSupported: () => !!SpeechRecognition,

    /**
     * Check if connected (always true for fallback)
     * @returns {boolean}
     */
    isConnected: () => true,

    /**
     * Get current turn state
     * @returns {string}
     */
    getTurnState: () => turnState,

    /**
     * Connect (no-op for fallback)
     * @returns {Promise<boolean>}
     */
    connect: async () => {
      console.log('[WebSpeech] connect called');
      if (!SpeechRecognition) {
        console.error('[WebSpeech] SpeechRecognition API not available');
        throw new Error('Speech recognition not supported in this browser');
      }
      console.log('[WebSpeech] SpeechRecognition available');
      return true;
    },

    /**
     * Disconnect (no-op for fallback)
     */
    disconnect: () => {
      engine.stopSession();
    },

    /**
     * Start voice session
     * @param {number} sessionId
     * @returns {Promise<void>}
     */
    startSession: async (sessionId) => {
      console.log('[WebSpeech] startSession called with sessionId:', sessionId);
      
      if (!SpeechRecognition) {
        console.error('[WebSpeech] SpeechRecognition not available');
        throw new Error('Speech recognition not supported');
      }

      sessionActive = true;
      console.log('[WebSpeech] Initializing recognition...');
      initRecognition();
      
      // Start silence check interval
      silenceCheckInterval = setInterval(() => {
        const timeSinceLastSpeech = Date.now() - lastSpeechTime;
        const hasAccumulatedSpeech = accumulatedTranscript.trim().length > 0;
        
        if (hasAccumulatedSpeech && timeSinceLastSpeech > 1500 && 
            turnState !== TURN_STATE.AI_SPEAKING && turnState !== TURN_STATE.PROCESSING) {
          finalizeUserSpeech();
        }
      }, 300);

      console.log('[WebSpeech] Session ready');
      callbacks.onSessionReady?.();
      return Promise.resolve();
    },

    /**
     * Stop voice session
     */
    stopSession: () => {
      sessionActive = false;
      
      if (silenceCheckInterval) {
        clearInterval(silenceCheckInterval);
        silenceCheckInterval = null;
      }

      engine.stopListening();
      synth?.cancel();
      
      turnState = TURN_STATE.IDLE;
      accumulatedTranscript = '';
      
      callbacks.onSessionEnded?.();
    },

    /**
     * Start listening
     */
    startListening: async () => {
      if (!recognition) {
        initRecognition();
      }

      if (!isListening && !isSpeaking && turnState !== TURN_STATE.PROCESSING) {
        try {
          accumulatedTranscript = '';
          lastSpeechTime = Date.now();
          recognition.start();
          isListening = true;
          setTurnState(TURN_STATE.USER_SPEAKING);
        } catch (e) {
          if (e.name !== 'InvalidStateError') {
            console.error('[WebSpeech] Start error:', e);
          }
        }
      }
    },

    /**
     * Stop listening
     */
    stopListening: () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore
        }
      }
      isListening = false;
    },

    /**
     * Mute microphone
     */
    muteMic: () => {
      engine.stopListening();
    },

    /**
     * Unmute microphone
     */
    unmuteMic: () => {
      if (sessionActive && turnState === TURN_STATE.IDLE) {
        engine.startListening();
      }
    },

    /**
     * Check if mic is muted
     * @returns {boolean}
     */
    isMicMuted: () => !isListening,

    /**
     * Set speaker volume (no-op for Web Speech)
     */
    setVolume: (volume) => {
      // Web Speech API doesn't have fine volume control
    },

    /**
     * Mute speaker
     */
    muteSpeaker: () => {
      isMuted = true;
      synth?.cancel();
    },

    /**
     * Unmute speaker
     */
    unmuteSpeaker: () => {
      isMuted = false;
    },

    /**
     * Send user final text
     * @param {string} text
     */
    sendUserFinal: (text) => {
      if (!text?.trim()) return;
      
      console.log('[WebSpeech] sendUserFinal called with:', text.substring(0, 50) + '...');
      accumulatedTranscript = '';
      setTurnState(TURN_STATE.PROCESSING);
      
      // Callback to send to backend
      if (onMessage) {
        console.log('[WebSpeech] Calling onMessage callback');
        onMessage(text.trim());
      } else {
        console.warn('[WebSpeech] No onMessage callback provided!');
      }
    },

    /**
     * Speak text using TTS
     * @param {string} text
     * @returns {Promise<void>}
     */
    speak: (text) => {
      return new Promise((resolve) => {
        if (isMuted || !synth) {
          resolve();
          return;
        }

        // Stop recognition during speech to prevent echo
        engine.stopListening();
        
        synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Try to get a natural voice
        const voices = synth.getVoices();
        const preferredVoice = voices.find(v =>
          v.name.includes('Natural') ||
          v.name.includes('Samantha') ||
          v.name.includes('Google') ||
          v.lang === 'en-US'
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          isSpeaking = true;
          setTurnState(TURN_STATE.AI_SPEAKING);
        };

        utterance.onend = () => {
          isSpeaking = false;
          setTurnState(TURN_STATE.IDLE);
          
          // Restart listening after delay
          setTimeout(() => {
            if (sessionActive) {
              engine.startListening();
            }
            resolve();
          }, 400);
        };

        utterance.onerror = () => {
          isSpeaking = false;
          setTurnState(TURN_STATE.IDLE);
          
          setTimeout(() => {
            if (sessionActive) {
              engine.startListening();
            }
            resolve();
          }, 400);
        };

        synth.speak(utterance);
        
        // Notify callback
        callbacks.onAssistantText?.(null, text, true);
      });
    },

    /**
     * Trigger interruption
     */
    interrupt: () => {
      synth?.cancel();
      isSpeaking = false;
      setTurnState(TURN_STATE.IDLE);
      
      if (sessionActive) {
        engine.startListening();
      }
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
    isAISpeaking: () => isSpeaking,

    /**
     * Check if user is speaking
     * @returns {boolean}
     */
    isUserSpeaking: () => isListening && accumulatedTranscript.length > 0,

    /**
     * Get engine type
     * @returns {string}
     */
    getType: () => 'webspeech',

    /**
     * Get empty metrics (fallback doesn't track detailed metrics)
     * @returns {Object}
     */
    getMetrics: () => ({})
  };

  /**
   * Initialize speech recognition
   */
  function initRecognition() {
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      // Skip if AI is speaking
      if (isSpeaking || turnState === TURN_STATE.PROCESSING) {
        return;
      }

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Update accumulated transcript
      if (finalTranscript) {
        accumulatedTranscript += (accumulatedTranscript ? ' ' : '') + finalTranscript.trim();
        lastSpeechTime = Date.now();
      }

      // Notify callback
      callbacks.onTranscript?.({
        text: accumulatedTranscript + (interimTranscript ? ' ' + interimTranscript : ''),
        interim: interimTranscript,
        isFinal: !!finalTranscript,
        confidence: event.results[event.results.length - 1]?.[0]?.confidence || 0
      });
    };

    recognition.onerror = (event) => {
      console.error('[WebSpeech] Error:', event.error);
      if (event.error === 'not-allowed') {
        callbacks.onError?.(new Error('Microphone access denied'));
      }
    };

    recognition.onend = () => {
      isListening = false;
      
      // Restart if still in session and not speaking
      if (sessionActive && !isSpeaking && turnState !== TURN_STATE.PROCESSING) {
        setTimeout(() => {
          if (sessionActive && !isSpeaking) {
            engine.startListening();
          }
        }, 100);
      }
    };
  }

  /**
   * Set turn state and notify
   */
  function setTurnState(newState) {
    const previousState = turnState;
    turnState = newState;
    callbacks.onTurnStateChange?.(newState, previousState);
  }

  /**
   * Finalize user speech and send
   */
  function finalizeUserSpeech() {
    const text = accumulatedTranscript.trim();
    if (text) {
      console.log('[WebSpeech] Finalizing user speech:', text.substring(0, 50) + '...');
      accumulatedTranscript = '';
      engine.sendUserFinal(text);
    }
  }

  return engine;
}

export { TURN_STATE };

export default {
  createWebSpeechFallbackEngine,
  TURN_STATE
};

