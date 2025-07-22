import React, { useState, useEffect } from "react";
import logo from "../../img/globe1.png"; // Import the loading animation logo

const ChangePassword = ({ onBackToAccount }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPasswordLabel, setCurrentPasswordLabel] = useState("Current Password");
  const [requiresAgentNum, setRequiresAgentNum] = useState(false);
  const [agentNum, setAgentNum] = useState("");
  const [currentPasswordValid, setCurrentPasswordValid] = useState(false);
  const [agentNumValid, setAgentNumValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [isForgotPassword, setIsForgotPassword] = useState(false); // State to toggle forgot password
  const [emailCode, setEmailCode] = useState(""); // State to hold the code sent via email
  
  useEffect(() => {
    const checkPassword = async () => {
      const userId = localStorage.getItem("userId");
      if (!userId) {
        setErrorMessage("User not logged in.");
        return;
      }

      try {
        const response = await fetch(
          `https://ariaslogin-4a95935f6093.herokuapp.com/api/check-password/${userId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const result = await response.json();
        console.log(result);
        if (result.success) {
          if (result.password === null) {
            setCurrentPasswordLabel("Current Password (Agent Number)");
            setRequiresAgentNum(result.agtnumRequired);
          } else {
            setCurrentPasswordLabel("Current Password");
          }
        } else {
          setErrorMessage(result.message || "Failed to check password.");
        }
      } catch (error) {
        setErrorMessage("An error occurred while checking the password.");
      }
    };

    checkPassword();
  }, []);

  const handleBlurCurrentPassword = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setErrorMessage("User not logged in.");
      return;
    }
  
    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/verify-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            currentPassword,
            isAgentNumber: currentPasswordLabel.includes("Agent Number"), // Determine if the label specifies Agent Number
          }),
        }
      );
      const result = await response.json();
      if (result.success) {
        setCurrentPasswordValid(true);
        setErrorMessage("");
      } else {
        setCurrentPasswordValid(false);
        setErrorMessage(result.message || "Validation failed.");
      }
    } catch (error) {
      setErrorMessage("An error occurred while validating the input.");
    }
  };
  
  const handleBlurConfirmPassword = () => {
    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match.");
    } else {
      setErrorMessage("");
    }
  };
  

  const handleBlurAgentNum = async () => {
    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/validate-agentnum",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agtnum: agentNum }),
        }
      );
      const result = await response.json();
      if (result.success) {
        setAgentNumValid(true);
        setErrorMessage("");
      } else {
        setAgentNumValid(false);
        setErrorMessage(result.message || "Agent Number is incorrect.");
      }
    } catch (error) {
      setErrorMessage("An error occurred while validating the Agent Number.");
    }
  };

  const handleForgotPassword = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setErrorMessage("User not logged in.");
      return;
    }
  
    setIsLoading(true); // Show loading overlay
  
    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/send-reset-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        }
      );
  
      const result = await response.json();
      setIsLoading(false); // Hide loading overlay
  
      if (result.success) {
        setErrorMessage("");
        setSuccessMessage("A reset code has been sent to your email.");
        setIsForgotPassword(true); // Toggle to the "Code From Email" field
      } else {
        setErrorMessage(result.message || "Failed to send reset code.");
      }
    } catch (error) {
      setIsLoading(false); // Hide loading overlay
      setErrorMessage("An error occurred while sending the reset code.");
    }
  };

  const handleBlurCode = async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setErrorMessage("User not logged in.");
      return;
    }
  
    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/verify-reset-code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, code: emailCode }),
        }
      );
  
      const result = await response.json();
      if (result.success) {
        setErrorMessage("");
        setSuccessMessage("Code verified. You can now update your password.");
        setCurrentPasswordValid(true); // Mark as valid
      } else {
        setCurrentPasswordValid(false);
        setErrorMessage(result.message || "Invalid or expired code.");
      }
    } catch (error) {
      setErrorMessage("An error occurred while verifying the code.");
    }
  };
  
  
  const handleChangePassword = async () => {
    if (!isForgotPassword && !currentPasswordValid) {
      setErrorMessage("Validation failed. Please ensure all inputs are correct.");
      return;
    }
  
    if (requiresAgentNum && !agentNumValid) {
      setErrorMessage("Validation failed. Please ensure all inputs are correct.");
      return;
    }
  
    if (newPassword !== confirmPassword) {
      setErrorMessage("New passwords do not match.");
      return;
    }
  
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setErrorMessage("User not logged in.");
      return;
    }
  
    // Build the request body
    const body = {
      userId,
      newPassword,
    };
  
    if (isForgotPassword) {
      body.emailCode = emailCode; // Include email code for forgot password flow
    } else if (requiresAgentNum) {
      body.agtnum = currentPassword; // Treat currentPassword as agentNum if required
    } else if (currentPasswordValid) {
      body.currentPassword = currentPassword; // Include currentPassword if valid
    }
  
    console.log("Final Request Body:", body); // Debugging log
  
    setIsLoading(true); // Enable loading overlay
  
    try {
      const response = await fetch(
        "https://ariaslogin-4a95935f6093.herokuapp.com/api/update-password",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
  
      const result = await response.json();
      setIsLoading(false); // Disable loading overlay
  
      if (result.success) {
        setSuccessMessage("Password updated successfully.");
        setErrorMessage("");
      } else {
        setErrorMessage(result.message || "Failed to update password.");
        setSuccessMessage("");
      }
    } catch (error) {
      setIsLoading(false); // Disable loading overlay
      setErrorMessage("An error occurred while updating the password.");
    }
  };
  
  return (
    <div className="app-container">
        {isLoading && (
  <div className="globe-loading-overlay">
    <img src={logo} alt="Loading" className="globe-loading-animation" />
  </div>
)}

<div className="account-setup-register-container">
<a href="#" onClick={onBackToAccount} className="account-setup-back-link">
          &larr; Back to Account
        </a>
        <h3>Update Password</h3>
  <div className="account-setup-register-form">
    {requiresAgentNum && (
      <div className="account-setup-form-field">
        <label>Agent Number</label>
        <input
          type="text"
          value={agentNum}
          onChange={(e) => setAgentNum(e.target.value)}
          onBlur={handleBlurAgentNum}
          className="account-setup-form-input"
        />
      </div>
    )}

    <div className="account-setup-form-field">
      <label>
        {isForgotPassword ? "Code From Email" : currentPasswordLabel}
      </label>
      <input
        type={isForgotPassword ? "text" : "password"}
        value={isForgotPassword ? emailCode : currentPassword}
        onChange={(e) => {
          if (isForgotPassword) {
            setEmailCode(e.target.value);
          } else if (currentPasswordLabel.includes("Agent Number")) {
            setCurrentPassword(e.target.value.toUpperCase());
          } else {
            setCurrentPassword(e.target.value);
          }
        }}
        onBlur={isForgotPassword ? handleBlurCode : handleBlurCurrentPassword}
        className="account-setup-form-input"
      />
    </div>

    {!isForgotPassword && (
      <a
        href="#"
        onClick={handleForgotPassword}
        className="forgot-password-link"
      >
        Forgot Password?
      </a>
    )}

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
    onBlur={handleBlurConfirmPassword}
    className="account-setup-form-input"
  />
</div>

          {errorMessage && <p className="account-setup-error-message">{errorMessage}</p>}
          {successMessage && <p className="success-message">{successMessage}</p>}
          <button onClick={handleChangePassword} className="insured-button">
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
