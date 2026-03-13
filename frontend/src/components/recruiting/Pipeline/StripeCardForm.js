import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { FiX } from 'react-icons/fi';
import './PipelineSettings.css';

const StripeCardForm = ({ clientSecret, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError('');
    console.log('[StripeCardForm] Confirming card setup with clientSecret:', clientSecret);

    try {
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (confirmError) {
        console.error('[StripeCardForm] Error confirming card setup:', confirmError);
        setError(confirmError.message);
        setProcessing(false);
        return;
      }

      console.log('[StripeCardForm] Card setup successful:', setupIntent);
      onSuccess(setupIntent.payment_method);
    } catch (err) {
      console.error('[StripeCardForm] Exception during card setup:', err);
      setError('An unexpected error occurred. Please try again.');
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <div 
      className="stripe-card-form-overlay"
      onClick={onCancel}
    >
      <div 
        className="stripe-card-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stripe-modal-header">
          <h3>Add Payment Card</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={processing}
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="stripe-modal-content">
          <p className="stripe-card-form-description">
            Enter your card details below. Your payment information will be securely saved with Stripe.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Card Information</label>
              <div className="stripe-card-element-wrapper">
                <CardElement options={cardElementOptions} />
              </div>
            </div>

            {error && (
              <div className="settings-alert settings-alert-error" style={{ marginTop: 16 }}>
                {error}
              </div>
            )}
          </form>
        </div>

        <div className="stripe-modal-actions">
          <button
            type="button"
            className="insured-button"
            onClick={onCancel}
            disabled={processing}
            style={{ backgroundColor: '#6c757d' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="insured-button"
            onClick={handleSubmit}
            disabled={!stripe || processing}
          >
            {processing ? 'Processing...' : 'Save Card'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StripeCardForm;


