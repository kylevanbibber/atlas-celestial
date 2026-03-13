import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import './Onboarding.css';
import logo from '../../img/globe1.png';
import quotes from '../../components/utils/quotes';

const OnboardingLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresSetPassword, setRequiresSetPassword] = useState(false);
  const [lastCheckedEmail, setLastCheckedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [randomQuote, setRandomQuote] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract hm parameter from URL
  const searchParams = new URLSearchParams(location.search);
  const hmParam = searchParams.get('hm');

  useEffect(() => {
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  const checkEmail = async (emailToCheck) => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      const res = await api.post('/onboarding/auth/start', { email: emailToCheck });
      const { exists, needsRegistration, needsCompletion, missingFields, existingData, hasPassword } = res.data || {};
      
      // Determine which hm to use (URL param only on login; hiring manager selection is handled on register)
      const effectiveHm = hmParam || null;
      
      // No pipeline record at all - full registration
      if (!exists || needsRegistration) {
        const registerUrl = effectiveHm ? `/onboarding/register?hm=${effectiveHm}` : '/onboarding/register';
        navigate(registerUrl, { state: { email: emailToCheck, hm: effectiveHm } });
        return;
      }
      
      // Pipeline record exists but redeemed = 0 - complete registration with missing fields
      if (needsCompletion) {
        const registerUrl = effectiveHm ? `/onboarding/register?hm=${effectiveHm}` : '/onboarding/register';
        navigate(registerUrl, { 
          state: { 
            email: emailToCheck,
            needsCompletion: true,
            missingFields,
            existingData,
            hm: effectiveHm
          } 
        });
        return;
      }
      
      // User is redeemed, proceed with password check
      setShowPassword(true);
      setRequiresSetPassword(!hasPassword);
      setLastCheckedEmail(emailToCheck);
    } catch (err) {
      setErrorMessage('Unable to continue. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    await checkEmail(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      if (!showPassword) {
        await checkEmail(email);
        return;
      }
      if (requiresSetPassword) {
        await api.post('/onboarding/auth/set-password', { email, password });
        setRequiresSetPassword(false);
      }
      const res = await api.post('/onboarding/auth/login', { email, password });
      if (res.data?.success) {
        console.log('[OnboardingLogin] Login successful, storing token:', res.data.token ? 'Token received' : 'No token');
        localStorage.setItem('onboardingEmail', email);
        localStorage.setItem('onboardingPipelineId', String(res.data.pipeline_id));
        // Store JWT token for authenticated API requests
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
          console.log('[OnboardingLogin] Token stored in localStorage');
          
          // Decode and log token details for debugging
          try {
            const tokenParts = res.data.token.split('.');
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('[OnboardingLogin] Token payload:', {
              id: payload.id,
              email: payload.email,
              role: payload.role,
              exp: payload.exp,
              expiresAt: new Date(payload.exp * 1000).toLocaleString()
            });
          } catch (e) {
            console.error('[OnboardingLogin] Failed to decode token:', e);
          }
        } else {
          console.error('[OnboardingLogin] No token received from server!');
        }
        navigate('/onboarding/home');
      } else {
        setErrorMessage('Invalid credentials.');
      }
    } catch (err) {
      setErrorMessage(requiresSetPassword ? 'Unable to set password.' : 'Invalid credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password requirement if the email changes from the last checked value
  useEffect(() => {
    if (lastCheckedEmail && email.trim().toLowerCase() !== lastCheckedEmail) {
      if (showPassword || requiresSetPassword) {
        setShowPassword(false);
        setRequiresSetPassword(false);
        setPassword('');
      }
    }
  }, [email, lastCheckedEmail, showPassword, requiresSetPassword]);

  // Inline conditional rendering instead of nested component to preserve input focus

  return (
    <div className="auth-background onboarding-auth-background onboarding-root">
      {isLoading && (
        <div className="globe-loading-overlay onboarding-loading-overlay">
          <img src={logo} alt="Loading" className="globe-loading-animation" />
        </div>
      )}
      <div className="login-container onboarding-login-container">
        <div className="login-card onboarding-login-card">
          <div className="left-side onboarding-left-side">
            <h2>Welcome to Onboarding</h2>
            <blockquote>{randomQuote}</blockquote>
          </div>
          <div className="right-side onboarding-right-side">
            <h2>{!showPassword ? 'Get Started' : requiresSetPassword ? 'Set Password' : 'Sign In'}</h2>
            {errorMessage && (
              <div className="error-message">{errorMessage}</div>
            )}
            <form onSubmit={handleSubmit} className="login-form onboarding-login-form">
              <div className="form-group onboarding-form-group">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              
              {showPassword && (
                <div className="form-group onboarding-form-group">
                  <label htmlFor="password">{requiresSetPassword ? 'Set Password' : 'Password'}</label>
                  <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              )}
              <button className="custom-button primary-button onboarding-primary-button" type="submit" disabled={isLoading}>
                {isLoading ? (showPassword ? (requiresSetPassword ? 'Saving...' : 'Signing in...') : 'Checking...') : (showPassword ? (requiresSetPassword ? 'Set Password' : 'Sign In') : 'Continue')}
              </button>
              <div className="login-links onboarding-links" style={{ marginTop: 12 }}>
                <button type="button" className="link-button" onClick={() => navigate('/onboarding/forgot')}>Forgot Password?</button>
              </div>
              {/* Changing the email will automatically reset password requirements */}
              <div className="login-links onboarding-links" style={{ marginTop: 8 }}>
                <button type="button" className="link-button" onClick={() => navigate('/login')}>Back to Agent Login</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingLogin;


