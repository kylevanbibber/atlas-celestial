import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import '../../components/recruiting/Pipeline/PipelineChecklist.css';

const OnboardingHome = () => {
  const navigate = useNavigate();
  const pipelineId = localStorage.getItem('onboardingPipelineId');
  const email = localStorage.getItem('onboardingEmail');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]); // checklist definitions
  const [stages, setStages] = useState([]); // stage definitions (ordered)
  const [progress, setProgress] = useState([]); // progress records
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingItems, setUploadingItems] = useState({});
  const fileInputRefs = useRef({});
  const [expandedStages, setExpandedStages] = useState({});

  useEffect(() => {
    if (!pipelineId) {
      navigate('/onboarding/login', { replace: true });
    }
  }, [pipelineId, navigate]);

  useEffect(() => {
    const run = async () => {
      if (!pipelineId) return;
      setLoading(true);
      setError('');
      try {
        const [itemsResp, progResp, attResp, stagesResp] = await Promise.all([
          api.get(`/recruitment/recruits/${pipelineId}/checklist/items`),
          api.get(`/recruitment/recruits/${pipelineId}/checklist`),
          api.get(`/pipeline-attachments/recruit/${pipelineId}`),
          api.get(`/recruitment/stages`)
        ]);
        const itemList = itemsResp.data?.data || [];
        const progList = progResp.data?.data || [];
        const atts = attResp.data?.data || attResp.data?.attachments || [];
        const stageList = stagesResp.data?.data || [];
        setItems(itemList);
        setProgress(progList);
        setAttachments(atts);
        setStages(stageList);
        // auto-expand first stage
        if (stageList.length) {
          const firstStageId = stageList[0].id;
          setExpandedStages({ [firstStageId]: true });
        }
      } catch (e) {
        setError('Failed to load checklist');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [pipelineId]);

  const progressByItemId = useMemo(() => {
    const map = new Map();
    (progress || []).forEach(p => map.set(p.checklist_item_id, p));
    return map;
  }, [progress]);

  const isSystemControlled = (name = '') => {
    const s = String(name).toLowerCase();
    return s.includes('receive agent number') || s.includes('activate agent number') || s.includes('agent number');
  };

  const needsProof = (item) => {
    const text = `${item.item_name || ''} ${item.item_description || ''}`.toLowerCase();
    return text.includes('attach proof') || text.includes('license approval') || text.includes('receive license approval');
  };

  const getItemAttachments = (itemId) => attachments.filter(a => a.checklist_item_id === itemId);

  const handleToggle = async (item) => {
    if (isSystemControlled(item.item_name)) return;
    if (needsProof(item) && getItemAttachments(item.id).length === 0) {
      // require proof before checking
      return;
    }
    try {
      const current = progressByItemId.get(item.id);
      const newCompleted = current ? !current.completed : true;
      await api.post(`/recruitment/recruits/${pipelineId}/checklist`, {
        checklist_item_id: item.id,
        completed: newCompleted
      });
      // refresh progress locally without refetch
      setProgress(prev => {
        const existing = prev.find(p => p.checklist_item_id === item.id);
        if (existing) {
          return prev.map(p => p.checklist_item_id === item.id ? { ...p, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : p);
        }
        return [...prev, { checklist_item_id: item.id, completed: newCompleted, stage_name: item.stage_name, item_name: item.item_name }];
      });
    } catch (e) {
      // ignore UI error for now
    }
  };

  const triggerFileInput = (itemId) => {
    if (fileInputRefs.current[itemId]) fileInputRefs.current[itemId].click();
  };

  const handleFileSelect = async (item, event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      setUploadingItems(prev => ({ ...prev, [item.id]: true }));
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recruit_id', pipelineId);
      formData.append('checklist_item_id', item.id);
      formData.append('file_category', 'proof');
      formData.append('description', `Proof for: ${item.item_name}`);
      const resp = await api.post('/pipeline-attachments/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (resp.data?.success) {
        // refresh attachments list
        const attResp = await api.get(`/pipeline-attachments/recruit/${pipelineId}`);
        const atts = attResp.data?.data || attResp.data?.attachments || [];
        setAttachments(atts);
      }
    } catch (e) {
      // error surfaced silently
    } finally {
      setUploadingItems(prev => ({ ...prev, [item.id]: false }));
      if (fileInputRefs.current[item.id]) fileInputRefs.current[item.id].value = '';
    }
  };

  // derive next steps: items not completed
  const getStageItems = (stageName) => {
    return (items || []).filter(i => i.stage_name === stageName);
  };

  const getStageCompletion = (stageName) => {
    const stageItems = getStageItems(stageName);
    if (stageItems.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = stageItems.filter(i => progressByItemId.get(i.id)?.completed).length;
    return { completed, total: stageItems.length, percentage: Math.round((completed / stageItems.length) * 100) };
  };

  return (
    <div className="onboarding-root onboarding-home">
      {/* Page Content */}
      <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        <h2 style={{ marginTop: 0 }}>Welcome to your Onboarding Portal</h2>
        <p style={{ color: 'var(--text-secondary, #666)' }}>
          We’ll guide you through the steps to get set up. Your progress will appear here.
        </p>
        {/* Staged checklist like RightDetails */}
        <div className="pipeline-checklist-container">
          {loading ? (
            <div className="checklist-loading">Loading checklist...</div>
          ) : error ? (
            <div className="checklist-loading" style={{ color: 'red' }}>{error}</div>
          ) : (
            <div className="checklist-stages">
            {stages.map(stage => {
              const stageItems = getStageItems(stage.stage_name);
              if (stageItems.length === 0) return null;
              const isExpanded = !!expandedStages[stage.id];
              const completion = getStageCompletion(stage.stage_name);
              return (
                <div key={stage.id} className={`checklist-stage`}>
                  <div className="checklist-stage-header" onClick={() => setExpandedStages(prev => ({ ...prev, [stage.id]: !isExpanded }))}>
                    <div className="stage-header-left">
                      <div className="stage-indicator" style={{ backgroundColor: stage.stage_color || '#00558c' }}></div>
                      <h4>{stage.stage_name}</h4>
                    </div>
                    <div className="stage-header-right">
                      <div className="stage-progress-bar">
                        <div className="stage-progress-fill" style={{ width: `${completion.percentage}%` }} />
                      </div>
                      <div className="stage-completion">{completion.completed}/{completion.total}</div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="checklist-items">
                      {stageItems.map(item => {
                        const isCompleted = !!progressByItemId.get(item.id)?.completed;
                        const itemAttachments = getItemAttachments(item.id);
                        const requiresProof = needsProof(item);
                        const disabled = isSystemControlled(item.item_name) || (requiresProof && itemAttachments.length === 0);
                        return (
                          <div key={item.id} className={`checklist-item ${isCompleted ? 'completed' : ''}`}>
                            <div className="checklist-item-main">
                              <div className="checklist-item-info">
                                <div 
                                  className={`checklist-checkbox ${isCompleted ? 'checked' : ''} ${disabled ? 'disabled' : ''}`} 
                                  onClick={() => !disabled && handleToggle(item)} 
                                  role="button"
                                  style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                                />
                                <div className="checklist-item-text">
                                  <label 
                                    onClick={() => !disabled && handleToggle(item)}
                                    style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                                  >
                                    {item.item_name}
                                  </label>
                                  {item.item_description && (
                                    <p className="item-description">{item.item_description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {requiresProof && (
                              <div className="checklist-item-attachments">
                                <input
                                  ref={el => fileInputRefs.current[item.id] = el}
                                  type="file"
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleFileSelect(item, e)}
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                                />
                                <div className="attachments-header">
                                  <span>Attachments ({itemAttachments.length})</span>
                                  <button onClick={() => triggerFileInput(item.id)} disabled={!!uploadingItems[item.id]} className="upload-btn">
                                    {uploadingItems[item.id] ? 'Uploading...' : 'Upload Proof'}
                                  </button>
                                </div>
                                {itemAttachments.length > 0 && (
                                  <div className="attachments-list">
                                    {itemAttachments.map(att => (
                                      <div key={att.id} className="attachment-item">
                                        <div className="attachment-info clickable" onClick={() => window.open(`/api/pipeline-attachments/download/${att.id}`, '_blank')}>
                                          <span className="attachment-name">{att.file_name || att.file_path}</span>
                                          <span className="attachment-size">{(att.file_size / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <div className="attachment-actions">
                                          <a className="attachment-action-btn" href={`/api/pipeline-attachments/download/${att.id}`} target="_blank" rel="noreferrer">↗</a>
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
        </div>
      </div>
    </div>
  );
};

export default OnboardingHome;


