import React, { useState, useEffect } from 'react';
import { FaTimes, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaCalendarAlt, FaEllipsisV } from 'react-icons/fa';
import '../utils/RightDetails.css';
import './ApplicantDetails.css';

const APPLICANT_STEPS = ['Careers Form', 'No Answer - Career Form', 'Callback - Career Form', 'Final', 'Not Interested'];

const APPLICANT_STEP_COLORS = {
  'Careers Form': '#3498db',
  'No Answer - Career Form': '#95a5a6',
  'Callback - Career Form': '#f39c12',
  'Final': '#27ae60',
  'Not Interested': '#e74c3c',
};

const ApplicantDetails = ({
  data,
  onClose,
  onSave,
  onQuickAction,
  onMoveToApplicants,
  onAdvanceStep,
  onShowFinalModal,
  onShowCallbackModal,
  onShowHiredModal,
  onStepChange
}) => {
  const [formData, setFormData] = useState(data || {});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setFormData(data || {});
  }, [data]);

  const handleSave = async () => {
    if (onSave) {
      const success = await onSave(formData);
      if (success) {
        setIsEditing(false);
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Action handlers
  const handleQuickAction = (action) => {
    if (onQuickAction) {
      onQuickAction(formData, action);
    }
  };

  const handleMoveToApplicants = () => {
    if (onMoveToApplicants) {
      onMoveToApplicants(formData.id);
      onClose(); // Close the panel after action
    }
  };

  const handleAdvanceStep = (step) => {
    if (onAdvanceStep) {
      onAdvanceStep(formData.id, step);
      onClose(); // Close the panel after action
    }
  };

  const handleModalAction = (actionCallback) => {
    if (actionCallback) {
      actionCallback(formData);
      onClose(); // Close the details panel when opening a modal
    }
  };

  return (
    <div className="right-details-content">
      {/* Header */}
      <div className="right-details-header">
        <div className="applicant-header-left">
          <FaUser className="header-icon" />
          <div>
            <h2>{formData.fullName || 'Applicant Details'}</h2>
            <p className="header-subtitle">Recruitment Pipeline</p>
          </div>
        </div>
        <div className="header-actions">
          {isEditing ? (
            <>
              <button className="primary-button" onClick={handleSave}>
                Save
              </button>
              <button 
                className="secondary-button" 
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button 
                className="secondary-button" 
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
              
              {/* Action Buttons */}
              {onQuickAction && (
                <div className="action-buttons-group">
                  <button 
                    className="primary-button action-btn"
                    onClick={() => handleModalAction(onShowFinalModal)}
                  >
                    Book Final
                  </button>
                  <button 
                    className="secondary-button action-btn"
                    onClick={() => handleModalAction(onShowCallbackModal)}
                  >
                    Schedule Callback
                  </button>
                  <button 
                    className="primary-button action-btn"
                    onClick={() => handleModalAction(onShowHiredModal)}
                  >
                    Hired
                  </button>
                  <button 
                    className="secondary-button action-btn"
                    onClick={() => handleAdvanceStep('Not Interested')}
                  >
                    Not Interested
                  </button>
                  <button 
                    className="secondary-button action-btn"
                    onClick={() => handleAdvanceStep('No Answer - Career Form')}
                  >
                    No Answer
                  </button>
                  
                  {/* Move to Applicants - only show if not already in Careers Form */}
                  {formData.step && formData.step !== 'Careers Form' && (
                    <button 
                      className="warning-button action-btn"
                      onClick={handleMoveToApplicants}
                    >
                      Move to Applicants
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="right-details-body">
        <div className="details-section">
          <h3>Personal Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label><FaUser /> Full Name</label>
              {isEditing ? (
                <div className="name-inputs">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={formData.recruit_first || ''}
                    onChange={(e) => handleInputChange('recruit_first', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Middle Name"
                    value={formData.recruit_middle || ''}
                    onChange={(e) => handleInputChange('recruit_middle', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={formData.recruit_last || ''}
                    onChange={(e) => handleInputChange('recruit_last', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Suffix"
                    value={formData.recruit_suffix || ''}
                    onChange={(e) => handleInputChange('recruit_suffix', e.target.value)}
                  />
                </div>
              ) : (
                <div className="field-value">{formData.fullName}</div>
              )}
            </div>

            <div className="form-group">
              <label><FaPhone /> Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              ) : (
                <div className="field-value">{formData.phone}</div>
              )}
            </div>

            <div className="form-group">
              <label><FaEnvelope /> Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              ) : (
                <div className="field-value">{formData.email}</div>
              )}
            </div>

            <div className="form-group">
              <label><FaMapMarkerAlt /> Resident State</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.resident_state || ''}
                  onChange={(e) => handleInputChange('resident_state', e.target.value)}
                />
              ) : (
                <div className="field-value">{formData.resident_state}</div>
              )}
            </div>

            <div className="form-group">
              <label><FaCalendarAlt /> Date Added</label>
              <div className="field-value">{formData.formattedDateAdded}</div>
            </div>

            <div className="form-group">
              <label>Current Step</label>
              <select
                className="step-select"
                value={formData.step || ''}
                onChange={(e) => {
                  const newStep = e.target.value;
                  handleInputChange('step', newStep);
                  if (onStepChange) {
                    onStepChange(formData.id, newStep);
                  }
                }}
                style={{
                  backgroundColor: APPLICANT_STEP_COLORS[formData.step] || '#3498db',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  fontSize: '0.85em',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {APPLICANT_STEPS.map(step => (
                  <option key={step} value={step} style={{ backgroundColor: '#fff', color: '#333' }}>
                    {step}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="details-section">
          <h3>Interview Details</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Aspects</label>
              {isEditing ? (
                <textarea
                  value={formData.Aspects || ''}
                  onChange={(e) => handleInputChange('Aspects', e.target.value)}
                  rows="3"
                />
              ) : (
                <div className="field-value">{formData.Aspects}</div>
              )}
            </div>

            <div className="form-group">
              <label>Concerns</label>
              {isEditing ? (
                <textarea
                  value={formData.Concern || ''}
                  onChange={(e) => handleInputChange('Concern', e.target.value)}
                  rows="3"
                />
              ) : (
                <div className="field-value">{formData.Concern}</div>
              )}
            </div>

            <div className="form-group">
              <label>Spouse Information</label>
              {isEditing ? (
                <textarea
                  value={formData.Spouse || ''}
                  onChange={(e) => handleInputChange('Spouse', e.target.value)}
                  rows="2"
                />
              ) : (
                <div className="field-value">{formData.Spouse}</div>
              )}
            </div>

            <div className="form-group">
              <label>Career Goals</label>
              {isEditing ? (
                <textarea
                  value={formData.CareerGoals || ''}
                  onChange={(e) => handleInputChange('CareerGoals', e.target.value)}
                  rows="3"
                />
              ) : (
                <div className="field-value">{formData.CareerGoals}</div>
              )}
            </div>

            <div className="form-group">
              <label>Compensation Expectations</label>
              {isEditing ? (
                <textarea
                  value={formData.Compensation || ''}
                  onChange={(e) => handleInputChange('Compensation', e.target.value)}
                  rows="2"
                />
              ) : (
                <div className="field-value">{formData.Compensation}</div>
              )}
            </div>

            <div className="form-group">
              <label>Why Choose Us</label>
              {isEditing ? (
                <textarea
                  value={formData.WhyChoose || ''}
                  onChange={(e) => handleInputChange('WhyChoose', e.target.value)}
                  rows="3"
                />
              ) : (
                <div className="field-value">{formData.WhyChoose}</div>
              )}
            </div>
          </div>
        </div>

        <div className="details-section">
          <h3>Assignment & Licensing</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>MGA</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.MGA || ''}
                  onChange={(e) => handleInputChange('MGA', e.target.value)}
                />
              ) : (
                <div className="field-value">{formData.MGA}</div>
              )}
            </div>

            <div className="form-group">
              <label>Recruiting Agent</label>
              <div className="field-value">{formData.lagnname}</div>
            </div>

            {formData.final_time && (
              <div className="form-group">
                <label>Final Interview Time</label>
                <div className="field-value">{formData.final_time}</div>
              </div>
            )}

            {formData.callback_time && (
              <div className="form-group">
                <label>Callback Time</label>
                <div className="field-value">{formData.callback_time}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicantDetails; 