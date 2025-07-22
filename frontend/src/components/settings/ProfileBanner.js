import React, { useState } from 'react';
import { FiImage } from 'react-icons/fi';
import '../../pages/settings/Settings.css';

// Profile banner component
const ProfileBanner = ({ bannerUrl, onUpdate, onRemove, isLoading }) => {
  const [hovering, setHovering] = useState(false);
  const defaultBanner = 'https://images.unsplash.com/photo-1531512073830-ba890ca4eba2?q=80&w=1470&auto=format&fit=crop';
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <div 
      className="profile-banner-container"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="profile-banner" style={{ backgroundImage: `url(${bannerUrl || defaultBanner})` }}></div>
      <div className={`profile-banner-overlay ${hovering ? 'visible' : ''}`}>
        <label htmlFor="profile-banner-upload" className={`camera-icon ${isLoading ? 'loading' : ''}`}>
          {isLoading ? (
            <div className="spinner"></div>
          ) : (
            <FiImage />
          )}
        </label>
        <input 
          id="profile-banner-upload" 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          disabled={isLoading}
        />
      </div>
      
      {bannerUrl && hovering && !isLoading && (
        <button 
          type="button" 
          className="remove-icon remove-icon-topright" 
          onClick={onRemove}
          disabled={isLoading}
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default ProfileBanner; 