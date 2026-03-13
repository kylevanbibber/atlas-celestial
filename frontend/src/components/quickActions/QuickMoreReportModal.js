import React, { useState, useEffect } from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '../../api';
import './QuickActionModals.css';

const SECTIONS = [
  {
    title: 'Personal Recruiting',
    fields: [
      { key: 'PR_Final_Set', label: 'Finals Set' },
      { key: 'PR_Final_Show', label: 'Finals Show' },
      { key: 'Happenstance_PR_Hires', label: 'Happenstance' },
      { key: 'PPR_Hires', label: 'PPR Hires' },
      { key: 'Social_Media_Hires', label: 'Social Media' },
    ]
  },
  {
    title: 'Internal Recruiting',
    fields: [
      { key: 'Internal_Webinar_Sets', label: 'Webinar Sets' },
      { key: 'Internal_Finals_Set', label: 'Finals Set' },
      { key: 'Internal_Final_Show', label: 'Finals Show' },
      { key: 'Total_Internal_Hires', label: 'Hires' },
    ]
  },
  {
    title: 'Vendor - Webinar',
    fields: [
      { key: 'Webinar_Sets_Purchased', label: 'Sets Purchased' },
      { key: 'Webinar_Finals_Set', label: 'Finals Set' },
      { key: 'Webinar_Final_Show', label: 'Finals Show' },
      { key: 'Webinar_Hires', label: 'Hires' },
    ]
  },
  {
    title: 'Vendor - Surveys',
    fields: [
      { key: 'Surveys_Purchased', label: 'Purchased' },
      { key: 'Survey_Finals_Set', label: 'Finals Set' },
      { key: 'Survey_Finals_Show', label: 'Finals Show' },
      { key: 'Survey_Hires', label: 'Hires' },
    ]
  },
  {
    title: 'Vendor - Finals',
    fields: [
      { key: 'Vendor_Finals_Purchased', label: 'Purchased' },
      { key: 'Vendor_Final_Show', label: 'Finals Show' },
      { key: 'Vendor_Final_Hires', label: 'Hires' },
      { key: 'Vendor_Hires_Purchased', label: 'Hires Purchased' },
    ]
  },
];

const ALL_FIELD_KEYS = SECTIONS.flatMap(s => s.fields.map(f => f.key));

function getWeekFriday(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const friday = new Date(now);
  friday.setDate(now.getDate() - day + 5 + offset * 7);
  return friday;
}

function formatFridayForApi(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWeekRange(offset) {
  const friday = getWeekFriday(offset);
  const saturday = new Date(friday);
  saturday.setDate(friday.getDate() - 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(saturday)} - ${fmt(friday)}`;
}

const QuickMoreReportModal = ({ onClose, user }) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hierarchy, setHierarchy] = useState({ rga: null, legacy: null, tree: null });

  const mgaName = user?.agnname || user?.lagnname || '';
  const fridayStr = formatFridayForApi(getWeekFriday(weekOffset));

  // Fetch hierarchy on mount
  useEffect(() => {
    if (!mgaName) return;
    api.get(`/more/mga-hierarchy/${encodeURIComponent(mgaName)}`)
      .then(res => {
        if (res.data?.success && res.data.data) setHierarchy(res.data.data);
      })
      .catch(() => setHierarchy({ rga: mgaName, legacy: mgaName, tree: mgaName }));
  }, [mgaName]);

  // Fetch week data
  useEffect(() => {
    if (!mgaName) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        const res = await api.get(`/more/fetch-more-data/${encodeURIComponent(mgaName)}/${fridayStr}`);
        if (cancelled) return;
        const d = res.data?.data || {};
        const v = {};
        for (const k of ALL_FIELD_KEYS) v[k] = d[k] ?? '';
        setValues(v);
      } catch {
        if (!cancelled) {
          const v = {};
          for (const k of ALL_FIELD_KEYS) v[k] = '';
          setValues(v);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mgaName, fridayStr]);

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setSuccess(false);
  };

  // Auto-calculate totals
  const prHires = (parseInt(values.Happenstance_PR_Hires) || 0) + (parseInt(values.PPR_Hires) || 0) + (parseInt(values.Social_Media_Hires) || 0);
  const vendorHires = (parseInt(values.Webinar_Hires) || 0) + (parseInt(values.Survey_Hires) || 0) + (parseInt(values.Vendor_Final_Hires) || 0) + (parseInt(values.Vendor_Hires_Purchased) || 0);
  const internalHires = parseInt(values.Total_Internal_Hires) || 0;
  const nonPrHires = internalHires + vendorHires;
  const totalHires = prHires + nonPrHires;
  const finalsSet = (parseInt(values.PR_Final_Set) || 0) + (parseInt(values.Internal_Finals_Set) || 0) + (parseInt(values.Webinar_Finals_Set) || 0) + (parseInt(values.Survey_Finals_Set) || 0) + (parseInt(values.Vendor_Finals_Purchased) || 0);
  const finalsShow = (parseInt(values.PR_Final_Show) || 0) + (parseInt(values.Internal_Final_Show) || 0) + (parseInt(values.Webinar_Final_Show) || 0) + (parseInt(values.Survey_Finals_Show) || 0) + (parseInt(values.Vendor_Final_Show) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updates = {};
      for (const k of ALL_FIELD_KEYS) updates[k] = parseInt(values[k]) || 0;
      updates.PR_Hires = prHires;
      updates.Non_PR_Hires = nonPrHires;
      updates.Total_Hires = totalHires;
      updates.Total_Vendor_Hires = vendorHires;
      updates.Finals_Set = finalsSet;
      updates.Finals_Show = finalsShow;

      const now = new Date();
      const currentEST = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const fridayDeadline = getWeekFriday(weekOffset);
      fridayDeadline.setHours(15, 15, 0, 0);
      const isOnTime = weekOffset === 0 && currentEST <= fridayDeadline;

      await api.post('/more/update-more-data', {
        MGA: mgaName,
        MORE_Date: fridayStr,
        updates,
        userRole: user?.clname || 'MGA',
        on_time: isOnTime,
        rga: hierarchy.rga || mgaName,
        legacy: hierarchy.legacy || mgaName,
        tree: hierarchy.tree || mgaName,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : formatWeekRange(weekOffset);

  return (
    <div className="qa-modal-overlay" onClick={onClose}>
      <div className="qa-modal qa-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="qa-modal-header">
          <h3>Report M.O.R.E</h3>
          <button className="qa-modal-close" onClick={onClose}><FiX size={20} /></button>
        </div>

        <div className="qa-date-nav">
          <button onClick={() => setWeekOffset(o => o - 1)} className="qa-date-arrow"><FiChevronLeft /></button>
          <div className="qa-date-label-group">
            <span className="qa-date-label">{weekLabel}</span>
            <span className="qa-date-sub">{formatWeekRange(weekOffset)}</span>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="qa-date-arrow" disabled={weekOffset >= 0}><FiChevronRight /></button>
        </div>

        {error && <div className="qa-modal-error">{error}</div>}
        {success && <div className="qa-modal-success">Saved!</div>}

        {loading ? (
          <div className="qa-modal-loading">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="qa-modal-form">
            {SECTIONS.map(section => (
              <div key={section.title} className="qa-section">
                <div className="qa-section-title">{section.title}</div>
                <div className="qa-field-grid">
                  {section.fields.map(f => (
                    <div key={f.key} className="qa-field">
                      <label>{f.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={values[f.key]}
                        onChange={e => handleChange(f.key, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="qa-totals-row">
              <span>Finals: <strong>{finalsSet}</strong> set / <strong>{finalsShow}</strong> show</span>
              <span>PR: <strong>{prHires}</strong></span>
              <span>Non-PR: <strong>{nonPrHires}</strong></span>
              <span>Total: <strong>{totalHires}</strong></span>
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

export default QuickMoreReportModal;
