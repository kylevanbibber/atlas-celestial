import React, { useState, useEffect } from 'react';
import './PresentationScripts.css';

const PresentationScripts = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSlideData, setCurrentSlideData] = useState(null);
  const [totalSlides, setTotalSlides] = useState(0);
  const [presentationData, setPresentationData] = useState(null);
  const [broadcastChannel, setBroadcastChannel] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Initialize BroadcastChannel
    const channel = new BroadcastChannel('presentation-channel');
    setBroadcastChannel(channel);

    // Listen for messages
    channel.onmessage = (event) => {
      console.log('[Scripts Panel] Received message:', event.data);
      
      if (event.data.type === 'SLIDE_CHANGED') {
        setCurrentSlide(event.data.slideIndex);
        setCurrentSlideData(event.data.slide);
        setTotalSlides(event.data.totalSlides);
        console.log('[Scripts] Updated to slide:', event.data.slideIndex, event.data.slide);
      } else if (event.data.type === 'SETUP_DATA') {
        setPresentationData(event.data.data);
      } else if (event.data.type === 'CLOSE_PRESENTATION') {
        window.close();
      }
    };

    // Load from sessionStorage as fallback
    const savedData = sessionStorage.getItem('presentationData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setPresentationData(data);
        console.log('[Scripts] Loaded presentation data from session');
      } catch (e) {
        console.warn('[Scripts] Failed to parse session data:', e);
      }
    }

    return () => {
      channel.close();
    };
  }, []);

  const handleNextSlide = () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'NEXT_SLIDE' });
      } catch (e) {
        console.warn('[Scripts] Failed to send NEXT_SLIDE:', e);
      }
    }
  };

  const handlePrevSlide = () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'PREV_SLIDE' });
      } catch (e) {
        console.warn('[Scripts] Failed to send PREV_SLIDE:', e);
      }
    }
  };

  const handleGoToSlide = (index) => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ 
          type: 'GOTO_SLIDE',
          slideIndex: index
        });
      } catch (e) {
        console.warn('[Scripts] Failed to send GOTO_SLIDE:', e);
      }
    }
  };

  const handleEndPresentation = () => {
    if (window.confirm('End presentation?')) {
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({ type: 'CLOSE_PRESENTATION' });
        } catch (e) {
          console.warn('[Scripts] Failed to send CLOSE_PRESENTATION:', e);
        }
      }
      window.close();
    }
  };

  // Handle window close event
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Ask for confirmation before closing
      const confirmationMessage = 'End presentation?';
      e.preventDefault();
      e.returnValue = confirmationMessage;
      
      // Broadcast close to other windows
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({ type: 'CLOSE_PRESENTATION' });
        } catch (err) {
          console.warn('[Scripts] Failed to broadcast close on unload:', err);
        }
      }
      
      return confirmationMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [broadcastChannel]);

  return (
    <div className="presentation-scripts">
      <div className="scripts-header">
        <h2>📋 Presentation Scripts</h2>
        <button className="end-button" onClick={handleEndPresentation}>
          End
        </button>
      </div>

      {/* Client Information */}
      {presentationData && (
        <div className="scripts-section client-section">
          <h3>Client Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>Lead Type:</label>
              <span>{presentationData.leadType || 'N/A'}</span>
            </div>
            <div className="info-item">
              <label>Primary:</label>
              <span>
                {presentationData.primaryFirst} {presentationData.primaryLast}
                {presentationData.primaryDOB && ` (${presentationData.primaryDOB})`}
              </span>
            </div>
            {presentationData.spouseFirst && (
              <div className="info-item">
                <label>Spouse:</label>
                <span>
                  {presentationData.spouseFirst} {presentationData.spouseLast}
                  {presentationData.spouseDOB && ` (${presentationData.spouseDOB})`}
                </span>
              </div>
            )}
            <div className="info-item">
              <label>Location:</label>
              <span>
                {presentationData.city && `${presentationData.city}, `}
                {presentationData.state}
              </span>
            </div>
            {presentationData.wlvsTerm && (
              <div className="info-item badge-item">
                <span className="badge">WL vs. Term</span>
              </div>
            )}
            {presentationData.fig && (
              <div className="info-item badge-item">
                <span className="badge">FIG</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide Navigation */}
      <div className="scripts-section navigation-section">
        <h3>Slide Navigation</h3>
        <div className="slide-counter">
          <span className="current-slide">{currentSlide + 1}</span>
          <span className="slide-separator">/</span>
          <span className="total-slides">{totalSlides}</span>
        </div>
        <div className="navigation-buttons">
          <button 
            className="nav-button prev-button" 
            onClick={handlePrevSlide}
            disabled={currentSlide === 0}
          >
            ← Previous
          </button>
          <button 
            className="nav-button next-button" 
            onClick={handleNextSlide}
            disabled={currentSlide === totalSlides - 1}
          >
            Next →
          </button>
        </div>

        {/* Slide thumbnails / quick navigation */}
        {totalSlides > 0 && (
          <div className="slide-list">
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                className={`slide-thumb ${currentSlide === i ? 'active' : ''}`}
                onClick={() => handleGoToSlide(i)}
              >
                Slide {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Slide Script */}
      {currentSlideData && (
        <div className="scripts-section script-section">
          <h3>📝 Script - {currentSlideData.title || `Slide ${currentSlide + 1}`}</h3>
          <div className="script-content">
            {currentSlideData.script ? (
              <p className="script-text">{currentSlideData.script}</p>
            ) : (
              <p className="no-script">No script available for this slide.</p>
            )}
          </div>
          {currentSlideData.notes && (
            <div className="slide-notes">
              <h4>💡 Notes:</h4>
              <p>{currentSlideData.notes}</p>
            </div>
          )}
          {currentSlideData.duration > 0 && (
            <div className="slide-duration">
              <strong>⏱ Duration:</strong> {currentSlideData.duration} seconds
            </div>
          )}
        </div>
      )}

      {/* Personal Notes Section */}
      <div className="scripts-section notes-section">
        <h3>Personal Notes</h3>
        <textarea
          className="notes-textarea"
          placeholder="Type your notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Keyboard Shortcuts */}
      <div className="scripts-section shortcuts-section">
        <h3>Keyboard Shortcuts</h3>
        <div className="shortcuts-list">
          <div className="shortcut">
            <kbd>→</kbd> <span>Next Slide</span>
          </div>
          <div className="shortcut">
            <kbd>←</kbd> <span>Previous Slide</span>
          </div>
          <div className="shortcut">
            <kbd>ESC</kbd> <span>Exit Presentation</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationScripts;
