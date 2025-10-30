import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import './Onboarding.css';
import logo from '../../img/globe1.png';
import quotes from '../../components/utils/quotes';

const OnboardingRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const presetEmail = location.state?.email || '';
  const [email, setEmail] = useState(presetEmail);
  const [password, setPassword] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [middle, setMiddle] = useState('');
  const [suffix, setSuffix] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  // US state abbreviations for dropdown
  const STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  ];

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  const [licensed, setLicensed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [randomQuote, setRandomQuote] = useState('');

  useEffect(() => {
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
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
        licensed
      });
      if (res.data?.success) {
        localStorage.setItem('onboardingEmail', email);
        localStorage.setItem('onboardingPipelineId', String(res.data.pipeline_id));
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

  return (
    <div className="auth-background onboarding-auth-background onboarding-root">
      {loading && (
        <div className="globe-loading-overlay onboarding-loading-overlay">
          <img src={logo} alt="Loading" className="globe-loading-animation" />
        </div>
      )}
      <div className="login-container onboarding-login-container">
        <div className="login-card onboarding-login-card">
          <div className="left-side onboarding-left-side">
            <h2>Create your Onboarding Account</h2>
            <blockquote>{randomQuote}</blockquote>
          </div>
          <div className="right-side onboarding-right-side">
            <h2>Register</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="login-form onboarding-login-form">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>First name</label>
                  <input value={first} onChange={(e) => setFirst(e.target.value)} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Middle</label>
                  <input value={middle} onChange={(e) => setMiddle(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label>Last name</label>
                  <input value={last} onChange={(e) => setLast(e.target.value)} required />
                </div>
                <div style={{ width: 100 }}>
                  <label>Suffix</label>
                  <input value={suffix} onChange={(e) => setSuffix(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
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
                  />
                </div>
                <div style={{ width: 180 }}>
                  <label>Resident State</label>
                  <select value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">Select...</option>
                    {STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)} />{' '}
                  Are you a licensed agent?
                </label>
              </div>
              <button className="custom-button primary-button" type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Create Account'}
              </button>
              <div className="login-links" style={{ marginTop: 12 }}>
                <button type="button" className="link-button" onClick={() => navigate('/onboarding/login')}>Back to Onboarding Login</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingRegister;


