import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import './LoadingSpinner.css';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary', 
  text = '', 
  overlay = false,
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    small: 'loading-spinner-sm',
    medium: 'loading-spinner-md', 
    large: 'loading-spinner-lg',
    xlarge: 'loading-spinner-xl'
  };

  const colorClasses = {
    primary: 'loading-spinner-primary',
    secondary: 'loading-spinner-secondary',
    muted: 'loading-spinner-muted',
    white: 'loading-spinner-white'
  };

  const spinnerClass = `loading-spinner ${sizeClasses[size]} ${colorClasses[color]} ${className}`;

  const content = (
    <div className="loading-spinner-container">
      <FaSpinner className={spinnerClass} />
      {text && <div className="loading-spinner-text">{text}</div>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-spinner-fullscreen">
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="loading-spinner-overlay">
        {content}
      </div>
    );
  }

  return content;
};

// Specific loading components for common use cases
export const ButtonSpinner = ({ className = '' }) => (
  <LoadingSpinner size="small" color="white" className={`loading-spinner-button ${className}`} />
);

export const PageSpinner = ({ text = 'Loading...' }) => (
  <LoadingSpinner size="large" color="primary" text={text} fullScreen />
);

export const InlineSpinner = ({ size = 'small', color = 'muted', className = '' }) => (
  <LoadingSpinner size={size} color={color} className={`loading-spinner-inline ${className}`} />
);

export const OverlaySpinner = ({ text = 'Loading...', size = 'large' }) => (
  <LoadingSpinner size={size} color="primary" text={text} overlay />
);

export default LoadingSpinner; 