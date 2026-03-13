import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import './Onboarding.css';
import logo from '../../img/globe1.png';
import quotes from '../../components/utils/quotes';

const OnboardingRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const needsCompletion = location.state?.needsCompletion || false;
  const missingFields = location.state?.missingFields || [];
  const existingData = location.state?.existingData || {};
  
  // Get hm from location.state OR from URL query params
  const searchParams = new URLSearchParams(location.search);
  const hmParam = location.state?.hm || searchParams.get('hm') || null;
  
  const presetEmail = location.state?.email || existingData.email || '';
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState('');
  const [first, setFirst] = useState(existingData.first || '');
  const [last, setLast] = useState(existingData.last || '');
  const [middle, setMiddle] = useState(existingData.middle || '');
  const [suffix, setSuffix] = useState(existingData.suffix || '');
  const [phone, setPhone] = useState(existingData.phone || '');
  const [state, setState] = useState(existingData.resident_state || '');
  const [instagram, setInstagram] = useState(existingData.instagram || '');
  const [birthday, setBirthday] = useState(existingData.birthday || '');
  
  // Hiring manager dropdown state
  const [hiringManagers, setHiringManagers] = useState([]);
  const [selectedHiringManager, setSelectedHiringManager] = useState('');
  const [hmSearchTerm, setHmSearchTerm] = useState('');
  
  // Debug logging
  useEffect(() => {
    console.log('[OnboardingRegister] Component loaded:', {
      needsCompletion,
      missingFields,
      existingData,
      hmParam,
      urlSearch: location.search
    });
  }, [needsCompletion, missingFields, existingData, hmParam, location.search]);
  
  // Fetch hiring managers if no hm parameter
  useEffect(() => {
    if (!hmParam) {
      const fetchHiringManagers = async () => {
        try {
          console.log('[OnboardingRegister] Fetching hiring managers...');
          const res = await api.get('/onboarding/hiring-managers');
          console.log('[OnboardingRegister] Hiring managers response:', res.data);
          if (res.data.success) {
            setHiringManagers(res.data.managers || []);
            console.log('[OnboardingRegister] Loaded hiring managers:', res.data.managers?.length);
          }
        } catch (err) {
          console.error('[OnboardingRegister] Error fetching hiring managers:', err);
        }
      };
      fetchHiringManagers();
    } else {
      console.log('[OnboardingRegister] hmParam present, skipping dropdown:', hmParam);
    }
  }, [hmParam]);
  // US state abbreviations for dropdown
  const STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  ];

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  const [licensed, setLicensed] = useState(false);
  const [textOptIn, setTextOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [randomQuote, setRandomQuote] = useState('');
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  const handleReviewClick = (e) => {
    e.preventDefault();
    setError('');
    setShowReview(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Use hmParam or selected hiring manager
    const effectiveHm = hmParam || selectedHiringManager || null;
    console.log('[OnboardingRegister] Submitting registration with hm:', effectiveHm);
    
    try {
      const res = await api.post('/onboarding/auth/register', {
        email,
        password,
        first,
        middle,
        last,
        suffix,
        phone,
        resident_state: state,
        instagram,
        birthday,
        licensed,
        hm: effectiveHm,
        text_opt_in: textOptIn
      });
      if (res.data?.success) {
        localStorage.setItem('onboardingEmail', email);
        localStorage.setItem('onboardingPipelineId', String(res.data.pipeline_id));
        
        // Generate JWT token for immediate login after registration
        const loginRes = await api.post('/onboarding/auth/login', { email, password });
        if (loginRes.data?.token) {
          localStorage.setItem('token', loginRes.data.token);
        }
        
        navigate('/onboarding/home');
      } else {
        setError(res.data?.message || 'Registration failed');
      }
    } catch (err) {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Filter hiring managers based on search term
  const filteredHiringManagers = hiringManagers.filter(manager =>
    manager.lagnname.toLowerCase().includes(hmSearchTerm.toLowerCase())
  );

  return (
    <div className="auth-background onboarding-auth-background onboarding-root">
      {loading && (
        <div className="globe-loading-overlay onboarding-loading-overlay">
          <img src={logo} alt="Loading" className="globe-loading-animation" />
        </div>
      )}
      <div className="login-container onboarding-login-container">
        <div className="login-card onboarding-login-card single-column">
          {/* Header Section */}
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            background: 'linear-gradient(135deg, #d7d7d7cc, #00548ca9)',
            borderRadius: '16px 16px 0 0',
            marginBottom: '0'
          }}>
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '600', 
              marginBottom: '12px',
              color: '#fff'
            }}>
              Create your Onboarding Account
            </h2>
            <blockquote style={{ 
              fontSize: '15px', 
              fontStyle: 'italic', 
              color: '#fff',
              margin: '0',
              padding: '0 20px',
              opacity: '0.95'
            }}>
              {randomQuote}
            </blockquote>
          </div>
          
          {/* Form Section */}
          <div style={{ padding: '0 30px 30px' }}>
            <h2 style={{ 
              fontSize: '20px',
              marginTop: '8px', 
              marginBottom: '20px',
              color: 'var(--text-primary)'
            }}>
              {needsCompletion ? 'Complete Your Registration' : 'Register'}
            </h2>
            {error && <div className="error-message">{error}</div>}
            
            {showReview ? (
              // Review Screen
              <div className="review-screen">
                <div style={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    marginBottom: '16px',
                    color: 'var(--text-primary)'
                  }}>
                    Review Your Information
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="review-item">
                      <strong>Email:</strong> {email}
                    </div>
                    
                    {(first || middle || last || suffix) && (
                      <div className="review-item">
                        <strong>Name:</strong> {first} {middle && `${middle}.`} {last} {suffix}
                      </div>
                    )}
                    
                    {birthday && (
                      <div className="review-item">
                        <strong>Birthday:</strong> {new Date(birthday).toLocaleDateString()}
                      </div>
                    )}
                    
                    {phone && (
                      <div className="review-item">
                        <strong>Phone:</strong> {phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
                      </div>
                    )}
                    
                    {state && (
                      <div className="review-item">
                        <strong>Resident State:</strong> {state}
                      </div>
                    )}
                    
                    {instagram && (
                      <div className="review-item">
                        <strong>Instagram:</strong> @{instagram}
                      </div>
                    )}
                    
                    {(selectedHiringManager || hmParam) && (
                      <div className="review-item">
                        <strong>Hiring Leader:</strong> {
                          selectedHiringManager 
                            ? hiringManagers.find(m => m.id === parseInt(selectedHiringManager))?.lagnname || 'Selected'
                            : 'Assigned'
                        }
                      </div>
                    )}
                    
                    <div className="review-item">
                      <strong>Licensed Agent:</strong> {licensed ? 'Yes' : 'No'}
                    </div>
                    
                    <div className="review-item">
                      <strong>Text Reminders:</strong> {textOptIn ? 'Opted In' : 'Opted Out'}
                    </div>
                  </div>
                </div>
                
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#92400e',
                  lineHeight: '1.5'
                }}>
                  <strong>📋 Please Review:</strong> Make sure all information is correct before submitting. You can go back to edit if needed.
                </div>
                
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={() => setShowReview(false)}
                    className="custom-button"
                    style={{
                      flex: '1',
                      minWidth: '120px',
                      backgroundColor: 'transparent',
                      border: '2px solid var(--primary-color)',
                      color: 'var(--primary-color)'
                    }}
                  >
                    ← Go Back to Edit
                  </button>
                  <button 
                    type="button"
                    onClick={handleSubmit}
                    className="custom-button primary-button"
                    disabled={loading}
                    style={{ flex: '1', minWidth: '120px' }}
                  >
                    {loading ? 'Submitting...' : 'Confirm & Create Account'}
                  </button>
                </div>
                
                <div className="login-links" style={{ marginTop: 12, textAlign: 'center' }}>
                  <button type="button" className="link-button" onClick={() => navigate('/onboarding/login')}>Back to Onboarding Login</button>
                </div>
              </div>
            ) : (
              // Registration Form
              <form onSubmit={handleReviewClick} className="login-form onboarding-login-form">
              <div className="onboarding-form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={needsCompletion} />
              </div>
              
              <div className="onboarding-form-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              
              {/* Name Section Disclaimer */}
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#1e40af',
                lineHeight: '1.5'
              }}>
                <strong>⚠️ Important:</strong> Please enter your full legal name exactly as it appears on official documents (driver's license, passport, etc.).
              </div>
              
              {(!needsCompletion || missingFields.includes('first')) && (
                <div className="onboarding-form-group onboarding-two-col-row">
                  <div className="onboarding-two-col">
                    <label>First name</label>
                    <input value={first} onChange={(e) => setFirst(e.target.value)} required />
                  </div>
                  <div className="onboarding-middle-col">
                    <label>Middle</label>
                    <input 
                      value={middle} 
                      onChange={(e) => setMiddle(e.target.value.slice(0, 1))} 
                      maxLength={1}
                    />
                  </div>
                </div>
              )}
              {(!needsCompletion || missingFields.includes('last')) && (
                <div className="onboarding-form-group onboarding-two-col-row">
                  <div className="onboarding-two-col">
                    <label>Last name</label>
                    <input value={last} onChange={(e) => setLast(e.target.value)} required />
                  </div>
                  <div className="onboarding-suffix-col">
                    <label>Suffix</label>
                    <input value={suffix} onChange={(e) => setSuffix(e.target.value)} />
                  </div>
                </div>
              )}
              
              {/* Birthday Field */}
              {(!needsCompletion || missingFields.includes('birthday')) && (
                <div className="onboarding-form-group">
                  <label>Birthday (Optional)</label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                  />
                </div>
              )}
              
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
              
              {(!needsCompletion || missingFields.includes('phone') || missingFields.includes('resident_state')) && (
                <div className="onboarding-form-group onboarding-two-col-row">
                  {(!needsCompletion || missingFields.includes('phone')) && (
                    <div className="onboarding-two-col">
                      <label>Phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        inputMode="numeric"
                        autoComplete="tel"
                        minLength={10}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        title="Enter 10 digits (numbers only)"
                        placeholder="##########"
                        required
                      />
                    </div>
                  )}
                  {(!needsCompletion || missingFields.includes('resident_state')) && (
                    <div className="onboarding-state-col">
                      <label>Resident State</label>
                      <select value={state} onChange={(e) => setState(e.target.value)} required>
                        <option value="">Select...</option>
                        {STATES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              
              {/* Instagram Handle */}
              {(!needsCompletion || missingFields.includes('instagram')) && (
                <div className="onboarding-form-group">
                  <label>Instagram Handle (Optional)</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => {
                      let value = e.target.value;
                      // Remove @ if user types it
                      if (value.startsWith('@')) {
                        value = value.substring(1);
                      }
                      setInstagram(value);
                    }}
                    placeholder="username"
                  />
                  {instagram && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                      <a 
                        href={`https://instagram.com/${instagram}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}
                      >
                        View @{instagram} on Instagram
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show hiring manager dropdown only if no hm in URL AND no code_to in existing data */}
              {!hmParam && !existingData.code_to && hiringManagers.length > 0 && (
                <div className="onboarding-form-group">
                  <label htmlFor="hiringManager">Hiring Leader (Optional)</label>
                  <input
                    id="hmSearch"
                    type="text"
                    placeholder="Search hiring leaders..."
                    value={hmSearchTerm}
                    onChange={(e) => setHmSearchTerm(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  <select
                    id="hiringManager"
                    value={selectedHiringManager}
                    onChange={(e) => setSelectedHiringManager(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">-- Select Hiring Leader --</option>
                    {filteredHiringManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.lagnname}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

              <div className="onboarding-form-group onboarding-checkbox-row">
                <label className="onboarding-checkbox-label">
                  <span className="onboarding-checkbox-text">
                    Are you a licensed agent?
                  </span>
                  <input
                    type="checkbox"
                    className="onboarding-checkbox"
                    checked={licensed}
                    onChange={(e) => setLicensed(e.target.checked)}
                  />
                </label>
              </div>

              <div className="onboarding-form-group onboarding-checkbox-row">
                <label className="onboarding-checkbox-label">
                  <span className="onboarding-checkbox-text">
                    I agree to receive text reminders and onboarding updates to this phone number.
                  </span>
                  <input
                    type="checkbox"
                    className="onboarding-checkbox"
                    checked={textOptIn}
                    onChange={(e) => setTextOptIn(e.target.checked)}
                  />
                </label>
                <div className="onboarding-checkbox-help">
                  By checking this box, you consent to receive automated text messages from Arias Life at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. View our <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>Privacy Policy</a> and <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>Terms of Service</a>.
                </div>
              </div>
              
              <button className="custom-button primary-button" type="submit" disabled={loading}>
                Review & Continue →
              </button>
              <div className="login-links" style={{ marginTop: 12 }}>
                <button type="button" className="link-button" onClick={() => navigate('/onboarding/login')}>Back to Onboarding Login</button>
              </div>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingRegister;


