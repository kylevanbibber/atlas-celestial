import React, { useState, useEffect } from 'react';
import { FiMessageCircle, FiClock, FiSave } from 'react-icons/fi';
import api from '../../../api';
import './PipelineSettings.css';

const CheckInSettings = () => {
  const [checkinEnabled, setCheckinEnabled] = useState(false);
  const [checkinFrequency, setCheckinFrequency] = useState(3);
  const [dueRecruits, setDueRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDue, setLoadingDue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (checkinEnabled) {
      fetchDueRecruits();
    }
  }, [checkinEnabled]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const checkinResponse = await api.get('/check-in-texts/settings');
      if (checkinResponse.data?.success) {
        setCheckinEnabled(checkinResponse.data.settings.enabled);
        setCheckinFrequency(checkinResponse.data.settings.frequency_days);
      }
    } catch (err) {
      console.error('[CheckInSettings] Error fetching settings:', err);
      setMessage('Failed to load check-in settings');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDueRecruits = async () => {
    try {
      setLoadingDue(true);
      const response = await api.get('/check-in-texts/due');
      if (response.data?.success) {
        setDueRecruits(response.data.recruits || []);
      }
    } catch (error) {
      console.error('Error fetching due recruits:', error);
    } finally {
      setLoadingDue(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');
      setMessageType('');

      const checkinResponse = await api.post('/check-in-texts/settings', {
        enabled: checkinEnabled,
        frequency_days: checkinFrequency,
      });

      if (checkinResponse.data?.success) {
        setMessage('Check-in settings saved successfully!');
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
        if (checkinEnabled) {
          fetchDueRecruits();
        }
      } else {
        setMessage(checkinResponse.data?.message || 'Failed to save settings');
        setMessageType('error');
      }
    } catch (err) {
      console.error('[CheckInSettings] Error saving settings:', err);
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
        <span>Loading check-in settings...</span>
      </div>
    );
  }

  return (
    <div className="pipeline-billing-card">
      <div className="pipeline-billing-header">
        <h3>
          <FiMessageCircle style={{ marginRight: '8px' }} />
          Automated Check-In Texts
        </h3>
        <p className="settings-note">
          Automatically send check-in texts to recruits who are in the pre-licensing stage to keep them engaged.
        </p>
      </div>

      <div className="pipeline-billing-body">
        <div className="auto-reload-settings">
          <div className="auto-reload-header">
            <div className="auto-reload-title">
              Enable Automated Check-Ins
            </div>
            <label className="auto-reload-toggle">
              <input
                type="checkbox"
                checked={checkinEnabled}
                onChange={(e) => setCheckinEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {checkinEnabled && (
            <div className="auto-reload-options">
              <div className="auto-reload-field">
                <label>
                  <FiClock style={{ marginRight: 6 }} />
                  Check-In Frequency (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={checkinFrequency}
                  onChange={(e) => setCheckinFrequency(Number(e.target.value))}
                  className="auto-reload-select"
                  style={{ maxWidth: '150px' }}
                />
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Send a check-in text every {checkinFrequency} day{checkinFrequency !== 1 ? 's' : ''}
                </div>
              </div>

              {!loadingDue && dueRecruits.length > 0 && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    {dueRecruits.length} recruit{dueRecruits.length !== 1 ? 's' : ''} due for check-in
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    These recruits will receive automated check-in texts based on their progress.
                  </div>
                </div>
              )}

              {!loadingDue && dueRecruits.length === 0 && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    No recruits currently due for check-in texts.
                  </div>
                </div>
              )}

              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#1e40af' }}>
                  How it works:
                </div>
                <ul style={{ fontSize: '12px', color: '#1e40af', margin: 0, paddingLeft: '20px' }}>
                  <li>Check-ins are sent to recruits who haven't completed their pre-licensing course</li>
                  <li>Messages are personalized based on their progress (time spent, completion %, last login)</li>
                  <li>Texts are automatically sent every {checkinFrequency} day{checkinFrequency !== 1 ? 's' : ''}</li>
                  <li>Once a recruit completes their course, they won't receive more check-ins</li>
                </ul>
              </div>
            </div>
          )}

          {!checkinEnabled && (
            <div className="auto-reload-disabled-note">
              Enable automated check-ins to help keep your recruits engaged during pre-licensing.
            </div>
          )}

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

          {message && (
            <div className={`settings-alert settings-alert-${messageType === 'success' ? 'success' : 'error'}`} style={{ marginTop: 12 }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckInSettings;


