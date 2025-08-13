// Utility for playing notification sounds
export const playNotificationSound = () => {
  try {
    // Create a simple notification beep using Web Audio API if no sound file is available
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Create a simple beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      
      return true;
    }
    
    // Fallback: If you have a notification sound file, use this instead:
    // const audio = new Audio('/notification-sound.mp3');
    // audio.volume = 0.3;
    // return audio.play();
    
  } catch (error) {
    console.log('Could not play notification sound:', error);
    return false;
  }
};

export default playNotificationSound; 