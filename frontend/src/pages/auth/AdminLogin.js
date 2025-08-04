import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
// Removed direct api import - now using AuthContext login function
import logo from '../../img/globe1.png';
import './Login.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    if (!username || !password) {
      setErrorMessage('Please enter both username and password');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Attempting admin login for:', username);
      
      // Use the AuthContext login function (now uses regular /auth/newlogin endpoint)
      const result = await login({ username, password });
      
      console.log('Admin login result:', result);

      if (result.success) {
        // Navigate to dashboard on successful login
        navigate('/dashboard');
      } else if (result.needsSetup) {
        setErrorMessage('Admin account requires setup. Please contact system administrator.');
      } else {
        setErrorMessage(result.message || 'Admin login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="auth-background">
        {isLoading && (
          <div className="globe-loading-overlay">
            <img src={logo} alt="Loading" className="globe-loading-animation" />
          </div>
        )}
        <div className="login-container">
          {/* Login Card */}
          <div className="login-card">
            <div className="left-side">
              <h2>Admin Portal</h2>
              <blockquote>
                Access administrative tools and manage system settings with enhanced privileges.
              </blockquote>
            </div>
            <div className="right-side">
              <h2>Admin Sign In</h2>
              {errorMessage && (
                <div className="error-message">
                  {errorMessage}
                </div>
              )}
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="username">Admin Username</label>
                  <input
                    id="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <button className="custom-button primary-button" type="submit" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
              <div className="login-links">
                <Link to="/login">
                  ← Back to User Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;