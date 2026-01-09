/**
 * Turn State Controller
 * Server-authoritative state machine for voice session turn management
 */

// Turn states
const TURN_STATE = {
  IDLE: 'IDLE',
  AI_SPEAKING: 'AI_SPEAKING',
  USER_SPEAKING: 'USER_SPEAKING',
  USER_INTERRUPTING: 'USER_INTERRUPTING',
  PROCESSING: 'PROCESSING'
};

/**
 * Create a turn controller for a voice session
 * @returns {Object} - Turn controller instance
 */
function createTurnController() {
  let currentState = TURN_STATE.IDLE;
  let stateTimestamp = Date.now();
  let interruptionStart = null;
  let listeners = [];

  // Metrics tracking
  const metrics = {
    interruptionCount: 0,
    confirmedInterruptions: 0,
    falseInterruptions: 0,
    totalAISpeakingTime: 0,
    totalUserSpeakingTime: 0,
    lastAISpeakingStart: null,
    lastUserSpeakingStart: null
  };

  const controller = {
    /**
     * Get current turn state
     * @returns {string}
     */
    getState: () => currentState,

    /**
     * Get state with timestamp
     * @returns {{ state: string, timestamp: number }}
     */
    getStateInfo: () => ({
      state: currentState,
      timestamp: stateTimestamp,
      duration: Date.now() - stateTimestamp
    }),

    /**
     * Get metrics
     * @returns {Object}
     */
    getMetrics: () => ({ ...metrics }),

    /**
     * Transition to a new state
     * @param {string} newState - Target state
     * @param {Object} context - Optional context data
     * @returns {boolean} - Whether transition was valid
     */
    transition: (newState, context = {}) => {
      const previousState = currentState;
      const now = Date.now();

      // Validate transition
      if (!isValidTransition(currentState, newState)) {
        console.warn(`[TurnController] Invalid transition: ${currentState} -> ${newState}`);
        return false;
      }

      // Update metrics based on state change
      updateMetrics(previousState, newState, now, metrics);

      // Perform transition
      currentState = newState;
      stateTimestamp = now;

      // Track interruption timing
      if (newState === TURN_STATE.USER_INTERRUPTING) {
        interruptionStart = now;
        metrics.interruptionCount++;
      } else if (previousState === TURN_STATE.USER_INTERRUPTING) {
        if (newState === TURN_STATE.USER_SPEAKING) {
          metrics.confirmedInterruptions++;
        } else {
          metrics.falseInterruptions++;
        }
        interruptionStart = null;
      }

      // Notify listeners
      const event = {
        previousState,
        newState,
        timestamp: now,
        context
      };
      listeners.forEach(fn => {
        try {
          fn(event);
        } catch (err) {
          console.error('[TurnController] Listener error:', err);
        }
      });

      console.log(`[TurnController] ${previousState} -> ${newState}`);
      return true;
    },

    /**
     * Force state (for recovery/sync)
     * @param {string} state
     */
    forceState: (state) => {
      if (TURN_STATE[state]) {
        currentState = state;
        stateTimestamp = Date.now();
      }
    },

    /**
     * Check if user can speak
     * @returns {boolean}
     */
    canUserSpeak: () => {
      return [TURN_STATE.IDLE, TURN_STATE.USER_SPEAKING, TURN_STATE.USER_INTERRUPTING].includes(currentState);
    },

    /**
     * Check if AI can speak
     * @returns {boolean}
     */
    canAISpeak: () => {
      return [TURN_STATE.IDLE, TURN_STATE.PROCESSING].includes(currentState);
    },

    /**
     * Check if interruption is possible
     * @returns {boolean}
     */
    canInterrupt: () => {
      return currentState === TURN_STATE.AI_SPEAKING;
    },

    /**
     * Start AI speaking
     * @returns {boolean}
     */
    startAISpeaking: () => {
      return controller.transition(TURN_STATE.AI_SPEAKING);
    },

    /**
     * End AI speaking
     * @returns {boolean}
     */
    endAISpeaking: () => {
      if (currentState === TURN_STATE.AI_SPEAKING) {
        return controller.transition(TURN_STATE.IDLE);
      }
      return false;
    },

    /**
     * Start user speaking
     * @returns {boolean}
     */
    startUserSpeaking: () => {
      if (currentState === TURN_STATE.AI_SPEAKING) {
        return controller.transition(TURN_STATE.USER_INTERRUPTING);
      }
      return controller.transition(TURN_STATE.USER_SPEAKING);
    },

    /**
     * Confirm interruption
     * @returns {boolean}
     */
    confirmInterruption: () => {
      if (currentState === TURN_STATE.USER_INTERRUPTING) {
        return controller.transition(TURN_STATE.USER_SPEAKING);
      }
      return false;
    },

    /**
     * Reject interruption (false positive)
     * @returns {boolean}
     */
    rejectInterruption: () => {
      if (currentState === TURN_STATE.USER_INTERRUPTING) {
        return controller.transition(TURN_STATE.AI_SPEAKING);
      }
      return false;
    },

    /**
     * End user speaking and start processing
     * @returns {boolean}
     */
    endUserSpeaking: () => {
      if (currentState === TURN_STATE.USER_SPEAKING) {
        return controller.transition(TURN_STATE.PROCESSING);
      }
      return false;
    },

    /**
     * Reset to idle
     */
    reset: () => {
      currentState = TURN_STATE.IDLE;
      stateTimestamp = Date.now();
      interruptionStart = null;
    },

    /**
     * Add state change listener
     * @param {Function} callback
     * @returns {Function} - Unsubscribe function
     */
    onStateChange: (callback) => {
      listeners.push(callback);
      return () => {
        listeners = listeners.filter(fn => fn !== callback);
      };
    },

    /**
     * Get interruption latency if currently interrupting
     * @returns {number|null}
     */
    getInterruptionLatency: () => {
      if (interruptionStart) {
        return Date.now() - interruptionStart;
      }
      return null;
    }
  };

  return controller;
}

/**
 * Validate state transition
 * @param {string} from - Current state
 * @param {string} to - Target state
 * @returns {boolean}
 */
function isValidTransition(from, to) {
  const validTransitions = {
    [TURN_STATE.IDLE]: [TURN_STATE.AI_SPEAKING, TURN_STATE.USER_SPEAKING, TURN_STATE.PROCESSING],
    [TURN_STATE.AI_SPEAKING]: [TURN_STATE.IDLE, TURN_STATE.USER_INTERRUPTING],
    [TURN_STATE.USER_SPEAKING]: [TURN_STATE.IDLE, TURN_STATE.PROCESSING],
    [TURN_STATE.USER_INTERRUPTING]: [TURN_STATE.USER_SPEAKING, TURN_STATE.AI_SPEAKING, TURN_STATE.IDLE],
    [TURN_STATE.PROCESSING]: [TURN_STATE.AI_SPEAKING, TURN_STATE.IDLE]
  };

  return validTransitions[from]?.includes(to) || false;
}

/**
 * Update metrics on state change
 */
function updateMetrics(previousState, newState, now, metrics) {
  // Track AI speaking time
  if (previousState === TURN_STATE.AI_SPEAKING && metrics.lastAISpeakingStart) {
    metrics.totalAISpeakingTime += now - metrics.lastAISpeakingStart;
    metrics.lastAISpeakingStart = null;
  }
  if (newState === TURN_STATE.AI_SPEAKING) {
    metrics.lastAISpeakingStart = now;
  }

  // Track user speaking time
  if (previousState === TURN_STATE.USER_SPEAKING && metrics.lastUserSpeakingStart) {
    metrics.totalUserSpeakingTime += now - metrics.lastUserSpeakingStart;
    metrics.lastUserSpeakingStart = null;
  }
  if (newState === TURN_STATE.USER_SPEAKING) {
    metrics.lastUserSpeakingStart = now;
  }
}

module.exports = {
  TURN_STATE,
  createTurnController
};

