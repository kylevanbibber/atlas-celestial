import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import Modal from '../../utils/Modal';
import { FiCheck, FiX, FiChevronDown, FiChevronRight, FiUpload, FiPaperclip, FiDownload, FiTrash2 } from 'react-icons/fi';
import './PipelineChecklist.css';

const PipelineChecklist = ({ recruit, stages, onClose }) => {
  const { user } = useAuth();
  const [checklistItems, setChecklistItems] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState({});
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingItems, setUploadingItems] = useState({});
  const fileInputRefs = useRef({});

  useEffect(() => {
    fetchChecklistData();
  }, [recruit.id]);

  const fetchChecklistData = async () => {
    try {
      setLoading(true);
      
      // Fetch all checklist items
      const itemsResponse = await api.get('/recruitment/checklist');
      if (itemsResponse.data.success) {
        setChecklistItems(itemsResponse.data.data);
      }
      
      // Fetch recruit's progress
      const progressResponse = await api.get(`/recruitment/recruits/${recruit.id}/checklist`);
      if (progressResponse.data.success) {
        setProgress(progressResponse.data.data);
      }
      
      // Fetch attachments for this recruit
      const attachmentsResponse = await api.get(`/pipeline-attachments/recruit/${recruit.id}`);
      if (attachmentsResponse.data.success) {
        setAttachments(attachmentsResponse.data.data || []);
      }
      
      // Auto-expand only the current stage (not completed previous stages)
      const expanded = {};
      const currentStage = stages.find(s => 
        s.stage_name.trim().toLowerCase() === (recruit.step || '').trim().toLowerCase()
      );
      if (currentStage) {
        expanded[currentStage.stage_name] = true;
      }
      setExpandedStages(expanded);
      
    } catch (error) {
      console.error('Error fetching checklist data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group items by stage
  const itemsByStage = {};
  checklistItems.forEach(item => {
    if (!itemsByStage[item.stage_name]) {
      itemsByStage[item.stage_name] = [];
    }
    itemsByStage[item.stage_name].push(item);
  });

  // Get progress for an item
  const getItemProgress = (itemId) => {
    return progress.find(p => p.checklist_item_id === itemId);
  };

  // Calculate completion percentage for a stage
  const getStageCompletion = (stageName) => {
    const stageItems = itemsByStage[stageName] || [];
    if (stageItems.length === 0) return 0;
    
    const completed = stageItems.filter(item => {
      const prog = getItemProgress(item.id);
      return prog?.completed;
    }).length;
    
    return Math.round((completed / stageItems.length) * 100);
  };

  // Toggle stage expansion
  const toggleStage = (stageName) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageName]: !prev[stageName]
    }));
  };

  // Handle checkbox toggle
  const handleToggleItem = async (item) => {
    const currentProgress = getItemProgress(item.id);
    const newCompleted = !currentProgress?.completed;
    
    try {
      await api.post(`/recruitment/recruits/${recruit.id}/checklist`, {
        checklist_item_id: item.id,
        completed: newCompleted,
        completed_by: newCompleted ? user.userId : null
      });
      
      // Refresh progress
      fetchChecklistData();
    } catch (error) {
      console.error('Error toggling checklist item:', error);
    }
  };

  // Handle value change for input fields
  const handleValueChange = async (item, value) => {
    try {
      setSaving(true);
      await api.post(`/recruitment/recruits/${recruit.id}/checklist`, {
        checklist_item_id: item.id,
        value: value,
        completed_by: user.userId
      });
      
      // Update local state
      setProgress(prev => {
        const existing = prev.find(p => p.checklist_item_id === item.id);
        if (existing) {
          return prev.map(p => 
            p.checklist_item_id === item.id 
              ? { ...p, value }
              : p
          );
        } else {
          return [...prev, {
            checklist_item_id: item.id,
            value,
            completed: false
          }];
        }
      });
    } catch (error) {
      console.error('Error updating value:', error);
    } finally {
      setSaving(false);
    }
  };

  // Get attachments for a specific checklist item
  const getItemAttachments = (itemId) => {
    return attachments.filter(att => att.checklist_item_id === itemId);
  };

  // Check if item needs proof attachment
  const needsProof = (item) => {
    return item.item_description && 
           item.item_description.toLowerCase().includes('attach proof');
  };

  // Handle file selection
  const handleFileSelect = async (item, event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingItems(prev => ({ ...prev, [item.id]: true }));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('recruit_id', recruit.id);
      formData.append('checklist_item_id', item.id);
      formData.append('file_category', 'proof');
      formData.append('description', `Proof for: ${item.item_name}`);

      const response = await api.post('/pipeline-attachments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        // Refresh attachments
        const attachmentsResponse = await api.get(`/pipeline-attachments/recruit/${recruit.id}`);
        if (attachmentsResponse.data.success) {
          setAttachments(attachmentsResponse.data.data || []);
        }
        alert('File uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please try again.');
    } finally {
      setUploadingItems(prev => ({ ...prev, [item.id]: false }));
      // Reset file input
      if (fileInputRefs.current[item.id]) {
        fileInputRefs.current[item.id].value = '';
      }
    }
  };

  // Handle file download
  const handleFileDownload = async (attachmentId, fileName) => {
    try {
      const response = await api.get(`/pipeline-attachments/download/${attachmentId}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file. Please try again.');
    }
  };

  // Handle file deletion
  const handleFileDelete = async (attachmentId, itemId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await api.delete(`/pipeline-attachments/${attachmentId}`);
      
      if (response.data.success) {
        // Remove from local state
        setAttachments(prev => prev.filter(att => att.id !== attachmentId));
        alert('File deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file. Please try again.');
    }
  };

  // Trigger file input click
  const triggerFileInput = (itemId) => {
    if (fileInputRefs.current[itemId]) {
      fileInputRefs.current[itemId].click();
    }
  };

  // Render input based on item type
  const renderInput = (item) => {
    const itemProgress = getItemProgress(item.id);
    const value = itemProgress?.value || '';
    
    switch (item.item_type) {
      case 'checkbox':
        return (
          <button
            onClick={() => handleToggleItem(item)}
            className={`checklist-checkbox ${itemProgress?.completed ? 'checked' : ''}`}
          >
            {itemProgress?.completed && <FiCheck />}
          </button>
        );
        
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(item, e.target.value)}
            onBlur={() => {}}
            className="checklist-input"
            placeholder="Enter value..."
          />
        );
        
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleValueChange(item, e.target.value)}
            className="checklist-input"
          />
        );
        
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(item, e.target.value)}
            className="checklist-input"
            placeholder="Enter number..."
          />
        );
        
      case 'select':
        const options = item.item_options ? JSON.parse(item.item_options) : [];
        return (
          <select
            value={value}
            onChange={(e) => handleValueChange(item, e.target.value)}
            className="checklist-select"
          >
            <option value="">Select...</option>
            {options.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
        
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleValueChange(item, e.target.value)}
            onBlur={() => {}}
            className="checklist-textarea"
            placeholder="Enter notes..."
            rows={3}
          />
        );
        
      default:
        return null;
    }
  };

  // Calculate overall progress
  const overallCompletion = () => {
    if (checklistItems.length === 0) return 0;
    const completed = checklistItems.filter(item => {
      const prog = getItemProgress(item.id);
      return prog?.completed;
    }).length;
    return Math.round((completed / checklistItems.length) * 100);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${recruit.recruit_first} ${recruit.recruit_last} - Pipeline Checklist`}
      size="large"
    >
      <div className="pipeline-checklist-container">
        {/* Header with overall progress */}
        <div className="checklist-header">
          <div className="checklist-recruit-info">
            <h3>{recruit.recruit_first} {recruit.recruit_last}</h3>
            <p>Current Stage: <strong>{recruit.step}</strong></p>
            {recruit.email && <p>Email: {recruit.email}</p>}
            {recruit.phone && <p>Phone: {recruit.phone}</p>}
          </div>
          
          <div className="checklist-progress-summary">
            <div className="progress-circle">
              <svg viewBox="0 0 36 36">
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#00558c"
                  strokeWidth="3"
                  strokeDasharray={`${overallCompletion()}, 100`}
                />
                <text x="18" y="20.35" fontSize="8" textAnchor="middle" fill="#333">
                  {overallCompletion()}%
                </text>
              </svg>
            </div>
            <span>Overall Progress</span>
          </div>
        </div>

        {/* Checklist by stages */}
        {loading ? (
          <div className="checklist-loading">
            <div className="pipeline-loading-spinner"></div>
            <span>Loading checklist...</span>
          </div>
        ) : (
          <div className="checklist-stages">
            {stages.map(stage => {
              const stageItems = itemsByStage[stage.stage_name] || [];
              const completion = getStageCompletion(stage.stage_name);
              const isExpanded = expandedStages[stage.stage_name];
              const isCurrentStage = stage.stage_name === recruit.step;
              
              if (stageItems.length === 0) return null;
              
              return (
                <div 
                  key={stage.id} 
                  className={`checklist-stage ${isCurrentStage ? 'current' : ''}`}
                >
                  <div 
                    className="checklist-stage-header"
                    onClick={() => toggleStage(stage.stage_name)}
                  >
                    <div className="stage-header-left">
                      {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                      <div
                        className="stage-indicator"
                        style={{ backgroundColor: stage.stage_color }}
                      />
                      <h4>{stage.stage_name}</h4>
                      {isCurrentStage && <span className="current-badge">Current</span>}
                    </div>
                    
                    <div className="stage-header-right">
                      <div className="stage-progress-bar">
                        <div 
                          className="stage-progress-fill"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <span className="stage-completion">{completion}%</span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="checklist-items">
                      {stageItems.map(item => {
                        const itemProgress = getItemProgress(item.id);
                        const isCompleted = itemProgress?.completed;
                        const itemAttachments = getItemAttachments(item.id);
                        const showAttachments = needsProof(item);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`checklist-item ${isCompleted ? 'completed' : ''}`}
                          >
                            <div className="checklist-item-main">
                              <div className="checklist-item-info">
                                {renderInput(item)}
                                <div className="checklist-item-text">
                                  <label>
                                    {item.item_name}
                                    {item.is_required && <span className="required-star">*</span>}
                                  </label>
                                  {item.item_description && (
                                    <p className="item-description">{item.item_description}</p>
                                  )}
                                </div>
                              </div>
                              
                              {isCompleted && itemProgress?.completed_by_name && (
                                <div className="checklist-item-meta">
                                  <span className="completed-by">
                                    ✓ {itemProgress.completed_by_name}
                                  </span>
                                  {itemProgress.completed_at && (
                                    <span className="completed-date">
                                      {new Date(itemProgress.completed_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Attachments Section */}
                            {showAttachments && (
                              <div className="checklist-item-attachments">
                                <input
                                  ref={el => fileInputRefs.current[item.id] = el}
                                  type="file"
                                  onChange={(e) => handleFileSelect(item, e)}
                                  style={{ display: 'none' }}
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                                />
                                
                                <div className="attachments-header">
                                  <FiPaperclip style={{ fontSize: '14px', color: '#666' }} />
                                  <span>Attachments ({itemAttachments.length})</span>
                                  <button
                                    onClick={() => triggerFileInput(item.id)}
                                    disabled={uploadingItems[item.id]}
                                    className="upload-btn"
                                  >
                                    {uploadingItems[item.id] ? (
                                      <>Uploading...</>
                                    ) : (
                                      <>
                                        <FiUpload style={{ marginRight: '4px' }} />
                                        Upload File
                                      </>
                                    )}
                                  </button>
                                </div>

                                {itemAttachments.length > 0 && (
                                  <div className="attachments-list">
                                    {itemAttachments.map(att => (
                                      <div key={att.id} className="attachment-item">
                                        <div className="attachment-info">
                                          <FiPaperclip style={{ fontSize: '12px', color: '#666' }} />
                                          <span className="attachment-name">{att.file_name}</span>
                                          <span className="attachment-size">
                                            ({(att.file_size / 1024).toFixed(1)} KB)
                                          </span>
                                        </div>
                                        <div className="attachment-actions">
                                          <button
                                            onClick={() => handleFileDownload(att.id, att.file_name)}
                                            className="attachment-action-btn"
                                            title="Download"
                                          >
                                            <FiDownload />
                                          </button>
                                          <button
                                            onClick={() => handleFileDelete(att.id, item.id)}
                                            className="attachment-action-btn delete"
                                            title="Delete"
                                          >
                                            <FiTrash2 />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Footer actions */}
        <div className="checklist-footer">
          <button onClick={onClose} className="pipeline-btn">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PipelineChecklist;

