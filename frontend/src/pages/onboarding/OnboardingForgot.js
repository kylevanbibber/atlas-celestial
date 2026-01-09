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
              Forgot Password
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
          <div style={{ padding: '30px' }}>
            <h2 style={{ 
              fontSize: '20px', 
              marginBottom: '20px',
              color: 'var(--text-primary)'
            }}>
              Reset Your Password
            </h2>
            {done ? (
              <div>
                <div style={{
                  backgroundColor: '#d1fae5',
                  border: '1px solid #6ee7b7',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '20px',
                  color: '#065f46'
                }}>
                  <strong>✓ Email Sent!</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                    Check your email for password reset instructions. The link will expire in 1 hour.
                  </p>
                </div>
                <button 
                  className="custom-button primary-button"
                  onClick={() => window.location.href = '/onboarding/login'}
                  style={{ width: '100%' }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form onboarding-login-form">
                <div style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  fontSize: '14px',
                  color: '#1e40af',
                  lineHeight: '1.5'
                }}>
                  Enter your email address and we'll send you a link to reset your password.
                </div>
                
                <div className="onboarding-form-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    placeholder="your.email@example.com"
                  />
                </div>
                <button 
                  className="custom-button primary-button" 
                  type="submit" 
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <div className="login-links" style={{ marginTop: 12, textAlign: 'center' }}>
                  <button type="button" className="link-button" onClick={() => window.location.href = '/onboarding/login'}>
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingForgot;


