import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { toast } from 'react-toastify';
import { uploadImageToImgur } from '../../utils/imgurUploader';
import './Settings.css';
import './Customization.css';
import { useTeamStyles } from '../../context/TeamStyleContext';

// Color picker component with preview
const ColorPicker = ({ label, value, onChange, defaultColor = '#007BFF' }) => (
  <div className="color-picker-container">
    <label>{label}</label>
    <div className="color-input-container">
      <input
        type="color"
        value={value || defaultColor}
        onChange={(e) => onChange(e.target.value)}
        className="color-picker"
      />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultColor}
        className="color-text-input"
      />
      <div 
        className="color-preview" 
        style={{ backgroundColor: value || defaultColor }}
      />
    </div>
  </div>
);

// Font options for dropdown
const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Garamond, serif', label: 'Garamond' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Brush Script MT, cursive', label: 'Brush Script MT' }
];

// Custom font selector component with previews of each font
const FontSelector = ({ value, onChange }) => {
  // Generate dynamic styles for the preview
  const previewStyle = {
    fontFamily: value || "'Avenir Next LT Pro', 'Avenir Next', Avenir, sans-serif"
  };
  
  return (
    <div className="font-selector">
      {/* Font preview section - always visible with current or selected font */}
      <div 
        className="selected-font-preview" 
        style={previewStyle}
      >
        <div className="current-font-label">
          {value ? 'Selected Font' : 'Default Font'}
        </div>
        <div className="current-font-sample">
          <span className="sample-text">The quick brown fox jumps over the lazy dog.</span>
          <span className="sample-alphabet">ABCDEFGHIJKLM abcdefghijklm 1234567890</span>
        </div>
        <div className="current-font-name">
          {value ? FONT_OPTIONS.find(f => f.value === value)?.label : 'Avenir Next LT Pro'}
        </div>
        <p className="font-apply-info">
          This font will be applied to all text throughout the application for your entire team.
        </p>
      </div>
      
      <div className="font-option-grid">
        <div 
          className={`font-option ${!value ? 'selected' : ''}`}
          onClick={() => onChange('')}
        >
          <div className="font-sample" style={{ fontFamily: "'Avenir Next LT Pro', sans-serif" }}>Aa</div>
          <div className="font-name">Default Font</div>
        </div>
        
        {FONT_OPTIONS.map((font) => (
          <div 
            key={font.value}
            className={`font-option ${value === font.value ? 'selected' : ''}`}
            onClick={() => onChange(font.value)}
          >
            <div className="font-sample" style={{ fontFamily: font.value }}>
              Aa
            </div>
            <div className="font-name">{font.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamCustomization = ({ teamType: propTeamType, teamId: propTeamId }) => {
  const { user, hasPermission } = useAuth();
  const { refreshStyles } = useTeamStyles();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  
  // Determine teamId and teamType from props or user context
  const teamType = propTeamType || (user?.clname === 'RGA' ? 'RGA' : user?.clname === 'MGA' ? 'MGA' : user?.clname === 'SGA' ? 'SGA' : 'Admin');
  const teamId = propTeamId || user?.userId;
  
  // State for all customization settings
  const [settings, setSettings] = useState({
    teamId,
    teamType,
    teamName: '',
    logoPreview: null,
    logoFile: null,
    logoUrl: null,
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    customFont: '',
    customCSS: '',
  });
  
  // Fetch the current team customization settings
  const fetchTeamSettings = async () => {
    setLoadingSettings(true);
    setError('');

    // Make sure we have a valid teamId
    if (!teamId) {
      setError('No team ID available.');
      setLoadingSettings(false);
      return;
    }

    try {
      // Use the correct endpoint to fetch team settings
      const response = await api.get(`/custom/team/${teamType}/${teamId}`);
      
      if (response.data.success && response.data.settings) {
        const data = response.data.settings;
        
        // Set the settings object with all available data
        setSettings({
          teamId,
          teamType,
          teamName: data.team_name || 'Arias Organization',
          logoUrl: data.logo_url || null,
          logoPreview: data.logo_url || null,
          logoFile: null,
          primaryColor: data.primary_color || '',
          secondaryColor: data.secondary_color || '',
          accentColor: data.accent_color || '',
          customFont: data.custom_font || '',
        });
      }
    } catch (err) {
      // Only set error if it's not a 404 (no settings found yet is OK)
      if (err.response?.status !== 404) {
        setError('Failed to load team settings');
        toast.error('Error loading settings');
      } else {
        // If 404, set default team name
        setSettings(prev => ({
          ...prev,
          teamName: 'Arias Organization'
        }));
      }
    } finally {
      setLoadingSettings(false);
    }
  };
  
  // Load team settings on component mount
  useEffect(() => {
    fetchTeamSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamType, teamId]);
  
  // Handle logo removal
  const handleRemoveLogo = async () => {
    if (!settings.logoUrl) return;
    
    setUploadingLogo(true);
    setError('');
    
    try {
      // Update backend to remove the logo
      const response = await api.post(`/custom/logo/${teamType}/${teamId}`, {
        logoUrl: null,
        logoWidth: null,
        logoHeight: null
      });
      
      if (response.data.success) {
        // Update local state
        setSettings(prev => ({
          ...prev,
          logoPreview: null,
          logoUrl: null
        }));
        
        toast.success('Logo removed successfully');
        
        // Refresh styles to apply the logo removal immediately
        refreshStyles();
      } else {
        throw new Error(response.data.message || 'Failed to remove logo');
      }
    } catch (err) {
      setError(err.message || 'Failed to remove logo');
      toast.error('Error removing logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // First, update general settings
      await api.post(`/custom/team/${teamType}/${teamId}`, {
        team_name: settings.teamName,
        primary_color: settings.primaryColor,
        secondary_color: settings.secondaryColor,
        accent_color: settings.accentColor,
        custom_font: settings.customFont
      });
      
      // If logo hasn't changed, we don't need to upload it again
      // Logo uploads are handled separately through handleLogoChange
      
      toast.success('Team customization settings saved successfully');
      
      // Refresh styles to apply changes immediately
      refreshStyles();
    } catch (err) {
      setError('Failed to save team settings');
      toast.error('Error saving customization settings');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle logo selection and upload to Imgur
  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // File validation
    if (file.size > 10 * 1024 * 1024) {
      setError('Logo file size must be less than 10MB');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      setError('Selected file must be an image');
      return;
    }
    
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setSettings(prev => ({
        ...prev,
        logoPreview: e.target.result
      }));
    };
    reader.readAsDataURL(file);
    
    // Upload to Imgur
    setUploadingLogo(true);
    setError('');
    
    try {
      // Upload to Imgur via backend
      const result = await uploadImageToImgur(file);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to upload logo');
      }
      
      // Save the logo URL to our backend
      const logoData = {
        logoUrl: result.data.url,
        logoWidth: 200, // Default width
        logoHeight: 80  // Default height
      };
      
      // Update backend with the new logo URL
      const response = await api.post(
        `/custom/logo/${teamType}/${teamId}`,
        logoData
      );
      
      if (response.data.success) {
        // Update local state with the new logo info
        setSettings(prev => ({
          ...prev,
          logoUrl: result.data.url,
          logoFile: null // Clear the file reference
        }));
        
        toast.success('Logo uploaded successfully');
        
        // Refresh styles to apply the new logo immediately
        refreshStyles();
      } else {
        throw new Error('Failed to update team with new logo');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload logo');
      toast.error('Error uploading logo');
      
      // Revert the preview if upload failed
      if (settings.logoUrl) {
        setSettings(prev => ({
          ...prev,
          logoPreview: prev.logoUrl
        }));
      } else {
        setSettings(prev => ({
          ...prev,
          logoPreview: null
        }));
      }
    } finally {
      setUploadingLogo(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Handle input changes
  const handleChange = (name, value) => {
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle reset all settings
  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all customization settings? This cannot be undone.')) {
      setLoading(true);
      
      try {
        // Delete team customization
        await api.delete(`/custom/team/${teamType}/${teamId}`);
        
        // Note: We can't delete the Imgur image since we don't store the deleteHash
        
        // Reset form
        setSettings(prev => ({
          ...prev,
          teamName: 'Arias Organization',
          primaryColor: '',
          secondaryColor: '',
          accentColor: '',
          customFont: '',
          logoPreview: null,
          logoUrl: null
        }));
        
        toast.success('Team customization settings reset successfully');
        
        // Refresh styles to apply default styles immediately
        refreshStyles();
      } catch (err) {
        setError('Failed to reset team settings');
        toast.error('Error resetting customization settings');
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Handle team name change with validation
  const handleTeamNameChange = (value) => {
    // Trim whitespace
    value = value.trim();
    
    // Enforce minimum length of 3 characters
    if (value.length > 0 && value.length < 3) {
      setError('Team name must be at least 3 characters');
    } else {
      setError('');
    }
    
    // Maximum length of 50 characters
    value = value.substring(0, 50);
    
    // Update the state
    handleChange('teamName', value);
  };
  
  if (loadingSettings) {
    return (
      <div className="route-loading" role="alert" aria-busy="true">
        <div className="spinner"></div>
        <p>Loading team settings...</p>
      </div>
    );
  }
  
  if (!hasPermission('edit_team')) {
    return <div className="error-message">You do not have permission to customize team settings.</div>;
  }
  
  return (
    <div className="customization-container">
      <h2>Team Appearance Customization</h2>
      <p className="customization-description">
        Customize the appearance of the application for your team. 
        These settings will apply to all users in your {teamType}.
      </p>
      
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit} className="customization-form">
        <div className="customization-section">
          <h3>Team Identity</h3>
          <div className="customization-field">
            <label>Team Name</label>
            <input
              type="text"
              value={settings.teamName}
              onChange={(e) => handleTeamNameChange(e.target.value)}
              className="text-input"
              placeholder="Enter your team name"
              maxLength={50}
            />
            <p className="field-help">
              This name will be used throughout the application for your team. 
              {settings.teamName.length === 0 && 
                "Using default: 'Arias Organization'"}
            </p>
          </div>
        </div>
        
        <div className="customization-section">
          <h3>Team Logo</h3>
          <div className="logo-container">
            {settings.logoPreview ? (
              <div className="logo-preview-container">
                <img 
                  src={settings.logoPreview} 
                  alt="Team Logo" 
                  className="logo-preview" 
                />
                <button 
                  type="button" 
                  className="remove-logo-button"
                  onClick={handleRemoveLogo}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Removing...' : 'Remove Logo'}
                </button>
              </div>
            ) : (
              <div className="logo-upload-placeholder">
                <span>{uploadingLogo ? 'Uploading...' : 'Upload your team logo'}</span>
              </div>
            )}
            
            <div className="logo-upload">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="file-input"
                ref={fileInputRef}
                disabled={uploadingLogo}
              />
              <p className="upload-instructions">
                Maximum file size: 10MB. Recommended dimensions: 200x80px.
                Images are hosted on Imgur.
              </p>
            </div>
          </div>
        </div>
        
        <div className="customization-section">
          <h3>Color Scheme</h3>
          <div className="color-pickers">
            <ColorPicker 
              label="Primary Color" 
              value={settings.primaryColor} 
              onChange={(value) => handleChange('primaryColor', value)}
              defaultColor="#007BFF"
            />
            
            <ColorPicker 
              label="Secondary Color" 
              value={settings.secondaryColor} 
              onChange={(value) => handleChange('secondaryColor', value)}
              defaultColor="#6C757D"
            />
            
            <ColorPicker 
              label="Accent Color" 
              value={settings.accentColor} 
              onChange={(value) => handleChange('accentColor', value)}
              defaultColor="#28A745"
            />
          </div>
        </div>
        
        <div className="customization-section">
          <h3>Typography</h3>
          <div className="customization-field">
            <label>Custom Font</label>
            <FontSelector 
              value={settings.customFont}
              onChange={(value) => handleChange('customFont', value)}
            />
            <p className="field-help">
              Select a font for your team's application. The font will be applied to the entire application.
            </p>
          </div>
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            className="reset-button"
            onClick={handleResetSettings}
            disabled={loading}
          >
            Reset All
          </button>
          
          <button 
            type="submit" 
            className="save-button"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamCustomization; 