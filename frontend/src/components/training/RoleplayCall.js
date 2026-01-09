import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiPlus, FiEdit2, FiClock, FiTarget, FiMessageCircle, FiChevronLeft, FiChevronRight, FiX, FiVolume2, FiVolumeX, FiSettings, FiZap, FiArrowLeft, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import api from '../../api';
import { createVoiceEngine, TURN_STATE, VOICE_MODE, isVoiceSupported } from '../../voice/VoiceEngine';
import './RoleplayCall.css';

const RoleplayCall = () => {
  // State management
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]); // For training progress across all scripts
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [editingScript, setEditingScript] = useState(null);
  const [sessionResults, setSessionResults] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [reviewingSession, setReviewingSession] = useState(null); // For viewing past sessions
  const [error, setError] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    goals: false,
    scripts: false,
    sessions: false
  });
  
  // Voice-specific state
  const [voiceEngine, setVoiceEngine] = useState(null);
  const [voiceMode, setVoiceMode] = useState(VOICE_MODE.AUTO);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [turnState, setTurnState] = useState(TURN_STATE.IDLE);
  const [isPremiumMode, setIsPremiumMode] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [difficulty, setDifficulty] = useState('medium'); // easy, medium, hard

  // Refs
  const messagesEndRef = useRef(null);
  const callTimerRef = useRef(null);
  const voiceEngineRef = useRef(null);
  const activeSessionRef = useRef(null);

  // Keep activeSession ref in sync
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Check voice support on mount
  useEffect(() => {
    const supported = isVoiceSupported();
    setVoiceSupported(supported);
    if (!supported) {
      setError('Voice features not fully supported in this browser. Please use Chrome or Edge.');
    }
  }, []);

  // Load scripts and all sessions on mount
  useEffect(() => {
    fetchScripts();
    fetchAllSessions(); // Load all sessions for training progress
  }, []);

  // Load filtered sessions when script changes
  useEffect(() => {
    if (selectedScript) {
      fetchSessions(selectedScript.id);
    }
  }, [selectedScript]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceEngineRef.current?.disconnect();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Initialize voice engine
  const initVoiceEngine = useCallback(async () => {
    if (voiceEngineRef.current) {
      return voiceEngineRef.current;
    }

    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      
      const engine = await createVoiceEngine({
        token,
        mode: voiceMode,
        onMessage: handleVoiceMessage
      });

      // Set up callbacks
      engine.on({
        onTranscript: handleTranscript,
        onAssistantText: handleAssistantText,
        onAssistantAudio: handleAssistantAudio,
        onTurnStateChange: handleTurnStateChange,
        onError: handleVoiceError,
        onSessionReady: handleSessionReady,
        onSessionEnded: handleSessionEnded
      });

      voiceEngineRef.current = engine;
      setVoiceEngine(engine);
      setIsPremiumMode(engine.isPremium());

      console.log('[RoleplayCall] Voice engine initialized:', engine.getMode(), 
        engine.isPremium() ? '(Premium)' : '(WebSpeech)');
      return engine;

    } catch (err) {
      console.warn('[RoleplayCall] Voice engine init error:', err.message);
      // Don't show error to user - the call can still work via REST API
      // Just log and continue without voice
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode]);

  // Voice event handlers
  const handleTranscript = useCallback((data) => {
    if (data.text) {
      setTranscript(data.text);
    }
  }, []);

  const handleAssistantText = useCallback((token, fullText, isComplete) => {
    if (isComplete && fullText) {
      // Add AI message
      setMessages(prev => {
        // Check if we already have this message (avoid duplicates)
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'ai' && lastMsg?.content === fullText) {
          return prev;
        }
        return [...prev, {
          role: 'ai',
          content: fullText,
          timestamp: new Date()
        }];
      });
    }
  }, []);

  const handleAssistantAudio = useCallback((audioData) => {
    // Audio is handled by the engine
  }, []);

  const handleTurnStateChange = useCallback((newState, previousState) => {
    setTurnState(newState);
    setIsSpeaking(newState === TURN_STATE.AI_SPEAKING);
    setIsListening(newState === TURN_STATE.USER_SPEAKING || newState === TURN_STATE.IDLE);
    setIsProcessing(newState === TURN_STATE.PROCESSING);
    
    // Clear transcript when AI starts speaking
    if (newState === TURN_STATE.AI_SPEAKING) {
      setTranscript('');
    }
  }, []);

  const handleVoiceError = useCallback((err) => {
    console.error('[RoleplayCall] Voice error:', err);
    setError(err.message || 'Voice error occurred');
  }, []);

  const handleSessionReady = useCallback((data) => {
    console.log('[RoleplayCall] Session ready:', data);
  }, []);

  const handleSessionEnded = useCallback(() => {
    console.log('[RoleplayCall] Session ended');
  }, []);

  // Handle voice message (for webspeech fallback - sends to REST API)
  const handleVoiceMessage = useCallback(async (text) => {
    const session = activeSessionRef.current;
    if (!session || !text) {
      console.log('[RoleplayCall] handleVoiceMessage - no session or text', { session: !!session, text });
      return;
    }

    console.log('[RoleplayCall] Processing voice message:', text.substring(0, 50) + '...');
    setIsProcessing(true);
    setTranscript('');

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date()
    }]);

    try {
      const response = await api.post(`/training/roleplay/sessions/${session.id}/message`, {
        content: text
      });

      if (response.data.success) {
        const aiResponse = response.data.data.aiResponse;
        console.log('[RoleplayCall] AI response received:', aiResponse.substring(0, 50) + '...');
        
        // Add AI response to messages
        setMessages(prev => [...prev, {
          role: 'ai',
          content: aiResponse,
          timestamp: new Date()
        }]);

        // Speak the response (for webspeech mode)
        if (voiceEngineRef.current?.getType() === 'webspeech') {
          await voiceEngineRef.current.speak(aiResponse);
        }
      }
    } catch (err) {
      console.error('[RoleplayCall] Message error:', err);
      setError('Failed to process message');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const fetchScripts = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/training/roleplay/scripts');
      if (response.data.success) {
        // Filter out POS Policy Review
        const filteredScripts = response.data.data.filter(script => 
          !script.name.toLowerCase().includes('pos policy review')
        );
        setScripts(filteredScripts);
        if (filteredScripts.length > 0 && !selectedScript) {
          setSelectedScript(filteredScripts[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching scripts:', err);
      setError('Failed to load scripts');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessions = async (scriptId) => {
    try {
      const response = await api.get(`/training/roleplay/sessions?scriptId=${scriptId}`);
      if (response.data.success) {
        setSessions(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  const fetchAllSessions = async () => {
    try {
      const response = await api.get(`/training/roleplay/sessions`);
      if (response.data.success) {
        setAllSessions(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching all sessions:', err);
    }
  };

  const startCall = async () => {
    if (!selectedScript || !voiceSupported) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Create session via REST API with difficulty level
      const response = await api.post('/training/roleplay/sessions', {
        scriptId: selectedScript.id,
        difficulty: difficulty
      });
      
      if (response.data.success) {
        const sessionData = response.data.data;
        setActiveSession(sessionData);
        setMessages([]);
        setSessionResults(null);
        setCallDuration(0);
        setTranscript('');

        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        // Get the initial greeting
        const greeting = sessionData.initialMessage || 'Hello?';
        setMessages([{
          role: 'ai',
          content: greeting,
          timestamp: new Date()
        }]);

        // Initialize voice engine
        try {
          const engine = await initVoiceEngine();
          
          if (engine) {
            console.log('[RoleplayCall] Starting voice session...');
            await engine.startSession(sessionData.id);
            
            // For webspeech mode, speak the greeting
            if (engine.getType() === 'webspeech') {
              await engine.speak(greeting);
            }
            
            // Start listening
            await engine.startListening();
            console.log('[RoleplayCall] Voice session started successfully');
          } else {
            console.warn('[RoleplayCall] No voice engine, call will be silent');
          }
        } catch (voiceErr) {
          console.error('[RoleplayCall] Voice init error (call continues):', voiceErr.message);
          // Don't fail the call, just continue without voice
        }
      }
    } catch (err) {
      console.error('Error starting call:', err);
      setError('Failed to start call. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const endCall = async () => {
    if (!activeSession) return;
    
    // Stop voice engine
    voiceEngineRef.current?.stopSession();
    
    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    try {
      setIsLoading(true);
      const response = await api.post(`/training/roleplay/sessions/${activeSession.id}/end`, {
        duration: callDuration // Pass the actual tracked duration in seconds
      });
      
      if (response.data.success) {
        setSessionResults(response.data.data);
        // Don't show modal - show inline results instead
        setShowResultsModal(false);
        setActiveSession(null);
        setTurnState(TURN_STATE.IDLE);
        setIsListening(false);
        setIsSpeaking(false);
        setTranscript('');
        
        // Refresh both filtered and all sessions
        if (selectedScript) {
          fetchSessions(selectedScript.id);
        }
        fetchAllSessions();
      }
    } catch (err) {
      console.error('Error ending call:', err);
      setError('Failed to end call. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const viewPastSession = async (sessionId) => {
    try {
      setIsLoading(true);
      const response = await api.get(`/training/roleplay/sessions/${sessionId}`);
      
      if (response.data.success) {
        const session = response.data.data;
        setReviewingSession({
          ...session,
          results: session.score_json ? {
            ...session.score_json,
            duration: session.duration,
            overallScore: session.score
          } : null
        });
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setError('Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  const closeSessionReview = () => {
    setReviewingSession(null);
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleScriptSelect = (script) => {
    if (activeSession) {
      if (!window.confirm('End current call and switch scripts?')) return;
      endCall();
    }
    setSelectedScript(script);
  };

  const openCreateScript = () => {
    setEditingScript(null);
    setShowScriptModal(true);
  };

  const openEditScript = (script) => {
    if (!script.isOwner) return;
    setEditingScript(script);
    setShowScriptModal(true);
  };

  const handleScriptSave = async (scriptData) => {
    try {
      if (editingScript) {
        await api.put(`/training/roleplay/scripts/${editingScript.id}`, scriptData);
      } else {
        await api.post('/training/roleplay/scripts', scriptData);
      }
      setShowScriptModal(false);
      fetchScripts();
    } catch (err) {
      console.error('Error saving script:', err);
      throw err;
    }
  };

  const toggleMic = () => {
    if (!voiceEngineRef.current) return;
    
    if (isListening) {
      voiceEngineRef.current.muteMic();
      setIsListening(false);
    } else {
      voiceEngineRef.current.unmuteMic();
      voiceEngineRef.current.startListening();
      setIsListening(true);
    }
  };

  const toggleMute = () => {
    if (!voiceEngineRef.current) return;
    
    if (isMuted) {
      voiceEngineRef.current.unmuteSpeaker();
      setIsMuted(false);
    } else {
      voiceEngineRef.current.muteSpeaker();
      setIsMuted(true);
    }
  };

  const handleInterrupt = () => {
    voiceEngineRef.current?.interrupt();
  };

  const switchVoiceMode = async (newMode) => {
    if (activeSession) {
      setError('Cannot change voice mode during active call');
      return;
    }

    setVoiceMode(newMode);
    
    // Reinitialize engine with new mode
    if (voiceEngineRef.current) {
      voiceEngineRef.current.disconnect();
      voiceEngineRef.current = null;
      setVoiceEngine(null);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTurnStateLabel = () => {
    switch (turnState) {
      case TURN_STATE.AI_SPEAKING:
        return '🔊 Prospect Speaking... (mic paused)';
      case TURN_STATE.USER_SPEAKING:
        return transcript ? '🎤 You are speaking...' : '🎙️ Your turn - speak now';
      case TURN_STATE.PROCESSING:
        return '⏳ Processing...';
      case TURN_STATE.USER_INTERRUPTING:
        return '🎤 Interrupting...';
      default:
        return '📞 Connected';
    }
  };

  return (
    <div className="roleplay-container">
      {/* Left Sidebar - Scripts & Sessions */}
      <div className={`roleplay-sidebar ${showSidebar ? '' : 'collapsed'}`}>
        <div className="sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>
          {showSidebar ? <FiChevronLeft /> : <FiChevronRight />}
        </div>

        {showSidebar && (
          <div className="sidebar-content">
            {/* Training Goals Section */}
            <div className="sidebar-section training-goals">
              <div className="sidebar-header collapsible" onClick={() => toggleSection('goals')}>
                <h3>Training Goals</h3>
                <button className="collapse-btn">
                  {collapsedSections.goals ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </div>
              {!collapsedSections.goals && (
                <TrainingProgress 
                  sessions={allSessions} 
                  scripts={scripts}
                  onSelectScript={(script, difficulty) => {
                    setSelectedScript(script);
                    setDifficulty(difficulty);
                  }}
                />
              )}
            </div>

            <div className="sidebar-section">
              <div className="sidebar-header collapsible">
                <div className="header-left-section" onClick={() => toggleSection('scripts')}>
                  <h3>Scripts</h3>
                  <button className="collapse-btn">
                    {collapsedSections.scripts ? <FiChevronDown /> : <FiChevronUp />}
                  </button>
                </div>
                <button className="icon-btn" onClick={openCreateScript} title="Create Script">
                  <FiPlus />
                </button>
              </div>
              {!collapsedSections.scripts && (
                <div className="script-list">
                  {scripts.map(script => (
                    <div 
                      key={script.id}
                      className={`script-item ${selectedScript?.id === script.id ? 'selected' : ''}`}
                      onClick={() => handleScriptSelect(script)}
                    >
                      <div className="script-info">
                        <span className="script-name">{script.name}</span>
                        {script.isGlobal && <span className="script-badge global">Template</span>}
                      </div>
                      {script.isOwner && (
                        <button 
                          className="icon-btn small" 
                          onClick={(e) => { e.stopPropagation(); openEditScript(script); }}
                        >
                          <FiEdit2 />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <div className="sidebar-header collapsible" onClick={() => toggleSection('sessions')}>
                <h3>Past Sessions</h3>
                <button className="collapse-btn">
                  {collapsedSections.sessions ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </div>
              {!collapsedSections.sessions && (
                <div className="sessions-list">
                {sessions.length === 0 ? (
                  <p className="empty-text">No sessions yet</p>
                ) : (
                  sessions.slice(0, 10).map(session => (
                    <div 
                      key={session.id}
                      className="session-item"
                      onClick={() => viewPastSession(session.id)}
                    >
                      <div className="session-info">
                        <span className="session-date">
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                        <div className="session-meta">
                          <span className={`difficulty-badge ${session.difficulty || 'medium'}`}>
                            {session.difficulty === 'easy' && '🟢 Easy'}
                            {session.difficulty === 'medium' && '🟡 Medium'}
                            {session.difficulty === 'hard' && '🔴 Hard'}
                            {!session.difficulty && '🟡 Medium'}
                          </span>
                          <span className="session-score">
                            Score: {session.score_json?.rubric ? 
                              Math.round(Object.values(session.score_json.rubric).reduce((a,b) => a+b, 0) / 4 * 20) : 
                              session.score || 'N/A'}%
                          </span>
                        </div>
                      </div>
                      <span className={`session-status ${session.outcome_json?.appointmentBooked ? 'booked' : 'no-book'}`}>
                        {session.outcome_json?.appointmentBooked ? '✓ Booked' : '✗ No Book'}
                      </span>
                    </div>
                  ))
                )}
              </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Call Interface or Session Review */}
      <div className="roleplay-main">
        {/* Session Review View */}
        {reviewingSession ? (
          <SessionReviewView 
            session={reviewingSession} 
            onClose={closeSessionReview}
          />
        ) : (
          <>
            {/* Header */}
            <div className="roleplay-header">
          <div className="header-left">
            <h2>
              <FiPhone className="header-icon" />
              {activeSession ? 'Call in Progress' : 'Roleplay Call'}
            </h2>
            {selectedScript && <span className="selected-script">{selectedScript.name}</span>}
            {isPremiumMode && (
              <span className="premium-badge" title="Premium Voice Mode (Deepgram + ElevenLabs)">
                <FiZap /> Premium
              </span>
            )}
          </div>
          <div className="header-actions">
            {!activeSession && (
              <>
                <div className="difficulty-selector">
                  <label>Difficulty:</label>
                  <div className="difficulty-buttons">
                    <button
                      className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`}
                      onClick={() => setDifficulty('easy')}
                      title="Easy: Friendly prospect, 0-1 objections"
                    >
                      🟢 Easy
                    </button>
                    <button
                      className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`}
                      onClick={() => setDifficulty('medium')}
                      title="Medium: Moderate resistance, 2-3 objections"
                    >
                      🟡 Medium
                    </button>
                    <button
                      className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`}
                      onClick={() => setDifficulty('hard')}
                      title="Hard: Challenging prospect, 4+ objections"
                    >
                      🔴 Hard
                    </button>
                  </div>
                </div>
                <button 
                  className="icon-btn" 
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  title="Voice Settings"
                >
                  <FiSettings />
                </button>
              </>
            )}
            {activeSession && (
              <span className="call-timer">{formatDuration(callDuration)}</span>
            )}
            {!activeSession ? (
              <button 
                className="btn-start-call" 
                onClick={startCall}
                disabled={!selectedScript || isLoading || !voiceSupported}
              >
                <FiPhone /> Start Call
              </button>
            ) : (
              <button 
                className="btn-end-call" 
                onClick={endCall}
                disabled={isLoading}
              >
                <FiPhoneOff /> End Call
              </button>
            )}
          </div>
        </div>

        {/* Voice Settings Panel */}
        {showVoiceSettings && !activeSession && (
          <div className="voice-settings-panel">
            <h4>Voice Mode</h4>
            <div className="voice-mode-options">
              <label className={`mode-option ${voiceMode === VOICE_MODE.AUTO ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="voiceMode" 
                  value={VOICE_MODE.AUTO}
                  checked={voiceMode === VOICE_MODE.AUTO}
                  onChange={() => switchVoiceMode(VOICE_MODE.AUTO)}
                />
                <div className="mode-info">
                  <span className="mode-name">Auto (Recommended)</span>
                  <span className="mode-desc">Uses Premium if available, falls back to browser voice</span>
                </div>
              </label>
              <label className={`mode-option ${voiceMode === VOICE_MODE.PREMIUM ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="voiceMode" 
                  value={VOICE_MODE.PREMIUM}
                  checked={voiceMode === VOICE_MODE.PREMIUM}
                  onChange={() => switchVoiceMode(VOICE_MODE.PREMIUM)}
                />
                <div className="mode-info">
                  <span className="mode-name"><FiZap /> Premium Voice</span>
                  <span className="mode-desc">Deepgram STT + ElevenLabs TTS (best quality)</span>
                </div>
              </label>
              <label className={`mode-option ${voiceMode === VOICE_MODE.WEBSPEECH ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="voiceMode" 
                  value={VOICE_MODE.WEBSPEECH}
                  checked={voiceMode === VOICE_MODE.WEBSPEECH}
                  onChange={() => switchVoiceMode(VOICE_MODE.WEBSPEECH)}
                />
                <div className="mode-info">
                  <span className="mode-name">Browser Voice</span>
                  <span className="mode-desc">Uses browser's speech recognition & synthesis (free)</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Call goal/tips panel */}
        {selectedScript && !activeSession && (
          <div className="call-info-panel">
            <div className="info-card">
              <h4><FiTarget /> Call Goal</h4>
              <p>{selectedScript.goal_text || 'Book an appointment to explain benefits'}</p>
            </div>
            <div className="info-card tips">
              <h4><FiMessageCircle /> Quick Tips</h4>
              <ul>
                <li>Speak clearly and naturally</li>
                <li>Listen to objections before responding</li>
                <li>Ask for the appointment confidently</li>
              </ul>
            </div>
          </div>
        )}

        {/* Active Call Interface */}
        {activeSession ? (
          <div className="call-interface">
            {/* Call Visual */}
            <div className="call-visual">
              <div className={`call-avatar ${isSpeaking ? 'speaking' : ''} ${isListening && !isSpeaking && !isProcessing ? 'listening' : ''} ${transcript ? 'user-talking' : ''}`}>
                <div className="avatar-ring"></div>
                <div className="avatar-inner">
                  {isSpeaking ? '🗣️' : transcript ? '🎤' : isListening ? '👂' : '📞'}
                </div>
                {(transcript || isSpeaking) && (
                  <div className="audio-waves">
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                )}
              </div>
              <div className="call-status">
                {getTurnStateLabel()}
              </div>
              {transcript && (
                <div className="live-transcript">
                  <span className="transcript-label">You:</span> {transcript}
                </div>
              )}
              {isSpeaking && (
                <div className="turn-indicator listening-paused">
                  🔇 Mic is paused while prospect speaks
                  {isPremiumMode && (
                    <button className="interrupt-btn" onClick={handleInterrupt}>
                      Interrupt
                    </button>
                  )}
                </div>
              )}
              {!isSpeaking && !isProcessing && !transcript && isListening && (
                <div className="turn-indicator">
                  Speak clearly when ready. Pause for 1.5 seconds when done.
                </div>
              )}
            </div>

            {/* Call Controls */}
            <div className="call-controls">
              <button 
                className={`control-btn mic ${isListening ? 'active' : ''}`}
                onClick={toggleMic}
                disabled={isSpeaking || isProcessing}
              >
                {isListening ? <FiMic /> : <FiMicOff />}
                <span>{isListening ? 'Listening' : 'Muted'}</span>
              </button>
              <button 
                className={`control-btn speaker ${isMuted ? 'muted' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? <FiVolumeX /> : <FiVolume2 />}
                <span>{isMuted ? 'Unmute' : 'Speaker'}</span>
              </button>
              <button 
                className="control-btn end"
                onClick={endCall}
              >
                <FiPhoneOff />
                <span>End</span>
              </button>
            </div>

            {/* Transcript Panel */}
            <div className="transcript-panel">
              <h4>Call Transcript</h4>
              <div className="messages-container">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    <div className="message-label">
                      {msg.role === 'user' ? 'You' : 'Prospect'}
                    </div>
                    <div className="message-content">
                      <p>{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-chat">
            <div className="phone-icon-large">
              <FiPhone />
            </div>
            <h3>Ready to Practice?</h3>
            <p>Select a script and click "Start Call" to begin your voice roleplay session.</p>
            {!voiceSupported && (
              <div className="voice-warning">
                ⚠️ Voice recognition not supported. Please use Chrome or Edge browser.
              </div>
            )}
          </div>
        )}

        {/* Inline Results Display (after call ends) */}
        {!activeSession && sessionResults && !showResultsModal && (
          <div className="inline-results">
            <InlineResults 
              results={sessionResults} 
              onClose={() => setSessionResults(null)}
              onNewCall={startCall}
            />
          </div>
        )}

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
          </>
        )}
      </div>

      {/* Script Modal */}
      {showScriptModal && (
        <ScriptModal
          script={editingScript}
          onSave={handleScriptSave}
          onClose={() => setShowScriptModal(false)}
        />
      )}

      {/* Results Modal */}
      {showResultsModal && sessionResults && (
        <ResultsModal
          results={sessionResults}
          onClose={() => setShowResultsModal(false)}
        />
      )}
    </div>
  );
};

// Script Create/Edit Modal Component
const ScriptModal = ({ script, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: script?.name || '',
    scriptText: script?.script_text || '',
    goalText: script?.goal_text || 'Book an appointment to explain benefits',
    rebuttals: script?.objections || []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Script name is required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onSave(formData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save script');
    } finally {
      setIsLoading(false);
    }
  };

  const addRebuttal = () => {
    setFormData(prev => ({
      ...prev,
      rebuttals: [...prev.rebuttals, { objection: '', response: '' }]
    }));
  };

  const updateRebuttal = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      rebuttals: prev.rebuttals.map((r, i) => 
        i === index ? { ...r, [field]: value } : r
      )
    }));
  };

  const removeRebuttal = (index) => {
    setFormData(prev => ({
      ...prev,
      rebuttals: prev.rebuttals.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content script-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{script ? 'Edit Script' : 'Create Script'}</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Script Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Response Card Cold Call"
              maxLength={255}
            />
          </div>

          <div className="form-group">
            <label>Call Goal</label>
            <input
              type="text"
              value={formData.goalText}
              onChange={e => setFormData(prev => ({ ...prev, goalText: e.target.value }))}
              placeholder="What is the goal of this call?"
              maxLength={2000}
            />
          </div>

          <div className="form-group">
            <label>Script Text</label>
            <textarea
              value={formData.scriptText}
              onChange={e => setFormData(prev => ({ ...prev, scriptText: e.target.value }))}
              placeholder="Enter your script outline, key phrases, and talking points..."
              rows={6}
              maxLength={10000}
            />
          </div>

          <div className="form-group">
            <label>
              Objection Rebuttals
              <button type="button" className="btn-add-rebuttal" onClick={addRebuttal}>
                <FiPlus /> Add
              </button>
            </label>
            <div className="rebuttals-list">
              {formData.rebuttals.map((rebuttal, index) => (
                <div key={index} className="rebuttal-item">
                  <input
                    type="text"
                    value={rebuttal.objection}
                    onChange={e => updateRebuttal(index, 'objection', e.target.value)}
                    placeholder="Objection (e.g., 'I'm not interested')"
                  />
                  <input
                    type="text"
                    value={rebuttal.response}
                    onChange={e => updateRebuttal(index, 'response', e.target.value)}
                    placeholder="Your response..."
                  />
                  <button type="button" className="btn-remove" onClick={() => removeRebuttal(index)}>
                    <FiX />
                  </button>
                </div>
              ))}
              {formData.rebuttals.length === 0 && (
                <p className="empty-text">No rebuttals added. Add common objections and your responses.</p>
              )}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Script'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Inline Results Component (shown in main area after call ends)
const InlineResults = ({ results, onClose, onNewCall }) => {
  const rubricLabels = {
    discovery: 'Discovery & Questions',
    objectionHandling: 'Objection Handling',
    clarity: 'Clarity & Script',
    nextStepAsk: 'Closing & Next Step'
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'excellent';
    if (score >= 3) return 'good';
    if (score >= 2) return 'fair';
    return 'needs-work';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const overallScore = results.rubric 
    ? Math.round(Object.values(results.rubric).reduce((a, b) => a + b, 0) / 4 * 20)
    : 0;

  return (
    <div className="inline-results-container">
      {/* Header with outcome */}
      <div className={`results-header ${results.appointmentBooked ? 'success' : 'no-book'}`}>
        <div className="results-header-content">
          <span className="outcome-icon">{results.appointmentBooked ? '🎉' : '📞'}</span>
          <div className="outcome-details">
            <h3>{results.appointmentBooked ? 'Appointment Booked!' : 'No Appointment Booked'}</h3>
            <div className="outcome-meta">
              {results.duration && <span><FiClock /> {formatDuration(results.duration)}</span>}
              <span className="overall-score">Score: {overallScore}%</span>
            </div>
          </div>
        </div>
        <div className="results-actions">
          <button className="btn-new-call" onClick={onNewCall}>
            <FiPhone /> New Call
          </button>
          <button className="btn-close-results" onClick={onClose}>
            <FiX />
          </button>
        </div>
      </div>

      {/* Results content */}
      <div className="results-body">
        {/* Rubric Scores */}
        <div className="results-section rubric-section-inline">
          <h4>Performance Scores</h4>
          <div className="rubric-grid-inline">
            {results.rubric && Object.entries(results.rubric).map(([key, score]) => (
              <div key={key} className="rubric-item-inline">
                <div className="rubric-header">
                  <span className="rubric-label">{rubricLabels[key] || key}</span>
                  <span className={`score-badge ${getScoreColor(score)}`}>{score}/5</span>
                </div>
                <div className="score-bar">
                  <div className={`score-fill ${getScoreColor(score)}`} style={{ width: `${score * 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two column layout for strengths and improvements */}
        <div className="feedback-columns">
          {/* Strengths */}
          {results.strengths?.length > 0 && (
            <div className="results-section strengths-inline">
              <h4>💪 Strengths</h4>
              <ul>
                {results.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {results.improvements?.length > 0 && (
            <div className="results-section improvements-inline">
              <h4>🎯 Areas to Improve</h4>
              <ul>
                {results.improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Better Phrasing */}
        {results.betterPhrasing?.length > 0 && (
          <div className="results-section phrasing-inline">
            <h4>💡 Better Phrasing Suggestions</h4>
            <div className="phrasing-grid">
              {results.betterPhrasing.map((item, i) => (
                <div key={i} className="phrasing-card">
                  <div className="situation">{item.situation}</div>
                  <div className="suggestion">→ {item.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Results Modal Component (for viewing past sessions)
const ResultsModal = ({ results, onClose }) => {
  const rubricLabels = {
    discovery: 'Discovery & Questions',
    objectionHandling: 'Objection Handling',
    clarity: 'Clarity & Script',
    nextStepAsk: 'Closing & Next Step'
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'excellent';
    if (score >= 3) return 'good';
    if (score >= 2) return 'fair';
    return 'needs-work';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content results-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Call Results</h3>
          <button className="modal-close" onClick={onClose}><FiX /></button>
        </div>

        <div className="results-content">
          {/* Outcome */}
          <div className={`outcome-banner ${results.appointmentBooked ? 'success' : 'no-book'}`}>
            <span className="outcome-icon">{results.appointmentBooked ? '🎉' : '📞'}</span>
            <span className="outcome-text">
              {results.appointmentBooked ? 'Appointment Booked!' : 'No Appointment'}
            </span>
            {results.duration && (
              <span className="call-duration">
                <FiClock /> {formatDuration(results.duration)}
              </span>
            )}
          </div>

          {/* Rubric Scores */}
          <div className="rubric-section">
            <h4>Performance Scores</h4>
            <div className="rubric-grid">
              {results.rubric && Object.entries(results.rubric).map(([key, score]) => (
                <div key={key} className="rubric-item">
                  <div className="rubric-label">{rubricLabels[key] || key}</div>
                  <div className={`rubric-score ${getScoreColor(score)}`}>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: `${score * 20}%` }} />
                    </div>
                    <span className="score-value">{score}/5</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          {results.strengths?.length > 0 && (
            <div className="feedback-section strengths">
              <h4>💪 Strengths</h4>
              <ul>
                {results.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {results.improvements?.length > 0 && (
            <div className="feedback-section improvements">
              <h4>🎯 Areas to Improve</h4>
              <ul>
                {results.improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Better Phrasing Suggestions */}
          {results.betterPhrasing?.length > 0 && (
            <div className="feedback-section phrasing">
              <h4>💡 Better Phrasing</h4>
              {results.betterPhrasing.map((item, i) => (
                <div key={i} className="phrasing-item">
                  <div className="situation">{item.situation}</div>
                  <div className="suggestion">→ {item.suggestion}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// Training Progress Component
const TrainingProgress = ({ sessions, scripts, onSelectScript }) => {
  // Filter out excluded scripts and get unique script names
  const excludedScripts = ['globe life', 'pos policy review'];
  const keyScripts = scripts.filter(s => 
    !excludedScripts.some(excluded => 
      s.name.toLowerCase().includes(excluded)
    )
  );

  // Get completed bookings by script ID and difficulty
  const completedBookings = sessions.filter(s => 
    s.status === 'completed' && 
    s.outcome_json?.appointmentBooked === true
  );

  // Build progress map: scriptId -> {name, script, easy, medium, hard}
  const scriptProgress = {};
  keyScripts.forEach(script => {
    scriptProgress[script.id] = {
      name: script.name,
      script: script, // Store full script object
      easy: false,
      medium: false,
      hard: false
    };
  });

  // Mark completed difficulties
  completedBookings.forEach(session => {
    const difficulty = session.difficulty || 'medium';
    if (scriptProgress[session.script_id]) {
      scriptProgress[session.script_id][difficulty] = true;
    }
  });

  // Calculate overall progress
  const totalChecks = Object.keys(scriptProgress).length * 3; // 3 difficulties per script
  const completedChecks = Object.values(scriptProgress).reduce((sum, prog) => 
    sum + (prog.easy ? 1 : 0) + (prog.medium ? 1 : 0) + (prog.hard ? 1 : 0), 0
  );
  const progressPercent = totalChecks > 0 ? (completedChecks / totalChecks) * 100 : 0;

  // Find recommended next step
  const getRecommendation = () => {
    for (const [scriptId, prog] of Object.entries(scriptProgress)) {
      if (!prog.easy) return { scriptId, scriptObj: prog.script, script: prog.name, difficulty: 'easy', difficultyLabel: 'Easy', emoji: '🟢' };
      if (!prog.medium) return { scriptId, scriptObj: prog.script, script: prog.name, difficulty: 'medium', difficultyLabel: 'Medium', emoji: '🟡' };
      if (!prog.hard) return { scriptId, scriptObj: prog.script, script: prog.name, difficulty: 'hard', difficultyLabel: 'Hard', emoji: '🔴' };
    }
    return null;
  };

  const recommendation = getRecommendation();

  const handleClick = (script, difficulty) => {
    if (onSelectScript) {
      onSelectScript(script, difficulty);
    }
  };

  return (
    <div className="training-progress">
      <div className="progress-header">
        <div className="progress-title">
          <FiTarget className="goal-icon" />
          <span>Training Progress</span>
        </div>
        <div className="progress-count">
          {completedChecks}/{totalChecks}
        </div>
      </div>
      
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="progress-instruction">
        Book appointments at all difficulty levels for each script type
      </div>

      {recommendation && (
        <div 
          className="next-recommendation clickable" 
          onClick={() => handleClick(recommendation.scriptObj, recommendation.difficulty)}
          title="Click to select this script and difficulty"
        >
          <div className="rec-header">📍 Next Step:</div>
          <div className="rec-action">
            Try <strong>{recommendation.script}</strong> on <span className="rec-difficulty">{recommendation.emoji} {recommendation.difficultyLabel}</span>
          </div>
        </div>
      )}

      <div className="script-progress-list">
        {Object.entries(scriptProgress).slice(0, 6).map(([scriptId, prog]) => {
          // Find first incomplete difficulty for this script
          const nextDifficulty = !prog.easy ? 'easy' : !prog.medium ? 'medium' : !prog.hard ? 'hard' : 'easy';
          
          return (
          <div key={scriptId} className="script-progress-item">
            <div 
              className="script-progress-name clickable" 
              onClick={() => handleClick(prog.script, nextDifficulty)}
              title={`Click to select ${prog.name}`}
            >
              {prog.name}
            </div>
            <div className="difficulty-checks">
              <span 
                className={`check-box ${prog.easy ? 'checked' : ''} clickable`} 
                title="Click to practice Easy mode"
                onClick={() => handleClick(prog.script, 'easy')}
              >
                {prog.easy ? '✓' : '○'} 🟢
              </span>
              <span 
                className={`check-box ${prog.medium ? 'checked' : ''} clickable`} 
                title="Click to practice Medium mode"
                onClick={() => handleClick(prog.script, 'medium')}
              >
                {prog.medium ? '✓' : '○'} 🟡
              </span>
              <span 
                className={`check-box ${prog.hard ? 'checked' : ''} clickable`} 
                title="Click to practice Hard mode"
                onClick={() => handleClick(prog.script, 'hard')}
              >
                {prog.hard ? '✓' : '○'} 🔴
              </span>
            </div>
          </div>
          );
        })}
      </div>

      {completedChecks === totalChecks && totalChecks > 0 && (
        <div className="goal-completed">
          🎉 All Scripts Mastered!
        </div>
      )}
    </div>
  );
};

// Session Review View Component (Full Page)
const SessionReviewView = ({ session, onClose }) => {
  const rubricLabels = {
    rapport: 'Building Rapport',
    objection_handling: 'Objection Handling',
    script_adherence: 'Script Adherence',
    closing: 'Closing Technique'
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'excellent';
    if (score >= 3) return 'good';
    if (score >= 2) return 'fair';
    return 'needs-work';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const results = session.results;

  return (
    <div className="session-review-view">
      {/* Header with Back Button */}
      <div className="review-header">
        <button className="btn-back" onClick={onClose}>
          <FiArrowLeft /> Back to Sessions
        </button>
        <h2>Session Review</h2>
        <span className="review-date">
          {new Date(session.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </span>
      </div>

      <div className="review-content-container">
        {/* Left Side - Transcript */}
        <div className="review-transcript">
          <h3>Call Transcript</h3>
          <div className="transcript-messages">
            {session.messages && session.messages.length > 0 ? (
              session.messages.map((msg, i) => (
                <div key={i} className={`transcript-message ${msg.role}`}>
                  <div className="message-role">
                    {msg.role === 'user' ? '👤 You' : '🤖 Prospect'}
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            ) : (
              <p className="empty-text">No transcript available</p>
            )}
          </div>
        </div>

        {/* Right Side - Results */}
        <div className="review-results">
          {results ? (
            <>
              {/* Outcome Banner */}
              <div className={`outcome-banner ${results.appointmentBooked ? 'success' : 'no-book'}`}>
                <span className="outcome-icon">{results.appointmentBooked ? '🎉' : '📞'}</span>
                <div className="outcome-info">
                  <span className="outcome-text">
                    {results.appointmentBooked ? 'Appointment Booked!' : 'No Appointment'}
                  </span>
                  {results.duration && (
                    <span className="call-duration">
                      <FiClock /> {formatDuration(results.duration)}
                    </span>
                  )}
                </div>
                {results.overallScore && (
                  <div className="overall-score-badge">
                    {results.overallScore}%
                  </div>
                )}
              </div>

              {/* Rubric Scores */}
              {results.rubric && (
                <div className="rubric-section">
                  <h4>Performance Scores</h4>
                  <div className="rubric-grid">
                    {Object.entries(results.rubric).map(([key, score]) => (
                      <div key={key} className="rubric-item">
                        <div className="rubric-label">{rubricLabels[key] || key}</div>
                        <div className={`rubric-score ${getScoreColor(score)}`}>
                          <div className="score-bar">
                            <div className="score-fill" style={{ width: `${score * 20}%` }} />
                          </div>
                          <span className="score-value">{score}/5</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {results.strengths?.length > 0 && (
                <div className="feedback-section strengths">
                  <h4>💪 Strengths</h4>
                  <ul>
                    {results.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {results.improvements?.length > 0 && (
                <div className="feedback-section improvements">
                  <h4>🎯 Areas to Improve</h4>
                  <ul>
                    {results.improvements.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {/* Better Phrasing */}
              {results.betterPhrasing?.length > 0 && (
                <div className="feedback-section phrasing">
                  <h4>💡 Better Phrasing</h4>
                  {results.betterPhrasing.map((item, i) => (
                    <div key={i} className="phrasing-item">
                      <div className="situation">{item.situation}</div>
                      <div className="suggestion">→ {item.suggestion}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="no-results">
              <p>No scoring results available for this session</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleplayCall;
