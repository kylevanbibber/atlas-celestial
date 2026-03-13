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

// Celebratory "cha-ching" sound for new sales
export const playSaleSound = () => {
  try {
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const t = ctx.currentTime;

      // Two-tone rising chime (cha-ching)
      const notes = [
        { freq: 880, start: 0, dur: 0.12 },     // A5
        { freq: 1318.5, start: 0.12, dur: 0.2 }, // E6
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(0.15, t + start);
        gain.gain.exponentialRampToValueAtTime(0.01, t + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + dur);
      });

      return true;
    }
  } catch (error) {
    console.log('Could not play sale sound:', error);
    return false;
  }
};

export default playNotificationSound; 