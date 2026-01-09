import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import './PresentationSlideshow.css';

const PresentationSlideshow = () => {
  const [presentationData, setPresentationData] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [broadcastChannel, setBroadcastChannel] = useState(null);
  const controlWindowRef = useRef(null);

  // Load presentation from backend
  useEffect(() => {
    const loadPresentation = async () => {
      try {
        // Load client data from sessionStorage
        const savedData = sessionStorage.getItem('presentationData');
        if (savedData) {
          const data = JSON.parse(savedData);
          setPresentationData(data);
          console.log('[Slideshow] Loaded presentation data from session:', data);
          
          // If a presentationId is provided, load slides from backend
          if (data.presentationId) {
            console.log('[Slideshow] Fetching presentation:', data.presentationId);
            const response = await api.get(`/presentations/${data.presentationId}`);
            if (response.data.success) {
              setPresentation(response.data.data);
              setSlides(response.data.data.slides || []);
              console.log('[Slideshow] Loaded', response.data.data.slides?.length, 'slides');
            }
          }
        }
      } catch (error) {
        console.error('[Slideshow] Error loading presentation:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPresentation();
  }, []);

  useEffect(() => {
    // Initialize BroadcastChannel
    const channel = new BroadcastChannel('presentation-channel');
    setBroadcastChannel(channel);

    // Listen for messages
    channel.onmessage = (event) => {
      console.log('[Slideshow] Received message:', event.data);
      
      if (event.data.type === 'SETUP_DATA') {
        setPresentationData(event.data.data);
      } else if (event.data.type === 'NEXT_SLIDE') {
        setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
      } else if (event.data.type === 'PREV_SLIDE') {
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (event.data.type === 'GOTO_SLIDE') {
        setCurrentSlide(event.data.slideIndex);
      } else if (event.data.type === 'CLOSE_PRESENTATION') {
        if (controlWindowRef.current && !controlWindowRef.current.closed) {
          controlWindowRef.current.close();
        }
        window.close();
      }
    };

    return () => {
      if (controlWindowRef.current && !controlWindowRef.current.closed) {
        controlWindowRef.current.close();
      }
      channel.close();
    };
  }, [slides.length]);

  // Broadcast slide changes to scripts panel
  useEffect(() => {
    if (broadcastChannel && slides.length > 0) {
      try {
        const currentSlideData = slides[currentSlide];
        broadcastChannel.postMessage({
          type: 'SLIDE_CHANGED',
          slideIndex: currentSlide,
          slide: currentSlideData,
          totalSlides: slides.length
        });
        console.log('[Slideshow] Broadcasted slide change:', currentSlide);
      } catch (e) {
        console.warn('[Slideshow] Failed to broadcast slide change:', e);
      }
    }
  }, [currentSlide, broadcastChannel, slides]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        if (window.confirm('End presentation?')) {
          // Broadcast close message to all windows
          if (broadcastChannel) {
            try {
              broadcastChannel.postMessage({ type: 'CLOSE_PRESENTATION' });
            } catch (e) {
              console.warn('[Slideshow] Failed to broadcast close:', e);
            }
          }
          // Close control window if it exists
          if (controlWindowRef.current && !controlWindowRef.current.closed) {
            controlWindowRef.current.close();
          }
          window.close();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [broadcastChannel, slides.length]);

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
          console.warn('[Slideshow] Failed to broadcast close on unload:', err);
        }
      }
      
      // Close control window
      if (controlWindowRef.current && !controlWindowRef.current.closed) {
        controlWindowRef.current.close();
      }
      
      return confirmationMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [broadcastChannel]);

  if (loading) {
    return (
      <div className="presentation-slideshow loading">
        <div className="loading-message">
          <h2>Loading presentation...</h2>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="presentation-slideshow empty">
        <div className="empty-message">
          <h2>No slides found</h2>
          <p>This presentation doesn't have any slides yet.</p>
        </div>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];

  return (
    <div className="presentation-slideshow">
      <div className="slide-container">
        <div className="slide">
          <div className="slide-header">
            <img 
              src="https://www.ailife.com/wp-content/uploads/2019/05/AIL-Logo.png" 
              alt="American Income Life" 
              className="slide-logo"
            />
          </div>
          
          <div className="slide-content">
            {currentSlideData.image_url ? (
              <div className="slide-image-wrapper">
                <img 
                  src={currentSlideData.image_url} 
                  alt={currentSlideData.title || `Slide ${currentSlide + 1}`}
                  className="slide-image"
                />
              </div>
            ) : (
              <>
                <h1 className="slide-title">{currentSlideData.title || `Slide ${currentSlide + 1}`}</h1>
                <div className="slide-body">
                  {currentSlideData.script && <p>{currentSlideData.script}</p>}
                </div>
              </>
            )}
          </div>

          {presentationData && currentSlide === 0 && (
            <div className="client-info">
              <h2>
                {presentationData.primaryFirst} {presentationData.primaryLast}
                {presentationData.spouseFirst && ` & ${presentationData.spouseFirst} ${presentationData.spouseLast}`}
              </h2>
              <p>{presentationData.city}, {presentationData.state}</p>
            </div>
          )}
          
          <div className="slide-footer">
            <div className="agent-info">
              {presentationData && (
                <>
                  {presentationData.agentFirstName} {presentationData.agentLastName}
                  {presentationData.licensedAH && <span className="badge">Licensed A&H</span>}
                </>
              )}
            </div>
            <div className="slide-progress">
              {currentSlide + 1} / {slides.length}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation hint */}
      <div className="navigation-hint">
        Use arrow keys or click to navigate • ESC to exit
      </div>
    </div>
  );
};

export default PresentationSlideshow;
