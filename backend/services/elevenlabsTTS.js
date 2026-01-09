/**
 * ElevenLabs TTS Streaming Service
 * Handles text-to-speech generation with streaming audio
 */

const https = require('https');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah - natural conversational
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5'; // Fastest model

// ElevenLabs streaming endpoint
const ELEVENLABS_API_BASE = 'api.elevenlabs.io';

/**
 * Generate speech from text with streaming
 * @param {string} text - Text to convert to speech
 * @param {Object} options - Generation options
 * @param {Function} options.onAudioChunk - Called with each audio chunk (Buffer)
 * @param {Function} options.onComplete - Called when generation completes
 * @param {Function} options.onError - Called on error
 * @param {AbortSignal} options.signal - AbortController signal for cancellation
 * @returns {Promise<void>}
 */
async function streamSpeech(text, options = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const { onAudioChunk, onComplete, onError, signal } = options;
  const voiceId = options.voiceId || ELEVENLABS_VOICE_ID;
  const modelId = options.modelId || ELEVENLABS_MODEL_ID;

  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const postData = JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    });

    const requestOptions = {
      hostname: ELEVENLABS_API_BASE,
      port: 443,
      path: `/v1/text-to-speech/${voiceId}/stream`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Accept': 'audio/mpeg',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        let errorBody = '';
        res.on('data', chunk => errorBody += chunk);
        res.on('end', () => {
          const error = new Error(`ElevenLabs API error: ${res.statusCode} - ${errorBody}`);
          onError?.(error);
          reject(error);
        });
        return;
      }

      // Stream audio chunks
      res.on('data', (chunk) => {
        if (!signal?.aborted) {
          onAudioChunk?.(chunk);
        }
      });

      res.on('end', () => {
        if (!signal?.aborted) {
          onComplete?.();
          resolve();
        }
      });

      res.on('error', (error) => {
        onError?.(error);
        reject(error);
      });
    });

    req.on('error', (error) => {
      onError?.(error);
      reject(error);
    });

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Aborted'));
      }, { once: true });
    }

    req.write(postData);
    req.end();
  });
}

/**
 * Generate speech with chunked text for lower latency
 * Splits text at sentence boundaries and streams progressively
 * @param {string} text - Full text to convert
 * @param {Object} options - Same as streamSpeech
 * @returns {Promise<void>}
 */
async function streamSpeechChunked(text, options = {}) {
  const { signal } = options;
  
  // Split text into sentence chunks for progressive TTS
  const chunks = splitIntoChunks(text);
  
  for (const chunk of chunks) {
    if (signal?.aborted) break;
    
    await streamSpeech(chunk, options);
  }
}

/**
 * Split text into sentence-like chunks for streaming
 * @param {string} text - Text to split
 * @param {number} maxChunkLength - Maximum characters per chunk
 * @returns {string[]}
 */
function splitIntoChunks(text, maxChunkLength = 200) {
  if (!text || text.length <= maxChunkLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  // Split on sentence boundaries
  const sentenceEnders = /([.!?]+\s+)/g;
  const sentences = remaining.split(sentenceEnders).filter(s => s.trim());

  let currentChunk = '';

  for (const part of sentences) {
    if ((currentChunk + part).length <= maxChunkLength) {
      currentChunk += part;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = part;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

/**
 * Get available voices
 * @returns {Promise<Array>}
 */
async function getVoices() {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: ELEVENLABS_API_BASE,
      port: 443,
      path: '/v1/voices',
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const voices = JSON.parse(data);
          resolve(voices.voices || []);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Check if ElevenLabs is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!ELEVENLABS_API_KEY;
}

module.exports = {
  streamSpeech,
  streamSpeechChunked,
  splitIntoChunks,
  getVoices,
  isConfigured
};

