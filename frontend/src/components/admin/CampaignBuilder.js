import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';
import VariablePicker from './VariablePicker';
import RecipientPreviewModal from './RecipientPreviewModal';
import './CampaignBuilder.css';

const CampaignBuilder = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState(1);
  const [campaign, setCampaign] = useState({
    name: '',
    templateId: null,
    subject: '',
    body: '',
    recipientFilter: {
      clname: [],
      lagnname: [],
      esidMin: '',
      esidMax: '',
      activeOnly: true,
      managerActiveOnly: false
    },
    sendOption: 'now', // 'now' or 'schedule'
    scheduledAt: ''
  });
  
  // Store raw text inputs for filters
  const [filterInputs, setFilterInputs] = useState({
    clname: '',
    lagnname: ''
  });
  
  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState([]);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const subjectInputRef = useRef(null);
  const bodyInputRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
    fetchVariables();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/email-campaigns/templates/list');
      setTemplates(response.data.templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const fetchVariables = async () => {
    try {
      const response = await api.get('/email-campaigns/variables');
      setVariables(response.data.variables || []);
    } catch (err) {
      console.error('Error fetching variables:', err);
    }
  };

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === parseInt(templateId));
    if (template) {
      setCampaign(prev => ({
        ...prev,
        templateId: template.id,
        subject: template.subject,
        body: template.body
      }));
    } else {
      setCampaign(prev => ({
        ...prev,
        templateId: null
      }));
    }
  };

  const handleInputChange = (field, value) => {
    setCampaign(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFilterChange = (field, value) => {
    setCampaign(prev => ({
      ...prev,
      recipientFilter: {
        ...prev.recipientFilter,
        [field]: value
      }
    }));
  };
  
  const handleFilterInputChange = (field, value) => {
    setFilterInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const processFilterInput = (field) => {
    const value = filterInputs[field];
    const processed = value.split(',').map(s => s.trim()).filter(Boolean);
    handleFilterChange(field, processed);
  };

  const insertVariable = (variableKey, targetField) => {
    const variable = `{{${variableKey}}}`;
    
    if (targetField === 'subject') {
      const input = subjectInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = campaign.subject;
      const newText = text.substring(0, start) + variable + text.substring(end);
      
      setCampaign(prev => ({ ...prev, subject: newText }));
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        input.focus();
        const newPos = start + variable.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    } else if (targetField === 'body') {
      const input = bodyInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = campaign.body;
      const newText = text.substring(0, start) + variable + text.substring(end);
      
      setCampaign(prev => ({ ...prev, body: newText }));
      
      setTimeout(() => {
        input.focus();
        const newPos = start + variable.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const previewRecipients = async () => {
    // Process filter inputs before previewing
    processFilterInput('clname');
    processFilterInput('lagnname');
    
    try {
      // Use the processed values
      const filter = {
        clname: filterInputs.clname.split(',').map(s => s.trim()).filter(Boolean),
        lagnname: filterInputs.lagnname.split(',').map(s => s.trim()).filter(Boolean),
        esidMin: campaign.recipientFilter.esidMin,
        esidMax: campaign.recipientFilter.esidMax,
        activeOnly: campaign.recipientFilter.activeOnly,
        managerActiveOnly: campaign.recipientFilter.managerActiveOnly
      };
      
      const response = await api.post('/email-campaigns/preview-recipients', {
        recipientFilter: filter
      });
      setRecipientCount(response.data.count);
      setShowRecipientPreview(true);
    } catch (err) {
      console.error('Error previewing recipients:', err);
      alert('Failed to preview recipients');
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!campaign.name.trim()) {
        setError('Campaign name is required');
        return false;
      }
      if (!campaign.subject.trim()) {
        setError('Subject is required');
        return false;
      }
      if (!campaign.body.trim()) {
        setError('Body is required');
        return false;
      }
    }
    
    if (step === 2) {
      // Process filter inputs before validation
      processFilterInput('clname');
      processFilterInput('lagnname');
      
      const hasFilter = 
        filterInputs.clname.trim() ||
        filterInputs.lagnname.trim() ||
        campaign.recipientFilter.esidMin ||
        campaign.recipientFilter.esidMax;
      
      if (!hasFilter) {
        setError('At least one recipient filter is required');
        return false;
      }
    }
    
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    try {
      // Process filter inputs one final time
      const finalFilter = {
        clname: filterInputs.clname.split(',').map(s => s.trim()).filter(Boolean),
        lagnname: filterInputs.lagnname.split(',').map(s => s.trim()).filter(Boolean),
        esidMin: campaign.recipientFilter.esidMin,
        esidMax: campaign.recipientFilter.esidMax,
        activeOnly: campaign.recipientFilter.activeOnly,
        managerActiveOnly: campaign.recipientFilter.managerActiveOnly
      };
      
      // Create campaign
      const createResponse = await api.post('/email-campaigns', {
        name: campaign.name,
        templateId: campaign.templateId,
        subject: campaign.subject,
        body: campaign.body,
        recipientFilter: finalFilter
      });

      const campaignId = createResponse.data.campaignId;

      // Send or schedule
      if (campaign.sendOption === 'now') {
        await api.post(`/email-campaigns/${campaignId}/send`);
        alert('Campaign sent successfully!');
      } else {
        await api.post(`/email-campaigns/${campaignId}/schedule`, {
          scheduledAt: campaign.scheduledAt
        });
        alert('Campaign scheduled successfully!');
      }

      onSuccess();
    } catch (err) {
      console.error('Error submitting campaign:', err);
      setError(err.response?.data?.error || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="step-content">
      <h3>Step 1: Create Your Email</h3>
      
      <div className="form-group">
        <label>Campaign Name *</label>
        <input
          type="text"
          value={campaign.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., Weekly Newsletter"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Use Template (Optional)</label>
        <select
          value={campaign.templateId || ''}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="form-select"
        >
          <option value="">Create from scratch</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Subject *</label>
        <div className="input-with-button">
          <input
            ref={subjectInputRef}
            type="text"
            value={campaign.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            placeholder="Email subject"
            className="form-input"
          />
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setShowVariablePicker('subject')}
          >
            Insert Variable
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Body *</label>
        <div className="input-with-button">
          <textarea
            ref={bodyInputRef}
            value={campaign.body}
            onChange={(e) => handleInputChange('body', e.target.value)}
            placeholder="Email body (HTML supported)"
            className="form-textarea"
            rows={12}
          />
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => setShowVariablePicker('body')}
          >
            Insert Variable
          </button>
        </div>
        <small className="help-text">
          Use variables like {'{{lagnname}}'} to personalize emails
        </small>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="step-content">
      <h3>Step 2: Select Recipients</h3>
      
      <div className="form-group">
        <label>Contract Level (clname)</label>
        <input
          type="text"
          value={filterInputs.clname}
          onChange={(e) => handleFilterInputChange('clname', e.target.value)}
          placeholder="e.g., MGA, RGA (comma-separated)"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Agent Name (lagnname)</label>
        <input
          type="text"
          value={filterInputs.lagnname}
          onChange={(e) => handleFilterInputChange('lagnname', e.target.value)}
          placeholder="e.g., SMITH JOHN, DOE JANE (comma-separated)"
          className="form-input"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>ESID Min</label>
          <input
            type="number"
            value={campaign.recipientFilter.esidMin}
            onChange={(e) => handleFilterChange('esidMin', e.target.value)}
            placeholder="Minimum ESID"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>ESID Max</label>
          <input
            type="number"
            value={campaign.recipientFilter.esidMax}
            onChange={(e) => handleFilterChange('esidMax', e.target.value)}
            placeholder="Maximum ESID"
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="checkbox-group-label">Status Filters</label>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={campaign.recipientFilter.activeOnly}
              onChange={(e) => handleFilterChange('activeOnly', e.target.checked)}
            />
            <span>Active users only (Active = 'y')</span>
          </label>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={campaign.recipientFilter.managerActiveOnly}
              onChange={(e) => handleFilterChange('managerActiveOnly', e.target.checked)}
            />
            <span>Leader Active only (managerActive = 'y')</span>
          </label>
        </div>
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={previewRecipients}
      >
        Preview Recipients
      </button>
      
      {recipientCount > 0 && (
        <div className="recipient-count">
          <strong>{recipientCount}</strong> recipient(s) will receive this email
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="step-content">
      <h3>Step 3: Send Options</h3>
      
      <div className="form-group">
        <label>When to send?</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              value="now"
              checked={campaign.sendOption === 'now'}
              onChange={(e) => handleInputChange('sendOption', e.target.value)}
            />
            <span>Send now</span>
          </label>
          
          <label className="radio-label">
            <input
              type="radio"
              value="schedule"
              checked={campaign.sendOption === 'schedule'}
              onChange={(e) => handleInputChange('sendOption', e.target.value)}
            />
            <span>Schedule for later</span>
          </label>
        </div>
      </div>

      {campaign.sendOption === 'schedule' && (
        <div className="form-group">
          <label>Schedule Date & Time *</label>
          <input
            type="datetime-local"
            value={campaign.scheduledAt}
            onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
            className="form-input"
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>
      )}

      <div className="summary-box">
        <h4>Campaign Summary</h4>
        <div className="summary-item">
          <strong>Name:</strong> {campaign.name}
        </div>
        <div className="summary-item">
          <strong>Subject:</strong> {campaign.subject}
        </div>
        <div className="summary-item">
          <strong>Recipients:</strong> {recipientCount} user(s)
        </div>
        <div className="summary-item">
          <strong>Send:</strong> {campaign.sendOption === 'now' ? 'Immediately' : `Scheduled for ${new Date(campaign.scheduledAt).toLocaleString()}`}
        </div>
      </div>
    </div>
  );

  return (
    <div className="campaign-builder">
      <div className="step-indicator">
        <div className={`step-item ${step >= 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Email Content</div>
        </div>
        <div className={`step-item ${step >= 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Recipients</div>
        </div>
        <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Send Options</div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      <div className="button-group">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        
        {step > 1 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleBack}
          >
            Back
          </button>
        )}
        
        {step < 3 ? (
          <button
            type="button"
            className="btn-primary"
            onClick={handleNext}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Sending...' : campaign.sendOption === 'now' ? 'Send Now' : 'Schedule'}
          </button>
        )}
      </div>

      {showVariablePicker && (
        <VariablePicker
          variables={variables}
          onSelect={(varKey) => {
            insertVariable(varKey, showVariablePicker);
            setShowVariablePicker(false);
          }}
          onClose={() => setShowVariablePicker(false)}
        />
      )}

      {showRecipientPreview && (
        <RecipientPreviewModal
          filters={campaign.recipientFilter}
          onClose={() => setShowRecipientPreview(false)}
        />
      )}
    </div>
  );
};

export default CampaignBuilder;


