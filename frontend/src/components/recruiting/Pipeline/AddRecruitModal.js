import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import Modal from '../../utils/Modal';
import './AddRecruitModal.css';

// US States for dropdown
const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }
];

const AddRecruitModal = ({ isOpen, onClose, onRecruitAdded, initialStage, stages = [] }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  
  // Build ordered stages to determine which come before Compliance
  const orderedStages = React.useMemo(() => {
    const pipelineStages = stages.filter(s => !s.is_terminal);
    
    // Find the starting stage (position_after is NULL)
    let currentStage = pipelineStages.find(s => s.position_after === null);
    
    if (!currentStage) {
      return pipelineStages;
    }
    
    const ordered = [];
    const visited = new Set();
    
    // Follow the chain
    while (currentStage && !visited.has(currentStage.stage_name)) {
      ordered.push(currentStage);
      visited.add(currentStage.stage_name);
      
      // Find next stage
      currentStage = pipelineStages.find(s => 
        s.position_after === currentStage.stage_name && 
        !visited.has(s.stage_name)
      );
    }
    
    return ordered;
  }, [stages]);

  // Get the index of Compliance stage
  const complianceIndex = orderedStages.findIndex(s => s.stage_name === 'Compliance');
  
  // Helper to check if a stage should be disabled
  const isStageDisabled = (stage) => {
    // If no license number, all stages are enabled
    if (!formData.resident_license_number || !formData.resident_license_number.trim()) {
      return false;
    }
    
    // If this is a terminal stage, it's always enabled
    if (stage.is_terminal) {
      return false;
    }
    
    // If Compliance doesn't exist in the list, don't disable anything
    if (complianceIndex === -1) {
      return false;
    }
    
    // Disable stages that come before Compliance
    const stageIndex = orderedStages.findIndex(s => s.stage_name === stage.stage_name);
    return stageIndex !== -1 && stageIndex < complianceIndex;
  };
  const [formData, setFormData] = useState({
    recruit_first: '',
    recruit_middle: '',
    recruit_last: '',
    recruit_suffix: '',
    email: '',
    phone: '',
    instagram: '',
    resident_license_number: '',
    step: initialStage || 'Careers Form',
    resident_state: '',
    code_to: user?.userId || ''
  });

  // Update step when initialStage changes
  useEffect(() => {
    if (initialStage) {
      setFormData(prev => ({ ...prev, step: initialStage }));
    }
  }, [initialStage]);

  // Load team members for "Coded To" dropdown - includes everyone in hierarchy
  useEffect(() => {
    const fetchHierarchyForCodedTo = async () => {
      if (!isOpen || !user?.userId) return;
      
      try {
        const response = await api.post('/auth/searchByUserIdLite', {
          userId: user.userId,
          includeInactive: false // Only active users
        });
        
        if (response.data?.data) {
          const users = response.data.data || [];
          
          // Check if logged-in user is already in the hierarchy
          const selfAlreadyExists = users.some(u => u.id === user.userId);
          
          // Build user list with self at the top, then sorted alphabetically
          let hierarchyUsers = users
            .filter(u => u.id !== user.userId) // Remove self first
            .map(u => ({
              id: u.id,
              lagnname: u.lagnname,
              clname: u.clname,
              isSelf: false
            }))
            .sort((a, b) => {
              const nameA = (a.lagnname || '').toLowerCase();
              const nameB = (b.lagnname || '').toLowerCase();
              return nameA.localeCompare(nameB);
            });
          
          // Add self at the top
          const usersWithSelf = [
            {
              id: user.userId,
              lagnname: user.lagnname,
              clname: user.clname,
              isSelf: true
            },
            ...hierarchyUsers
          ];
          
          console.log('[AddRecruitModal] Loaded hierarchy for Coded To:', {
            totalUsers: usersWithSelf.length,
            includingSelf: true
          });
          
          setTeamMembers(usersWithSelf);
        }
      } catch (error) {
        console.error('Error fetching hierarchy for Coded To dropdown:', error);
        // Fallback to just current user
        setTeamMembers([{
          id: user.userId,
          lagnname: user.lagnname,
          clname: user.clname,
          isSelf: true
        }]);
      }
    };
    
    fetchHierarchyForCodedTo();
  }, [isOpen, user?.userId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Phone number formatting - only allow digits and format as (XXX) XXX-XXXX
    if (name === 'phone') {
      // Remove all non-digit characters
      const digits = value.replace(/\D/g, '');
      
      // Limit to 10 digits
      const limitedDigits = digits.slice(0, 10);
      
      // Format the phone number
      let formattedPhone = limitedDigits;
      if (limitedDigits.length > 6) {
        formattedPhone = `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
      } else if (limitedDigits.length > 3) {
        formattedPhone = `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
      } else if (limitedDigits.length > 0) {
        formattedPhone = `(${limitedDigits}`;
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedPhone
      }));
      return;
    }
    
    // Auto-switch to Compliance step if license number is entered
    if (name === 'resident_license_number') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        step: value.trim() ? 'Compliance' : (initialStage || 'Careers Form')
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Generate random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.recruit_first || !formData.recruit_last) {
      setError('First name and last name are required');
      return;
    }

    // Generate random password for recruit
    const randomPassword = generateRandomPassword();

    // Prepare full payload with all fields (most will be null)
    const payload = {
      recruiting_agent: user.userId,
      recruit_first: formData.recruit_first,
      recruit_middle: formData.recruit_middle || null,
      recruit_last: formData.recruit_last,
      recruit_suffix: formData.recruit_suffix || null,
      step: formData.step || 'Careers Form',
      email: formData.email || null,
      phone: formData.phone || null,
      instagram: formData.instagram || null,
      overview_time: null,
      hire: null,
      final_time: null,
      callback_time: null,
      resident_state: formData.resident_state || null,
      enrolled: null,
      course: null,
      expected_complete_date: null,
      current_progress: null,
      last_log_prelic: null,
      prelic_passed: null,
      prelic_cert: null,
      test_date: null,
      test_passed: null,
      test_cert: null,
      bg_date: null,
      compliance1: null,
      compliance2: null,
      compliance3: null,
      compliance4: null,
      compliance5: null,
      aob: null,
      resident_license_number: formData.resident_license_number || null,
      npn: null,
      agentnum: null,
      impact_setup: null,
      training_start_date: null,
      coded: null,
      code_to: formData.code_to || null,
      eapp_username: null,
      impact_username: null,
      referral_source: null,
      Aspects: null,
      Concern: null,
      Spouse: null,
      CareerGoals: null,
      Compensation: null,
      WhyChoose: null,
      MGA: null,
      redeemed: 0,
      password: randomPassword
    };

    // Show confirmation screen
    setPendingData(payload);
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/recruitment/recruits', pendingData);
      
      // Notify parent component of the new recruit
      if (onRecruitAdded) {
        onRecruitAdded(response.data);
      }

      // Close the modal
      onClose();

      // Reset form
      setFormData({
        recruit_first: '',
        recruit_middle: '',
        recruit_last: '',
        recruit_suffix: '',
        email: '',
        phone: '',
        instagram: '',
        resident_license_number: '',
        step: initialStage || 'Careers Form',
        resident_state: '',
        code_to: user?.userId || ''
      });
      setShowConfirmation(false);
      setPendingData(null);
    } catch (err) {
      console.error('Error adding recruit:', err);
      setError(err.response?.data?.message || 'Failed to add recruit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEdit = () => {
    setShowConfirmation(false);
    setError(null);
  };

  const handleCancel = () => {
    setError(null);
    setShowConfirmation(false);
    setPendingData(null);
    setFormData({
      recruit_first: '',
      recruit_middle: '',
      recruit_last: '',
      recruit_suffix: '',
      email: '',
      phone: '',
      instagram: '',
      resident_license_number: '',
      step: initialStage || 'Careers Form',
      resident_state: '',
      code_to: user?.userId || ''
    });
    onClose();
  };

  // Get the team member name for code_to display
  const getCodeToName = () => {
    const member = teamMembers.find(m => m.id === parseInt(formData.code_to));
    return member ? member.lagnname : 'Not assigned';
  };

  // Get the state label
  const getStateLabel = () => {
    const state = US_STATES.find(s => s.value === formData.resident_state);
    return state ? state.label : 'Not specified';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title={showConfirmation ? "Confirm Recruit Information" : "Add New Recruit"} maxWidth="600px">
      {showConfirmation ? (
        // Confirmation Screen
        <div className="add-recruit-confirmation">
          <div className="confirmation-warning">
            <strong>⚠️ Please verify all information is correct</strong>
            <p>This information will be saved as the agent's official profile. Incorrect information can cause issues down the road.</p>
          </div>

          <div className="confirmation-details">
            <div className="confirmation-section">
              <h4>Personal Information</h4>
              <div className="confirmation-row">
                <span className="confirmation-label">Name:</span>
                <span className="confirmation-value">
                  {pendingData.recruit_first} {pendingData.recruit_middle} {pendingData.recruit_last} {pendingData.recruit_suffix}
                </span>
              </div>
              {pendingData.email && (
                <div className="confirmation-row">
                  <span className="confirmation-label">Email:</span>
                  <span className="confirmation-value">{pendingData.email}</span>
                </div>
              )}
              {pendingData.phone && (
                <div className="confirmation-row">
                  <span className="confirmation-label">Phone:</span>
                  <span className="confirmation-value">{pendingData.phone}</span>
                </div>
              )}
              {pendingData.instagram && (
                <div className="confirmation-row">
                  <span className="confirmation-label">Instagram:</span>
                  <span className="confirmation-value">@{pendingData.instagram}</span>
                </div>
              )}
            </div>

            <div className="confirmation-section">
              <h4>Location & Licensing</h4>
              {pendingData.resident_state && (
                <div className="confirmation-row">
                  <span className="confirmation-label">State:</span>
                  <span className="confirmation-value">{getStateLabel()}</span>
                </div>
              )}
              {pendingData.resident_license_number && (
                <div className="confirmation-row">
                  <span className="confirmation-label">License Number:</span>
                  <span className="confirmation-value">{pendingData.resident_license_number}</span>
                </div>
              )}
            </div>

            <div className="confirmation-section">
              <h4>Pipeline Details</h4>
              <div className="confirmation-row">
                <span className="confirmation-label">Stage:</span>
                <span className="confirmation-value">{pendingData.step}</span>
              </div>
              <div className="confirmation-row">
                <span className="confirmation-label">Coded To:</span>
                <span className="confirmation-value">{getCodeToName()}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="add-recruit-error">
              {error}
            </div>
          )}

          <div className="confirmation-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleBackToEdit}
              disabled={loading}
            >
              ← Back to Edit
            </button>
            <button 
              type="button" 
              className="btn-primary"
              onClick={handleConfirmSubmit}
              disabled={loading}
            >
              {loading ? 'Adding Recruit...' : '✓ Confirm & Add Recruit'}
            </button>
          </div>
        </div>
      ) : (
        // Form Screen
        <form onSubmit={handleSubmit} className="add-recruit-form">
          <div className="add-recruit-disclaimer">
            <strong>⚠️ Important:</strong> Please fill out the recruit's information accurately. This is saved in the system as this agent's official profile, and incorrect information can cause issues down the road.
          </div>

          {error && (
            <div className="add-recruit-error">
              {error}
            </div>
          )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="recruit_first">First Name <span className="required">*</span></label>
            <input
              type="text"
              id="recruit_first"
              name="recruit_first"
              value={formData.recruit_first}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter first name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="recruit_middle">Middle Name</label>
            <input
              type="text"
              id="recruit_middle"
              name="recruit_middle"
              value={formData.recruit_middle}
              onChange={handleChange}
              disabled={loading}
              placeholder="Enter middle name (optional)"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="recruit_last">Last Name <span className="required">*</span></label>
            <input
              type="text"
              id="recruit_last"
              name="recruit_last"
              value={formData.recruit_last}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter last name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="recruit_suffix">Suffix</label>
            <select
              id="recruit_suffix"
              name="recruit_suffix"
              value={formData.recruit_suffix}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">None</option>
              <option value="Jr.">Jr.</option>
              <option value="Sr.">Sr.</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
              <option value="V">V</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              placeholder="email@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={loading}
              placeholder="(555) 123-4567"
              maxLength="14"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="instagram">Instagram Handle</label>
            <input
              type="text"
              id="instagram"
              name="instagram"
              value={formData.instagram}
              onChange={(e) => {
                let value = e.target.value;
                // Remove @ if user types it
                if (value.startsWith('@')) {
                  value = value.substring(1);
                }
                handleChange({ target: { name: 'instagram', value } });
              }}
              disabled={loading}
              placeholder="username"
            />
            {formData.instagram && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                <a 
                  href={`https://instagram.com/${formData.instagram}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}
                >
                  View @{formData.instagram} on Instagram
                </a>
              </div>
            )}
          </div>

          <div className="form-group">
            {/* Empty div to maintain grid layout */}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="resident_state">State</label>
            <select
              id="resident_state"
              name="resident_state"
              value={formData.resident_state}
              onChange={handleChange}
              disabled={loading}
            >
              {US_STATES.map(state => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="resident_license_number">License Number</label>
            <input
              type="text"
              id="resident_license_number"
              name="resident_license_number"
              value={formData.resident_license_number}
              onChange={handleChange}
              disabled={loading}
              placeholder="Enter license # (auto-sets to Compliance)"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="step">Pipeline Step</label>
            <select
              id="step"
              name="step"
              value={formData.step}
              onChange={handleChange}
              disabled={loading}
            >
              {stages.map(stage => (
                <option 
                  key={stage.id} 
                  value={stage.stage_name}
                  disabled={isStageDisabled(stage)}
                  style={isStageDisabled(stage) ? { color: '#999', fontStyle: 'italic' } : {}}
                >
                  {stage.stage_name}
                  {isStageDisabled(stage) ? ' (Licensed agents only)' : ''}
                </option>
              ))}
            </select>
            {formData.resident_license_number && (
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Licensed agent - stages before Compliance are disabled
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="code_to">Coded To</label>
            <select
              id="code_to"
              name="code_to"
              value={formData.code_to}
              onChange={handleChange}
              disabled={loading}
            >
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.lagnname} {member.isSelf ? '(You)' : ''} {member.clname && member.clname !== 'AGT' ? `- ${member.clname}` : ''}
                </option>
              ))}
            </select>
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Select anyone in your hierarchy ({teamMembers.length} available)
            </small>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancel}
            disabled={loading}
            className="btn-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-submit"
          >
            Continue to Review →
          </button>
        </div>
      </form>
      )}
    </Modal>
  );
};

export default AddRecruitModal;

