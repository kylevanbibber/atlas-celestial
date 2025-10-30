import React, { useState, useEffect } from 'react';
import api from '../../api';
import './Onboarding.css';
import logo from '../../img/globe1.png';
import quotes from '../../components/utils/quotes';

const OnboardingForgot = () => {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [randomQuote, setRandomQuote] = useState('');

  useEffect(() => {
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/onboarding/auth/forgot', { email });
      setDone(true);
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
            <h2>Forgot Password</h2>
            <blockquote>{randomQuote}</blockquote>
          </div>
          <div className="right-side onboarding-right-side">
            <h2>Reset</h2>
            {done ? (
              <div>Check your email for password reset instructions.</div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <button className="custom-button primary-button" type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForgot;


