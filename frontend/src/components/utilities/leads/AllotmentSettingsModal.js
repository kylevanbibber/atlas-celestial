import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import api from '../../../api';
import { toast } from 'react-hot-toast';
import CustomGroupModal from './CustomGroupModal';
import './AllotmentSettingsModal.css';

const AllotmentSettingsModal = ({ isOpen, onClose, onSave, targetMonth }) => {
  const { user } = useContext(AuthContext);
  
  // Form state
  const [refMonths, setRefMonths] = useState([]);
  const [alpMonths, setAlpMonths] = useState([]);
  const [groupRefRequirements, setGroupRefRequirements] = useState({
    1: 6,
    2: 5,
    3: 4,
    4: 3,
    5: 2
  });
  const [vipEnabled, setVipEnabled] = useState(true);
  const [vipAlpValue, setVipAlpValue] = useState(5000);
  const [vipMonths, setVipMonths] = useState([]);
  const [customGroupsEnabled, setCustomGroupsEnabled] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingSettingsId, setExistingSettingsId] = useState(null);
  
  // Custom groups state
  const [customGroups, setCustomGroups] = useState([]);
  const [showCustomGroupModal, setShowCustomGroupModal] = useState(false);
  const [editingCustomGroup, setEditingCustomGroup] = useState(null);

  // Helper to get prev-prev month as default
  const getDefaultSourceMonth = () => {
    if (!targetMonth) return '';
    
    const [year, month] = targetMonth.split('-').map(Number);
    const targetDate = new Date(year, month - 1, 1);
    
    // Go back 2 months for default (prev-prev month)
    const sourceDate = new Date(targetDate);
    sourceDate.setMonth(sourceDate.getMonth() - 2);
    
    return `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, '0')}`;
  };

  // Fetch existing settings when modal opens
  useEffect(() => {
    if (isOpen && targetMonth) {
      fetchSettings();
      fetchCustomGroups();
    }
  }, [isOpen, targetMonth]);

  const fetchSettings = async () => {
    try {
      const response = await api.get(`/pnp/allotment-settings?targetMonth=${targetMonth}`);
      
      if (response.data.success && response.data.settings) {
        const settings = response.data.settings;
        setExistingSettingsId(settings.id);
        setRefMonths(JSON.parse(settings.ref_months || '[]'));
        setAlpMonths(JSON.parse(settings.alp_months || '[]'));
        setGroupRefRequirements(JSON.parse(settings.group_ref_requirements || '{}'));
        setVipEnabled(settings.vip_enabled === 1 || settings.vip_enabled === true);
        setVipAlpValue(settings.vip_alp_value || 5000);
        setVipMonths(JSON.parse(settings.vip_months || '[]'));
        setCustomGroupsEnabled(settings.custom_groups_enabled === 1 || settings.custom_groups_enabled === true);
        setNotes(settings.notes || '');
      } else {
        // No settings exist, set defaults
        const defaultMonth = getDefaultSourceMonth();
        setRefMonths([defaultMonth]);
        setAlpMonths([defaultMonth]);
        setVipMonths([defaultMonth]);
        setGroupRefRequirements({ 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 });
        setVipEnabled(true);
        setVipAlpValue(5000);
        setCustomGroupsEnabled(true);
        setNotes('');
        setExistingSettingsId(null);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const fetchCustomGroups = async () => {
    try {
      const response = await api.get('/pnp/custom-groups');
      if (response.data.success) {
        // Filter to only show groups for this target month
        const filteredGroups = response.data.groups.filter(
          g => g.target_month === targetMonth
        );
        setCustomGroups(filteredGroups);
      }
    } catch (error) {
      console.error('Error fetching custom groups:', error);
    }
  };

  const handleDeleteCustomGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this custom group?')) {
      return;
    }

    try {
      await api.delete(`/pnp/custom-groups/${groupId}`);
      toast.success('Custom group deleted');
      fetchCustomGroups();
    } catch (error) {
      console.error('Error deleting custom group:', error);
      toast.error('Failed to delete custom group');
    }
  };

  const handleSave = async () => {
    if (refMonths.length === 0 || alpMonths.length === 0) {
      toast.error('Please select at least one month for refs and ALP calculations');
      return;
    }

    setLoading(true);
    try {
      await api.post('/pnp/allotment-settings', {
        targetMonth,
        refMonths,
        alpMonths,
        groupRefRequirements,
        vipEnabled,
        vipAlpValue,
        vipMonths: vipMonths.length > 0 ? vipMonths : alpMonths,
        customGroupsEnabled,
        notes
      });

      toast.success('Allotment settings saved successfully');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRefMonth = () => {
    const newMonth = window.prompt('Enter month to add (YYYY-MM format):');
    if (newMonth && /^\d{4}-\d{2}$/.test(newMonth)) {
      if (!refMonths.includes(newMonth)) {
        setRefMonths([...refMonths, newMonth].sort());
      }
    } else if (newMonth) {
      toast.error('Invalid format. Use YYYY-MM (e.g., 2025-10)');
    }
  };

  const handleAddAlpMonth = () => {
    const newMonth = window.prompt('Enter month to add (YYYY-MM format):');
    if (newMonth && /^\d{4}-\d{2}$/.test(newMonth)) {
      if (!alpMonths.includes(newMonth)) {
        setAlpMonths([...alpMonths, newMonth].sort());
      }
    } else if (newMonth) {
      toast.error('Invalid format. Use YYYY-MM (e.g., 2025-10)');
    }
  };

  const handleRemoveRefMonth = (monthToRemove) => {
    setRefMonths(refMonths.filter(m => m !== monthToRemove));
  };

  const handleRemoveAlpMonth = (monthToRemove) => {
    setAlpMonths(alpMonths.filter(m => m !== monthToRemove));
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset to default settings? This will use the prev-prev month for all calculations.')) {
      const defaultMonth = getDefaultSourceMonth();
      setRefMonths([defaultMonth]);
      setAlpMonths([defaultMonth]);
      setVipMonths([defaultMonth]);
      setGroupRefRequirements({ 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 });
      setVipEnabled(true);
      setVipAlpValue(5000);
      setCustomGroupsEnabled(true);
      setNotes('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="allotment-settings-modal-overlay" onClick={onClose}>
      <div className="allotment-settings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="allotment-settings-modal-header">
          <h2>⚙️ Allotment Settings Builder</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="allotment-settings-modal-body">
          {/* Target Month Display */}
          <div className="settings-section">
            <h3>Target Allotment Month</h3>
            <div className="target-month-display">
              <span className="month-badge">{targetMonth}</span>
              <span className="help-text">
                Configure calculation rules for the {targetMonth} allotment
              </span>
            </div>
          </div>

          {/* Referral Source Months */}
          <div className="settings-section">
            <h3>Referral Counting Months</h3>
            <p className="section-description">
              Which months should be used for counting referrals?
            </p>
            <div className="month-list">
              {refMonths.map(month => (
                <span key={month} className="month-chip">
                  {month}
                  <button onClick={() => handleRemoveRefMonth(month)}>✕</button>
                </span>
              ))}
              <button className="add-month-btn" onClick={handleAddRefMonth}>
                + Add Month
              </button>
            </div>
          </div>

          {/* ALP Source Months */}
          <div className="settings-section">
            <h3>ALP Calculation Months</h3>
            <p className="section-description">
              Which months should be used for ALP calculation?
            </p>
            <div className="month-list">
              {alpMonths.map(month => (
                <span key={month} className="month-chip">
                  {month}
                  <button onClick={() => handleRemoveAlpMonth(month)}>✕</button>
                </span>
              ))}
              <button className="add-month-btn" onClick={handleAddAlpMonth}>
                + Add Month
              </button>
            </div>
          </div>

          {/* Group Ref Requirements */}
          <div className="settings-section">
            <h3>Group Referral Requirements</h3>
            <div className="group-refs-grid">
              {[1, 2, 3, 4, 5].map(group => (
                <div key={group} className="group-ref-item">
                  <label>Group {group}:</label>
                  <input
                    type="number"
                    min="0"
                    value={groupRefRequirements[group] || 0}
                    onChange={(e) => setGroupRefRequirements({
                      ...groupRefRequirements,
                      [group]: parseInt(e.target.value) || 0
                    })}
                  />
                  <span className="refs-label">refs</span>
                </div>
              ))}
            </div>
          </div>

          {/* VIP Settings */}
          <div className="settings-section">
            <h3>VIP Configuration</h3>
            <div className="vip-settings">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={vipEnabled}
                  onChange={(e) => setVipEnabled(e.target.checked)}
                />
                <span>Enable VIP ALP Crediting</span>
              </label>

              {vipEnabled && (
                <>
                  <div className="vip-value-input">
                    <label>ALP Value per VIP:</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={vipAlpValue}
                      onChange={(e) => setVipAlpValue(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <p className="section-description">
                    VIP months will use the same months as ALP calculation
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Custom Groups */}
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Custom Groups ({customGroups.length})</h3>
              <button
                className="add-custom-group-btn"
                onClick={() => {
                  setEditingCustomGroup(null);
                  setShowCustomGroupModal(true);
                }}
              >
                + New Custom Group
              </button>
            </div>
            
            <label className="checkbox-label" style={{ marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={customGroupsEnabled}
                onChange={(e) => setCustomGroupsEnabled(e.target.checked)}
              />
              <span>Allow Custom Groups for this month</span>
            </label>

            {customGroupsEnabled && customGroups.length > 0 && (
              <div className="custom-groups-list">
                {customGroups.map(group => (
                  <div key={group.id} className="custom-group-card">
                    <div className="custom-group-header">
                      <div 
                        className="group-color-badge" 
                        style={{ backgroundColor: group.group_color }}
                      />
                      <div className="custom-group-info">
                        <h4>{group.group_name}</h4>
                        <div className="group-details">
                          <span>{group.leads_per_month} leads/month</span>
                          <span>•</span>
                          <span>{group.leads_per_drop} per drop</span>
                          <span>•</span>
                          <span>{group.refs_required} refs</span>
                        </div>
                        {group.lead_types && (
                          <div className="group-lead-types">{group.lead_types}</div>
                        )}
                      </div>
                    </div>
                    <div className="custom-group-actions">
                      <button
                        className="edit-group-btn"
                        onClick={() => {
                          setEditingCustomGroup(group);
                          setShowCustomGroupModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-group-btn"
                        onClick={() => handleDeleteCustomGroup(group.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {customGroupsEnabled && customGroups.length === 0 && (
              <p className="no-groups-message">
                No custom groups created for this month yet. Click "New Custom Group" to create one.
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="settings-section">
            <h3>Notes</h3>
            <textarea
              placeholder="Add any notes about these settings..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Summary */}
          <div className="settings-summary">
            <h4>Summary</h4>
            <ul>
              <li>
                <strong>Referrals:</strong> Using {refMonths.length} month(s): {refMonths.join(', ')}
              </li>
              <li>
                <strong>ALP:</strong> Using {alpMonths.length} month(s): {alpMonths.join(', ')}
              </li>
              <li>
                <strong>VIP:</strong> {vipEnabled ? `Enabled (${vipAlpValue.toLocaleString()} ALP per VIP)` : 'Disabled'}
              </li>
              <li>
                <strong>Custom Groups:</strong> {customGroupsEnabled ? `Enabled (${customGroups.length} groups configured)` : 'Disabled'}
              </li>
            </ul>
          </div>
        </div>

        <div className="allotment-settings-modal-footer">
          <button 
            className="reset-btn" 
            onClick={handleResetToDefaults}
            disabled={loading}
          >
            Reset to Defaults
          </button>
          <div className="footer-actions">
            <button 
              className="cancel-btn" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : existingSettingsId ? 'Update Settings' : 'Create Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Group Modal */}
      {showCustomGroupModal && (
        <CustomGroupModal
          isOpen={showCustomGroupModal}
          onClose={() => {
            setShowCustomGroupModal(false);
            setEditingCustomGroup(null);
          }}
          onSave={() => {
            fetchCustomGroups();
            setShowCustomGroupModal(false);
            setEditingCustomGroup(null);
          }}
          groupToEdit={editingCustomGroup}
          targetMonth={targetMonth}
        />
      )}
    </div>
  );
};

export default AllotmentSettingsModal;

