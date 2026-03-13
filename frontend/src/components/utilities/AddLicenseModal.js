import React, { useState, useCallback } from 'react';
import api from '../../api';
import { US_STATES } from '../../constants';
import '../../pages/utilities/Utilities.css';

const AddLicenseModal = ({ isOpen, onClose, userId, lagnname, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!selectedState) {
      setError('Please select a state');
      return;
    }
    try {
      setLoading(true);
      
      const payload = {
        userId: userId,
        lagnname: lagnname || '',
        state: selectedState,
        license_number: licenseNumber || '',
        expiry_date: expiryDate || '',
        resident_state: true
      };
      
      await api.post('/licenses', payload);
      setSuccess('License added');
      // Close after a brief delay and notify parent
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          // Provide minimal license info for optimistic update in parent
          onSuccess({ userId, state: selectedState, expiry_date: expiryDate || null });
        }
        // Reset form
        setSelectedState('');
        setLicenseNumber('');
        setExpiryDate('');
        setSuccess('');
      }, 600);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save license');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form state when closing
    setSelectedState('');
    setLicenseNumber('');
    setExpiryDate('');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="settings-section"
        style={{
          padding: 0,
          width: '100%',
          maxWidth: 560,
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}
      >
        <div className="settings-card" style={{ margin: 0 }}>
          <h2 className="settings-card-title" style={{ marginTop: 0 }}>Add License for {lagnname}</h2>
          <p className="settings-card-description" style={{ marginBottom: 12 }}>
            Add a licensed state for this agent to enable lead pack requests.
          </p>

          {error && <div className="settings-alert settings-alert-error" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div className="settings-alert settings-alert-success" style={{ marginBottom: 12 }}>{success}</div>}

          <div className="license-edit-form" style={{ padding: 0 }}>
            <div className="license-edit-fields">
              <div className="license-edit-row">
                <div className="license-state-field">
                  <label style={{ display: 'block', marginBottom: 6 }}>State</label>
                  <select 
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className={`state-select ${!selectedState && error ? 'input-error' : ''}`}
                  >
                    <option value="">Select</option>
                    {US_STATES.map(state => (
                      <option key={state.code} value={state.code}>
                        {state.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="license-edit-row">
                <div className="license-field">
                  <label>License (optional)</label>
                  <input 
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Enter license number"
                  />
                </div>
              </div>

              <div className="license-edit-row">
                <div className="license-field">
                  <label>Expires (optional)</label>
                  <input 
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions at bottom */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button 
              className="insured-button"
              onClick={handleClose}
              disabled={loading}
              style={{ backgroundColor: '#6c757d' }}
            >
              Cancel
            </button>
            <button 
              className="insured-button"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save License'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddLicenseModal;
