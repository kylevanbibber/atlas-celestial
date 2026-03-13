import React, { useState } from "react";
import logo from "../../img/globe1.png"; // Import the loading animation logo
import api from "../../api"; // Import our configured API
import Modal from "../../components/utils/Modal";

const ForgotPassword = ({ onBackToLogin }) => {
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleSendResetCode = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);
    try {
      const response = await api.post("/auth/send-reset-code-by-email", { email });
      
      setIsLoading(false);

      if (response.data.success) {
        setSuccessMessage("Reset code sent to your email.");
        setIsCodeSent(true);
        localStorage.setItem("userId", response.data.userId); // Save the userId
        localStorage.setItem("resetEmail", email); // Save the email for subsequent requests
      } else {
        setErrorMessage(response.data.message || "Failed to send reset code.");
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.response?.data?.message || "An error occurred while sending the reset code.");
    }
  };

  const handleVerifyCode = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const userId = localStorage.getItem("userId"); // Retrieve userId from localStorage
    const resetEmail = localStorage.getItem("resetEmail"); // Retrieve email from localStorage

    try {
      const response = await api.post("/auth/verify-reset-code", { 
        userId, 
        email: resetEmail,
        code: emailCode.trim().toUpperCase() 
      });

      setIsLoading(false);

      if (response.data.success) {
        setSuccessMessage("Code verified. You can now reset your password.");
        setIsCodeVerified(true);
      } else {
        setErrorMessage(response.data.message || "Invalid or expired reset code.");
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.response?.data?.message || "An error occurred while verifying the reset code.");
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const userId = localStorage.getItem("userId"); // Retrieve userId from localStorage
    const resetEmail = localStorage.getItem("resetEmail"); // Retrieve email from localStorage

    try {
      const response = await api.put("/auth/update-password", { 
        userId, 
        email: resetEmail,
        emailCode: emailCode.trim().toUpperCase(), 
        newPassword 
      });

      setIsLoading(false);

      if (response.data.success) {
        setSuccessMessage("Password reset successfully. You can now log in.");
        try { localStorage.removeItem("userId"); localStorage.removeItem("resetEmail"); } catch (_) {}
      } else {
        setErrorMessage(response.data.message || "Failed to reset password.");
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(error.response?.data?.message || "An error occurred while resetting the password.");
    }
  };

  return (
    <div className="app-container">
      {isLoading && (
        <div className="globe-loading-overlay">
          <img src={logo} alt="Loading" className="globe-loading-animation" />
        </div>
      )}

      <div className="change-password-container">
        <a href="#" onClick={onBackToLogin} className="account-setup-back-link">
          &larr; Back to Login
        </a>
        <h3>Forgot Password</h3>
        <div className="account-setup-register-form">
          <p>If this is your first time logging in resetting your password will not work. Please see <a href="#" onClick={() => setShowInfoModal(true)}>
                    I don't know my login/don't have one
                  </a> if you need help.
                  </p>
                  <hr style={{ marginBottom: '20px' }} />
          {!isCodeSent ? (
            <>
              <div className="account-setup-form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="account-setup-form-input"
                />
              </div>
              {errorMessage && (
                <p className="account-setup-error-message">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="success-message">{successMessage}</p>
              )}
              <button
                onClick={handleSendResetCode}
                className="insured-button"
                disabled={isLoading || !email}
              >
                {isLoading ? "Sending..." : "Send Reset Code"}
              </button>
            </>
          ) : !isCodeVerified ? (
            <>
              <div className="account-setup-form-field">
                <label>Enter Reset Code</label>
                <input
                  type="text"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  className="account-setup-form-input"
                />
              </div>
              {errorMessage && (
                <p className="account-setup-error-message">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="success-message">{successMessage}</p>
              )}
              <button
                onClick={handleVerifyCode}
                className="insured-button"
                disabled={isLoading || !emailCode}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </button>
            </>
          ) : (
            <>
              <div className="account-setup-form-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="account-setup-form-input"
                />
              </div>
              <div className="account-setup-form-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="account-setup-form-input"
                />
              </div>
              {errorMessage && (
                <p className="account-setup-error-message">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="success-message">{successMessage}</p>
              )}
              <button style={{ marginTop: '20px' }}
                onClick={handleResetPassword}
                className="insured-button"
                disabled={
                  isLoading ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword
                }
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </button>
            </>
          )}
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
        </div>
    </div>
  );
};

export default ForgotPassword;
