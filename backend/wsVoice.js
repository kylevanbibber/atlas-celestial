/**
 * WebSocket Voice Endpoint
 * Handles real-time voice communication for roleplay sessions
 * 
 * Protocol:
 * Client -> Server:
 *   { type: 'auth', token: 'jwt...' }
 *   { type: 'start_session', sessionId: number, scriptId: number }
 *   { type: 'audio', data: base64_pcm16 }
 *   { type: 'user_final', text: '...' }
 *   { type: 'interrupt' }
 *   { type: 'end_session' }
 *   { type: 'ping' }
 * 
 * Server -> Client:
 *   { type: 'auth_success' }
 *   { type: 'auth_error', message: '...' }
 *   { type: 'session_ready', turnState: '...' }
 *   { type: 'transcript', text: '...', isFinal: bool, confidence: number }
 *   { type: 'assistant_token', token: '...', fullText: '...' }
 *   { type: 'assistant_chunk', text: '...' }
 *   { type: 'assistant_audio', data: base64_mp3 }
 *   { type: 'assistant_complete', fullText: '...' }
 *   { type: 'turn_state', state: '...', timestamp: number }
 *   { type: 'metrics', data: {...} }
 *   { type: 'error', message: '...' }
 *   { type: 'pong' }
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { query } = require('./db');
const { createDeepgramSession, isConfigured: isDeepgramConfigured } = require('./services/deepgramStream');
const { streamSpeech, isConfigured: isElevenLabsConfigured } = require('./services/elevenlabsTTS');
const { streamChatCompletion, buildProspectSystemPrompt, createAbortController } = require('./services/openaiChatStream');
const { TURN_STATE, createTurnController } = require('./services/turnController');

// Debug mode
const DEBUG_VOICE = process.env.DEBUG_VOICE === 'true';

/**
 * Initialize voice WebSocket server
 * @param {WebSocket.Server} wss - WebSocket server instance
 */
function initVoiceWebSocket(wss) {
  console.log('[VoiceWS] Voice WebSocket handler initialized');
  
  wss.on('connection', (ws, req) => {
    console.log('[VoiceWS] New connection from:', req?.socket?.remoteAddress);
    
    // Connection state
    const state = {
      isAuthenticated: false,
      userId: null,
      sessionId: null,
      scriptData: null,
      turnController: null,
      deepgramSession: null,
      openaiAbort: null,
      elevenlabsAbort: null,
      conversationHistory: [],
      metrics: createMetrics(),
      lastActivity: Date.now()
    };

    // Ping/pong for keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    // Message handler
    ws.on('message', async (rawMessage) => {
      try {
        state.lastActivity = Date.now();
        
        // Try to parse as JSON first (for auth, commands, etc.)
        // WebSocket can receive text messages as Buffers, so we need to try parsing
        let message;
        try {
          const messageStr = Buffer.isBuffer(rawMessage) ? rawMessage.toString('utf8') : rawMessage;
          message = JSON.parse(messageStr);
          console.log('[VoiceWS] *** JSON MESSAGE RECEIVED, TYPE:', message.type, '***');
          await handleMessage(message, state, ws);
          return;
        } catch (jsonError) {
          // Not JSON - must be binary audio data
          if (Buffer.isBuffer(rawMessage)) {
            console.log('[VoiceWS] *** BINARY AUDIO RECEIVED ***');
            handleAudioData(rawMessage, state, ws);
            return;
          }
          throw new Error('Invalid message format - not JSON and not binary');
        }
      } catch (err) {
        console.error('[VoiceWS] Message error:', err);
        sendError(ws, 'Invalid message format');
      }
    });

    // Connection close
    ws.on('close', () => {
      console.log('[VoiceWS] Connection closed');
      clearInterval(pingInterval);
      cleanup(state);
    });

    ws.on('error', (err) => {
      console.error('[VoiceWS] Error:', err);
      clearInterval(pingInterval);
      cleanup(state);
    });
  });
}

/**
 * Handle incoming message
 */
async function handleMessage(message, state, ws) {
  const { type } = message;

  console.log('[VoiceWS] Message received:', type);

  switch (type) {
    case 'auth':
      await handleAuth(message, state, ws);
      break;

    case 'start_session':
      if (!state.isAuthenticated) {
        sendError(ws, 'Not authenticated');
        return;
      }
      await handleStartSession(message, state, ws);
      break;

    case 'audio':
      if (!state.isAuthenticated || !state.sessionId) {
        return;
      }
      // Base64 audio data
      const audioBuffer = Buffer.from(message.data, 'base64');
      handleAudioData(audioBuffer, state, ws);
      break;

    case 'user_final':
      if (!state.isAuthenticated || !state.sessionId) {
        return;
      }
      await handleUserFinal(message.text, state, ws);
      break;

    case 'interrupt':
      handleInterrupt(state, ws);
      break;

    case 'end_session':
      await handleEndSession(state, ws);
      break;

    case 'pong':
      // Client responded to ping
      break;

    case 'get_metrics':
      sendMetrics(state, ws);
      break;

    default:
      if (DEBUG_VOICE) {
        console.log('[VoiceWS] Unknown message type:', type);
      }
  }
}

/**
 * Handle authentication
 */
async function handleAuth(message, state, ws) {
  const { token } = message;

  if (!token) {
    console.log('[VoiceWS] Auth failed: No token provided');
    send(ws, { type: 'auth_error', message: 'Token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    state.userId = decoded.userId;
    state.isAuthenticated = true;

    // Check if premium voice is available
    const deepgramOk = isDeepgramConfigured();
    const elevenlabsOk = isElevenLabsConfigured();
    const premiumAvailable = deepgramOk && elevenlabsOk;

    console.log(`[VoiceWS] Auth success - User: ${state.userId}, Premium: ${premiumAvailable}`);

    const authResponse = { 
      type: 'auth_success',
      premiumAvailable,
      features: {
        deepgram: deepgramOk,
        elevenlabs: elevenlabsOk
      }
    };
    send(ws, authResponse);
  } catch (err) {
    console.error('[VoiceWS] Auth failed:', err.message);
    send(ws, { type: 'auth_error', message: 'Invalid token' });
    ws.close();
  }
}

/**
 * Handle session start
 */
async function handleStartSession(message, state, ws) {
  const { sessionId, scriptId } = message;

  if (!sessionId) {
    sendError(ws, 'Session ID required');
    return;
  }

  try {
    // Verify session ownership
    const [session] = await query(`
      SELECT s.id, s.status, s.script_id, s.difficulty, rs.script_text, rs.goal_text, rs.objections
      FROM roleplay_sessions s
      LEFT JOIN roleplay_scripts rs ON s.script_id = rs.id
      WHERE s.id = ? AND s.user_id = ?
    `, [sessionId, state.userId]);

    if (!session) {
      sendError(ws, 'Session not found');
      return;
    }

    if (session.status !== 'active') {
      sendError(ws, 'Session is not active');
      return;
    }

    // Store session data
    state.sessionId = sessionId;
    state.scriptData = {
      scriptText: session.script_text,
      goalText: session.goal_text,
      rebuttals: safeParseJSON(session.objections, []),
      difficulty: session.difficulty || 'medium'
    };

    // Initialize turn controller
    state.turnController = createTurnController();
    state.turnController.onStateChange((event) => {
      send(ws, { 
        type: 'turn_state', 
        state: event.newState,
        previousState: event.previousState,
        timestamp: event.timestamp
      });
    });

    // Load existing messages into conversation history
    const messages = await query(`
      SELECT role, content FROM roleplay_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `, [sessionId]);

    state.conversationHistory = messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }));

    // Initialize Deepgram if available
    if (isDeepgramConfigured()) {
      try {
        state.deepgramSession = createDeepgramSession({
          onTranscript: (transcript) => handleDeepgramTranscript(transcript, state, ws),
          onError: (err) => console.error('[VoiceWS] Deepgram error:', err),
          onClose: () => {
            if (DEBUG_VOICE) console.log('[VoiceWS] Deepgram closed');
          }
        });
        await state.deepgramSession.connect();
      } catch (err) {
        console.error('[VoiceWS] Failed to connect Deepgram:', err);
        // Continue without Deepgram - client should use fallback
      }
    }

    send(ws, { 
      type: 'session_ready',
      turnState: state.turnController.getState(),
      conversationHistory: state.conversationHistory.map(m => ({
        role: m.role === 'assistant' ? 'ai' : 'user',
        content: m.content
      })),
      features: {
        deepgram: !!state.deepgramSession,
        elevenlabs: isElevenLabsConfigured()
      }
    });

    console.log(`[VoiceWS] Session ${sessionId} started for user ${state.userId}`);

  } catch (err) {
    console.error('[VoiceWS] Start session error:', err);
    sendError(ws, 'Failed to start session');
  }
}

/**
 * Handle incoming audio data
 */
function handleAudioData(audioBuffer, state, ws) {
  if (!state.deepgramSession || !state.turnController) {
    return;
  }

  // Record metric for first audio
  if (!state.metrics.firstAudioReceived) {
    state.metrics.firstAudioReceived = Date.now();
  }

  // Forward to Deepgram
  state.deepgramSession.send(audioBuffer);
}

/**
 * Handle Deepgram transcript
 */
function handleDeepgramTranscript(transcript, state, ws) {
  const turnState = state.turnController.getState();

  // Handle special events
  if (transcript.type === 'speech_started') {
    if (!state.metrics.firstSpeechDetected) {
      state.metrics.firstSpeechDetected = Date.now();
    }
    
    // If AI is speaking and user starts talking, it's a potential interrupt
    if (turnState === TURN_STATE.AI_SPEAKING) {
      // Let client handle interruption detection with fingerprinting
      // Just notify that speech was detected during AI speaking
      send(ws, { type: 'speech_during_ai', timestamp: Date.now() });
    }
    return;
  }

  if (transcript.type === 'utterance_end') {
    send(ws, { type: 'utterance_end', timestamp: Date.now() });
    return;
  }

  // Regular transcript
  const { text, isFinal, confidence } = transcript;

  // Gate transcripts based on turn state
  // During AI_SPEAKING or USER_INTERRUPTING, we still send transcripts
  // but mark them so client can decide whether to use them
  const isGated = turnState === TURN_STATE.AI_SPEAKING;

  // Record metrics
  if (isFinal && !state.metrics.firstFinalTranscript) {
    state.metrics.firstFinalTranscript = Date.now();
    if (state.metrics.userStartedSpeaking) {
      state.metrics.timeToFinalTranscriptMs = state.metrics.firstFinalTranscript - state.metrics.userStartedSpeaking;
    }
  }

  if (!state.metrics.firstTranscript && text) {
    state.metrics.firstTranscript = Date.now();
    if (state.metrics.userStartedSpeaking) {
      state.metrics.timeToFirstTranscriptMs = state.metrics.firstTranscript - state.metrics.userStartedSpeaking;
    }
  }

  send(ws, {
    type: 'transcript',
    text,
    isFinal,
    confidence,
    isGated,
    turnState
  });
}

/**
 * Handle user final text (ready to send to AI)
 */
async function handleUserFinal(text, state, ws) {
  if (!text || !text.trim()) {
    return;
  }

  const turnController = state.turnController;
  if (!turnController) {
    return;
  }

  // Transition to processing
  if (turnController.getState() === TURN_STATE.USER_SPEAKING) {
    turnController.endUserSpeaking();
  } else if (turnController.getState() !== TURN_STATE.PROCESSING) {
    turnController.forceState(TURN_STATE.PROCESSING);
  }

  state.metrics.userFinalReceived = Date.now();

  try {
    // Save user message to database
    await query(`
      INSERT INTO roleplay_messages (session_id, role, content, created_at)
      VALUES (?, 'user', ?, NOW())
    `, [state.sessionId, text.trim()]);

    // Add to conversation history
    state.conversationHistory.push({
      role: 'user',
      content: text.trim()
    });

    // Generate AI response
    await generateAndStreamResponse(state, ws);

  } catch (err) {
    console.error('[VoiceWS] User final error:', err);
    sendError(ws, 'Failed to process message');
    turnController.forceState(TURN_STATE.IDLE);
  }
}

/**
 * Generate and stream AI response
 */
async function generateAndStreamResponse(state, ws) {
  const { scriptData, conversationHistory, turnController, metrics } = state;

  // Create abort controller for cancellation
  state.openaiAbort = createAbortController();
  state.elevenlabsAbort = new AbortController();

  const systemPrompt = buildProspectSystemPrompt(
    scriptData.scriptText,
    scriptData.goalText,
    scriptData.rebuttals,
    scriptData.difficulty || 'medium'
  );

  let fullResponse = '';
  let audioChunksQueued = 0;

  try {
    // Start streaming from OpenAI
    await streamChatCompletion(
      {
        messages: conversationHistory,
        systemPrompt
      },
      {
        onToken: (token, accumulated) => {
          if (state.openaiAbort?.signal.aborted) return;
          
          // Record first token metric
          if (!metrics.firstTokenReceived) {
            metrics.firstTokenReceived = Date.now();
            if (metrics.userFinalReceived) {
              metrics.timeToFirstTokenMs = metrics.firstTokenReceived - metrics.userFinalReceived;
            }
          }

          send(ws, { 
            type: 'assistant_token', 
            token, 
            fullText: accumulated 
          });
        },

        onChunk: async (chunk, accumulated) => {
          if (state.openaiAbort?.signal.aborted) return;

          send(ws, { type: 'assistant_chunk', text: chunk });

          // Start TTS for this chunk
          if (isElevenLabsConfigured() && !state.elevenlabsAbort?.signal.aborted) {
            // Start AI speaking state on first chunk
            if (audioChunksQueued === 0) {
              turnController.startAISpeaking();
            }
            audioChunksQueued++;

            try {
              await streamSpeech(chunk, {
                signal: state.elevenlabsAbort.signal,
                onAudioChunk: (audioData) => {
                  if (state.elevenlabsAbort?.signal.aborted) return;

                  // Record first audio metric
                  if (!metrics.firstAssistantAudio) {
                    metrics.firstAssistantAudio = Date.now();
                    if (metrics.userFinalReceived) {
                      metrics.timeToFirstAudioMs = metrics.firstAssistantAudio - metrics.userFinalReceived;
                    }
                  }

                  send(ws, {
                    type: 'assistant_audio',
                    data: audioData.toString('base64')
                  });
                }
              });
            } catch (ttsErr) {
              if (ttsErr.message !== 'Aborted') {
                console.error('[VoiceWS] TTS error:', ttsErr);
              }
            }
          }

          fullResponse = accumulated;
        },

        onComplete: async (finalText) => {
          fullResponse = finalText;

          // Save AI response to database
          await query(`
            INSERT INTO roleplay_messages (session_id, role, content, created_at)
            VALUES (?, 'ai', ?, NOW())
          `, [state.sessionId, finalText]);

          // Add to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: finalText
          });

          send(ws, { type: 'assistant_complete', fullText: finalText });

          // End AI speaking
          turnController.endAISpeaking();
        },

        onError: (err) => {
          console.error('[VoiceWS] OpenAI streaming error:', err);
          sendError(ws, 'AI response failed');
          turnController.forceState(TURN_STATE.IDLE);
        }
      },
      state.openaiAbort.signal
    );

  } catch (err) {
    if (err.message !== 'Aborted') {
      console.error('[VoiceWS] Response generation error:', err);
      sendError(ws, 'Failed to generate response');
    }
    turnController.forceState(TURN_STATE.IDLE);
  }
}

/**
 * Handle interruption request
 */
function handleInterrupt(state, ws) {
  const { turnController, openaiAbort, elevenlabsAbort, metrics } = state;

  if (!turnController) return;

  const currentState = turnController.getState();
  
  if (currentState === TURN_STATE.AI_SPEAKING || currentState === TURN_STATE.USER_INTERRUPTING) {
    // Record interruption metrics
    metrics.interruptionRequested = Date.now();
    
    // Abort active streams
    openaiAbort?.abort();
    elevenlabsAbort?.abort();

    // Clear abort controllers
    state.openaiAbort = null;
    state.elevenlabsAbort = null;

    // Finalize Deepgram utterance
    state.deepgramSession?.finalize();

    // Transition to user speaking
    if (currentState === TURN_STATE.USER_INTERRUPTING) {
      turnController.confirmInterruption();
    } else {
      turnController.startUserSpeaking();
    }

    // Calculate barge-in latency
    if (metrics.interruptionRequested && metrics.lastAISpeakingStart) {
      metrics.bargeInLatencyMs = metrics.interruptionRequested - metrics.lastAISpeakingStart;
    }

    send(ws, { 
      type: 'interrupt_confirmed',
      bargeInLatencyMs: metrics.bargeInLatencyMs
    });

    console.log('[VoiceWS] Interruption confirmed');
  }
}

/**
 * Handle session end
 */
async function handleEndSession(state, ws) {
  cleanup(state);
  send(ws, { type: 'session_ended' });
}

/**
 * Cleanup session resources
 */
function cleanup(state) {
  // Abort active streams
  state.openaiAbort?.abort();
  state.elevenlabsAbort?.abort();

  // Close Deepgram
  if (state.deepgramSession) {
    state.deepgramSession.close();
    state.deepgramSession = null;
  }

  // Reset state
  state.turnController?.reset();
  state.sessionId = null;
  state.scriptData = null;
}

/**
 * Create metrics object
 */
function createMetrics() {
  return {
    sessionStarted: Date.now(),
    firstAudioReceived: null,
    firstSpeechDetected: null,
    userStartedSpeaking: null,
    firstTranscript: null,
    firstFinalTranscript: null,
    userFinalReceived: null,
    firstTokenReceived: null,
    firstAssistantAudio: null,
    interruptionRequested: null,
    lastAISpeakingStart: null,
    
    // Computed metrics
    timeToFirstTranscriptMs: null,
    timeToFinalTranscriptMs: null,
    timeToFirstTokenMs: null,
    timeToFirstAudioMs: null,
    bargeInLatencyMs: null
  };
}

/**
 * Send metrics to client
 */
function sendMetrics(state, ws) {
  const turnMetrics = state.turnController?.getMetrics() || {};
  send(ws, {
    type: 'metrics',
    data: {
      ...state.metrics,
      ...turnMetrics
    }
  });
}

/**
 * Send message to client
 */
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Send error to client
 */
function sendError(ws, message) {
  send(ws, { type: 'error', message });
}

/**
 * Safe JSON parse
 */
function safeParseJSON(str, defaultValue = null) {
  if (!str) return defaultValue;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Check if premium voice is available
 */
function isPremiumAvailable() {
  return isDeepgramConfigured() && isElevenLabsConfigured();
}

module.exports = {
  initVoiceWebSocket,
  isPremiumAvailable
};

