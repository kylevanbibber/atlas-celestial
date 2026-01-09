/**
 * Voice Session Metrics
 * Collects and tracks performance metrics for voice sessions
 */

// Debug mode flag
const DEBUG_AUDIO = typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_AUDIO') === 'true';

/**
 * Create metrics collector for a voice session
 * @param {Object} options
 * @param {Function} options.onMetricsUpdate - Called when metrics update
 * @returns {Object} - Metrics collector
 */
export function createMetricsCollector(options = {}) {
  const { onMetricsUpdate } = options;

  // Timing metrics
  const metrics = {
    sessionStarted: null,
    
    // STT metrics
    firstAudioSent: null,
    firstTranscript: null,
    firstFinalTranscript: null,
    timeToFirstTranscriptMs: null,
    timeToFinalTranscriptMs: null,
    
    // LLM metrics  
    userFinalSent: null,
    firstTokenReceived: null,
    assistantComplete: null,
    timeToFirstTokenMs: null,
    timeToAssistantCompleteMs: null,
    
    // TTS metrics
    firstAudioReceived: null,
    timeToFirstAudioMs: null,
    
    // Barge-in metrics
    bargeInRequested: null,
    bargeInLatencyMs: null,
    bargeInCount: 0,
    falseBargeInCount: 0,
    
    // Turn metrics
    turnCount: 0,
    avgTurnDurationMs: 0,
    totalTurnDurationMs: 0,
    
    // Quality metrics
    transcriptConfidenceSum: 0,
    transcriptCount: 0,
    avgTranscriptConfidence: 0
  };

  // Debug logging at throttled rate
  let lastDebugLog = 0;
  const DEBUG_LOG_INTERVAL = 200; // 5 Hz max

  const collector = {
    /**
     * Get current metrics
     * @returns {Object}
     */
    getMetrics: () => ({ ...metrics }),

    /**
     * Start session timing
     */
    startSession: () => {
      metrics.sessionStarted = Date.now();
      log('Session started');
    },

    /**
     * Record first audio sent to STT
     */
    recordFirstAudioSent: () => {
      if (!metrics.firstAudioSent) {
        metrics.firstAudioSent = Date.now();
        log('First audio sent');
      }
    },

    /**
     * Record transcript received
     * @param {Object} transcript - { text, isFinal, confidence }
     */
    recordTranscript: (transcript) => {
      const now = Date.now();

      if (!metrics.firstTranscript && transcript.text) {
        metrics.firstTranscript = now;
        if (metrics.firstAudioSent) {
          metrics.timeToFirstTranscriptMs = now - metrics.firstAudioSent;
          log(`First transcript: ${metrics.timeToFirstTranscriptMs}ms`);
        }
      }

      if (transcript.isFinal && !metrics.firstFinalTranscript) {
        metrics.firstFinalTranscript = now;
        if (metrics.firstAudioSent) {
          metrics.timeToFinalTranscriptMs = now - metrics.firstAudioSent;
          log(`Final transcript: ${metrics.timeToFinalTranscriptMs}ms`);
        }
      }

      // Track confidence
      if (transcript.confidence) {
        metrics.transcriptConfidenceSum += transcript.confidence;
        metrics.transcriptCount++;
        metrics.avgTranscriptConfidence = 
          metrics.transcriptConfidenceSum / metrics.transcriptCount;
      }

      onMetricsUpdate?.(metrics);
    },

    /**
     * Record user final message sent to LLM
     */
    recordUserFinalSent: () => {
      metrics.userFinalSent = Date.now();
      metrics.turnCount++;
      log('User final sent');
      
      // Reset per-turn metrics
      metrics.firstTranscript = null;
      metrics.firstFinalTranscript = null;
      metrics.firstAudioSent = null;
      metrics.firstTokenReceived = null;
      metrics.firstAudioReceived = null;
    },

    /**
     * Record first assistant token received
     */
    recordFirstToken: () => {
      if (!metrics.firstTokenReceived) {
        metrics.firstTokenReceived = Date.now();
        if (metrics.userFinalSent) {
          metrics.timeToFirstTokenMs = metrics.firstTokenReceived - metrics.userFinalSent;
          log(`First token: ${metrics.timeToFirstTokenMs}ms`);
        }
      }
      onMetricsUpdate?.(metrics);
    },

    /**
     * Record first assistant audio received
     */
    recordFirstAudio: () => {
      if (!metrics.firstAudioReceived) {
        metrics.firstAudioReceived = Date.now();
        if (metrics.userFinalSent) {
          metrics.timeToFirstAudioMs = metrics.firstAudioReceived - metrics.userFinalSent;
          log(`First audio: ${metrics.timeToFirstAudioMs}ms`);
        }
      }
      onMetricsUpdate?.(metrics);
    },

    /**
     * Record assistant response complete
     */
    recordAssistantComplete: () => {
      metrics.assistantComplete = Date.now();
      if (metrics.userFinalSent) {
        const turnDuration = metrics.assistantComplete - metrics.userFinalSent;
        metrics.totalTurnDurationMs += turnDuration;
        metrics.avgTurnDurationMs = metrics.totalTurnDurationMs / metrics.turnCount;
        log(`Turn complete: ${turnDuration}ms (avg: ${Math.round(metrics.avgTurnDurationMs)}ms)`);
      }
      onMetricsUpdate?.(metrics);
    },

    /**
     * Record barge-in attempt
     * @param {boolean} confirmed - Whether barge-in was confirmed
     * @param {number} latencyMs - Latency from detection to stop
     */
    recordBargeIn: (confirmed, latencyMs = null) => {
      if (confirmed) {
        metrics.bargeInCount++;
        if (latencyMs !== null) {
          metrics.bargeInLatencyMs = latencyMs;
        }
        log(`Barge-in confirmed: ${latencyMs}ms`);
      } else {
        metrics.falseBargeInCount++;
        log('Barge-in rejected');
      }
      onMetricsUpdate?.(metrics);
    },

    /**
     * Get false barge-in rate
     * @returns {number} - Rate as decimal (0-1)
     */
    getFalseBargeRate: () => {
      const total = metrics.bargeInCount + metrics.falseBargeInCount;
      return total > 0 ? metrics.falseBargeInCount / total : 0;
    },

    /**
     * Log debug info (throttled)
     * @param {Object} debugInfo - Debug data to log
     */
    logDebug: (debugInfo) => {
      if (!DEBUG_AUDIO) return;
      
      const now = Date.now();
      if (now - lastDebugLog < DEBUG_LOG_INTERVAL) return;
      lastDebugLog = now;

      console.log('[VoiceMetrics]', {
        ...debugInfo,
        turnCount: metrics.turnCount,
        avgTurnMs: Math.round(metrics.avgTurnDurationMs)
      });
    },

    /**
     * Reset metrics for new session
     */
    reset: () => {
      Object.keys(metrics).forEach(key => {
        if (typeof metrics[key] === 'number') {
          metrics[key] = key.includes('Count') ? 0 : null;
        } else {
          metrics[key] = null;
        }
      });
      metrics.bargeInCount = 0;
      metrics.falseBargeInCount = 0;
      metrics.turnCount = 0;
      metrics.avgTurnDurationMs = 0;
      metrics.totalTurnDurationMs = 0;
      metrics.transcriptConfidenceSum = 0;
      metrics.transcriptCount = 0;
      metrics.avgTranscriptConfidence = 0;
    }
  };

  function log(message) {
    if (DEBUG_AUDIO) {
      console.log(`[VoiceMetrics] ${message}`);
    }
  }

  return collector;
}

/**
 * Format metrics for display
 * @param {Object} metrics
 * @returns {Object} - Formatted metrics
 */
export function formatMetrics(metrics) {
  return {
    'Time to First Transcript': metrics.timeToFirstTranscriptMs 
      ? `${metrics.timeToFirstTranscriptMs}ms` : '-',
    'Time to Final Transcript': metrics.timeToFinalTranscriptMs
      ? `${metrics.timeToFinalTranscriptMs}ms` : '-',
    'Time to First Token': metrics.timeToFirstTokenMs
      ? `${metrics.timeToFirstTokenMs}ms` : '-',
    'Time to First Audio': metrics.timeToFirstAudioMs
      ? `${metrics.timeToFirstAudioMs}ms` : '-',
    'Barge-in Latency': metrics.bargeInLatencyMs
      ? `${metrics.bargeInLatencyMs}ms` : '-',
    'Turn Count': metrics.turnCount,
    'Avg Turn Duration': metrics.avgTurnDurationMs
      ? `${Math.round(metrics.avgTurnDurationMs)}ms` : '-',
    'Barge-ins': `${metrics.bargeInCount} confirmed, ${metrics.falseBargeInCount} rejected`,
    'Avg Confidence': metrics.avgTranscriptConfidence
      ? `${(metrics.avgTranscriptConfidence * 100).toFixed(1)}%` : '-'
  };
}

/**
 * Check if debug audio mode is enabled
 * @returns {boolean}
 */
export function isDebugAudioEnabled() {
  return DEBUG_AUDIO;
}

/**
 * Enable/disable debug audio mode
 * @param {boolean} enabled
 */
export function setDebugAudioEnabled(enabled) {
  if (typeof localStorage !== 'undefined') {
    if (enabled) {
      localStorage.setItem('DEBUG_AUDIO', 'true');
    } else {
      localStorage.removeItem('DEBUG_AUDIO');
    }
  }
}

export default {
  createMetricsCollector,
  formatMetrics,
  isDebugAudioEnabled,
  setDebugAudioEnabled
};

