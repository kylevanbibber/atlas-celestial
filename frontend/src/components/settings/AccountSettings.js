import React, { useState, useEffect } from 'react';
import { FiEdit, FiSave } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import ProfileBanner from './ProfileBanner';
import ProfilePicture from './ProfilePicture';
import { getContentFeedback } from '../../utils/contentFilters';
import '../../pages/settings/Settings.css';

// Account settings component
const AccountSettings = () => {
  const { user, loading: authLoading, updateProfile, updateProfilePicture, removeHeaderImage } = useAuth();
  const [pageLoading, setPageLoading] = useState(true); // Only for initial page load
  const [profilePicLoading, setProfilePicLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false); // For form submissions only
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [originalData, setOriginalData] = useState({});
  const [tenure, setTenure] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    preferredName: '',
    bio: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);
  const [contentWarnings, setContentWarnings] = useState({
    preferredName: '',
    bio: ''
  });
  
  // BIO_MAX_LENGTH constant for bio field
  const BIO_MAX_LENGTH = 255;
  const SCREEN_NAME_MAX_LENGTH = 50;
  
  // Calculate tenure based on esid (start date)
  const calculateTenure = (startDateStr) => {
    if (!startDateStr) return '';
    
    const startDate = new Date(startDateStr);
    const now = new Date();

    // Reset time components to 0 for comparison
    startDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = now - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const weeks = Math.floor((diffDays % 30) / 7);
    const days = diffDays % 7;

    let tenureString = '';

    if (years > 0) {
      tenureString += `${years} year${years > 1 ? 's' : ''}`;
    }

    if (months > 0) {
      if (tenureString) {
        tenureString += `, `;
      }
      tenureString += `${months} month${months > 1 ? 's' : ''}`;
    }

    if (weeks > 0) {
      if (tenureString) {
        tenureString += `, `;
      }
      tenureString += `${weeks} week${weeks > 1 ? 's' : ''}`;
    }

    if (days > 0) {
      if (tenureString) {
        tenureString += `, `;
      }
      tenureString += `${days} day${days > 1 ? 's' : ''}`;
    }

    return tenureString || 'Just started';
  };
  
  // Load user data from auth context
  useEffect(() => {
    if (!authLoading && user) {
      console.log('User data loaded in Settings:', user);
      // Log the specific image-related properties  
      console.log('Profile image properties:', {
        profilePicture: user.profilePicture,
        profpic: user.profpic,
        profileBanner: user.profileBanner,
        headerPic: user.headerPic,
        header_pic: user.header_pic
      });
      
      // Log user fields to help with debugging
      console.log('User data fields:', {
        screen_name: user.screen_name,
        screenName: user.screenName,
        preferredName: user.preferredName
      });
      
      const userData = {
        name: user.name || '',
        // Map screen_name from backend to preferredName in frontend
        // Try all possible field names that might contain the screen name
        preferredName: user.preferredName || user.screenName || user.screen_name || '',
        bio: user.bio || '',
        email: user.email || '',
        phone: user.phone || '',
      };
      
      setFormData({
        ...userData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Store original data for comparison later
      setOriginalData(userData);
      setPageLoading(false);
      
      // Calculate tenure if user has an esid (start date)
      if (user.esid) {
        setTenure(calculateTenure(user.esid));
      }
    }
  }, [user, authLoading]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Apply character limit for specific fields
    if ((name === 'bio' && value.length > BIO_MAX_LENGTH) || 
        (name === 'preferredName' && value.length > SCREEN_NAME_MAX_LENGTH)) {
      return;
    }
    
    setFormData({ ...formData, [name]: value });
    
    // Check for banned content on fields that need moderation
    if (name === 'preferredName') {
      const feedback = getContentFeedback(value, SCREEN_NAME_MAX_LENGTH);
      setContentWarnings(prev => ({
        ...prev,
        preferredName: !feedback.isValid ? feedback.message : ''
      }));
    } else if (name === 'bio') {
      const feedback = getContentFeedback(value, BIO_MAX_LENGTH);
      setContentWarnings(prev => ({
        ...prev,
        bio: !feedback.isValid ? feedback.message : ''
      }));
    }
  };

  const handleProfilePictureUpdate = async (fileObject) => {
    setError('');
    setSuccess('');
    setProfilePicLoading(true);
    
    try {
      // Handle null or file object
      const result = await updateProfilePicture(fileObject);
      
      if (result.success) {
        setSuccess(result.message || 'Profile picture updated successfully');
      } else {
        setError(result.message || 'Failed to update profile picture');
      }
    } catch (err) {
      console.error('Error updating profile picture:', err);
      setError('An error occurred while updating the profile picture');
    } finally {
      setProfilePicLoading(false);
    }
  };
  
  const handleProfileBannerUpdate = async (newBannerUrl) => {
    setError('');
    setSuccess('');
    setBannerLoading(true);
    
    try {
      if (newBannerUrl === null) {
        // Use the dedicated function to remove header image
        const result = await removeHeaderImage();
        if (result.success) {
          setSuccess(result.message || 'Profile banner removed successfully');
        } else {
          setError(result.message || 'Failed to remove profile banner');
        }
      } else {
        // Upload new banner image
        const success = await updateProfile({ 
          profileBanner: newBannerUrl 
        });
        
        if (success) {
          setSuccess('Profile banner updated successfully');
        } else {
          setError('Failed to update profile banner');
        }
      }
    } catch (err) {
      console.error('Error updating profile banner:', err);
      setError('An error occurred while updating the profile banner');
    } finally {
      setBannerLoading(false);
    }
  };

  // Determine which fields have changed from the original data
  const getChangedFields = () => {
    const changedFields = {};
    
    // Compare each field with original data
    if (formData.preferredName !== originalData.preferredName) {
      // Map preferredName to screenName for the database
      changedFields.screenName = formData.preferredName;
    }
    
    if (formData.bio !== originalData.bio) {
      changedFields.bio = formData.bio;
    }
    
    if (formData.email !== originalData.email) {
      changedFields.email = formData.email;
    }
    
    if (formData.phone !== originalData.phone) {
      changedFields.phone = formData.phone;
    }
    
    // Password fields always go through if provided
    if (formData.currentPassword) {
      changedFields.currentPassword = formData.currentPassword;
      
      if (formData.newPassword) {
        changedFields.newPassword = formData.newPassword;
      }
    }
    
    return changedFields;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Check for inappropriate content before submitting
    if (contentWarnings.preferredName || contentWarnings.bio) {
      setError('Please address content warnings before saving.');
      return;
    }
    
    setFormSubmitting(true);

    // Basic validation
    if (!formData.email) {
      setError('Email is required');
      setFormSubmitting(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setFormSubmitting(false);
      return;
    }

    // Password validation if changing password
    if (formData.newPassword || formData.confirmPassword || formData.currentPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        setFormSubmitting(false);
        return;
      }
      if (!formData.currentPassword) {
        setError('Current password is required to set a new password');
        setFormSubmitting(false);
        return;
      }
      if (formData.newPassword.length < 8) {
        setError('New password must be at least 8 characters long');
        setFormSubmitting(false);
        return;
      }
    }

    // Get only changed fields
    const changedFields = getChangedFields();
    
    // Check if there are any changes at all
    if (Object.keys(changedFields).length === 0) {
      setSuccess('No changes to save');
      setFormSubmitting(false);
      setEditing(false);
      return;
    }

    // Check if email is being changed
    const isEmailChanged = user.email !== formData.email;
    if (isEmailChanged) {
      setPendingSubmitData(changedFields);
      setEmailDialogOpen(true);
      setFormSubmitting(false);
      return;
    }

    // Otherwise proceed with the update using only changed fields
    await saveUserData(changedFields);
  };

  const saveUserData = async (data) => {
    setFormSubmitting(true);
    
    try {
      // Call the updateProfile function from auth context with only the changed fields
      const success = await updateProfile(data);
      
      if (success) {
        setSuccess('Profile updated successfully');
        setEditing(false);
        
        // Update original data with new values to reflect current state
        // Map screen_name back to preferredName if it exists in the data
        const updatedOriginalData = { ...originalData };
        
        if (data.screenName !== undefined) {
          updatedOriginalData.preferredName = data.screenName;
        }
        
        // Copy other fields directly
        Object.keys(data).forEach(key => {
          if (key !== 'screenName' && key !== 'currentPassword' && key !== 'newPassword') {
            updatedOriginalData[key] = data[key];
          }
        });
        
        setOriginalData(updatedOriginalData);
        
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }));
      } else {
        setError('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('An error occurred while updating the profile');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle email dialog responses
  const handleEmailDialogConfirm = async () => {
    if (pendingSubmitData) {
      setFormSubmitting(true);
      await saveUserData(pendingSubmitData);
      setFormSubmitting(false);
    }
    setEmailDialogOpen(false);
    setPendingSubmitData(null);
  };

  const handleEmailDialogCancel = () => {
    setEmailDialogOpen(false);
    setPendingSubmitData(null);
  };

  if (authLoading || pageLoading) {
    return <div className="settings-section">Loading...</div>;
  }

  return (
    <div className="settings-section">
      <div className="settings-header">
        <h1 className="settings-section-title">My Profile</h1>
        <button 
          className="settings-icon-button"
          onClick={() => setEditing(!editing)}
          aria-label={editing ? "Cancel editing" : "Edit profile"}
        >
          {editing ? <span className="cancel-icon">&times;</span> : <FiEdit />}
        </button>
      </div>
      
      {error && <div className="settings-alert settings-alert-error">{error}</div>}
      {success && <div className="settings-alert settings-alert-success">{success}</div>}
      
      <form onSubmit={handleSave}>
        <div className="settings-profile-vertical">
          {/* Profile Banner */}
          <ProfileBanner 
            bannerUrl={user?.profileBanner || user?.headerPic || user?.header_pic} 
            onUpdate={handleProfileBannerUpdate} 
            onRemove={() => handleProfileBannerUpdate(null)} 
            isLoading={bannerLoading}
          />
          
          {/* Profile Picture */}
          <div className="settings-profile-picture-wrapper">
            <ProfilePicture 
              pictureUrl={user?.profilePicture} 
              onUpdate={handleProfilePictureUpdate} 
              onRemove={() => handleProfilePictureUpdate(null)} 
              isLoading={profilePicLoading}
            />
            <p className="settings-help-text">Click the camera icon to update your profile picture</p>
          </div>
          
          {/* User Role and Tenure */}
          <div className="user-profile-metadata">
            {user?.clname && (
              <span
                className="user-role-badge"
                style={{
                  backgroundColor:
                    user.clname === "AGT" ? "lightgrey" :
                    user.clname === "SA" ? "rgb(178, 82, 113)" :
                    user.clname === "GA" ? "rgb(237, 114, 47)" :
                    user.clname === "MGA" ? "rgb(104, 182, 117)" :
                    user.clname === "RGA" ? "#00558c" :
                    "transparent",
                  border: `2px solid ${
                    user.clname === "AGT" ? "grey" :
                    user.clname === "SA" ? "rgb(138, 62, 93)" :
                    user.clname === "GA" ? "rgb(197, 94, 37)" :
                    user.clname === "MGA" ? "rgb(84, 152, 97)" :
                    user.clname === "RGA" ? "#004372" :
                    "transparent"
                  }`,
                  color: "#fff",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  display: "inline-block",
                  margin: "0 8px",
                  textShadow: "0px 1px 2px rgba(0,0,0,0.2)"
                }}
              >
                {user.clname}
              </span>
            )}
            
            {tenure && (
              <div className="user-tenure">
                <strong>Tenure:</strong> {tenure}
                {user.esid && (
                  <div className="start-date">
                    <small>Started {new Date(user.esid).toLocaleDateString("en-US")}</small>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Personal Information */}
          <div className="settings-card">
            <h2 className="settings-card-title">Personal Information</h2>
            
            <div className="settings-row">
              <label htmlFor="name">Name</label>
              <div className="input-with-feedback">
                <input 
                  id="name"
                  type="text" 
                  name="name"
                  value={formData.name} 
                  onChange={handleChange} 
                  disabled={true}
                  placeholder="Your full name"
                  readOnly
                />
              </div>
            </div>
            
            <div className="settings-row">
              <label htmlFor="preferredName">
                Preferred Name
                {editing && (
                  <span className="character-count">
                    {formData.preferredName.length}/{SCREEN_NAME_MAX_LENGTH}
                  </span>
                )}
              </label>
              <div className="input-with-feedback">
                <input 
                  id="preferredName"
                  type="text" 
                  name="preferredName"
                  value={formData.preferredName} 
                  onChange={handleChange} 
                  disabled={!editing}
                  placeholder="How should we address you?"
                  maxLength={SCREEN_NAME_MAX_LENGTH}
                />
                {contentWarnings.preferredName && (
                  <div className="input-warning">{contentWarnings.preferredName}</div>
                )}
              </div>
            </div>
            
            <div className="settings-row">
              <label htmlFor="bio">
                Bio 
                {editing && (
                  <span className="character-count">
                    {formData.bio.length}/{BIO_MAX_LENGTH}
                  </span>
                )}
              </label>
              <div className="input-with-feedback">
                <textarea 
                  id="bio"
                  name="bio"
                  value={formData.bio} 
                  onChange={handleChange} 
                  disabled={!editing}
                  placeholder="Tell us a bit about yourself"
                  maxLength={BIO_MAX_LENGTH}
                  rows="4"
                />
                {contentWarnings.bio && (
                  <div className="input-warning">{contentWarnings.bio}</div>
                )}
              </div>
            </div>
            
            <div className="settings-row">
              <label htmlFor="email">Email</label>
              <div className="input-with-feedback">
                <input 
                  id="email"
                  type="email" 
                  name="email"
                  value={formData.email} 
                  onChange={handleChange} 
                  disabled={!editing}
                  placeholder="Your email"
                  required
                />
              </div>
            </div>
            
            <div className="settings-row">
              <label htmlFor="phone">Phone</label>
              <div className="input-with-feedback">
                <input 
                  id="phone"
                  type="tel" 
                  name="phone"
                  value={formData.phone} 
                  onChange={handleChange} 
                  disabled={!editing}
                  placeholder="Your phone number"
                />
              </div>
            </div>
            
            {editing && (
              <>
                <h3 className="settings-subtitle">Change Password</h3>
                
                <div className="settings-row">
                  <label htmlFor="currentPassword">Current Password</label>
                  <div className="input-with-feedback">
                    <input 
                      id="currentPassword"
                      type="password" 
                      name="currentPassword"
                      value={formData.currentPassword}
                      onChange={handleChange}
                      placeholder="Required to change password"
                    />
                  </div>
                </div>
                
                <div className="settings-row settings-row-grid">
                  <div className="settings-field">
                    <label htmlFor="newPassword">New Password</label>
                    <div className="input-with-feedback">
                      <input 
                        id="newPassword"
                        type="password" 
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleChange}
                        placeholder="New password (min. 8 characters)"
                      />
                    </div>
                  </div>
                  
                  <div className="settings-field">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <div className="input-with-feedback">
                      <input 
                        id="confirmPassword"
                        type="password" 
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {editing && (
              <button type="submit" className="settings-button" disabled={formSubmitting || contentWarnings.preferredName || contentWarnings.bio}>
                {formSubmitting ? (
                  <>
                    <div className="spinner button-spinner"></div>
                    <span style={{ marginLeft: '8px' }}>Saving...</span>
                  </>
                ) : (
                  <>
                    <FiSave style={{ marginRight: '5px' }} /> Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Email change confirmation dialog */}
      {emailDialogOpen && (
        <div className="settings-dialog-backdrop">
          <div className="settings-dialog">
            <h3 className="settings-dialog-title">Confirm Email Address Change</h3>
            <p className="settings-dialog-content">
              You are about to change your email address from <strong>{user?.email}</strong> to <strong>{formData.email}</strong>. 
              This will affect how you log in to your account. Are you sure you want to proceed?
            </p>
            <div className="settings-dialog-actions">
              <button 
                className="settings-button settings-button-secondary" 
                onClick={handleEmailDialogCancel}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button 
                className="settings-button" 
                onClick={handleEmailDialogConfirm}
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <>
                    <div className="spinner button-spinner"></div>
                    <span style={{ marginLeft: '8px' }}>Confirming...</span>
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings; 