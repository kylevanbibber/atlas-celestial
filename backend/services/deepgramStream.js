/**
 * Deepgram Streaming STT Service
 * Handles real-time speech-to-text via WebSocket
 */

const WebSocket = require('ws');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL || 'nova-2';
const DEEPGRAM_LANGUAGE = process.env.DEEPGRAM_LANGUAGE || 'en-US';

// Deepgram WebSocket URL with query parameters
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

/**
 * Creates a Deepgram streaming session
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onTranscript - Called with { text, isFinal, confidence, words }
 * @param {Function} callbacks.onError - Called with error object
 * @param {Function} callbacks.onClose - Called when connection closes
 * @returns {Object} - Session object with send() and close() methods
 */
function createDeepgramSession(callbacks = {}) {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  const { onTranscript, onError, onClose } = callbacks;

  // Build WebSocket URL with parameters
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    language: DEEPGRAM_LANGUAGE,
    punctuate: 'true',
    interim_results: 'true',
    endpointing: '1500',         // 1.5 seconds silence for endpoint detection
    vad_events: 'true',          // Voice activity detection events
    smart_format: 'true',        // Better formatting
    encoding: 'linear16',        // PCM16 audio
    sample_rate: '16000',        // 16kHz sample rate
    channels: '1'                // Mono
  });

  const wsUrl = `${DEEPGRAM_WS_URL}?${params.toString()}`;

  let ws = null;
  let isConnected = false;
  let keepAliveInterval = null;

  const session = {
    isConnected: () => isConnected,

    /**
     * Connect to Deepgram
     * @returns {Promise} - Resolves when connected
     */
    connect: () => {
      return new Promise((resolve, reject) => {
        try {
          ws = new WebSocket(wsUrl, {
            headers: {
              Authorization: `Token ${DEEPGRAM_API_KEY}`
            }
          });

          ws.on('open', () => {
            isConnected = true;
            console.log('[Deepgram] Connected');

            // Send keepalive every 8 seconds to maintain connection
            keepAliveInterval = setInterval(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'KeepAlive' }));
              }
            }, 8000);

            resolve();
          });

          ws.on('message', (data) => {
            try {
              const message = JSON.parse(data.toString());
              handleDeepgramMessage(message, onTranscript);
            } catch (err) {
              console.error('[Deepgram] Error parsing message:', err);
            }
          });

          ws.on('error', (error) => {
            console.error('[Deepgram] WebSocket error:', error);
            isConnected = false;
            onError?.(error);
            reject(error);
          });

          ws.on('close', (code, reason) => {
            console.log(`[Deepgram] Connection closed: ${code} ${reason}`);
            isConnected = false;
            clearInterval(keepAliveInterval);
            onClose?.(code, reason);
          });

        } catch (err) {
          reject(err);
        }
      });
    },

    /**
     * Send audio data to Deepgram
     * @param {Buffer|ArrayBuffer} audioData - Raw PCM16 audio data
     */
    send: (audioData) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(audioData);
      }
    },

    /**
     * Send finalize message and close connection
     */
    close: () => {
      if (ws) {
        clearInterval(keepAliveInterval);
        
        if (ws.readyState === WebSocket.OPEN) {
          // Send CloseStream message for graceful shutdown
          ws.send(JSON.stringify({ type: 'CloseStream' }));
          
          // Give Deepgram time to send final results
          setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
              ws.close();
            }
          }, 500);
        } else {
          ws.close();
        }
        
        isConnected = false;
      }
    },

    /**
     * Finalize current utterance (triggers endpoint)
     */
    finalize: () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'Finalize' }));
      }
    }
  };

  return session;
}

/**
 * Handle incoming Deepgram messages
 */
function handleDeepgramMessage(message, onTranscript) {
  // Handle different message types
  if (message.type === 'Results') {
    const alternative = message.channel?.alternatives?.[0];
    
    if (alternative) {
      const transcript = {
        text: alternative.transcript || '',
        isFinal: message.is_final || false,
        confidence: alternative.confidence || 0,
        words: alternative.words || [],
        speechFinal: message.speech_final || false,
        start: message.start,
        duration: message.duration
      };

      // Only emit if there's actual text
      if (transcript.text.trim()) {
        onTranscript?.(transcript);
      }
    }
  } else if (message.type === 'SpeechStarted') {
    // Voice activity started
    onTranscript?.({ type: 'speech_started' });
  } else if (message.type === 'UtteranceEnd') {
    // Utterance boundary detected
    onTranscript?.({ type: 'utterance_end' });
  } else if (message.type === 'Metadata') {
    console.log('[Deepgram] Metadata:', message);
  } else if (message.type === 'Error') {
    console.error('[Deepgram] Error message:', message);
  }
}

/**
 * Check if Deepgram is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!DEEPGRAM_API_KEY;
}

module.exports = {
  createDeepgramSession,
  isConfigured
};

