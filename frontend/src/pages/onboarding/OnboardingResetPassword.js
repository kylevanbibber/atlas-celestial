import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import './Onboarding.css';
import logo from '../../img/globe1.png';
import quotes from '../../components/utils/quotes';

const OnboardingResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [randomQuote, setRandomQuote] = useState('');

  useEffect(() => {
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('No reset token provided');
        setValidating(false);
        return;
      }

      try {
        const res = await api.get(`/onboarding/auth/validate-reset-token?token=${token}`);
        if (res.data.success) {
          setTokenValid(true);
          setEmail(res.data.email);
        } else {
          setError(res.data.message || 'Invalid or expired reset token');
        }
      } catch (err) {
        setError('Invalid or expired reset token');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/onboarding/auth/reset', {
        token,
        password
      });

      if (res.data.success) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/onboarding/login');
        }, 3000);
      } else {
        setError(res.data.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="auth-background onboarding-auth-background onboarding-root">
        <div className="globe-loading-overlay onboarding-loading-overlay">
          <img src={logo} alt="Loading" className="globe-loading-animation" />
        </div>
      </div>
    );
  }

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
              Reset Your Password
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
            {!tokenValid ? (
              <div>
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '20px',
                  color: '#991b1b'
                }}>
                  <strong>⚠️ {error || 'Invalid Reset Link'}</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                    This password reset link is invalid or has expired. Please request a new one.
                  </p>
                </div>
                <button 
                  className="custom-button primary-button"
                  onClick={() => navigate('/onboarding/forgot')}
                  style={{ width: '100%' }}
                >
                  Request New Reset Link
                </button>
                <div className="login-links" style={{ marginTop: 12, textAlign: 'center' }}>
                  <button type="button" className="link-button" onClick={() => navigate('/onboarding/login')}>
                    Back to Login
                  </button>
                </div>
              </div>
            ) : success ? (
              <div>
                <div style={{
                  backgroundColor: '#d1fae5',
                  border: '1px solid #6ee7b7',
                  borderRadius: '6px',
                  padding: '16px',
                  marginBottom: '20px',
                  color: '#065f46'
                }}>
                  <strong>✓ Password Reset Successful!</strong>
                  <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                    Your password has been reset. Redirecting to login...
                  </p>
                </div>
                <button 
                  className="custom-button primary-button"
                  onClick={() => navigate('/onboarding/login')}
                  style={{ width: '100%' }}
                >
                  Go to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {email && (
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    color: '#1e40af'
                  }}>
                    Resetting password for: <strong>{email}</strong>
                  </div>
                )}

                {error && (
                  <div style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    color: '#991b1b'
                  }}>
                    {error}
                  </div>
                )}

                <div className="onboarding-form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                  />
                </div>

                <div className="onboarding-form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Re-enter your password"
                  />
                </div>

                <button 
                  className="custom-button primary-button" 
                  type="submit" 
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>

                <div className="login-links" style={{ marginTop: 12, textAlign: 'center' }}>
                  <button type="button" className="link-button" onClick={() => navigate('/onboarding/login')}>
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

export default OnboardingResetPassword;

