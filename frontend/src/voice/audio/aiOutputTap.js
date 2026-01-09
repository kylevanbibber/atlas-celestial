/**
 * AI Output Tap Module
 * Handles playback of AI audio with volume control and fingerprint extraction
 */

import { getAudioContext, resumeAudioContext } from './micCapture';
import { createFingerprintGenerator } from './fingerprint';

/**
 * Create AI output player with volume control and fingerprinting
 * @param {Object} options
 * @param {Function} options.onFingerprint - Called with fingerprint data for echo detection
 * @param {Function} options.onPlaybackStart - Called when audio starts playing
 * @param {Function} options.onPlaybackEnd - Called when audio finishes
 * @param {Function} options.onPlaybackProgress - Called with progress updates
 * @returns {Object} - Player instance
 */
export function createAIOutputPlayer(options = {}) {
  const {
    onFingerprint,
    onPlaybackStart,
    onPlaybackEnd,
    onPlaybackProgress
  } = options;

  let audioContext = null;
  let gainNode = null;
  let currentSource = null;
  let isPlaying = false;
  let audioQueue = [];
  let isProcessingQueue = false;
  let playbackStartTime = null;
  let totalDuration = 0;
  let chunkBuffer = []; // Buffer for accumulating small chunks
  let bufferTimer = null; // Timer for flushing buffer

  const fingerprintGenerator = createFingerprintGenerator();

  // Initialize audio context and gain node
  async function ensureInitialized() {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = await resumeAudioContext();
    }
    
    if (!gainNode) {
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
    }

    return { audioContext, gainNode };
  }

  /**
   * Decode MP3 audio data
   * @param {ArrayBuffer} audioData
   * @returns {Promise<AudioBuffer>}
   */
  async function decodeAudio(audioData) {
    const { audioContext } = await ensureInitialized();
    return await audioContext.decodeAudioData(audioData.slice(0));
  }

  /**
   * Extract fingerprints from AudioBuffer for echo detection
   * @param {AudioBuffer} audioBuffer
   */
  function extractFingerprints(audioBuffer) {
    if (!onFingerprint) return;

    const channelData = audioBuffer.getChannelData(0);
    const fingerprints = fingerprintGenerator.generateFrames(channelData);
    
    fingerprints.forEach(fp => {
      onFingerprint(fp);
    });
  }

  /**
   * Process next item in audio queue
   */
  async function processQueue() {
    if (isProcessingQueue || audioQueue.length === 0) {
      return;
    }

    isProcessingQueue = true;

    while (audioQueue.length > 0) {
      const audioData = audioQueue.shift();
      
      try {
        await playAudioBuffer(audioData);
      } catch (err) {
        console.error('[AIOutput] Error playing audio:', err);
      }
    }

    isProcessingQueue = false;
    
    // All audio finished
    if (!isPlaying) {
      onPlaybackEnd?.();
    }
  }

  /**
   * Play a single audio buffer
   * @param {ArrayBuffer} audioData - Raw audio data (MP3)
   */
  async function playAudioBuffer(audioData) {
    const { audioContext, gainNode } = await ensureInitialized();
    
    // Decode audio
    const audioBuffer = await decodeAudio(audioData);
    
    // Extract fingerprints for echo detection
    extractFingerprints(audioBuffer);
    
    // Create and play source
    return new Promise((resolve) => {
      currentSource = audioContext.createBufferSource();
      currentSource.buffer = audioBuffer;
      currentSource.connect(gainNode);
      
      if (!isPlaying) {
        isPlaying = true;
        playbackStartTime = Date.now();
        onPlaybackStart?.();
      }
      
      totalDuration += audioBuffer.duration;
      
      currentSource.onended = () => {
        currentSource = null;
        
        // Check if more audio in queue
        if (audioQueue.length === 0) {
          isPlaying = false;
        }
        
        resolve();
      };
      
      currentSource.start();
    });
  }

  /**
   * Flush accumulated chunks
   */
  function flushChunkBuffer() {
    if (chunkBuffer.length === 0) return;
    
    // Combine all buffered chunks into one
    const totalLength = chunkBuffer.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunkBuffer) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    // Add combined buffer to queue
    audioQueue.push(combined.buffer);
    chunkBuffer = [];
    
    // Process the queue
    processQueue();
  }

  const player = {
    /**
     * Queue audio data for playback
     * @param {ArrayBuffer|string} audioData - Raw audio data or base64 encoded
     */
    queueAudio: async (audioData) => {
      // Convert base64 to ArrayBuffer if needed
      let buffer = audioData;
      if (typeof audioData === 'string') {
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        buffer = bytes.buffer;
      }

      // Buffer small chunks to create larger, more decodable chunks
      chunkBuffer.push(buffer);
      
      // Clear existing timer
      if (bufferTimer) {
        clearTimeout(bufferTimer);
      }
      
      // Flush buffer if it's large enough (>50KB) or after a delay
      const totalBufferSize = chunkBuffer.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      if (totalBufferSize > 50000) {
        // Large enough, flush immediately
        flushChunkBuffer();
      } else {
        // Wait a bit for more chunks
        bufferTimer = setTimeout(() => {
          flushChunkBuffer();
        }, 100); // 100ms buffer window
      }
    },

    /**
     * Stop playback immediately
     */
    stop: () => {
      // Stop current source
      if (currentSource) {
        try {
          currentSource.stop();
        } catch (e) {
          // May already be stopped
        }
        currentSource = null;
      }

      // Clear timers
      if (bufferTimer) {
        clearTimeout(bufferTimer);
        bufferTimer = null;
      }

      // Clear all buffers and queue
      chunkBuffer = [];
      audioQueue = [];
      isPlaying = false;
      isProcessingQueue = false;
      playbackStartTime = null;
      totalDuration = 0;
    },

    /**
     * Set volume (0-1)
     * @param {number} volume
     */
    setVolume: (volume) => {
      if (gainNode) {
        gainNode.gain.value = Math.max(0, Math.min(1, volume));
      }
    },

    /**
     * Get current volume
     * @returns {number}
     */
    getVolume: () => gainNode?.gain.value || 1,

    /**
     * Duck volume temporarily
     * @param {number} duckLevel - Target volume during duck (0-1)
     * @param {number} rampMs - Ramp time in ms
     */
    duck: (duckLevel = 0.2, rampMs = 50) => {
      if (!gainNode || !audioContext) return;
      
      const now = audioContext.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(duckLevel, now + rampMs / 1000);
    },

    /**
     * Restore volume from duck
     * @param {number} rampMs - Ramp time in ms
     */
    restore: (rampMs = 200) => {
      if (!gainNode || !audioContext) return;
      
      const now = audioContext.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(1.0, now + rampMs / 1000);
    },

    /**
     * Check if currently playing
     * @returns {boolean}
     */
    isPlaying: () => isPlaying,

    /**
     * Get queue length
     * @returns {number}
     */
    getQueueLength: () => audioQueue.length,

    /**
     * Get gain node for external control
     * @returns {GainNode|null}
     */
    getGainNode: () => gainNode,

    /**
     * Get playback duration so far
     * @returns {number} - Duration in ms
     */
    getPlaybackDuration: () => {
      if (!playbackStartTime) return 0;
      return Date.now() - playbackStartTime;
    },

    /**
     * Clean up resources
     */
    cleanup: () => {
      // Flush any remaining chunks before stopping
      if (chunkBuffer.length > 0) {
        flushChunkBuffer();
      }
      
      player.stop();
      gainNode = null;
      // Don't close audioContext - it's shared
    }
  };

  return player;
}

/**
 * Create simple audio player without fingerprinting (for fallback mode)
 * @returns {Object}
 */
export function createSimplePlayer() {
  let audioElement = null;
  let audioQueue = [];
  let isPlaying = false;

  return {
    queueAudio: (base64Data) => {
      const blob = base64ToBlob(base64Data, 'audio/mpeg');
      const url = URL.createObjectURL(blob);
      audioQueue.push(url);
      processNextAudio();
    },

    stop: () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      audioQueue.forEach(url => URL.revokeObjectURL(url));
      audioQueue = [];
      isPlaying = false;
    },

    setVolume: (volume) => {
      if (audioElement) {
        audioElement.volume = Math.max(0, Math.min(1, volume));
      }
    },

    isPlaying: () => isPlaying
  };

  function processNextAudio() {
    if (isPlaying || audioQueue.length === 0) return;

    const url = audioQueue.shift();
    isPlaying = true;

    if (!audioElement) {
      audioElement = new Audio();
    }

    audioElement.src = url;
    audioElement.onended = () => {
      URL.revokeObjectURL(url);
      isPlaying = false;
      processNextAudio();
    };
    audioElement.onerror = () => {
      URL.revokeObjectURL(url);
      isPlaying = false;
      processNextAudio();
    };
    audioElement.play().catch(err => {
      console.error('[SimplePlayer] Play error:', err);
      isPlaying = false;
      processNextAudio();
    });
  }
}

/**
 * Convert base64 to Blob
 * @param {string} base64 
 * @param {string} mimeType 
 * @returns {Blob}
 */
function base64ToBlob(base64, mimeType) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export default {
  createAIOutputPlayer,
  createSimplePlayer
};

