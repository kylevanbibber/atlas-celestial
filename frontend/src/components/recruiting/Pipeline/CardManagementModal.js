import React, { useState } from 'react';
import { FiX, FiCreditCard, FiTrash2 } from 'react-icons/fi';
import './PipelineSettings.css';

const CardManagementModal = ({ paymentMethod, onClose, onRemove, onUpdate }) => {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const handleRemove = async () => {
    if (!window.confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      setRemoving(true);
      setError('');
      await onRemove(paymentMethod.id);
    } catch (err) {
      console.error('[CardManagementModal] Error removing card:', err);
      setError('Failed to remove payment method. Please try again.');
      setRemoving(false);
    }
  };

  const handleUpdate = () => {
    onUpdate();
  };

  const formatCardBrand = (brand) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <div 
      className="stripe-card-form-overlay"
      onClick={onClose}
    >
      <div 
        className="stripe-card-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stripe-modal-header">
          <h3>Manage Payment Card</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={removing}
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="stripe-modal-content">
          <p className="stripe-card-form-description">
            Your current payment method on file:
          </p>

          <div className="card-display">
            <div className="card-display-icon">
              <FiCreditCard size={24} />
            </div>
            <div className="card-display-info">
              <div className="card-display-brand">{formatCardBrand(paymentMethod.brand)}</div>
              <div className="card-display-number">•••• •••• •••• {paymentMethod.last4}</div>
              <div className="card-display-expiry">
                Expires {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
              </div>
            </div>
          </div>

          {error && (
            <div className="settings-alert settings-alert-error" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}
        </div>

        <div className="stripe-modal-actions">
          <button
            type="button"
            className="insured-button"
            onClick={handleRemove}
            disabled={removing}
            style={{ backgroundColor: '#dc3545' }}
          >
            <FiTrash2 style={{ marginRight: 6 }} />
            {removing ? 'Removing...' : 'Remove Card'}
          </button>
          <button
            type="button"
            className="insured-button"
            onClick={handleUpdate}
            disabled={removing}
          >
            <FiCreditCard style={{ marginRight: 6 }} />
            Update Card
          </button>
        </div>
      </div>
    </div>
  );
};

export default CardManagementModal;

