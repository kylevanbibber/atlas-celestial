import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../api';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import './PipelineSettings.css';

const PipelineSettings = () => {
  const { user } = useAuth();
  const [stages, setStages] = useState([]);
  const [orderedStages, setOrderedStages] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState(null);
  const [expandedStage, setExpandedStage] = useState(null);
  const [editingStage, setEditingStage] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [newItemForm, setNewItemForm] = useState(null);
  const [newStageForm, setNewStageForm] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Build ordered stages from before/after relationships
  const buildStageOrder = (stageList) => {
    // Filter out terminal stages (they're not in the main pipeline flow)
    const pipelineStages = stageList.filter(s => !s.is_terminal);
    
    // Find the starting stage (position_after is NULL)
    let currentStage = pipelineStages.find(s => s.position_after === null);
    
    if (!currentStage) {
      console.warn('[Pipeline Settings] No starting stage found');
      return pipelineStages;
    }
    
    const ordered = [];
    const visited = new Set();
    
    // Follow the chain
    while (currentStage && !visited.has(currentStage.stage_name)) {
      ordered.push(currentStage);
      visited.add(currentStage.stage_name);
      
      // Find next stage (where position_after === current stage_name)
      currentStage = pipelineStages.find(s => 
        s.position_after === currentStage.stage_name && 
        !visited.has(s.stage_name)
      );
    }
    
    // Add any stages not in the chain (shouldn't happen, but safety check)
    pipelineStages.forEach(stage => {
      if (!visited.has(stage.stage_name)) {
        console.warn(`[Pipeline Settings] Stage "${stage.stage_name}" not in chain, appending to end`);
        ordered.push(stage);
      }
    });
    
    return ordered;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch stages
      const stagesResponse = await api.get('/recruitment/stages');
      if (stagesResponse.data.success) {
        const allStages = stagesResponse.data.data;
        setStages(allStages);
        setOrderedStages(buildStageOrder(allStages));
        if (!selectedStage && allStages.length > 0) {
          setSelectedStage(allStages[0].stage_name);
        }
      }
      
      // Fetch all checklist items
      const itemsResponse = await api.get('/recruitment/checklist');
      if (itemsResponse.data.success) {
        setChecklistItems(itemsResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get items for selected stage
  const getStageItems = (stageName) => {
    return checklistItems
      .filter(item => item.stage_name === stageName)
      .sort((a, b) => a.item_order - b.item_order);
  };

  // Handle creating new checklist item
  const handleAddItem = (stageName) => {
    setNewItemForm({
      stage_name: stageName,
      item_name: '',
      item_description: '',
      item_order: getStageItems(stageName).length + 1,
      is_required: false,
      item_type: 'checkbox'
    });
  };

  // Save new checklist item
  const handleSaveNewItem = async () => {
    try {
      const response = await api.post('/recruitment/checklist', {
        ...newItemForm,
        created_by: user.userId
      });
      
      if (response.data.success) {
        fetchData();
        setNewItemForm(null);
      }
    } catch (error) {
      console.error('Error creating checklist item:', error);
    }
  };

  // Handle updating checklist item
  const handleUpdateItem = async (itemId, updates) => {
    try {
      await api.put(`/recruitment/checklist/${itemId}`, updates);
      fetchData();
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating checklist item:', error);
    }
  };

  // Handle deleting checklist item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this checklist item?')) {
      return;
    }
    
    try {
      await api.delete(`/recruitment/checklist/${itemId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting checklist item:', error);
    }
  };

  // Toggle stage expansion
  const toggleStageExpansion = (stageName) => {
    setExpandedStage(expandedStage === stageName ? null : stageName);
  };

  // Handle creating new custom stage
  const handleAddStage = () => {
    setNewStageForm({
      stage_name: '',
      stage_color: '#3498db',
      stage_description: '',
      position_after: orderedStages.length > 0 ? orderedStages[orderedStages.length - 1].stage_name : null,
      position_before: null,
      is_default: false
    });
  };

  // Save new custom stage
  const handleSaveNewStage = async () => {
    if (!newStageForm.stage_name) {
      alert('Please enter a stage name');
      return;
    }

    try {
      const response = await api.post('/recruitment/stages', {
        ...newStageForm,
        created_by: user.userId,
        team_id: user.userId // Team-specific stage
      });
      
      if (response.data.success) {
        fetchData();
        setNewStageForm(null);
      }
    } catch (error) {
      console.error('Error creating stage:', error);
      alert('Error creating stage. Please try again.');
    }
  };

  // Handle deleting custom stage
  const handleDeleteStage = async (stageId, isDefault) => {
    if (isDefault) {
      alert('Cannot delete default stages');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this stage? All checklist items for this stage will also be removed.')) {
      return;
    }
    
    try {
      await api.delete(`/recruitment/stages/${stageId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting stage:', error);
      alert('Error deleting stage. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="pipeline-settings-loading">
        <div className="pipeline-loading-spinner"></div>
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="pipeline-settings-container">
      <div className="settings-header">
        <h2>Pipeline Configuration</h2>
        <p>Configure pipeline stages and checklist items for your team</p>
      </div>

      <div className="settings-content">
        {/* Stages List */}
        <div className="settings-stages-section">
          <div className="stages-section-header">
            <div>
              <h3>Pipeline Stages</h3>
              <p className="settings-note">
                Default stages are locked and cannot be deleted. You can add custom stages between any existing stages.
              </p>
            </div>
            <button
              onClick={handleAddStage}
              className="pipeline-btn pipeline-btn-primary"
            >
              <FiPlus /> Add Custom Stage
            </button>
          </div>
          
          {/* New Stage Form */}
          {newStageForm && (
            <div className="new-stage-form">
              <h4>Add Custom Stage</h4>
              <div className="form-group">
                <label>Stage Name *</label>
                <input
                  type="text"
                  value={newStageForm.stage_name}
                  onChange={(e) => setNewStageForm({ ...newStageForm, stage_name: e.target.value })}
                  className="form-input"
                  placeholder="Enter stage name..."
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newStageForm.stage_description}
                  onChange={(e) => setNewStageForm({ ...newStageForm, stage_description: e.target.value })}
                  className="form-textarea"
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Stage Color</label>
                  <input
                    type="color"
                    value={newStageForm.stage_color}
                    onChange={(e) => setNewStageForm({ ...newStageForm, stage_color: e.target.value })}
                    className="form-color-input"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Position After</label>
                  <select
                    value={newStageForm.position_after || ''}
                    onChange={(e) => {
                      const selectedAfter = e.target.value || null;
                      // Find what comes after the selected stage
                      const afterIndex = orderedStages.findIndex(s => s.stage_name === selectedAfter);
                      const before = afterIndex >= 0 && afterIndex < orderedStages.length - 1 
                        ? orderedStages[afterIndex + 1].stage_name 
                        : null;
                      setNewStageForm({ 
                        ...newStageForm, 
                        position_after: selectedAfter,
                        position_before: before
                      });
                    }}
                    className="form-select"
                  >
                    <option value="">-- Start of Pipeline --</option>
                    {orderedStages.map(stage => (
                      <option key={stage.id} value={stage.stage_name}>
                        {stage.stage_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Position Before</label>
                  <select
                    value={newStageForm.position_before || ''}
                    onChange={(e) => {
                      const selectedBefore = e.target.value || null;
                      // Find what comes before the selected stage
                      const beforeIndex = orderedStages.findIndex(s => s.stage_name === selectedBefore);
                      const after = beforeIndex > 0 
                        ? orderedStages[beforeIndex - 1].stage_name 
                        : null;
                      setNewStageForm({ 
                        ...newStageForm, 
                        position_before: selectedBefore,
                        position_after: after
                      });
                    }}
                    className="form-select"
                  >
                    <option value="">-- End of Pipeline --</option>
                    {orderedStages.map(stage => (
                      <option key={stage.id} value={stage.stage_name}>
                        {stage.stage_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-actions">
                <button
                  onClick={handleSaveNewStage}
                  className="pipeline-btn pipeline-btn-primary"
                  disabled={!newStageForm.stage_name}
                >
                  <FiSave /> Save Stage
                </button>
                <button
                  onClick={() => setNewStageForm(null)}
                  className="pipeline-btn"
                >
                  <FiX /> Cancel
                </button>
              </div>
            </div>
          )}
          
          <div className="stages-list">
            {orderedStages.map(stage => (
                <div key={stage.id} className="stage-config-item">
                  <div 
                    className="stage-config-header"
                    onClick={() => toggleStageExpansion(stage.stage_name)}
                  >
                    <div className="stage-config-info">
                      {expandedStage === stage.stage_name ? <FiChevronDown /> : <FiChevronRight />}
                      <div 
                        className="stage-color-indicator"
                        style={{ backgroundColor: stage.stage_color }}
                      />
                      <span className="stage-name">{stage.stage_name}</span>
                      {stage.is_default && (
                        <span className="default-badge">Default</span>
                      )}
                    </div>
                    
                    <div className="stage-config-actions">
                      <span className="items-count">
                        {getStageItems(stage.stage_name).length} items
                      </span>
                      {!stage.is_default && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStage(stage.id, stage.is_default);
                          }}
                          className="icon-btn delete"
                          title="Delete custom stage"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {expandedStage === stage.stage_name && (
                    <div className="stage-config-body">
                      {/* Stage Description */}
                      {stage.stage_description && (
                        <p className="stage-description">{stage.stage_description}</p>
                      )}
                      
                      {/* Checklist Items */}
                      <div className="stage-checklist-items">
                        <div className="checklist-items-header">
                          <h4>Checklist Items</h4>
                          <button
                            onClick={() => handleAddItem(stage.stage_name)}
                            className="pipeline-btn pipeline-btn-primary"
                          >
                            <FiPlus /> Add Item
                          </button>
                        </div>
                        
                        {getStageItems(stage.stage_name).length === 0 ? (
                          <div className="no-items">
                            <p>No checklist items for this stage yet.</p>
                            <button
                              onClick={() => handleAddItem(stage.stage_name)}
                              className="pipeline-btn"
                            >
                              Add First Item
                            </button>
                          </div>
                        ) : (
                          <div className="checklist-items-list">
                            {getStageItems(stage.stage_name).map(item => (
                              <div key={item.id} className="checklist-config-item">
                                {editingItem === item.id ? (
                                  <div className="item-edit-form">
                                    <input
                                      type="text"
                                      value={item.item_name}
                                      onChange={(e) => {
                                        setChecklistItems(prev => 
                                          prev.map(i => 
                                            i.id === item.id 
                                              ? { ...i, item_name: e.target.value }
                                              : i
                                          )
                                        );
                                      }}
                                      className="form-input"
                                      placeholder="Item name"
                                    />
                                    <div className="item-edit-actions">
                                      <button
                                        onClick={() => handleUpdateItem(item.id, {
                                          item_name: item.item_name
                                        })}
                                        className="pipeline-btn pipeline-btn-primary"
                                      >
                                        <FiSave /> Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingItem(null);
                                          fetchData();
                                        }}
                                        className="pipeline-btn"
                                      >
                                        <FiX /> Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="item-info">
                                      <span className="item-name">
                                        {item.item_name}
                                        {item.is_required && <span className="required-star">*</span>}
                                      </span>
                                      <span className="item-type-badge">{item.item_type}</span>
                                    </div>
                                    <div className="item-actions">
                                      <button
                                        onClick={() => setEditingItem(item.id)}
                                        className="icon-btn"
                                        title="Edit"
                                      >
                                        <FiEdit2 />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="icon-btn delete"
                                        title="Delete"
                                      >
                                        <FiTrash2 />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* New Item Form */}
                        {newItemForm && newItemForm.stage_name === stage.stage_name && (
                          <div className="new-item-form">
                            <h5>Add New Checklist Item</h5>
                            <div className="form-group">
                              <label>Item Name *</label>
                              <input
                                type="text"
                                value={newItemForm.item_name}
                                onChange={(e) => setNewItemForm({ ...newItemForm, item_name: e.target.value })}
                                className="form-input"
                                placeholder="Enter item name..."
                              />
                            </div>
                            
                            <div className="form-group">
                              <label>Description</label>
                              <textarea
                                value={newItemForm.item_description}
                                onChange={(e) => setNewItemForm({ ...newItemForm, item_description: e.target.value })}
                                className="form-textarea"
                                placeholder="Optional description..."
                                rows={2}
                              />
                            </div>
                            
                            <div className="form-row">
                              <div className="form-group">
                                <label>Type</label>
                                <select
                                  value={newItemForm.item_type}
                                  onChange={(e) => setNewItemForm({ ...newItemForm, item_type: e.target.value })}
                                  className="form-select"
                                >
                                  <option value="checkbox">Checkbox</option>
                                  <option value="text">Text</option>
                                  <option value="date">Date</option>
                                  <option value="number">Number</option>
                                  <option value="select">Select</option>
                                  <option value="textarea">Textarea</option>
                                </select>
                              </div>
                              
                              <div className="form-group">
                                <label className="checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={newItemForm.is_required}
                                    onChange={(e) => setNewItemForm({ ...newItemForm, is_required: e.target.checked })}
                                  />
                                  Required
                                </label>
                              </div>
                            </div>
                            
                            <div className="form-actions">
                              <button
                                onClick={handleSaveNewItem}
                                className="pipeline-btn pipeline-btn-primary"
                                disabled={!newItemForm.item_name}
                              >
                                <FiSave /> Save Item
                              </button>
                              <button
                                onClick={() => setNewItemForm(null)}
                                className="pipeline-btn"
                              >
                                <FiX /> Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineSettings;

