import React, { useState, useEffect } from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '../../api';
import './QuickActionModals.css';

const FIELDS = [
  { key: 'calls', label: 'Calls' },
  { key: 'appts', label: 'Appts' },
  { key: 'sits', label: 'Sits' },
  { key: 'sales', label: 'Sales' },
  { key: 'alp', label: 'ALP', step: '0.01', prefix: '$' },
  { key: 'refs', label: 'Refs' },
  { key: 'refAppt', label: 'Ref Appts' },
  { key: 'refSit', label: 'Ref Sits' },
  { key: 'refSale', label: 'Ref Sales' },
  { key: 'refAlp', label: 'Ref ALP', step: '0.01', prefix: '$' },
];

function getEasternDate(offset = 0) {
  const d = new Date();
  const eastern = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  eastern.setDate(eastern.getDate() + offset);
  return eastern;
}

function formatDateForApi(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(date) {
  const today = getEasternDate();
  const todayStr = formatDateForApi(today);
  const yesterday = getEasternDate(-1);
  const yesterdayStr = formatDateForApi(yesterday);
  const dateStr = formatDateForApi(date);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const QuickDailyActivityModal = ({ onClose }) => {
  const [dateOffset, setDateOffset] = useState(0);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const currentDate = getEasternDate(dateOffset);
  const dateStr = formatDateForApi(currentDate);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const res = await api.get('/dailyActivity/user-summary', {
          params: { startDate: dateStr, endDate: dateStr }
        });
        if (cancelled) return;
        const row = res.data?.data?.[0];
        const v = {};
        for (const f of FIELDS) {
          v[f.key] = row?.[f.key] ?? '';
        }
        setValues(v);
      } catch {
        if (!cancelled) setValues({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [dateStr]);

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updates = {};
      updates[dateStr] = { reportDate: dateStr };
      for (const f of FIELDS) {
        updates[dateStr][f.key] = parseFloat(values[f.key]) || 0;
      }
      await api.post('/dailyActivity/update', { updates });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="qa-modal-overlay" onClick={onClose}>
      <div className="qa-modal" onClick={e => e.stopPropagation()}>
        <div className="qa-modal-header">
          <h3>Daily Activity</h3>
          <button className="qa-modal-close" onClick={onClose}><FiX size={20} /></button>
        </div>

        <div className="qa-date-nav">
          <button onClick={() => setDateOffset(o => o - 1)} className="qa-date-arrow"><FiChevronLeft /></button>
          <span className="qa-date-label">{formatDateDisplay(currentDate)}</span>
          <button
            onClick={() => setDateOffset(o => o + 1)}
            className="qa-date-arrow"
            disabled={dateOffset >= 0}
          >
            <FiChevronRight />
          </button>
        </div>

        {error && <div className="qa-modal-error">{error}</div>}
        {success && <div className="qa-modal-success">Saved!</div>}

        {loading ? (
          <div className="qa-modal-loading">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="qa-modal-form">
            <div className="qa-field-grid">
              {FIELDS.map(f => (
                <div key={f.key} className="qa-field">
                  <label>{f.label}</label>
                  <div className="qa-field-input-wrap">
                    {f.prefix && <span className="qa-field-prefix">{f.prefix}</span>}
                    <input
                      type="number"
                      step={f.step || '1'}
                      min="0"
                      value={values[f.key]}
                      onChange={e => handleChange(f.key, e.target.value)}
                      placeholder="0"
                      className={f.prefix ? 'has-prefix' : ''}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button type="submit" className="qa-modal-submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default QuickDailyActivityModal;
