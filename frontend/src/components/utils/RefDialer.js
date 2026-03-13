import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';
import { FiPhone, FiPhoneOff, FiSkipForward, FiSkipBack, FiCheck, FiX, FiUser, FiClock, FiList, FiMic, FiMicOff, FiZap } from 'react-icons/fi';
import api from '../../api';
import './RefDialer.css';

const TALLY_API_URL = process.env.REACT_APP_TALLY_API_URL || 'https://intense-dusk-79330-68ded9c767c7.herokuapp.com';
const TALLY_API_KEY = process.env.REACT_APP_TALLY_API_KEY || 'atlas-tally-integration-2026';

const RefDialer = ({ refs, onClose, onUpdateStatus, onCurrentRefChange, userEmail, userId }) => {
  const dialableRefs = useMemo(() =>
    refs.filter(r => r.phone && r.phone.trim() && !r.archive),
    [refs]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [callLog, setCallLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [deviceError, setDeviceError] = useState(null);
  const [amdResult, setAmdResult] = useState(null);
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedFromNumber, setSelectedFromNumber] = useState('');
  const [autoDialing, setAutoDialing] = useState(false);
  const [pendingAutoDial, setPendingAutoDial] = useState(false);

  const deviceRef = useRef(null);
  const connectionRef = useRef(null);
  const timerRef = useRef(null);
  const wsRef = useRef(null);
  const autoDialTimerRef = useRef(null);
  const callSidRef = useRef(null);

  const current = dialableRefs[currentIndex] || null;

  // Notify parent of current ref for row highlighting
  useEffect(() => {
    if (onCurrentRefChange) {
      onCurrentRefChange(current?.id || null);
    }
  }, [current?.id, onCurrentRefChange]);

  // Notify parent on unmount to clear highlight
  useEffect(() => {
    return () => {
      if (onCurrentRefChange) onCurrentRefChange(null);
    };
  }, [onCurrentRefChange]);

  const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const getE164 = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
  };

  // Initialize Twilio Device
  useEffect(() => {
    let cancelled = false;

    const initDevice = async () => {
      try {
        setDeviceError(null);
        const res = await fetch(`${TALLY_API_URL}/webhooks/atlas-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': TALLY_API_KEY
          },
          body: JSON.stringify({
            userIdentity: userId || 'atlas-user',
            userEmail: userEmail || ''
          })
        });

        if (!res.ok) {
          throw new Error(`Token request failed: ${res.status}`);
        }

        const data = await res.json();
        if (!data.success || !data.token) {
          throw new Error(data.message || 'No token returned');
        }

        if (cancelled) return;

        const device = new Device(data.token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu']
        });

        device.on('registered', () => {
          console.log('[RefDialer] Device registered');
          if (!cancelled) setDeviceReady(true);
        });

        device.on('error', (err) => {
          console.error('[RefDialer] Device error:', err);
          if (!cancelled) setDeviceError(err.message || 'Device error');
        });

        device.on('tokenWillExpire', async () => {
          console.log('[RefDialer] Token expiring, refreshing...');
          try {
            const refreshRes = await fetch(`${TALLY_API_URL}/webhooks/atlas-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': TALLY_API_KEY
              },
              body: JSON.stringify({
                userIdentity: userId || 'atlas-user',
                userEmail: userEmail || ''
              })
            });
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.token) {
              device.updateToken(refreshData.token);
            }
          } catch (e) {
            console.error('[RefDialer] Token refresh failed:', e);
          }
        });

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        console.error('[RefDialer] Init error:', err);
        if (!cancelled) setDeviceError(err.message);
      }
    };

    initDevice();

    return () => {
      cancelled = true;
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, [userId, userEmail]);

  // Fetch available outbound phone numbers from user's Tally account
  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const [phoneRes, callerIdRes] = await Promise.all([
          api.get('/tally/phone-numbers').catch(() => null),
          api.get('/tally/caller-ids').catch(() => null)
        ]);

        const numbers = [];
        const seen = new Set();

        if (phoneRes?.data?.success && phoneRes.data.data) {
          for (const n of phoneRes.data.data) {
            if (!seen.has(n.phone_number)) {
              seen.add(n.phone_number);
              numbers.push({ phoneNumber: n.phone_number, friendlyName: n.friendly_name || n.phone_number });
            }
          }
        }

        if (callerIdRes?.data?.success && callerIdRes.data.data) {
          for (const c of callerIdRes.data.data) {
            if (c.is_verified && !seen.has(c.phone_number)) {
              seen.add(c.phone_number);
              numbers.push({ phoneNumber: c.phone_number, friendlyName: c.friendly_name || c.phone_number });
            }
          }
        }

        if (numbers.length) {
          setAvailableNumbers(numbers);
          const defaultId = callerIdRes?.data?.defaultCallerId;
          setSelectedFromNumber(defaultId && seen.has(defaultId) ? defaultId : numbers[0].phoneNumber);
        }
      } catch (e) {
        console.error('[RefDialer] Failed to fetch phone numbers:', e);
      }
    };
    fetchNumbers();
  }, []);

  // Connect to Tally WebSocket for AMD results and call status
  useEffect(() => {
    const wsUrl = TALLY_API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log('[RefDialer] WS connected');
        if (userEmail) {
          ws.send(JSON.stringify({ type: 'identify', userEmail }));
        }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // AMD result
          if (data.answeredBy) {
            console.log('[RefDialer] AMD result:', data.answeredBy);
            setAmdResult(data.answeredBy);

            // Auto-hangup on machine detection
            if (data.answeredBy !== 'human') {
              console.log('[RefDialer] Machine detected, auto-hanging up');
              if (connectionRef.current) {
                connectionRef.current.disconnect();
                connectionRef.current = null;
              }
              setCallState('ended');
              setPendingAutoDial(true);
            }
          }

          // Call status from server (no-answer, busy, failed)
          if (data.callStatus && data.callSid) {
            const status = data.callStatus;
            if (['no-answer', 'busy', 'failed', 'canceled'].includes(status)) {
              console.log('[RefDialer] Call failed/no-answer:', status);
              setCallState('ended');
              connectionRef.current = null;
              setPendingAutoDial(true);
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      };
      ws.onclose = () => console.log('[RefDialer] WS disconnected');
      wsRef.current = ws;
    } catch (e) {
      console.error('[RefDialer] WS error:', e);
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [userEmail]);

  // Handle auto-dial after machine/no-answer: log outcome, advance, dial next
  useEffect(() => {
    if (!pendingAutoDial || !autoDialing) {
      if (pendingAutoDial && !autoDialing) setPendingAutoDial(false);
      return;
    }

    // Log the no-answer/machine outcome
    if (current) {
      setCallLog(prev => [...prev, {
        refId: current.id,
        name: current.name || 'Unknown',
        phone: current.phone,
        outcome: 'no-answer',
        duration: callDuration,
        amd: amdResult,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }]);
    }

    setPendingAutoDial(false);
    setCallDuration(0);
    setAmdResult(null);
    setMuted(false);

    // Advance to next and auto-dial after short delay
    if (currentIndex < dialableRefs.length - 1) {
      setCurrentIndex(prev => prev + 1);
      autoDialTimerRef.current = setTimeout(() => {
        setCallState('idle');
      }, 1500);
    } else {
      setCallState('idle');
    }
  }, [pendingAutoDial, autoDialing, current, currentIndex, dialableRefs.length, callDuration, amdResult]);

  // Auto-dial when state goes to idle and autoDialing is on (after advancing)
  useEffect(() => {
    if (autoDialing && callState === 'idle' && deviceReady && current) {
      autoDialTimerRef.current = setTimeout(() => {
        handleDial();
      }, 500);
    }
    return () => {
      if (autoDialTimerRef.current) {
        clearTimeout(autoDialTimerRef.current);
        autoDialTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDialing, callState, deviceReady, currentIndex]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleDial = useCallback(async () => {
    if (!current || !deviceRef.current) return;

    setCallState('connecting');
    setAmdResult(null);

    try {
      const call = await deviceRef.current.connect({
        params: {
          To: getE164(current.phone),
          userEmail: userEmail || '',
          fromNumber: selectedFromNumber || ''
        }
      });

      connectionRef.current = call;
      callSidRef.current = call.parameters?.CallSid || null;

      call.on('ringing', () => {
        setCallState('ringing');
      });

      call.on('accept', () => {
        setCallState('connected');
      });

      call.on('disconnect', () => {
        setCallState('ended');
        connectionRef.current = null;
      });

      call.on('cancel', () => {
        setCallState('ended');
        connectionRef.current = null;
      });

      call.on('error', (err) => {
        console.error('[RefDialer] Call error:', err);
        setCallState('idle');
        connectionRef.current = null;
      });
    } catch (err) {
      console.error('[RefDialer] Dial error:', err);
      setCallState('idle');
    }
  }, [current, userEmail, selectedFromNumber]);

  const handleHangup = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setCallState('ended');
  }, []);

  const toggleMute = useCallback(() => {
    if (connectionRef.current) {
      const newMuted = !muted;
      connectionRef.current.mute(newMuted);
      setMuted(newMuted);
    }
  }, [muted]);

  const logOutcome = useCallback((outcome) => {
    if (!current) return;
    setCallLog(prev => [...prev, {
      refId: current.id,
      name: current.name || 'Unknown',
      phone: current.phone,
      outcome,
      duration: callDuration,
      amd: amdResult,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }]);

    if (onUpdateStatus) {
      if (outcome === 'answered') {
        onUpdateStatus(current.id, 'status', 'Contacted');
      } else if (outcome === 'scheduled') {
        onUpdateStatus(current.id, 'status', 'Scheduled');
      }
    }

    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }

    setCallState('idle');
    setCallDuration(0);
    setAmdResult(null);
    setMuted(false);

    if (currentIndex < dialableRefs.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [current, currentIndex, dialableRefs.length, onUpdateStatus, callDuration, amdResult]);

  const handleSkip = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setCallState('idle');
    setCallDuration(0);
    setAmdResult(null);
    setMuted(false);
    if (currentIndex < dialableRefs.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, dialableRefs.length]);

  const handlePrev = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
    }
    setCallState('idle');
    setCallDuration(0);
    setAmdResult(null);
    setMuted(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'd': case 'D':
          if (callState === 'idle' && deviceReady) handleDial();
          break;
        case 'h': case 'H':
          if (callState === 'connected' || callState === 'ringing') handleHangup();
          break;
        case 'm': case 'M':
          if (callState === 'connected') toggleMute();
          break;
        case 'ArrowRight': handleSkip(); break;
        case 'ArrowLeft': handlePrev(); break;
        case 'Escape': onClose(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDial, handleHangup, handleSkip, handlePrev, toggleMute, onClose, callState, deviceReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
      }
      if (autoDialTimerRef.current) {
        clearTimeout(autoDialTimerRef.current);
      }
    };
  }, []);

  const isInCall = callState === 'connecting' || callState === 'ringing' || callState === 'connected';

  if (dialableRefs.length === 0) {
    return (
      <div className="ref-dialer">
        <div className="ref-dialer-row">
          <FiPhone size={14} />
          <span className="ref-dialer-empty" style={{ padding: 0, flex: 1, textAlign: 'left' }}>No refs with phone numbers to dial.</span>
          <button className="ref-dialer-close" onClick={onClose}><FiX size={14} /></button>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / dialableRefs.length) * 100;
  const answered = callLog.filter(l => l.outcome === 'answered').length;
  const noAnswer = callLog.filter(l => l.outcome === 'no-answer').length;

  return (
    <div className="ref-dialer">
      <div className="ref-dialer-progress">
        <div className="ref-dialer-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {deviceError && (
        <div className="ref-dialer-device-error">
          Connection error: {deviceError}
        </div>
      )}

      <div className="ref-dialer-row">
        {/* Nav buttons */}
        <button
          className="ref-dialer-btn prev"
          onClick={handlePrev}
          disabled={currentIndex === 0 || isInCall}
          title="Previous"
        >
          <FiSkipBack size={14} />
        </button>

        {/* Contact info */}
        {current && (
          <div className="ref-dialer-contact-inline">
            <span className="ref-dialer-contact-name">
              <FiUser size={12} />
              {current.name || 'No Name'}
            </span>
            <span className="ref-dialer-contact-phone">{formatPhone(current.phone)}</span>
            {current.type && <span className="ref-dialer-contact-type">{current.type}</span>}
            {current.status && (
              <span className="ref-dialer-contact-status">{current.status}</span>
            )}
          </div>
        )}

        {/* Caller ID selector */}
        {availableNumbers.length > 0 && (
          <div className="ref-dialer-from-select">
            <select
              value={selectedFromNumber}
              onChange={(e) => setSelectedFromNumber(e.target.value)}
              disabled={isInCall}
              title="Outbound caller ID"
            >
              {availableNumbers.map(n => (
                <option key={n.phoneNumber} value={n.phoneNumber}>
                  {n.friendlyName !== n.phoneNumber ? n.friendlyName : formatPhone(n.phoneNumber)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ref-dialer-divider" />

        {/* Auto-dial toggle */}
        <button
          className={`ref-dialer-btn auto-dial${autoDialing ? ' active' : ''}`}
          onClick={() => setAutoDialing(!autoDialing)}
          disabled={isInCall}
          title={autoDialing ? 'Auto-dial ON — auto-skips machines & no-answers' : 'Auto-dial OFF'}
        >
          <FiZap size={13} />
          <span>Auto</span>
        </button>

        {/* Call state indicator */}
        {isInCall && (
          <div className={`ref-dialer-call-state ${callState}`}>
            <span className="ref-dialer-call-state-dot" />
            <span>
              {callState === 'connecting' && 'Connecting...'}
              {callState === 'ringing' && 'Ringing...'}
              {callState === 'connected' && formatDuration(callDuration)}
            </span>
            {amdResult && (
              <span className={`ref-dialer-amd ${amdResult === 'human' ? 'human' : 'machine'}`}>
                {amdResult === 'human' ? 'Human' : 'VM'}
              </span>
            )}
          </div>
        )}

        {/* Dial / In-call controls */}
        {callState === 'idle' || callState === 'ended' ? (
          <button
            className="ref-dialer-btn dial"
            onClick={handleDial}
            disabled={!deviceReady}
            title={deviceReady ? 'Dial (D)' : 'Connecting...'}
          >
            <FiPhone size={14} />
            <span>{!deviceReady ? '...' : 'Dial'}</span>
          </button>
        ) : isInCall ? (
          <div className="ref-dialer-in-call-actions">
            <button
              className="ref-dialer-btn mute"
              onClick={toggleMute}
              title={muted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {muted ? <FiMicOff size={14} /> : <FiMic size={14} />}
            </button>
            <button
              className="ref-dialer-btn hangup"
              onClick={handleHangup}
              title="Hang up (H)"
            >
              <FiPhoneOff size={14} />
            </button>
          </div>
        ) : null}

        {/* Outcome buttons */}
        {(callState === 'ended' || callState === 'connected') && (
          <>
            <div className="ref-dialer-divider" />
            <div className="ref-dialer-outcomes">
              <button className="ref-dialer-btn outcome answered" onClick={() => logOutcome('answered')} title="Answered">
                <FiCheck size={12} /> Answered
              </button>
              <button className="ref-dialer-btn outcome no-answer" onClick={() => logOutcome('no-answer')} title="No Answer">
                <FiX size={12} /> No Ans
              </button>
              <button className="ref-dialer-btn outcome scheduled" onClick={() => logOutcome('scheduled')} title="Scheduled">
                <FiClock size={12} /> Callback
              </button>
            </div>
          </>
        )}

        <button
          className="ref-dialer-btn skip"
          onClick={handleSkip}
          disabled={currentIndex >= dialableRefs.length - 1}
          title="Skip"
        >
          <FiSkipForward size={14} />
        </button>

        <div className="ref-dialer-divider" />

        {/* Summary + log + counter + close */}
        {callLog.length > 0 && (
          <div className="ref-dialer-summary">
            <span className="ref-dialer-summary-item answered">{answered}</span>
            <span className="ref-dialer-summary-item no-answer">{noAnswer}</span>
            <span className="ref-dialer-summary-item total">{callLog.length}</span>
          </div>
        )}

        <span className="ref-dialer-counter">{currentIndex + 1}/{dialableRefs.length}</span>

        <button
          className={`ref-dialer-log-btn${showLog ? ' active' : ''}`}
          onClick={() => setShowLog(!showLog)}
          title="Call log"
        >
          <FiList size={14} />
          {callLog.length > 0 && <span className="ref-dialer-log-badge">{callLog.length}</span>}
        </button>

        <button className="ref-dialer-close" onClick={onClose}><FiX size={14} /></button>
      </div>

      {/* Expandable call log */}
      {showLog && (
        <div className="ref-dialer-call-log">
          {callLog.length === 0 ? (
            <div className="ref-dialer-empty">No calls yet.</div>
          ) : (
            callLog.map((entry, i) => (
              <div key={i} className={`ref-dialer-log-entry ${entry.outcome}`}>
                <span className="ref-dialer-log-name">{entry.name}</span>
                <span className="ref-dialer-log-phone">{formatPhone(entry.phone)}</span>
                <span className={`ref-dialer-log-outcome ${entry.outcome}`}>
                  {entry.outcome === 'answered' ? 'Answered' :
                   entry.outcome === 'no-answer' ? 'No Answer' : 'Callback'}
                </span>
                {entry.amd && (
                  <span className={`ref-dialer-amd ${entry.amd === 'human' ? 'human' : 'machine'}`}>
                    {entry.amd === 'human' ? 'Human' : 'VM'}
                  </span>
                )}
                {entry.duration > 0 && (
                  <span className="ref-dialer-log-duration">{formatDuration(entry.duration)}</span>
                )}
                <span className="ref-dialer-log-time">{entry.time}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default RefDialer;
