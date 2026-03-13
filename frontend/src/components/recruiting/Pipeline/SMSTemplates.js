import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiShare2, FiUser, FiCode } from 'react-icons/fi';
import SMSVariablePicker from './SMSVariablePicker';
import './PipelineSettings.css';

const SMSTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    is_shared: false,
    category: ''
  });
  const messageTextareaRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/recruitment/sms/templates');
      if (response.data.success) {
        setTemplates(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching SMS templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        message: template.message,
        is_shared: template.is_shared === 1,
        category: template.category || ''
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        message: '',
        is_shared: false,
        category: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      message: '',
      is_shared: false,
      category: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.message) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate) {
        // Update existing template
        const response = await api.put(`/recruitment/sms/templates/${editingTemplate.id}`, formData);
        if (response.data.success) {
          toast.success('Template updated successfully');
          fetchTemplates();
          handleCloseModal();
        }
      } else {
        // Create new template
        const response = await api.post('/recruitment/sms/templates', formData);
        if (response.data.success) {
          toast.success('Template created successfully');
          fetchTemplates();
          handleCloseModal();
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.message || 'Failed to save template');
    }
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await api.delete(`/recruitment/sms/templates/${templateId}`);
      if (response.data.success) {
        toast.success('Template deleted successfully');
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error.response?.data?.message || 'Failed to delete template');
    }
  };

  const handleCopyMessage = (message) => {
    navigator.clipboard.writeText(message);
    toast.success('Message copied to clipboard');
  };

  const handleInsertVariable = (variable) => {
    const textarea = messageTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.message;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newMessage = before + variable + after;
    setFormData({ ...formData, message: newMessage });
    
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
    
    setShowVariablePicker(false);
  };

  // Group templates by personal vs shared
  const personalTemplates = templates.filter(t => t.user_id === user?.userId);
  const sharedTemplates = templates.filter(t => t.user_id !== user?.userId && t.is_shared === 1);

  return (
    <div className="sms-templates-section">
      <div className="sms-templates-header">
        <div>
          <h3>SMS Templates</h3>
          <p className="settings-note">
            Create reusable text message templates for faster communication with recruits
          </p>
        </div>
        <button
          type="button"
          className="pipeline-btn pipeline-btn-primary"
          onClick={() => handleOpenModal()}
        >
          <FiPlus style={{ marginRight: 6 }} />
          New Template
        </button>
      </div>

      {loading ? (
        <div className="pipeline-billing-loading-row">
          <div className="pipeline-loading-spinner" />
          <span>Loading templates…</span>
        </div>
      ) : (
        <>
          {/* Personal Templates */}
          {personalTemplates.length > 0 && (
            <div className="templates-group">
              <h4 className="templates-group-title">
                <FiUser style={{ marginRight: 6 }} />
                My Templates ({personalTemplates.length})
              </h4>
              <div className="templates-grid">
                {personalTemplates.map(template => (
                  <div key={template.id} className="template-card">
                    <div className="template-card-header">
                      <div>
                        <h5 className="template-name">{template.name}</h5>
                        {template.category && (
                          <span className="template-category">{template.category}</span>
                        )}
                      </div>
                      <div className="template-actions">
                        <button
                          className="template-action-btn"
                          onClick={() => handleCopyMessage(template.message)}
                          title="Copy message"
                        >
                          <FiCopy />
                        </button>
                        <button
                          className="template-action-btn"
                          onClick={() => handleOpenModal(template)}
                          title="Edit template"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          className="template-action-btn delete"
                          onClick={() => handleDelete(template.id)}
                          title="Delete template"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                    <div className="template-message">
                      {template.message}
                    </div>
                    <div className="template-footer">
                      <span className="template-usage">
                        Used {template.usage_count} time{template.usage_count !== 1 ? 's' : ''}
                      </span>
                      {template.is_shared === 1 && (
                        <span className="template-shared-badge">
                          <FiShare2 style={{ marginRight: 4 }} />
                          Shared
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared Templates */}
          {sharedTemplates.length > 0 && (
            <div className="templates-group">
              <h4 className="templates-group-title">
                <FiShare2 style={{ marginRight: 6 }} />
                Team Templates ({sharedTemplates.length})
              </h4>
              <div className="templates-grid">
                {sharedTemplates.map(template => (
                  <div key={template.id} className="template-card shared">
                    <div className="template-card-header">
                      <div>
                        <h5 className="template-name">{template.name}</h5>
                        {template.category && (
                          <span className="template-category">{template.category}</span>
                        )}
                      </div>
                      <div className="template-actions">
                        <button
                          className="template-action-btn"
                          onClick={() => handleCopyMessage(template.message)}
                          title="Copy message"
                        >
                          <FiCopy />
                        </button>
                      </div>
                    </div>
                    <div className="template-message">
                      {template.message}
                    </div>
                    <div className="template-footer">
                      <span className="template-usage">
                        Used {template.usage_count} time{template.usage_count !== 1 ? 's' : ''}
                      </span>
                      <span className="template-creator">
                        by {template.created_by_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {templates.length === 0 && (
            <div className="templates-empty">
              <FiPlus size={48} style={{ color: '#9ca3af', marginBottom: 16 }} />
              <p>No templates yet</p>
              <button
                type="button"
                className="pipeline-btn pipeline-btn-primary"
                onClick={() => handleOpenModal()}
              >
                Create Your First Template
              </button>
            </div>
          )}
        </>
      )}

      {/* Template Modal */}
      {showModal && (
        <div className="template-modal-overlay" onClick={handleCloseModal}>
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal-header">
              <h3>{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
              <button className="template-modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="template-modal-body">
                <div className="form-field">
                  <label>Template Name *</label>
                  <input
                    type="text"
                    className="pipeline-input"
                    placeholder="e.g., Welcome Message, Follow-up Reminder"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Category (Optional)</label>
                  <input
                    type="text"
                    className="pipeline-input"
                    placeholder="e.g., Onboarding, Follow-up, Reminder"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Message *</span>
                    <button
                      type="button"
                      className="pipeline-btn"
                      onClick={() => setShowVariablePicker(true)}
                      style={{ 
                        padding: '4px 12px', 
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <FiCode /> Insert Variable
                    </button>
                  </label>
                  <textarea
                    ref={messageTextareaRef}
                    className="pipeline-input"
                    placeholder="Enter your message template... Use {{variable_name}} for dynamic content."
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    maxLength={5000}
                  />
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 4 }}>
                    {formData.message.length}/5000 characters
                    {formData.message.length > 160 && (
                      <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
                        (Note: Messages over 160 characters will be sent as multiple SMS segments)
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-field">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_shared}
                      onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
                    />
                    <span>Share with team</span>
                  </label>
                  <p className="field-hint">
                    Shared templates can be used by all team members
                  </p>
                </div>
              </div>

              <div className="template-modal-footer">
                <button
                  type="button"
                  className="pipeline-btn"
                  onClick={handleCloseModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pipeline-btn pipeline-btn-primary"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variable Picker Modal */}
      {showVariablePicker && (
        <SMSVariablePicker
          onInsert={handleInsertVariable}
          onClose={() => setShowVariablePicker(false)}
        />
      )}
    </div>
  );
};

export default SMSTemplates;

