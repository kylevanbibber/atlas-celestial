import React, { useState, useEffect, useCallback } from 'react';
import { FiChevronRight, FiEdit3, FiTrash2, FiPlus, FiSave, FiX, FiClipboard } from 'react-icons/fi';
import api from '../../api';
import { US_STATES } from '../../constants/usStates';
import './ChecklistEditor.css';

const ITEM_TYPES = ['checkbox', 'text', 'date', 'number', 'select', 'textarea', 'url'];
const ACTIONS = ['modify', 'remove', 'not_required', 'add'];

const ChecklistEditor = () => {
  const [stages, setStages] = useState([]);
  const [items, setItems] = useState({});
  const [stateReqs, setStateReqs] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedStages, setExpandedStages] = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  // Editing state
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addingToStage, setAddingToStage] = useState(null);
  const [addForm, setAddForm] = useState({});

  // Variant editing state
  const [editingReqId, setEditingReqId] = useState(null);
  const [reqForm, setReqForm] = useState({});
  const [addingVariantTo, setAddingVariantTo] = useState(null);
  const [variantForm, setVariantForm] = useState({});

  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [stagesRes, itemsRes, reqsRes] = await Promise.all([
        api.get('/recruitment/stages'),
        api.get('/recruitment/checklist'),
        api.get('/recruitment/state-requirements')
      ]);

      const stageList = stagesRes.data.success ? stagesRes.data.data : [];
      setStages(stageList.filter(s => s.active !== 0));

      const itemList = itemsRes.data.success ? itemsRes.data.data : [];
      const grouped = {};
      itemList.forEach(item => {
        if (!grouped[item.stage_name]) grouped[item.stage_name] = [];
        grouped[item.stage_name].push(item);
      });
      Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => a.item_order - b.item_order));
      setItems(grouped);

      const reqList = reqsRes.data.success ? reqsRes.data.data : [];
      const reqGrouped = {};
      reqList.forEach(r => {
        const key = `${r.stage_name}::${r.target_item_name || r.item_name}`;
        if (!reqGrouped[key]) reqGrouped[key] = [];
        reqGrouped[key].push(r);
      });
      setStateReqs(reqGrouped);
    } catch (err) {
      console.error('Error loading checklist data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStage = (id) => setExpandedStages(p => ({ ...p, [id]: !p[id] }));
  const toggleItem = (id) => setExpandedItems(p => ({ ...p, [id]: !p[id] }));

  // ---- Item CRUD ----
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditForm({
      item_name: item.item_name || '',
      item_description: item.item_description || '',
      instructions: item.instructions || '',
      item_order: item.item_order || 0,
      is_required: item.is_required ? 1 : 0,
      item_type: item.item_type || 'checkbox'
    });
    setAddingToStage(null);
  };

  const cancelEdit = () => { setEditingItemId(null); setEditForm({}); };

  const saveItem = async () => {
    if (!editForm.item_name?.trim()) return;
    setSaving(true);
    try {
      await api.put(`/recruitment/checklist/${editingItemId}`, editForm);
      cancelEdit();
      await fetchData();
    } catch (err) {
      console.error('Error saving item:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this checklist item?')) return;
    try {
      await api.delete(`/recruitment/checklist/${id}`);
      await fetchData();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const startAddItem = (stageName) => {
    const stageItems = items[stageName] || [];
    const maxOrder = stageItems.reduce((m, i) => Math.max(m, i.item_order || 0), 0);
    setAddingToStage(stageName);
    setAddForm({
      stage_name: stageName,
      item_name: '',
      item_description: '',
      instructions: '',
      item_order: maxOrder + 1,
      is_required: 1,
      item_type: 'checkbox'
    });
    setEditingItemId(null);
  };

  const cancelAdd = () => { setAddingToStage(null); setAddForm({}); };

  const saveNewItem = async () => {
    if (!addForm.item_name?.trim()) return;
    setSaving(true);
    try {
      await api.post('/recruitment/checklist', addForm);
      cancelAdd();
      await fetchData();
    } catch (err) {
      console.error('Error creating item:', err);
    } finally {
      setSaving(false);
    }
  };

  // ---- State Requirement CRUD ----
  const getVariantsForItem = (stageName, itemName) => {
    return stateReqs[`${stageName}::${itemName}`] || [];
  };

  const startEditVariant = (req) => {
    setEditingReqId(req.id);
    setReqForm({
      state: req.state || '',
      action: req.action || 'modify',
      instructions: req.instructions || '',
      override_description: req.override_description || '',
      override_required: req.override_required !== null ? req.override_required : '',
      url: req.url || ''
    });
    setAddingVariantTo(null);
  };

  const cancelEditVariant = () => { setEditingReqId(null); setReqForm({}); };

  const saveVariant = async () => {
    if (!reqForm.state) return;
    setSaving(true);
    try {
      await api.put(`/recruitment/state-requirements/${editingReqId}`, reqForm);
      cancelEditVariant();
      await fetchData();
    } catch (err) {
      console.error('Error saving variant:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteVariant = async (id) => {
    if (!window.confirm('Delete this state variant?')) return;
    try {
      await api.delete(`/recruitment/state-requirements/${id}`);
      await fetchData();
    } catch (err) {
      console.error('Error deleting variant:', err);
    }
  };

  const startAddVariant = (stageName, itemName) => {
    setAddingVariantTo(`${stageName}::${itemName}`);
    setVariantForm({
      state: '',
      stage_name: stageName,
      target_item_name: itemName,
      action: 'modify',
      instructions: '',
      override_description: '',
      override_required: '',
      url: ''
    });
    setEditingReqId(null);
  };

  const cancelAddVariant = () => { setAddingVariantTo(null); setVariantForm({}); };

  const saveNewVariant = async () => {
    if (!variantForm.state || !variantForm.action) return;
    setSaving(true);
    try {
      await api.post('/recruitment/state-requirements', variantForm);
      cancelAddVariant();
      await fetchData();
    } catch (err) {
      console.error('Error creating variant:', err);
    } finally {
      setSaving(false);
    }
  };

  // ---- Render helpers ----
  const renderItemForm = (form, setForm, onSave, onCancel, isNew) => (
    <div className={isNew ? "ce-edit-form" : "ce-edit-form"}>
      <div className="ce-form-grid">
        <div className="ce-form-group">
          <label>Item Name</label>
          <input value={form.item_name || ''} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} placeholder="e.g. Background Check" />
        </div>
        <div className="ce-form-group" style={{ display: 'flex', flexDirection: 'row', gap: 14, alignItems: 'flex-end' }}>
          <div className="ce-form-group" style={{ flex: 1 }}>
            <label>Type</label>
            <select value={form.item_type || 'checkbox'} onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}>
              {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="ce-form-group" style={{ flex: 1 }}>
            <label>Order</label>
            <input type="number" value={form.item_order ?? ''} onChange={e => setForm(p => ({ ...p, item_order: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="ce-form-group" style={{ flex: 1 }}>
            <label>Required</label>
            <select value={form.is_required ?? 1} onChange={e => setForm(p => ({ ...p, is_required: parseInt(e.target.value) }))}>
              <option value={1}>Yes</option>
              <option value={0}>No</option>
            </select>
          </div>
        </div>
        <div className="ce-form-group full-width">
          <label>Description</label>
          <textarea value={form.item_description || ''} onChange={e => setForm(p => ({ ...p, item_description: e.target.value }))} placeholder="Shown to recruits as item description..." rows={2} />
        </div>
        <div className="ce-form-group full-width">
          <label>Instructions</label>
          <textarea value={form.instructions || ''} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} placeholder="Detailed step-by-step instructions for recruits..." rows={3} />
        </div>
      </div>
      <div className="ce-form-actions">
        <button className="btn-cancel" onClick={onCancel} disabled={saving}><FiX size={13} /> Cancel</button>
        <button className="btn-save" onClick={onSave} disabled={saving}><FiSave size={13} /> {saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );

  const renderVariantForm = (form, setForm, onSave, onCancel) => (
    <div className="ce-variant-form">
      <div className="ce-form-grid">
        <div className="ce-form-group">
          <label>State</label>
          <select value={form.state || ''} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}>
            <option value="">Select...</option>
            {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
          </select>
        </div>
        <div className="ce-form-group">
          <label>Action</label>
          <select value={form.action || 'modify'} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="ce-form-group">
          <label>URL</label>
          <input value={form.url || ''} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
        </div>
      </div>
      {(form.action === 'modify' || form.action === 'add') && (
        <div className="ce-form-grid" style={{ marginTop: 10 }}>
          <div className="ce-form-group full-width">
            <label>State-Specific Instructions</label>
            <textarea value={form.instructions || ''} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} placeholder="Instructions specific to this state..." rows={2} />
          </div>
          <div className="ce-form-group full-width">
            <label>Override Description</label>
            <textarea value={form.override_description || ''} onChange={e => setForm(p => ({ ...p, override_description: e.target.value }))} placeholder="Replace item description for this state..." rows={2} />
          </div>
        </div>
      )}
      <div className="ce-form-actions">
        <button className="btn-cancel" onClick={onCancel} disabled={saving}><FiX size={13} /> Cancel</button>
        <button className="btn-save" onClick={onSave} disabled={saving}><FiSave size={13} /> {saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="checklist-editor"><div className="ce-loading">Loading checklist data...</div></div>;
  }

  return (
    <div className="checklist-editor">
      <div className="page-header">
        <FiClipboard size={24} color="#00558c" />
        <div>
          <h2>Checklist Editor</h2>
          <p>Manage onboarding steps, instructions & state-specific variants</p>
        </div>
      </div>

      {stages.map(stage => {
        const stageItems = items[stage.stage_name] || [];
        const isExpanded = expandedStages[stage.id];

        return (
          <div className="ce-stage" key={stage.id}>
            <div className="ce-stage-header" onClick={() => toggleStage(stage.id)}>
              <div className="stage-color-dot" style={{ background: stage.stage_color || '#888' }} />
              <h3>{stage.stage_name}</h3>
              <span className="stage-count">{stageItems.length} items</span>
              <FiChevronRight size={16} className={`chevron ${isExpanded ? 'open' : ''}`} />
            </div>

            {isExpanded && (
              <div className="ce-items">
                {stageItems.map(item => {
                  const isItemExpanded = expandedItems[item.id];
                  const isEditing = editingItemId === item.id;
                  const variants = getVariantsForItem(stage.stage_name, item.item_name);
                  const variantKey = `${stage.stage_name}::${item.item_name}`;

                  return (
                    <div className="ce-item" key={item.id}>
                      <div className="ce-item-header" onClick={() => toggleItem(item.id)}>
                        <span className="item-order">{item.item_order}</span>
                        <span className="item-name">{item.item_name}</span>
                        <div className="item-badges">
                          <span className="item-badge type">{item.item_type || 'checkbox'}</span>
                          <span className={`item-badge ${item.is_required ? 'required' : 'optional'}`}>
                            {item.is_required ? 'Required' : 'Optional'}
                          </span>
                          {variants.length > 0 && (
                            <span className="item-badge variants">{variants.length} state variant{variants.length > 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <div className="ce-item-actions" onClick={e => e.stopPropagation()}>
                          <button onClick={() => startEditItem(item)} title="Edit"><FiEdit3 size={14} /></button>
                          <button className="delete" onClick={() => deleteItem(item.id)} title="Delete"><FiTrash2 size={14} /></button>
                        </div>
                      </div>

                      {isEditing && renderItemForm(editForm, setEditForm, saveItem, cancelEdit, false)}

                      {isItemExpanded && !isEditing && (
                        <div className="ce-item-details">
                          <div className="ce-detail-row">
                            <span className="label">Description</span>
                            <span className={`value ${!item.item_description ? 'empty' : ''}`}>
                              {item.item_description || '(none)'}
                            </span>
                          </div>
                          <div className="ce-detail-row">
                            <span className="label">Instructions</span>
                            <span className={`value ${!item.instructions ? 'empty' : ''}`}>
                              {item.instructions || '(none)'}
                            </span>
                          </div>

                          <div className="ce-variants">
                            <div className="ce-variants-header">
                              <h4>State Variants ({variants.length})</h4>
                              <button className="ce-add-btn" onClick={() => startAddVariant(stage.stage_name, item.item_name)}>
                                <FiPlus size={12} /> Add Variant
                              </button>
                            </div>

                            {addingVariantTo === variantKey && renderVariantForm(variantForm, setVariantForm, saveNewVariant, cancelAddVariant)}

                            {variants.length === 0 && addingVariantTo !== variantKey && (
                              <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic', padding: '4px 0' }}>
                                No state-specific variants
                              </div>
                            )}

                            {variants.map(req => (
                              editingReqId === req.id ? (
                                <div key={req.id}>
                                  {renderVariantForm(reqForm, setReqForm, saveVariant, cancelEditVariant)}
                                </div>
                              ) : (
                                <div className="ce-variant-row" key={req.id}>
                                  <span className="variant-state">{req.state}</span>
                                  <span className="variant-action">{req.action}</span>
                                  <span className="variant-detail">
                                    {req.instructions && <span>{req.instructions.substring(0, 80)}{req.instructions.length > 80 ? '...' : ''}</span>}
                                    {!req.instructions && req.override_description && <span>{req.override_description.substring(0, 80)}...</span>}
                                    {!req.instructions && !req.override_description && <span style={{ color: '#aaa', fontStyle: 'italic' }}>No details</span>}
                                  </span>
                                  <div className="variant-actions">
                                    <button onClick={() => startEditVariant(req)} title="Edit"><FiEdit3 size={12} /></button>
                                    <button onClick={() => deleteVariant(req.id)} title="Delete"><FiTrash2 size={12} /></button>
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {addingToStage === stage.stage_name ? (
                  renderItemForm(addForm, setAddForm, saveNewItem, cancelAdd, true)
                ) : (
                  <div className="ce-add-item-row">
                    <button className="ce-add-btn" onClick={() => startAddItem(stage.stage_name)}>
                      <FiPlus size={12} /> Add Item
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChecklistEditor;
