import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiZap } from 'react-icons/fi';
import api from '../../../api';
import './PipelineSettings.css';

const PurchaseCreditsModal = ({ onClose, onSuccess, hasPaymentMethod }) => {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await api.get('/recruitment/billing/sms-packages');
      if (response.data?.success) {
        setPackages(response.data.packages || []);
        // Pre-select the popular package
        const popular = response.data.packages.find(pkg => pkg.popular);
        if (popular) {
          setSelectedPackage(popular.id);
        }
      }
    } catch (err) {
      console.error('[PurchaseCreditsModal] Error fetching packages:', err);
      setError('Failed to load packages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      setError('Please select a package');
      return;
    }

    if (!hasPaymentMethod) {
      setError('Please add a payment method first');
      return;
    }

    try {
      setPurchasing(true);
      setError('');
      console.log('[PurchaseCreditsModal] Purchasing package:', selectedPackage);

      const response = await api.post('/recruitment/billing/purchase-credits', {
        packageId: selectedPackage,
      });

      if (response.data?.success) {
        console.log('[PurchaseCreditsModal] Purchase successful');
        onSuccess(response.data.credits);
      } else {
        setError(response.data?.message || 'Purchase failed');
        setPurchasing(false);
      }
    } catch (err) {
      console.error('[PurchaseCreditsModal] Error purchasing credits:', err);
      setError(err.response?.data?.message || 'An error occurred during purchase');
      setPurchasing(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <div className="stripe-card-form-overlay" onClick={onClose}>
      <div className="purchase-credits-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stripe-modal-header">
          <h3>Add Balance</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={purchasing}
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="stripe-modal-content">
          {!hasPaymentMethod && (
            <div className="settings-alert settings-alert-error" style={{ marginBottom: 16 }}>
              Please add a payment method before purchasing.
            </div>
          )}

          {loading ? (
            <div className="loading-packages">
              <div className="pipeline-loading-spinner" />
              <span>Loading packages...</span>
            </div>
          ) : (
            <>
              <p className="stripe-card-form-description">
                Select a package to add balance to your account. Your balance never expires.
              </p>

              <div className="packages-grid">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`package-card ${selectedPackage === pkg.id ? 'selected' : ''}`}
                    onClick={() => !purchasing && setSelectedPackage(pkg.id)}
                  >
                    <div className="package-name">{pkg.name}</div>
                    <div className="package-breakdown">
                      <div className="package-breakdown-item">
                        <strong>{pkg.smsCount?.toLocaleString()}</strong> texts
                      </div>
                    </div>
                    {selectedPackage === pkg.id && (
                      <div className="package-selected-icon">
                        <FiCheck size={20} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Cost Breakdown */}
              <div className="cost-breakdown-info">
                <div className="cost-breakdown-title">Messaging Costs:</div>
                <div className="cost-breakdown-grid">
                  <div className="cost-breakdown-item">
                    <span className="cost-breakdown-label">All Text Messages:</span>
                    <span className="cost-breakdown-value">$0.055 each</span>
                  </div>
                </div>
                <div className="cost-breakdown-note">
                  Each text message sent costs $0.055, deducted from your balance.
                </div>
              </div>

              {error && (
                <div className="settings-alert settings-alert-error" style={{ marginTop: 16 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="stripe-modal-actions">
          <button
            type="button"
            className="insured-button"
            onClick={onClose}
            disabled={purchasing}
            style={{ backgroundColor: '#6c757d' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="insured-button"
            onClick={handlePurchase}
            disabled={!selectedPackage || purchasing || !hasPaymentMethod || loading}
          >
            {purchasing ? 'Processing...' : `Add ${formatPrice(packages.find(pkg => pkg.id === selectedPackage)?.actualPrice || 0)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseCreditsModal;

