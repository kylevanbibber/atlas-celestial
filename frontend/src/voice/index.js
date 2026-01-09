/**
 * Voice Module Index
 * Exports all voice-related functionality
 */

export {
  createVoiceEngine,
  isVoiceSupported,
  getVoiceSupportDetails,
  TURN_STATE,
  VOICE_MODE
} from './VoiceEngine';

export { createPremiumVoiceEngine } from './PremiumVoiceEngine';
export { createWebSpeechFallbackEngine } from './WebSpeechFallbackEngine';

export {
  createMetricsCollector,
  formatMetrics,
  isDebugAudioEnabled,
  setDebugAudioEnabled
} from './metrics';

// Audio utilities
export { createMicCapture, int16ToBase64, isMicrophoneAvailable } from './audio/micCapture';
export { createAIOutputPlayer, createSimplePlayer } from './audio/aiOutputTap';
export { createEchoDetector, createFingerprintGenerator } from './audio/fingerprint';
export { createBargeInController, INTERRUPT_STATE } from './audio/bargeInController';

