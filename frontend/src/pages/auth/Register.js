import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import dodontimg from '../../img/dodont.png';
const AccountSetupPage = ({ onBackToLogin, lagnname, email: defaultEmail, phone: defaultPhone, id }) => {
  const [formData, setFormData] = useState({
    email: defaultEmail || '',
    phone: defaultPhone || '',
    screenName: '',
    profilePicture: '', // State for profile picture
  });

  const [phoneNumber, setPhoneNumber] = useState({
    areaCode: '',
    prefix: '',
    lineNumber: '',
  });

  const areaCodeRef = useRef(null);
  const prefixRef = useRef(null);
  const lineNumberRef = useRef(null);

  const navigate = useNavigate();

  const [errors, setErrors] = useState({ email: '', phone: '' });
  const [imagePreview, setImagePreview] = useState('https://via.placeholder.com/150');
  const [profilePicture, setProfilePicture] = useState('');
  const [userData, setUserData] = useState(null);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false); // Control overlay visibility
  const handleToggleInfoOverlay = () => setShowInfoOverlay(!showInfoOverlay); // Toggle overlay
  const [notification, setNotification] = useState({
    message: '',
    type: '' // 'error' or 'success'
});
const [showModal, setShowModal] = useState(false);
const [modalContent, setModalContent] = useState({
    conflictMessage: '',
    email: '',
    phone: '',
    screenName: '',
    isDecisionMade: false,
});
  useEffect(() => {
    const formattedName = formatScreenName(lagnname);
    setFormData((prev) => ({ ...prev, screenName: formattedName }));
  }, [lagnname]);

  const formatScreenName = (name) => {
    if (!name) return '';
    const parts = name.split(' ').filter(Boolean);
    const last = parts[0] || '';
    const first = parts[1] || '';

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

    const formattedFirst = capitalize(first);
    const formattedLast = capitalize(last);

    return `${formattedFirst} ${formattedLast}`.trim();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^\d{10}$/.test(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Validate email and phone
    const emailError = validateEmail(formData.email) ? '' : 'Invalid email address.';
    const phoneError = validatePhone(formData.phone) ? '' : 'Phone must be 10 digits.';
    setErrors({ email: emailError, phone: phoneError });
  
    if (emailError || phoneError) return;
  
    const fullPhoneNumber = `1(${phoneNumber.areaCode})${phoneNumber.prefix}-${phoneNumber.lineNumber}`;
  
    try {
      // Step 1: Check for existing user
      const response = await fetch('https://ariaslogin-4a95935f6093.herokuapp.com/api/checkUserInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          phone: fullPhoneNumber,
          esid: formData.esid,
          lagnname: lagnname,
          id: id, // Include ID here
        }),
      });
  
      const data = await response.json();
  
      if (data.success) {
        // No conflict, proceed with account update/creation
        const createResponse = await fetch('https://ariaslogin-4a95935f6093.herokuapp.com/api/handleUserInfo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: id, // Include ID here
            screenName: formData.screenName,
            email: formData.email,
            phone: fullPhoneNumber,
            esid: formData.esid,
            lagnname: lagnname,
            decision: 'new',
          }),
        });
  
        const createData = await createResponse.json();
  
        if (createData.success) {
          alert('Account setup completed successfully!');
          onBackToLogin();
        } else {
          alert(createData.message || 'Failed to create/update user. Please try again.');
        }
      } else {
        // Conflict exists, show modal
        setShowModal(true);
        setModalContent({
          conflictMessage: 'An account already exists with this information. Please enter a new email or phone number.',
          email: data.data?.email || '',
          phone: data.data?.phone || '',
          screenName: data.data?.screenName || '',
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('An error occurred while processing your request. Please try again.');
    }
  };
  
  

  const handlePhoneNumberChange = (e, field, nextRef, prevRef) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= e.target.maxLength) {
      setPhoneNumber((prev) => ({ ...prev, [field]: value }));
    }

    if (value.length === e.target.maxLength && nextRef) nextRef.current.focus();
    if (e.key === 'Backspace' && value.length === 0 && prevRef) prevRef.current.focus();
  };

  useEffect(() => {
    const fullPhoneNumber = `${phoneNumber.areaCode}${phoneNumber.prefix}${phoneNumber.lineNumber}`;
    setFormData((prev) => ({ ...prev, phone: fullPhoneNumber }));
  }, [phoneNumber]);

  const handleFileChange = async (e) => {
    console.log('triggered');
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const formDataPayload = new FormData();
      formDataPayload.append('profilePic', selectedFile);
      formDataPayload.append('userId', id); // Use id from props
  
      try {
        const response = await fetch('https://ariaslogin-4a95935f6093.herokuapp.com/api/upload-profile-pic', {
          method: 'POST',
          body: formDataPayload,
        });
        const result = await response.json();
        if (result.success) {
          setProfilePicture(result.filePath);
          setImagePreview(result.filePath); // Update preview
        } else {
          console.error('Failed to upload profile picture');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };
  

  const handleRemovePicture = async () => {
    try {
      const response = await fetch('https://ariaslogin-4a95935f6093.herokuapp.com/api/remove-profile-picture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: id }), // Use id from props
      });
  
      const result = await response.json();
      if (result.success) {
        setProfilePicture('');
        setImagePreview('https://via.placeholder.com/150');
      } else {
        console.error('Failed to remove profile picture');
      }
    } catch (error) {
      console.error('Error removing profile picture:', error);
    }
  };
  



  return (
    <div className="app-container">
      <div className="account-setup-register-container">
        <a href="#" onClick={onBackToLogin} className="account-setup-back-link">
          &larr; Back to Login
        </a>
        <h2 className="account-setup-register-header">Welcome, {formData.screenName}.</h2>
        <p className="account-setup-description">
          Enter the info below to complete your Arias Life account setup.
        </p>
        <p className="account-setup-description-small">
          It is not required to have an Arias Life account to maintain a contract with Arias Organization. This site is meant to be used as a tool for your convenience.
        </p>
        {/* Info Overlay */}
        {showInfoOverlay && (
          <div className="info-overlay">
            <div className="info-overlay-content">
              <span className="close-overlay" onClick={handleToggleInfoOverlay}>
                &times;
              </span>
              <img src={dodontimg} alt="Do's and Don'ts" className="info-image" />
            </div>
          </div>
        )}
{showModal && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h4>Account Conflict</h4>
      <p>{modalContent.conflictMessage}</p>
      <ul>
        {modalContent.email && <li><strong>Email:</strong> {modalContent.email}</li>}
        {modalContent.phone && <li><strong>Phone:</strong> {modalContent.phone}</li>}
      </ul>
      <button
        className="insured-button"
        onClick={() => setShowModal(false)}
      >
        Close
      </button>
    </div>
  </div>
)}


        <div className="image-container">
  <img
    src={imagePreview}
    alt="Profile"
    className="profile-image"
  />
  <p className="account-setup-description-small">Setting a profile picture is not required for account setup.</p>
        <div className="image-options" style={{ marginTop: '5px'}}>
          <button
            onClick={handleToggleInfoOverlay}
            className="insured-button"
            style={{ marginRight: '5px' }}
          >
            ℹ
          </button>

          {/* Upload Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('fileInput').click();
            }}
            className="insured-button"
          >
            Upload
          </button>

          {/* Remove Button */}
          {formData.profilePicture && (
            <button
              onClick={() => handleRemovePicture()}
              className="insured-button"
            >
              Remove
            </button>
          )}
        </div>




</div>
<input
  type="file"
  id="fileInput"
  style={{ display: 'none' }}
  accept="image/*"
  onChange={handleFileChange}
/>


        <form onSubmit={handleSubmit} className="account-setup-register-form">
          <div className="account-setup-form-field">
            <label className="account-setup-form-label">*Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="account-setup-form-input"
            />
            {errors.email && <span className="account-setup-error-message">{errors.email}</span>}
          </div>

          <div className="account-setup-form-field">
            <label className="account-setup-form-label">*Phone</label>
            <div className="phone-number-container">
              <input
                type="text"
                id="area-code"
                ref={areaCodeRef}
                maxLength="3"
                required
                autoComplete="off"
                value={phoneNumber.areaCode}
                onChange={(e) => handlePhoneNumberChange(e, 'areaCode', prefixRef)}
                className="account-setup-form-input"
              />
              <input
                type="text"
                id="prefix"
                ref={prefixRef}
                maxLength="3"
                required
                autoComplete="off"
                value={phoneNumber.prefix}
                onChange={(e) => handlePhoneNumberChange(e, 'prefix', lineNumberRef, areaCodeRef)}
                className="account-setup-form-input"
              />
              <input
                type="text"
                id="line-number"
                ref={lineNumberRef}
                maxLength="4"
                required
                autoComplete="off"
                value={phoneNumber.lineNumber}
                onChange={(e) => handlePhoneNumberChange(e, 'lineNumber', null, prefixRef)}
                className="account-setup-form-input"
              />
            </div>
            {errors.phone && <span className="account-setup-error-message">{errors.phone}</span>}
          </div>

          <button type="submit" className="account-setup-submit-button">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};

export default AccountSetupPage;
