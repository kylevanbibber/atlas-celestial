import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { US_STATES } from '../../constants';
import '../../pages/utilities/Utilities.css';

const LicenseOnboardingModal = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkLicenses = useCallback(async () => {
    if (!isAuthenticated || !user?.userId) return;
    try {
      setLicensesLoading(true);
      const resp = await api.get(`/licenses/${user.userId}`);
      const list = resp.data.licenses || [];
      if (Array.isArray(list) && list.length === 0) {
        setIsOpen(true);
      }
    } catch (e) {
      // Fail open: don't block UI if check fails
    } finally {
      setLicensesLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    checkLicenses();
  }, [checkLicenses]);

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
        userId: user.userId,
        lagnname: user.lagnname || user.name || '',
        state: selectedState,
        license_number: licenseNumber || '',
        expiry_date: expiryDate || '',
        resident_state: false
      };
      await api.post('/licenses', payload);
      setSuccess('License added');
      // Close after a brief delay; future checks will see at least one license present
      setTimeout(() => setIsOpen(false), 600);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to save license');
    } finally {
      setLoading(false);
    }
  };
  // Do not show on Licensing page
  const isLicensingPage = location.pathname === '/utilities' && (new URLSearchParams(location.search).get('section') === 'licensing');
  if (!isOpen || !isAuthenticated || licensesLoading || isLicensingPage) return null;

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
          <h2 className="settings-card-title" style={{ marginTop: 0 }}>Add Your Licensed State</h2>
          <p className="settings-card-description" style={{ marginBottom: 12 }}>
            Please add at least one state where you're licensed. You can update full details later in Licensing.
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
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <a 
              className="insured-button"
              href="/utilities?section=licensing"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Go to Licensing
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseOnboardingModal;


