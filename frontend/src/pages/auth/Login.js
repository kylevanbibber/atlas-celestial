import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '../../img/globe1.png';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import Modal from '../../components/utils/Modal'; // Use your custom modal component
import './Login.css'; // Your custom CSS for styling the login page
import quotes from '../../components/utils/quotes'; // Import your quotes array
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAriasModal, setShowAriasModal] = useState(false); // State for Arias modal
  const [showRegister, setShowRegister] = useState(false); // Toggle for Register component
  const [registerData, setRegisterData] = useState({}); // Store data for Register component
  const [showChangePassword, setShowChangePassword] = useState(false); // Toggle for ChangePassword component
  const [randomQuote, setRandomQuote] = useState(''); // State for random quote
  const [errorMessage, setErrorMessage] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth(); // Use our auth hook
  
  // Get redirect path from location state (if navigated from a protected route)
  const from = location.state?.from || '/';

  useEffect(() => {
    // Only redirect when authentication changes and we're authenticated
    // Also prevent redirection while still loading
    if (auth.isAuthenticated && !auth.loading) {
      // Get intended path from localStorage or fallback to dashboard
      const intendedPath = localStorage.getItem('intendedPath') || '/dashboard';
      localStorage.removeItem('intendedPath'); // Clear after use
      console.log(`Login: User is authenticated, redirecting to ${intendedPath}`);
      navigate(intendedPath, { replace: true });
    }
    
    // Set random quote
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, [auth.isAuthenticated, auth.loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
  
    if (username.toLowerCase() === 'arias') {
      setShowAriasModal(true);
      return;
    }
  
    setIsLoading(true);
  
    try {
      // Use our auth context to handle login with the /auth/newlogin endpoint
      const result = await auth.login({ username, password });
      
      if (result.success) {
        // Navigate to the intended destination from localStorage or default to dashboard
        const intendedPath = localStorage.getItem('intendedPath') || '/dashboard';
        localStorage.removeItem('intendedPath'); // Clear after use
        navigate(intendedPath, { replace: true });
      } else if (result.needsSetup) {
        // User needs to complete account setup
        setRegisterData(result.registerData);
        setShowRegister(true);
      } else {
        setErrorMessage(result.message || auth.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred. Please try again later.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  return (
    <>
    <div className="auth-background">
      {showRegister ? (
        <Register
          onBackToLogin={() => setShowRegister(false)}
          id={registerData.id}
          lagnname={registerData.lagnname}
          esid={registerData.esid}
          email={registerData.email}
          phone={registerData.phone}
          screenName={registerData.screenName}
        />
      ) : showChangePassword ? (
        <ForgotPassword onBackToLogin={() => setShowChangePassword(false)} />
      ) : (
        <>
          {isLoading && (
            <div className="globe-loading-overlay">
              <img src={logo} alt="Loading" className="globe-loading-animation" />
            </div>
          )}
          <div className="login-container">
            {/* Login Card */}
            <div className="login-card">
              <div className="left-side">
                <h2>Welcome back!</h2>
                <blockquote>{randomQuote}</blockquote>
              </div>
              <div className="right-side">
                <h2>Sign In</h2>
                {errorMessage && (
                  <div className="error-message">
                    {errorMessage}
                  </div>
                )}
                <form onSubmit={handleLogin} className="login-form">
                  <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={handlePasswordChange}
                    />
                  </div>
                  <div className="login-links" style={{ marginTop: '-10px' }}>
                    <a href="#" onClick={() => setShowChangePassword(true)}>
                      Forgot Password?
                    </a>
                  </div>
                  <button className="custom-button primary-button" type="submit" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : 'Log In'}
                  </button>
                </form>
                <div className="login-links">
                  <a href="#" onClick={() => setShowInfoModal(true)}>
                    I don't know my login/don't have one
                  </a>
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                      className="secondary-button"
                      onClick={() => navigate('/onboarding/login')}
                    >
                      Onboarding Login
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Modal using custom Modal */}
          <Modal
            isOpen={showInfoModal}
            onClose={() => setShowInfoModal(false)}
            title="Login Help"
          >
            <p>Your account may be accessed the day after receiving your agent number.</p>
            <p>Your username is the first letter of your first name + your full government last name.</p>
            <p>Example: Bernard Rapoport's username would be:</p>
            <input type="text" value="BRAPOPORT" disabled />
            <p>Your default password is your most current agent number.</p>
          </Modal>

          {/* Arias Modal using custom Modal */}
          <Modal
            isOpen={showAriasModal}
            onClose={() => setShowAriasModal(false)}
            title="Important Notice"
          >
            <h1>The Agent Portal has undergone an update</h1>
            <h3>
              The default usernames <strong>arias, mga, and big4</strong> will no longer work.
            </h3>
            <h5>Please log in using your personal agent account. Information on how to access this account is below.</h5>
            <p>Your account may be accessed the day after receiving your agent number.</p>
            <p>Your username is the first letter of your first name + your full government last name.</p>
            <p>Example: Bernard Rapoport's username would be:</p>
            <input type="text" value="BRAPOPORT" disabled />
            <p>Your default password is your most current agent number.</p>
            <p>If you have any questions, please contact your MGA, or email us at account@ariaslife.com.</p>
          </Modal>
        </>
      )}
      </div>
    </>
  );
};

export default Login;
