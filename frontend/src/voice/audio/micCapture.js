/**
 * Microphone Capture Module
 * Handles getUserMedia and audio processing for voice input
 */

// Audio context singleton
let audioContext = null;

/**
 * Get or create AudioContext
 * @returns {AudioContext}
 */
export function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000 // Match Deepgram expected rate
    });
  }
  return audioContext;
}

/**
 * Resume AudioContext (required after user gesture)
 */
export async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
}

/**
 * Create microphone capture session
 * @param {Object} options - Capture options
 * @param {Function} options.onAudioData - Called with PCM16 audio chunks (Int16Array)
 * @param {Function} options.onRmsLevel - Called with RMS level (0-1) at ~20Hz
 * @param {Function} options.onError - Called on error
 * @param {number} options.chunkSize - Samples per chunk (default 4096)
 * @returns {Object} - Capture session with start/stop/mute methods
 */
export function createMicCapture(options = {}) {
  const {
    onAudioData,
    onRmsLevel,
    onError,
    chunkSize = 4096
  } = options;

  let stream = null;
  let sourceNode = null;
  let processorNode = null;
  let analyserNode = null;
  let isMuted = false;
  let isActive = false;
  let rmsInterval = null;

  const session = {
    /**
     * Start capturing
     */
    start: async () => {
      if (isActive) return;

      try {
        // Get user media with echo cancellation
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1
          }
        });

        const ctx = await resumeAudioContext();

        // Create source from stream
        sourceNode = ctx.createMediaStreamSource(stream);

        // Create analyser for RMS metering
        analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.3;

        // Create script processor for raw audio data
        // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
        processorNode = ctx.createScriptProcessor(chunkSize, 1, 1);

        processorNode.onaudioprocess = (event) => {
          if (isMuted || !isActive) return;

          const inputData = event.inputBuffer.getChannelData(0);
          
          // Convert Float32 to Int16 for transmission
          const pcm16 = floatTo16BitPCM(inputData);
          
          onAudioData?.(pcm16);
        };

        // Connect nodes
        sourceNode.connect(analyserNode);
        analyserNode.connect(processorNode);
        processorNode.connect(ctx.destination); // Required for processing to work

        // Start RMS metering
        if (onRmsLevel) {
          const dataArray = new Float32Array(analyserNode.fftSize);
          
          rmsInterval = setInterval(() => {
            if (!isActive || isMuted) {
              onRmsLevel?.(0);
              return;
            }
            
            analyserNode.getFloatTimeDomainData(dataArray);
            const rms = calculateRMS(dataArray);
            onRmsLevel?.(rms);
          }, 50); // ~20Hz
        }

        isActive = true;
        console.log('[MicCapture] Started');

      } catch (err) {
        console.error('[MicCapture] Error starting:', err);
        onError?.(err);
        throw err;
      }
    },

    /**
     * Stop capturing
     */
    stop: () => {
      isActive = false;

      if (rmsInterval) {
        clearInterval(rmsInterval);
        rmsInterval = null;
      }

      if (processorNode) {
        processorNode.disconnect();
        processorNode = null;
      }

      if (analyserNode) {
        analyserNode.disconnect();
        analyserNode = null;
      }

      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }

      console.log('[MicCapture] Stopped');
    },

    /**
     * Mute microphone (still capturing but not sending)
     */
    mute: () => {
      isMuted = true;
    },

    /**
     * Unmute microphone
     */
    unmute: () => {
      isMuted = false;
    },

    /**
     * Check if muted
     */
    isMuted: () => isMuted,

    /**
     * Check if active
     */
    isActive: () => isActive,

    /**
     * Get analyser node for external analysis
     */
    getAnalyser: () => analyserNode
  };

  return session;
}

/**
 * Convert Float32 audio to Int16 PCM
 * @param {Float32Array} float32Array
 * @returns {Int16Array}
 */
function floatTo16BitPCM(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to -1 to 1
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // Convert to 16-bit integer
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return int16Array;
}

/**
 * Calculate RMS level from audio samples
 * @param {Float32Array} samples
 * @returns {number} - RMS value 0-1
 */
function calculateRMS(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Convert Int16Array to base64 for transmission
 * @param {Int16Array} int16Array
 * @returns {string}
 */
export function int16ToBase64(int16Array) {
  const buffer = int16Array.buffer;
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Check if microphone is available
 * @returns {Promise<boolean>}
 */
export async function isMicrophoneAvailable() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(device => device.kind === 'audioinput');
  } catch {
    return false;
  }
}

export default {
  createMicCapture,
  getAudioContext,
  resumeAudioContext,
  int16ToBase64,
  isMicrophoneAvailable
};

