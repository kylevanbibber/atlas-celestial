import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiSave } from 'react-icons/fi';
import api from '../../../api';
import './PipelineSettings.css';

const AutoReloadSettings = () => {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(25);
  const [reloadAmount, setReloadAmount] = useState(25);
  const [thresholdOptions, setThresholdOptions] = useState([]);
  const [amountOptions, setAmountOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/recruitment/billing/auto-reload');
      if (response.data?.success) {
        const { autoReload, thresholdOptions: thresholds, amountOptions: amounts } = response.data;
        setEnabled(autoReload.enabled);
        setThreshold(autoReload.threshold);
        setReloadAmount(autoReload.reloadAmount);
        setThresholdOptions(thresholds || []);
        setAmountOptions(amounts || []);
      }
    } catch (err) {
      console.error('[AutoReloadSettings] Error fetching settings:', err);
      setMessage('Failed to load auto-reload settings');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      setMessageType('');

      const response = await api.post('/recruitment/billing/auto-reload', {
        enabled,
        threshold,
        reloadAmount,
      });

      if (response.data?.success) {
        setMessage('Auto-reload settings saved successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(response.data?.message || 'Failed to save settings');
        setMessageType('error');
      }
    } catch (err) {
      console.error('[AutoReloadSettings] Error saving settings:', err);
      setMessage('An error occurred while saving settings');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="auto-reload-loading">
        <div className="pipeline-loading-spinner" />
        <span>Loading auto-reload settings...</span>
      </div>
    );
  }

  return (
    <div className="auto-reload-settings">
      <div className="auto-reload-header">
        <div className="auto-reload-title">
          <FiRefreshCw size={18} style={{ marginRight: 8 }} />
          Auto-Reload
        </div>
        <label className="auto-reload-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

            <p className="auto-reload-description">
              Automatically add balance to your account when it falls below a certain dollar amount.
            </p>

      {enabled && (
        <div className="auto-reload-options">
          <div className="auto-reload-field">
            <label>Reload When Balance Falls Below</label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="auto-reload-select"
            >
              {thresholdOptions.map((option) => (
                <option key={option} value={option}>
                  ${option}
                </option>
              ))}
            </select>
          </div>

          <div className="auto-reload-field">
            <label>Reload Amount</label>
            <select
              value={reloadAmount}
              onChange={(e) => setReloadAmount(Number(e.target.value))}
              className="auto-reload-select"
            >
              {amountOptions.map((option) => (
                <option key={option} value={option}>
                  ${option}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="pipeline-btn pipeline-btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ marginTop: 12 }}
          >
            <FiSave style={{ marginRight: 6 }} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {!enabled && (
        <div className="auto-reload-disabled-note">
          Enable auto-reload to automatically maintain your balance.
        </div>
      )}

      {message && (
        <div className={`settings-alert settings-alert-${messageType === 'success' ? 'success' : 'error'}`} style={{ marginTop: 12 }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default AutoReloadSettings;

