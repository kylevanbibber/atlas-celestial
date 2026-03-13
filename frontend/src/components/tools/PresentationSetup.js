import React, { useState, useEffect } from 'react';
import api from '../../api';
import './PresentationSetup.css';

const PresentationSetup = () => {
  const [formData, setFormData] = useState({
    presentationId: '',
    agentFirstName: 'Kyle',
    agentLastName: 'VANBIBBER',
    licensedAH: false,
    leadType: '',
    primaryFirst: '',
    primaryLast: '',
    primaryDOB: '',
    primaryGender: 'M',
    spouseFirst: '',
    spouseLast: '',
    spouseDOB: '',
    spouseGender: 'F',
    city: '',
    state: '',
    wlvsTerm: false,
    fig: false,
    closingPlanStyle: 'Recommended/Basic',
    language: 'English'
  });

  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  // Load available presentations
  useEffect(() => {
    const loadPresentations = async () => {
      try {
        const response = await api.get('/presentations');
        if (response.data.success) {
          setPresentations(response.data.data);
          console.log('[Setup] Loaded', response.data.data.length, 'presentations');
          
          // Auto-select first presentation if available
          if (response.data.data.length > 0 && !formData.presentationId) {
            setFormData(prev => ({
              ...prev,
              presentationId: response.data.data[0].id
            }));
          }
        }
      } catch (error) {
        console.error('[Setup] Error loading presentations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPresentations();
  }, []);

  useEffect(() => {
    // Initialize BroadcastChannel for communication
    const channel = new BroadcastChannel('presentation-channel');
    setBroadcastChannel(channel);

    // Listen for messages from parent window
    channel.onmessage = (event) => {
      console.log('[Presentation Window] Received message:', event.data);
      if (event.data.type === 'UPDATE_FORM') {
        setFormData(prev => ({ ...prev, ...event.data.payload }));
      }
    };

    // Also listen for postMessage
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'UPDATE_FORM') {
        setFormData(prev => ({ ...prev, ...event.data.payload }));
      }
    };
    
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Broadcast changes to other windows
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'FORM_UPDATE',
          field: name,
          value: newValue
        });
      } catch (e) {
        console.warn('[Setup] Failed to broadcast form update:', e);
      }
    }
  };

  const handleStart = () => {
    console.log('Starting presentation with:', formData);
    
    // Store presentation data in sessionStorage for access in slideshow
    sessionStorage.setItem('presentationData', JSON.stringify(formData));
    
    const screenWidth = window.screen.availWidth;
    const screenHeight = window.screen.availHeight;
    
    // Calculate slideshow dimensions (73% width, 78% height)
    const slideshowWidth = Math.floor(screenWidth * 0.73);
    const slideshowHeight = Math.floor(screenHeight * 0.78);
    const slideshowLeft = 0;
    const slideshowTop = screenHeight - slideshowHeight;
    
    // Calculate scripts panel dimensions (25% width, full height)
    const scriptsWidth = Math.floor(screenWidth * 0.25);
    const scriptsHeight = screenHeight;
    const scriptsLeft = screenWidth - scriptsWidth;
    const scriptsTop = 0;
    
    // Open slideshow window
    const slideshowUrl = `${window.location.origin}/presentation-slideshow`;
    window.open(
      slideshowUrl,
      'PresentationSlideshow',
      `width=${slideshowWidth},height=${slideshowHeight},left=${slideshowLeft},top=${slideshowTop},resizable=yes,scrollbars=yes`
    );
    
    // Open scripts window
    const scriptsUrl = `${window.location.origin}/presentation-scripts`;
    window.open(
      scriptsUrl,
      'PresentationScripts',
      `width=${scriptsWidth},height=${scriptsHeight},left=${scriptsLeft},top=${scriptsTop},resizable=yes,scrollbars=yes`
    );
    
    // Broadcast setup data to all windows
    setTimeout(() => {
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({
            type: 'START_PRESENTATION',
            data: formData
          });
          
          broadcastChannel.postMessage({
            type: 'SETUP_DATA',
            data: formData
          });
        } catch (e) {
          console.warn('[Setup] Failed to broadcast start event:', e);
        }
      }
    }, 200);
    
    // Close the setup window after opening both presentation windows
    setTimeout(() => {
      window.close();
    }, 300);
  };

  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  return (
    <div className="presentation-setup">
      <div className="presentation-header">
        <h1>Presentation Set Up</h1>
        <div className="ai-logo">
          <div className="logo-circle">
            <span className="logo-text">American Income</span>
          </div>
        </div>
      </div>

      <div className="presentation-form">
        {/* Presentation Selector */}
        <div className="form-row presentation-row">
          <label><span className="required">*</span> Presentation:</label>
          <div className="form-inputs">
            {loading ? (
              <div className="loading-select">Loading presentations...</div>
            ) : (
              <select
                name="presentationId"
                value={formData.presentationId}
                onChange={handleChange}
                required
              >
                <option value="">Select a Presentation</option>
                {presentations.map(pres => (
                  <option key={pres.id} value={pres.id}>
                    {pres.title} ({pres.slide_count || 0} slides)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Agent Name */}
        <div className="form-row agent-row">
          <label>Agent Name:</label>
          <div className="form-inputs">
            <input
              type="text"
              name="agentFirstName"
              value={formData.agentFirstName}
              onChange={handleChange}
              placeholder="First"
            />
            <input
              type="text"
              name="agentLastName"
              value={formData.agentLastName}
              onChange={handleChange}
              placeholder="Last"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="licensedAH"
                checked={formData.licensedAH}
                onChange={handleChange}
              />
              Licensed for A&H
            </label>
          </div>
        </div>

        {/* Lead Type */}
        <div className="form-row required-row">
          <label><span className="required">*</span> Lead Type:</label>
          <div className="form-inputs">
            <select
              name="leadType"
              value={formData.leadType}
              onChange={handleChange}
              required
            >
              <option value="">Choose Lead Type</option>
              <option value="Member">Member</option>
              <option value="Referral">Referral</option>
              <option value="Cold">Cold</option>
            </select>
          </div>
        </div>

        {/* Primary */}
        <div className="form-row primary-row">
          <label><span className="required">*</span> Primary:</label>
          <div className="form-inputs">
            <input
              type="text"
              name="primaryFirst"
              value={formData.primaryFirst}
              onChange={handleChange}
              placeholder="First"
              required
            />
            <input
              type="text"
              name="primaryLast"
              value={formData.primaryLast}
              onChange={handleChange}
              placeholder="Last"
              required
            />
            <input
              type="text"
              name="primaryDOB"
              value={formData.primaryDOB}
              onChange={handleChange}
              placeholder="MMDDYYYY"
              maxLength="8"
            />
            <select
              name="primaryGender"
              value={formData.primaryGender}
              onChange={handleChange}
            >
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>
        </div>

        {/* Spouse */}
        <div className="form-row spouse-row">
          <label>Spouse:</label>
          <div className="form-inputs">
            <input
              type="text"
              name="spouseFirst"
              value={formData.spouseFirst}
              onChange={handleChange}
              placeholder="First"
            />
            <input
              type="text"
              name="spouseLast"
              value={formData.spouseLast}
              onChange={handleChange}
              placeholder="Last"
            />
            <input
              type="text"
              name="spouseDOB"
              value={formData.spouseDOB}
              onChange={handleChange}
              placeholder="MMDDYYYY"
              maxLength="8"
            />
            <select
              name="spouseGender"
              value={formData.spouseGender}
              onChange={handleChange}
            >
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>
        </div>

        {/* City */}
        <div className="form-row city-row">
          <label>City:</label>
          <div className="form-inputs">
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Member's City"
            />
          </div>
        </div>

        {/* State */}
        <div className="form-row required-row">
          <label><span className="required">*</span> State:</label>
          <div className="form-inputs">
            <select
              name="state"
              value={formData.state}
              onChange={handleChange}
              required
            >
              <option value="">Select a State</option>
              {usStates.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Extras */}
        <div className="form-row extras-row">
          <label>Extras:</label>
          <div className="form-inputs checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="wlvsTerm"
                checked={formData.wlvsTerm}
                onChange={handleChange}
              />
              WL vs. Term
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="fig"
                checked={formData.fig}
                onChange={handleChange}
              />
              FIG
            </label>
          </div>
        </div>

        {/* Closing Plan Style */}
        <div className="form-row">
          <label>Closing Plan Style:</label>
          <div className="form-inputs">
            <select
              name="closingPlanStyle"
              value={formData.closingPlanStyle}
              onChange={handleChange}
            >
              <option value="Recommended/Basic">Recommended/Basic</option>
              <option value="Advanced">Advanced</option>
              <option value="Premium">Premium</option>
            </select>
          </div>
        </div>

        {/* Language */}
        <div className="form-row language-row">
          <label>Language:</label>
          <div className="form-inputs">
            <select
              name="language"
              value={formData.language}
              onChange={handleChange}
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
            </select>
          </div>
        </div>

        {/* Start Button */}
        <div className="form-actions">
          <button className="start-button" onClick={handleStart}>
            START
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationSetup;

