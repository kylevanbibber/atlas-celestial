import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import './RecruitmentForm.css';

const RecruitmentForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const playerRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    recruit_first: '',
    recruit_middle: '',
    recruit_last: '',
    recruit_suffix: '',
    Phone: '',
    Email: '',
    HiringManager: '',
    resident_state: '',
    referral_source: '',
    Aspects: '',
    Concern: '',
    Spouse: '',
    CareerGoals: '',
    Compensation: '',
    WhyChoose: '',
    Prepared: '',
    recruitingAgent: '',
    Date: new Date().toISOString().split('T')[0],
    agentEmail: ''
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Custom video state
  const [customVideo, setCustomVideo] = useState(null);
  const [videoLoading, setVideoLoading] = useState(true);
  
  // Helper function to extract video ID
  const extractVideoId = (url, type) => {
    if (type === 'youtube') {
      const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      return match ? match[1] : null;
    } else if (type === 'vimeo') {
      const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
      return match ? match[1] : null;
    }
    return null;
  };

  // Load YouTube IFrame API and initialize player
  useEffect(() => {
    // Wait for custom video to be loaded
    if (videoLoading) return;

    // Only proceed if we're using a YouTube video (custom or default)
    const useYouTube = !customVideo || customVideo.video_type === 'youtube';
    if (!useYouTube) return;

    let mounted = true;
    
    // Determine which video ID to use
    const videoId = customVideo && customVideo.video_type === 'youtube'
      ? extractVideoId(customVideo.video_url, 'youtube')
      : 'vSlk0AB0GXI';  // Default video

    function initializePlayer() {
      if (!mounted) return;
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const playerDiv = document.getElementById('youtube-player');
        if (!playerDiv) {
          console.error('YouTube player div not found');
          return;
        }

        try {
          playerRef.current = new window.YT.Player('youtube-player', {
            height: '390',
            width: '640',
            videoId: videoId,
            playerVars: {
              autoplay: 0,
              controls: 1,
              modestbranding: 1,
              rel: 0
            }
          });
        } catch (error) {
          console.error('Error initializing YouTube player:', error);
        }
      }, 100);
    }

    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      initializePlayer();
    } else {
      // Load YouTube IFrame API script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // Initialize player when API is ready
      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    }

    return () => {
      mounted = false;
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customVideo, videoLoading]);

  // Fetch custom video for affiliate
  useEffect(() => {
    const fetchCustomVideo = async () => {
      let userId = searchParams.get('hm');
      
      // If no ID is provided, default to 26911
      if (!userId) {
        userId = '26911';
      }
      
      try {
        setVideoLoading(true);
        const response = await api.get(`/careers-videos/for-affiliate/${userId}`);
        if (response.data.success && response.data.video) {
          setCustomVideo(response.data.video);
        }
      } catch (error) {
        console.error('Error fetching custom video:', error);
        // Fail silently and use default video
      } finally {
        setVideoLoading(false);
      }
    };
    
    fetchCustomVideo();
  }, [searchParams]);

  // Initialize form with hiring manager data
  useEffect(() => {
    const initializeForm = async () => {
      let userId = searchParams.get('hm');
      
      // If no ID is provided, default to 26911
      if (!userId) {
        userId = '26911';
      }
      
      // Set recruiting agent ID
      setFormData(prev => ({ ...prev, recruitingAgent: userId }));
      
      // Fetch details only if an ID was passed in the URL
      if (searchParams.get('hm')) {
        try {
          const response = await api.get(`/auth/getagent/${userId}`);
          if (response.data.success) {
            const agentDetails = response.data.data;
            const formattedName = formatName(agentDetails.lagnname);
            
            setFormData(prev => ({
              ...prev,
              HiringManager: formattedName,
              agentEmail: agentDetails.email || ''
            }));
          }
        } catch (error) {
          console.error('Error fetching agent details:', error);
        }
      }
    };
    
    initializeForm();
  }, [searchParams]);
  
  // Format name from "Last First Middle" to "First Last"
  const formatName = (lagnname) => {
    const nameParts = lagnname.split(' ');
    if (nameParts.length >= 2) {
      const firstName = nameParts[1];
      const lastName = nameParts[0];
      return `${firstName} ${lastName}`;
    }
    return lagnname;
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors = {};
    const requiredFields = [
      'recruit_first', 'recruit_last', 'Phone', 'Email', 'HiringManager',
      'resident_state', 'referral_source', 'Aspects', 'Concern', 'Spouse',
      'CareerGoals', 'Compensation', 'WhyChoose', 'Prepared'
    ];
    
    requiredFields.forEach(field => {
      if (!formData[field] || formData[field].trim() === '') {
        newErrors[field] = 'This field is required';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await api.post('/recruitment/applicants', formData);
      
      if (response.data.success) {
        // Redirect to success page
        navigate('/careers-success');
      } else {
        alert('Error submitting form. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
      setLoading(false);
    }
  };
  
  const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ];
  
  const stateAbbreviations = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH',
    'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
    'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
    'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN',
    'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
    'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };
  
  return (
    <div className="recruitment-form-page">
      {/* Header */}
      <div className="recruitment-header">
        <div className="recruitment-header-content">
          <img 
            src="/assets/Globe_AIL_Arias.png" 
            alt="Globe Life American Income Division" 
            height="75px"
            onError={(e) => {
              // Fallback if image doesn't exist
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="recruitment-header-content"></div>
      </div>
      
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay visible">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <div className="recruitment-container">
        {/* Hero Section */}
        <div 
          className="img-grid"
          style={{ 
            backgroundImage: `url(${process.env.PUBLIC_URL}/assets/pittsburgh_skyline.jpg)`,
          }}
        >
          <h1>Start Your Journey Now!</h1>
          <div 
            className="img-grid-edge"
            style={{
              backgroundImage: `url(${process.env.PUBLIC_URL}/assets/ripped_edge.png)`,
            }}
          />
        </div>
        
        {/* Video Section */}
        <div className="top-grid">
          <div style={{ margin: '50px 0' }}>
            <h1>Step 1: Watch Company Overview</h1>
          </div>
          <div className="video-container">
            {videoLoading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                Loading video...
              </div>
            ) : customVideo && customVideo.video_type === 'vimeo' ? (
              // Vimeo player
              <iframe
                src={`https://player.vimeo.com/video/${extractVideoId(customVideo.video_url, 'vimeo')}`}
                width="640"
                height="390"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Company Overview Video"
                style={{ maxWidth: '100%' }}
              />
            ) : (
              // YouTube player (custom or default)
              <div id="youtube-player"></div>
            )}
          </div>
        </div>
        
        {/* Form Section */}
        <div className="bottom-grid">
          <div className="horizontal-bar" style={{ margin: '60px 0 30px' }}></div>
          <div className="top-grid">
            <h1>Step 2: Fill out Compatibility Assessment</h1>
          </div>
          
          <div style={{ textAlign: 'left', width: '100%' }}>
            <center>
              <p>Please submit this questionnaire to be considered for an interview.</p>
            </center>
            
            <form id="questionnaire" onSubmit={handleSubmit}>
              {/* Name Fields */}
              <div className="name-fields">
                <div>
                  <label htmlFor="recruit-first">First Name:</label>
                  <input
                    type="text"
                    id="recruit-first"
                    name="recruit_first"
                    value={formData.recruit_first}
                    onChange={handleInputChange}
                    className={errors.recruit_first ? 'invalid' : ''}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="recruit-middle">Middle:</label>
                  <input
                    type="text"
                    id="recruit-middle"
                    name="recruit_middle"
                    value={formData.recruit_middle}
                    onChange={handleInputChange}
                    maxLength="1"
                  />
                </div>
                <div>
                  <label htmlFor="recruit-last">Last Name:</label>
                  <input
                    type="text"
                    id="recruit-last"
                    name="recruit_last"
                    value={formData.recruit_last}
                    onChange={handleInputChange}
                    className={errors.recruit_last ? 'invalid' : ''}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="recruit-suffix">Suffix:</label>
                  <input
                    type="text"
                    id="recruit-suffix"
                    name="recruit_suffix"
                    value={formData.recruit_suffix}
                    onChange={handleInputChange}
                    maxLength="3"
                  />
                </div>
              </div>
              
              {/* Contact Fields */}
              <div className="contact-fields">
                <div>
                  <label htmlFor="phone">Phone Number:</label>
                  <input
                    type="text"
                    id="phone"
                    name="Phone"
                    value={formData.Phone}
                    onChange={handleInputChange}
                    className={errors.Phone ? 'invalid' : ''}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email">Email:</label>
                  <input
                    type="email"
                    id="email"
                    name="Email"
                    value={formData.Email}
                    onChange={handleInputChange}
                    className={errors.Email ? 'invalid' : ''}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="hiring-manager">Hiring Manager:</label>
                  <input
                    type="text"
                    id="hiring-manager"
                    name="HiringManager"
                    value={formData.HiringManager}
                    onChange={handleInputChange}
                    disabled={searchParams.get('hm') !== null}
                    className={errors.HiringManager ? 'invalid' : ''}
                    required
                  />
                </div>
              </div>
              
              {/* Resident State */}
              <div>
                <label htmlFor="resident-state">Resident State:</label>
                <select
                  id="resident-state"
                  name="resident_state"
                  value={formData.resident_state}
                  onChange={handleInputChange}
                  className={errors.resident_state ? 'invalid' : ''}
                  required
                >
                  <option value="" disabled>Select your state</option>
                  {states.map(state => (
                    <option key={state} value={stateAbbreviations[state]}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Referral Source */}
              <div>
                <label htmlFor="referral-source">How did you hear about us?</label>
                <select
                  id="referral-source"
                  name="referral_source"
                  value={formData.referral_source}
                  onChange={handleInputChange}
                  className={errors.referral_source ? 'invalid' : ''}
                  required
                >
                  <option value="" disabled>Select an option</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Job Post">Job Post</option>
                  <option value="Random Introduction">Random Introduction</option>
                  <option value="Friend/Family">Friend/Family</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              {/* Text Areas */}
              <label htmlFor="aspects">What aspects of the opportunity appeal to you the most?</label>
              <textarea
                id="aspects"
                name="Aspects"
                rows="4"
                value={formData.Aspects}
                onChange={handleInputChange}
                className={errors.Aspects ? 'invalid' : ''}
                required
              />
              
              <label htmlFor="concern">What is your biggest concern about the opportunity?</label>
              <textarea
                id="concern"
                name="Concern"
                rows="4"
                value={formData.Concern}
                onChange={handleInputChange}
                className={errors.Concern ? 'invalid' : ''}
                required
              />
              
              <label htmlFor="spouse">Have you discussed this opportunity with your spouse or significant other? What questions or concerns do they have?</label>
              <textarea
                id="spouse"
                name="Spouse"
                rows="4"
                value={formData.Spouse}
                onChange={handleInputChange}
                className={errors.Spouse ? 'invalid' : ''}
                required
              />
              
              <label htmlFor="career-goals">What are your career goals if you are invited to join our team?</label>
              <textarea
                id="career-goals"
                name="CareerGoals"
                rows="4"
                value={formData.CareerGoals}
                onChange={handleInputChange}
                className={errors.CareerGoals ? 'invalid' : ''}
                required
              />
              
              <label htmlFor="compensation">What questions do you have about the compensation and bonus program?</label>
              <textarea
                id="compensation"
                name="Compensation"
                rows="4"
                value={formData.Compensation}
                onChange={handleInputChange}
                className={errors.Compensation ? 'invalid' : ''}
                required
              />
              
              <label htmlFor="why-choose">Why should we choose you to join our team?</label>
              <textarea
                id="why-choose"
                name="WhyChoose"
                rows="4"
                value={formData.WhyChoose}
                onChange={handleInputChange}
                className={errors.WhyChoose ? 'invalid' : ''}
                required
              />
              
              {/* Radio Buttons */}
              <label>If you were offered an opportunity to join our company, and we agreed to move forward, would you be prepared to begin the State required licensing process at the end of the final interview?</label>
              <div style={{ marginBottom: '30px' }}>
                <input
                  type="radio"
                  id="yes"
                  name="Prepared"
                  value="yes"
                  checked={formData.Prepared === 'yes'}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="yes" style={{ display: 'inline' }}>Yes</label><br />
                <input
                  type="radio"
                  id="no"
                  name="Prepared"
                  value="no"
                  checked={formData.Prepared === 'no'}
                  onChange={handleInputChange}
                  required
                />
                <label htmlFor="no" style={{ display: 'inline' }}>No</label>
              </div>
              
              <input
                type="submit"
                id="submit-btn"
                value="Submit"
              />
            </form>
          </div>
        </div>
      </div>
      <br /><br /><br /><br />
    </div>
  );
};

export default RecruitmentForm;

