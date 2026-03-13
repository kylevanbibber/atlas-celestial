import React, { useState, useEffect } from 'react';
import api from '../../api';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

const CreateCampaignModal = ({ campaign, onSave, onClose }) => {
  const [name, setName] = useState(campaign?.name || '');
  const [messageTemplate, setMessageTemplate] = useState(campaign?.message_template || '');
  const [followUps, setFollowUps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!campaign;

  // Fetch follow-up steps when editing an existing campaign
  useEffect(() => {
    if (campaign?.id) {
      api.get(`/text-campaigns/${campaign.id}`)
        .then(res => {
          const data = res.data.data;
          if (data.follow_ups && data.follow_ups.length > 0) {
            setFollowUps(data.follow_ups);
          }
        })
        .catch(err => console.error('Error fetching campaign follow-ups:', err));
    }
  }, [campaign?.id]);

  const addFollowUp = () => {
    setFollowUps(prev => [
      ...prev,
      {
        step_number: prev.length + 1,
        message: '',
        delay_value: 24,
        delay_unit: 'hours'
      }
    ]);
  };

  const removeFollowUp = (index) => {
    setFollowUps(prev =>
      prev.filter((_, i) => i !== index)
          .map((fu, i) => ({ ...fu, step_number: i + 1 }))
    );
  };

  const updateFollowUp = (index, field, value) => {
    setFollowUps(prev => prev.map((fu, i) =>
      i === index ? { ...fu, [field]: value } : fu
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !messageTemplate.trim()) {
      setError('Name and message are required');
      return;
    }

    // Validate follow-ups have messages
    const validFollowUps = followUps.filter(fu => fu.message.trim());

    try {
      setSaving(true);
      setError('');

      const payload = {
        name: name.trim(),
        message_template: messageTemplate.trim(),
        follow_ups: validFollowUps.map((fu, i) => ({
          step_number: i + 1,
          message: fu.message.trim(),
          delay_value: fu.delay_value || 24,
          delay_unit: fu.delay_unit || 'hours'
        }))
      };

      if (isEditing) {
        await api.put(`/text-campaigns/${campaign.id}`, payload);
      } else {
        await api.post('/text-campaigns', payload);
      }

      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const charCount = messageTemplate.length;
  const segments = Math.ceil(charCount / 160) || 1;

  return (
    <div className="tc-modal-overlay" onClick={onClose}>
      <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tc-modal-header">
          <h3>{isEditing ? 'Edit Campaign' : 'New Campaign'}</h3>
          <button className="tc-modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="tc-modal-body">
            {error && <div className="tc-alert tc-alert-error">{error}</div>}

            <div className="tc-form-group">
              <label>Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. January Outreach"
                maxLength={255}
              />
            </div>

            <div className="tc-form-group">
              <label>Message Template</label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Type the message that will be sent to all contacts..."
                maxLength={1600}
              />
              <div className={`tc-char-count ${charCount > 160 ? 'warn' : ''}`}>
                {charCount} characters ({segments} SMS segment{segments !== 1 ? 's' : ''})
              </div>
            </div>

            {/* Follow-Up Messages Section */}
            <div className="tc-followups-section">
              <div className="tc-followups-header">
                <label>Follow-Up Messages</label>
                <button
                  type="button"
                  className="tc-btn tc-btn-sm tc-btn-secondary"
                  onClick={addFollowUp}
                >
                  <FiPlus size={12} style={{ marginRight: 4 }} /> Add Follow-Up
                </button>
              </div>

              {followUps.length === 0 && (
                <p className="tc-followups-empty">
                  No follow-ups configured. Contacts who don't respond will only receive the initial message.
                </p>
              )}

              {followUps.map((fu, index) => {
                const fuCharCount = fu.message.length;
                const fuSegments = Math.ceil(fuCharCount / 160) || 1;
                return (
                  <div key={index} className="tc-followup-step">
                    <div className="tc-followup-step-header">
                      <span className="tc-followup-step-label">Follow-Up #{fu.step_number}</span>
                      <button
                        type="button"
                        className="tc-followup-remove"
                        onClick={() => removeFollowUp(index)}
                        title="Remove follow-up"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>

                    <div className="tc-followup-delay">
                      <span>Send after</span>
                      <input
                        type="number"
                        min="1"
                        value={fu.delay_value}
                        onChange={(e) => updateFollowUp(index, 'delay_value', parseInt(e.target.value) || 1)}
                        className="tc-followup-delay-input"
                      />
                      <select
                        value={fu.delay_unit}
                        onChange={(e) => updateFollowUp(index, 'delay_unit', e.target.value)}
                        className="tc-followup-delay-select"
                      >
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                      <span className="tc-followup-delay-hint">from previous message</span>
                    </div>

                    <textarea
                      value={fu.message}
                      onChange={(e) => updateFollowUp(index, 'message', e.target.value)}
                      placeholder={`Follow-up message #${fu.step_number}...`}
                      maxLength={1600}
                      className="tc-followup-textarea"
                    />
                    <div className={`tc-char-count ${fuCharCount > 160 ? 'warn' : ''}`}>
                      {fuCharCount} characters ({fuSegments} SMS segment{fuSegments !== 1 ? 's' : ''})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="tc-modal-footer">
            <button type="button" className="tc-btn tc-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="tc-btn tc-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaignModal;
