/**
 * Audio Fingerprinting Module
 * Creates lightweight audio fingerprints for echo/self-listening detection
 */

// Configuration
const FRAME_SIZE = 20; // ms per frame
const SAMPLE_RATE = 16000;
const NUM_BANDS = 8; // Number of frequency bands
const BUFFER_DURATION = 2000; // ms of history to keep
const SIMILARITY_THRESHOLD = 0.7; // Threshold for match detection
const DRIFT_WINDOW = 150; // ms drift tolerance for matching

/**
 * Create a fingerprint generator for an audio source
 * @param {Object} options
 * @param {number} options.sampleRate - Audio sample rate
 * @param {number} options.frameSize - Frame size in ms
 * @param {number} options.numBands - Number of frequency bands
 * @returns {Object} - Fingerprint generator
 */
export function createFingerprintGenerator(options = {}) {
  const {
    sampleRate = SAMPLE_RATE,
    frameSize = FRAME_SIZE,
    numBands = NUM_BANDS
  } = options;

  const samplesPerFrame = Math.floor(sampleRate * frameSize / 1000);
  
  return {
    /**
     * Generate fingerprint from audio samples
     * @param {Float32Array|Int16Array} samples - Audio samples
     * @returns {Object} - Fingerprint with rms and bands
     */
    generate: (samples) => {
      // Convert Int16 to Float32 if needed
      let floatSamples = samples;
      if (samples instanceof Int16Array) {
        floatSamples = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          floatSamples[i] = samples[i] / 32768;
        }
      }

      // Calculate RMS energy
      let sumSquares = 0;
      for (let i = 0; i < floatSamples.length; i++) {
        sumSquares += floatSamples[i] * floatSamples[i];
      }
      const rms = Math.sqrt(sumSquares / floatSamples.length);

      // Calculate band energies using simple bandpass approximation
      const bands = calculateBandEnergies(floatSamples, sampleRate, numBands);

      return {
        timestamp: Date.now(),
        rms,
        bands,
        sampleCount: floatSamples.length
      };
    },

    /**
     * Generate fingerprints for multiple frames
     * @param {Float32Array|Int16Array} samples
     * @returns {Array} - Array of fingerprints
     */
    generateFrames: (samples) => {
      const fingerprints = [];
      const generator = createFingerprintGenerator(options);

      for (let i = 0; i < samples.length; i += samplesPerFrame) {
        const frameEnd = Math.min(i + samplesPerFrame, samples.length);
        const frame = samples.slice(i, frameEnd);
        
        if (frame.length >= samplesPerFrame / 2) {
          fingerprints.push(generator.generate(frame));
        }
      }

      return fingerprints;
    }
  };
}

/**
 * Calculate band energies for frequency analysis
 * Simple approximation without FFT for CPU efficiency
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number} numBands
 * @returns {Float32Array}
 */
function calculateBandEnergies(samples, sampleRate, numBands) {
  const bands = new Float32Array(numBands);
  const bandSize = Math.floor(samples.length / numBands);

  // Simple band energy calculation using sample variance in regions
  // This is a crude approximation but very fast
  for (let b = 0; b < numBands; b++) {
    let sum = 0;
    const start = b * bandSize;
    const end = Math.min((b + 1) * bandSize, samples.length);
    
    for (let i = start; i < end; i++) {
      sum += Math.abs(samples[i]);
    }
    
    bands[b] = sum / (end - start);
  }

  // Normalize bands
  const maxBand = Math.max(...bands) || 1;
  for (let b = 0; b < numBands; b++) {
    bands[b] /= maxBand;
  }

  return bands;
}

/**
 * Create a fingerprint ring buffer for storing history
 * @param {number} durationMs - Buffer duration in ms
 * @param {number} frameSize - Frame size in ms
 * @returns {Object} - Ring buffer
 */
export function createFingerprintBuffer(durationMs = BUFFER_DURATION, frameSize = FRAME_SIZE) {
  const maxFrames = Math.ceil(durationMs / frameSize);
  const buffer = [];

  return {
    /**
     * Add fingerprint to buffer
     * @param {Object} fingerprint
     */
    add: (fingerprint) => {
      buffer.push(fingerprint);
      
      // Remove old fingerprints
      const cutoff = Date.now() - durationMs;
      while (buffer.length > 0 && buffer[0].timestamp < cutoff) {
        buffer.shift();
      }

      // Also enforce max frames
      while (buffer.length > maxFrames) {
        buffer.shift();
      }
    },

    /**
     * Get all fingerprints
     * @returns {Array}
     */
    getAll: () => [...buffer],

    /**
     * Get fingerprints within time range
     * @param {number} startTime
     * @param {number} endTime
     * @returns {Array}
     */
    getRange: (startTime, endTime) => {
      return buffer.filter(fp => 
        fp.timestamp >= startTime && fp.timestamp <= endTime
      );
    },

    /**
     * Clear buffer
     */
    clear: () => {
      buffer.length = 0;
    },

    /**
     * Get buffer size
     * @returns {number}
     */
    size: () => buffer.length
  };
}

/**
 * Compare two fingerprints for similarity
 * @param {Object} fp1 - First fingerprint
 * @param {Object} fp2 - Second fingerprint
 * @returns {number} - Similarity score 0-1
 */
export function compareFingerprints(fp1, fp2) {
  if (!fp1 || !fp2 || !fp1.bands || !fp2.bands) {
    return 0;
  }

  // RMS difference (normalized)
  const rmsWeight = 0.4;
  const rmsDiff = Math.abs(fp1.rms - fp2.rms);
  const rmsScore = 1 - Math.min(rmsDiff * 2, 1);

  // Band energy correlation
  const bandWeight = 0.6;
  let bandCorrelation = 0;
  const numBands = Math.min(fp1.bands.length, fp2.bands.length);

  if (numBands > 0) {
    let sumProduct = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < numBands; i++) {
      sumProduct += fp1.bands[i] * fp2.bands[i];
      sum1Sq += fp1.bands[i] * fp1.bands[i];
      sum2Sq += fp2.bands[i] * fp2.bands[i];
    }

    const denom = Math.sqrt(sum1Sq * sum2Sq);
    bandCorrelation = denom > 0 ? sumProduct / denom : 0;
  }

  return rmsWeight * rmsScore + bandWeight * bandCorrelation;
}

/**
 * Create echo detector using AI output fingerprints
 * @param {Object} options
 * @param {number} options.threshold - Similarity threshold for echo detection
 * @param {number} options.driftWindow - Time drift tolerance in ms
 * @returns {Object} - Echo detector
 */
export function createEchoDetector(options = {}) {
  const {
    threshold = SIMILARITY_THRESHOLD,
    driftWindow = DRIFT_WINDOW
  } = options;

  const aiBuffer = createFingerprintBuffer();
  const generator = createFingerprintGenerator();

  return {
    /**
     * Add AI output fingerprint
     * @param {Object} fingerprint
     */
    addAIFingerprint: (fingerprint) => {
      aiBuffer.add(fingerprint);
    },

    /**
     * Add AI output audio samples
     * @param {Float32Array|Int16Array} samples
     */
    addAIAudio: (samples) => {
      const fingerprints = generator.generateFrames(samples);
      fingerprints.forEach(fp => aiBuffer.add(fp));
    },

    /**
     * Check if mic input matches recent AI output (echo detection)
     * @param {Object} micFingerprint - Mic input fingerprint
     * @returns {{ isEcho: boolean, similarity: number, matchedTimestamp: number|null }}
     */
    checkEcho: (micFingerprint) => {
      if (!micFingerprint) {
        return { isEcho: false, similarity: 0, matchedTimestamp: null };
      }

      const now = micFingerprint.timestamp;
      const searchStart = now - driftWindow;
      const searchEnd = now + driftWindow;

      const candidates = aiBuffer.getRange(searchStart - 1000, searchEnd);
      
      let maxSimilarity = 0;
      let matchedTimestamp = null;

      for (const aiFingerprint of candidates) {
        const similarity = compareFingerprints(micFingerprint, aiFingerprint);
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          matchedTimestamp = aiFingerprint.timestamp;
        }
      }

      return {
        isEcho: maxSimilarity >= threshold,
        similarity: maxSimilarity,
        matchedTimestamp
      };
    },

    /**
     * Check mic audio for echo
     * @param {Float32Array|Int16Array} samples
     * @returns {{ isEcho: boolean, maxSimilarity: number }}
     */
    checkEchoAudio: (samples) => {
      const fingerprints = generator.generateFrames(samples);
      
      let maxSimilarity = 0;
      let anyEcho = false;

      for (const fp of fingerprints) {
        const result = echoDetector.checkEcho(fp);
        if (result.similarity > maxSimilarity) {
          maxSimilarity = result.similarity;
        }
        if (result.isEcho) {
          anyEcho = true;
        }
      }

      return { isEcho: anyEcho, maxSimilarity };
    },

    /**
     * Clear AI buffer
     */
    clear: () => {
      aiBuffer.clear();
    },

    /**
     * Get buffer size
     * @returns {number}
     */
    getBufferSize: () => aiBuffer.size()
  };

  const echoDetector = {
    addAIFingerprint: (fp) => aiBuffer.add(fp),
    addAIAudio: (samples) => {
      const fps = generator.generateFrames(samples);
      fps.forEach(fp => aiBuffer.add(fp));
    },
    checkEcho: (micFp) => {
      if (!micFp) return { isEcho: false, similarity: 0, matchedTimestamp: null };
      
      const now = micFp.timestamp;
      const candidates = aiBuffer.getRange(now - driftWindow - 1000, now + driftWindow);
      
      let maxSim = 0;
      let matchTs = null;
      
      for (const aiFp of candidates) {
        const sim = compareFingerprints(micFp, aiFp);
        if (sim > maxSim) {
          maxSim = sim;
          matchTs = aiFp.timestamp;
        }
      }
      
      return { isEcho: maxSim >= threshold, similarity: maxSim, matchedTimestamp: matchTs };
    },
    checkEchoAudio: (samples) => {
      const fps = generator.generateFrames(samples);
      let maxSim = 0;
      let anyEcho = false;
      
      for (const fp of fps) {
        const result = echoDetector.checkEcho(fp);
        if (result.similarity > maxSim) maxSim = result.similarity;
        if (result.isEcho) anyEcho = true;
      }
      
      return { isEcho: anyEcho, maxSimilarity: maxSim };
    },
    clear: () => aiBuffer.clear(),
    getBufferSize: () => aiBuffer.size()
  };

  return echoDetector;
}

export default {
  createFingerprintGenerator,
  createFingerprintBuffer,
  compareFingerprints,
  createEchoDetector
};

