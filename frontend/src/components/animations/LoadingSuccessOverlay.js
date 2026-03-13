import React from 'react';
import globe from '../../img/globe1.png';
import './LoadingSuccessOverlay.css';

const LoadingSuccessOverlay = ({
  isLoading = false,
  isSuccess = false,
  message,
  size = 120
}) => {
  if (!isLoading && !isSuccess) {
    return null;
  }


  return (
    <div className="loading-success-overlay" role="status" aria-live="polite">
      <div className="loading-success-content">
        <div
          className="loading-success-globe-wrap"
          style={{ width: size, height: size }}
        >
          <img
            src={globe}
            alt={isSuccess ? 'Success' : 'Loading'}
            className="loading-success-globe"
          />
          {isSuccess && (
            <div className="loading-success-checkmark">
              <svg
                className="loading-success-checkmark-svg"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 52 52"
              >
                <circle
                  className="loading-success-checkmark-circle"
                  cx="26"
                  cy="26"
                  r="25"
                  fill="none"
                />
                <path
                  className="loading-success-checkmark-path"
                  fill="none"
                  d="M14.1 27.2l7.1 7.2 16.7-16.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default LoadingSuccessOverlay;
