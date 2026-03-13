import React, { useState } from 'react';
import { FiCamera } from 'react-icons/fi';
import '../../pages/utilities/Utilities.css';

// Simple profile picture component
const ProfilePicture = ({ pictureUrl, onUpdate, onRemove, isLoading }) => {
  const [hovering, setHovering] = useState(false);
  const defaultPicture = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size before upload (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB');
        return;
      }
      
      // Call the parent component's update function with the actual file
      onUpdate(file);
    }
  };
  
  return (
    <div 
      className="user-profile-picture-container"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div 
        className="user-profile-picture" 
        style={{ backgroundImage: `url(${pictureUrl || defaultPicture})` }}
      ></div>
              <div className={`user-profile-picture-overlay ${hovering ? 'visible' : ''}`}>
        <label htmlFor="profile-picture-upload" className={`camera-icon ${isLoading ? 'loading' : ''}`}>
          {isLoading ? (
            <div className="spinner"></div>
          ) : (
            <FiCamera />
          )}
        </label>
        <input 
          id="profile-picture-upload" 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload}
          style={{ display: 'none' }}
          disabled={isLoading}
        />
      </div>
      
      {pictureUrl && hovering && !isLoading && (
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

export default ProfilePicture; 