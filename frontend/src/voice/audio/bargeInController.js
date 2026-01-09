/**
 * Barge-In Controller
 * Handles interruption detection with dual-threshold logic and ducking
 */

// Configuration defaults
const DEFAULT_CONFIG = {
  // Energy thresholds
  possibleInterruptThreshold: 0.02,   // RMS level to trigger possible interrupt
  confirmedInterruptThreshold: 0.03,  // RMS level for confirmed interrupt
  
  // Timing thresholds
  possibleInterruptDuration: 100,     // ms of speech to trigger possible
  confirmedInterruptDuration: 400,    // ms of sustained speech to confirm
  
  // Echo detection
  echoSimilarityThreshold: 0.65,      // Similarity score to consider as echo
  
  // Ducking
  duckingGainDb: -15,                 // Volume reduction during possible interrupt
  duckingRampMs: 50,                  // Ramp time for ducking
  restoreRampMs: 200,                 // Ramp time to restore volume
  
  // State
  debugMode: false
};

// Interrupt states
export const INTERRUPT_STATE = {
  NONE: 'NONE',
  POSSIBLE: 'POSSIBLE',
  CONFIRMED: 'CONFIRMED'
};

/**
 * Create barge-in controller
 * @param {Object} options - Configuration options
 * @param {Function} options.onPossibleInterrupt - Called when possible interrupt detected
 * @param {Function} options.onConfirmedInterrupt - Called when interrupt confirmed
 * @param {Function} options.onInterruptRejected - Called when interrupt was false positive
 * @param {Function} options.getEchoSimilarity - Function to get current echo similarity
 * @param {GainNode} options.gainNode - GainNode for volume ducking
 * @returns {Object} - Controller instance
 */
export function createBargeInController(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const {
    onPossibleInterrupt,
    onConfirmedInterrupt,
    onInterruptRejected,
    getEchoSimilarity,
    gainNode
  } = options;

  let state = INTERRUPT_STATE.NONE;
  let speechStartTime = null;
  let possibleStartTime = null;
  let isDucked = false;
  let isEnabled = true;
  let lastRmsTime = 0;
  let rmsHistory = [];

  // Metrics
  let metrics = {
    possibleCount: 0,
    confirmedCount: 0,
    rejectedCount: 0,
    avgConfirmLatencyMs: 0,
    totalConfirmLatencyMs: 0
  };

  const controller = {
    /**
     * Get current interrupt state
     * @returns {string}
     */
    getState: () => state,

    /**
     * Get metrics
     * @returns {Object}
     */
    getMetrics: () => ({ ...metrics }),

    /**
     * Process RMS level update
     * @param {number} rms - Current RMS level (0-1)
     * @param {number} echoSimilarity - Echo similarity score (0-1)
     */
    processRms: (rms, echoSimilarity = 0) => {
      if (!isEnabled) return;

      const now = Date.now();
      const timeSinceLastRms = now - lastRmsTime;
      lastRmsTime = now;

      // Update RMS history (keep last 500ms)
      rmsHistory.push({ rms, timestamp: now });
      const cutoff = now - 500;
      rmsHistory = rmsHistory.filter(r => r.timestamp > cutoff);

      // Skip if this looks like echo
      if (echoSimilarity >= config.echoSimilarityThreshold) {
        if (config.debugMode) {
          console.log('[BargeIn] Echo detected, ignoring:', echoSimilarity.toFixed(2));
        }
        return;
      }

      // Check for speech based on RMS
      const isSpeaking = rms >= config.possibleInterruptThreshold;

      if (isSpeaking) {
        // Start tracking speech if not already
        if (!speechStartTime) {
          speechStartTime = now;
        }

        const speechDuration = now - speechStartTime;

        // Handle state transitions
        if (state === INTERRUPT_STATE.NONE) {
          // Check for possible interrupt
          if (speechDuration >= config.possibleInterruptDuration) {
            state = INTERRUPT_STATE.POSSIBLE;
            possibleStartTime = now;
            metrics.possibleCount++;

            // Apply ducking
            duckVolume();

            if (config.debugMode) {
              console.log('[BargeIn] POSSIBLE interrupt detected');
            }

            onPossibleInterrupt?.({
              rms,
              speechDuration,
              timestamp: now
            });
          }
        } else if (state === INTERRUPT_STATE.POSSIBLE) {
          // Check for confirmed interrupt
          const possibleDuration = now - possibleStartTime;
          
          // Require sustained speech above confirmed threshold
          if (speechDuration >= config.confirmedInterruptDuration &&
              rms >= config.confirmedInterruptThreshold) {
            
            state = INTERRUPT_STATE.CONFIRMED;
            metrics.confirmedCount++;
            
            const latency = now - possibleStartTime;
            metrics.totalConfirmLatencyMs += latency;
            metrics.avgConfirmLatencyMs = metrics.totalConfirmLatencyMs / metrics.confirmedCount;

            if (config.debugMode) {
              console.log('[BargeIn] CONFIRMED interrupt, latency:', latency, 'ms');
            }

            onConfirmedInterrupt?.({
              rms,
              speechDuration,
              latencyMs: latency,
              timestamp: now
            });
          }
        }
      } else {
        // No speech detected
        if (speechStartTime) {
          const speechDuration = now - speechStartTime;
          
          // If we were in POSSIBLE state but speech stopped, reject
          if (state === INTERRUPT_STATE.POSSIBLE && speechDuration < config.confirmedInterruptDuration) {
            state = INTERRUPT_STATE.NONE;
            metrics.rejectedCount++;

            // Restore volume
            restoreVolume();

            if (config.debugMode) {
              console.log('[BargeIn] Interrupt REJECTED (speech stopped)');
            }

            onInterruptRejected?.({
              speechDuration,
              timestamp: now
            });
          }

          speechStartTime = null;
        }
      }
    },

    /**
     * Reset controller state
     */
    reset: () => {
      state = INTERRUPT_STATE.NONE;
      speechStartTime = null;
      possibleStartTime = null;
      rmsHistory = [];
      restoreVolume();
    },

    /**
     * Enable/disable controller
     * @param {boolean} enabled
     */
    setEnabled: (enabled) => {
      isEnabled = enabled;
      if (!enabled) {
        controller.reset();
      }
    },

    /**
     * Check if enabled
     * @returns {boolean}
     */
    isEnabled: () => isEnabled,

    /**
     * Force confirm interrupt (from external source)
     */
    forceConfirm: () => {
      if (state !== INTERRUPT_STATE.CONFIRMED) {
        state = INTERRUPT_STATE.CONFIRMED;
        metrics.confirmedCount++;
        
        onConfirmedInterrupt?.({
          forced: true,
          timestamp: Date.now()
        });
      }
    },

    /**
     * Update configuration
     * @param {Object} newConfig
     */
    updateConfig: (newConfig) => {
      Object.assign(config, newConfig);
    }
  };

  /**
   * Apply volume ducking
   */
  function duckVolume() {
    if (!gainNode || isDucked) return;

    const ctx = gainNode.context;
    const now = ctx.currentTime;
    const targetGain = Math.pow(10, config.duckingGainDb / 20);
    
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + config.duckingRampMs / 1000);
    
    isDucked = true;
  }

  /**
   * Restore volume from ducking
   */
  function restoreVolume() {
    if (!gainNode || !isDucked) return;

    const ctx = gainNode.context;
    const now = ctx.currentTime;
    
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(1.0, now + config.restoreRampMs / 1000);
    
    isDucked = false;
  }

  return controller;
}

export default {
  createBargeInController,
  INTERRUPT_STATE
};

