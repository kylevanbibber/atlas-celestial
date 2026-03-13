import React, { useState, useEffect } from 'react';
import './PresentationControl.css';

const PresentationControl = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(4);
  const [presentationData, setPresentationData] = useState(null);
  const [broadcastChannel, setBroadcastChannel] = useState(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // Initialize BroadcastChannel
    const channel = new BroadcastChannel('presentation-channel');
    setBroadcastChannel(channel);

    // Listen for messages
    channel.onmessage = (event) => {
      console.log('[Control Panel] Received message:', event.data);
      
      if (event.data.type === 'SLIDE_CHANGED') {
        setCurrentSlide(event.data.slideIndex);
        setTotalSlides(event.data.totalSlides);
      } else if (event.data.type === 'SETUP_DATA') {
        setPresentationData(event.data.data);
      }
    };

    // Request current presentation data
    const requestTimer = setTimeout(() => {
      try {
        channel.postMessage({
          type: 'REQUEST_SETUP_DATA'
        });
      } catch (e) {
        console.warn('[Control] Failed to request setup data:', e);
      }
    }, 500);

    // Load from sessionStorage as fallback
    const savedData = sessionStorage.getItem('presentationData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setPresentationData(data);
      } catch (e) {
        console.warn('[Control] Failed to parse session data:', e);
      }
    }

    return () => {
      clearTimeout(requestTimer);
      channel.close();
    };
  }, []);

  const handleNextSlide = () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'NEXT_SLIDE' });
      } catch (e) {
        console.warn('[Control] Failed to send NEXT_SLIDE:', e);
      }
    }
  };

  const handlePrevSlide = () => {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'PREV_SLIDE' });
      } catch (e) {
        console.warn('[Control] Failed to send PREV_SLIDE:', e);
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
        console.warn('[Control] Failed to send GOTO_SLIDE:', e);
      }
    }
  };

  const handleEndPresentation = () => {
    if (window.confirm('End presentation?')) {
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({ type: 'CLOSE_PRESENTATION' });
        } catch (e) {
          console.warn('[Control] Failed to send CLOSE_PRESENTATION:', e);
        }
      }
      window.close();
    }
  };

  return (
    <div className="presentation-control">
      <div className="control-header">
        <h2>🎯 Presentation Control</h2>
        <button className="end-button" onClick={handleEndPresentation}>
          End Presentation
        </button>
      </div>

      {/* Client Information */}
      {presentationData && (
        <div className="control-section client-section">
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
      <div className="control-section navigation-section">
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
      </div>

      {/* Notes Section */}
      <div className="control-section notes-section">
        <h3>Notes</h3>
        <textarea
          className="notes-textarea"
          placeholder="Type your notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Keyboard Shortcuts */}
      <div className="control-section shortcuts-section">
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

export default PresentationControl;

