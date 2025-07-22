import React, { useState } from "react";
import logo from "../../img/globe1.png"; // Import the loading animation logo

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

  const handleSendResetCode = async () => {
    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/send-reset-code-by-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setSuccessMessage("Reset code sent to your email.");
        setIsCodeSent(true);
        localStorage.setItem("userId", result.userId); // Save the userId
      } else {
        setErrorMessage(result.message || "Failed to send reset code.");
      }
    } catch (error) {
      setErrorMessage("An error occurred while sending the reset code.");
    }
  };

  const handleVerifyCode = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    const userId = localStorage.getItem("userId"); // Retrieve userId from localStorage

    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/verify-reset-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, code: emailCode }), // Use userId and emailCode
        }
      );

      const result = await response.json();
      setIsLoading(false);

      if (result.success) {
        setSuccessMessage("Code verified. You can now reset your password.");
        setIsCodeVerified(true);
      } else {
        setErrorMessage(result.message || "Invalid or expired reset code.");
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage("An error occurred while verifying the reset code.");
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

    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/update-password",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, emailCode, newPassword }), // Use userId, emailCode, and newPassword
        }
      );

      const result = await response.json();
      setIsLoading(false);

      if (result.success) {
        setSuccessMessage("Password reset successfully. You can now log in.");
      } else {
        setErrorMessage(result.message || "Failed to reset password.");
      }
    } catch (error) {
      setIsLoading(false);
      setErrorMessage("An error occurred while resetting the password.");
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
              >
                Send Reset Code
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
              >
                Verify Code
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
              <button
                onClick={handleResetPassword}
                className="insured-button"
              >
                Reset Password
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
