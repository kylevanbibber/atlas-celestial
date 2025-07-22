import React from 'react';
import VerificationForm from './VerificationForm';
import './VerificationDetails.css';

const VerificationDetails = ({ data, onSave, onClose }) => {
  const handleFormSubmitSuccess = () => {
    if (onSave) {
      onSave();
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="verification-details-container">
      <div className="verification-details-header">
        <h3 className="verification-details-title">
          New Verification
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="verification-details-close-button"
          >
            ×
          </button>
        )}
      </div>
      
      <VerificationForm onSubmitSuccess={handleFormSubmitSuccess} />
    </div>
  );
};

export default VerificationDetails; 