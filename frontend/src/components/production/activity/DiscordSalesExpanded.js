import React, { useState } from 'react';
import api from '../../../api';

const DiscordSalesExpanded = ({ 
  salesData, 
  onSalesUpdate, 
  onSalesDelete,
  dateString,
  breakdownData,
  onManualUpdate 
}) => {
  const [editingSale, setEditingSale] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editingManual, setEditingManual] = useState(false);
  const [manualFormData, setManualFormData] = useState({});

  const handleEditStart = (sale) => {
    setEditingSale(sale.id);
    setEditFormData({
      alp: sale.alp,
      refs: sale.refs,
      lead_type: sale.lead_type
    });
  };

  const handleEditCancel = () => {
    setEditingSale(null);
    setEditFormData({});
  };

  const handleEditSave = async (saleId) => {
    try {
      const response = await api.put(`/discord/sales/${saleId}`, editFormData);
      
      if (response.data.success) {
        // Update the local data
        onSalesUpdate(saleId, editFormData);
        setEditingSale(null);
        setEditFormData({});
      } else {
        alert('Failed to update sale: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error updating discord sale:', error);
      alert('Error updating sale: ' + error.message);
    }
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Are you sure you want to delete this Discord sale?')) {
      return;
    }

    try {
      const response = await api.delete(`/discord/sales/${saleId}`);
      
      if (response.data.success) {
        onSalesDelete(saleId);
      } else {
        alert('Failed to delete sale: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error deleting discord sale:', error);
      alert('Error deleting sale: ' + error.message);
    }
  };

  const handleManualEditStart = () => {
    setEditingManual(true);
    setManualFormData({
      alp: breakdownData?.manual_alp || 0,
      refs: breakdownData?.manual_refs || 0
    });
  };

  const handleManualEditCancel = () => {
    setEditingManual(false);
    setManualFormData({});
  };

  const handleManualEditSave = async () => {
    try {
      if (onManualUpdate) {
        await onManualUpdate(manualFormData);
        setEditingManual(false);
        setManualFormData({});
      }
    } catch (error) {
      console.error('Error updating manual amounts:', error);
      alert('Error updating manual amounts: ' + error.message);
    }
  };

  const formatTimestamp = (timestamp) => {
    // Create date object from UTC timestamp
    const utcDate = new Date(timestamp);
    
    // Convert to local time and format
    return utcDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  };

  const formatLeadType = (leadType) => {
    return leadType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  // Calculate totals
  const totals = salesData.reduce((acc, sale) => {
    acc.alp += parseFloat(sale.alp) || 0;
    acc.refs += parseInt(sale.refs) || 0;
    acc.sales += 1;
    return acc;
  }, { alp: 0, refs: 0, sales: 0 });

  // Get manual amounts from breakdown data
  const manualAlp = breakdownData?.manual_alp || 0;
  const manualRefs = breakdownData?.manual_refs || 0;
  const totalAlp = breakdownData?.total_alp || (totals.alp + manualAlp);
  const totalRefs = breakdownData?.total_refs || (totals.refs + manualRefs);

  if (!salesData || salesData.length === 0) {
    // No Discord sales, but might have manual entries
    if (manualAlp > 0 || manualRefs > 0) {
      return (
        <div className="expanded-content">
          <div className="discord-sales-container">
            <div className="discord-sales-header">
              <h4 className="discord-sales-title">Activity for {dateString}</h4>
              <span className="discord-sales-count">Manual entries only</span>
            </div>

            <div className="discord-sale-item manual-addition-item">
              <div className="discord-sale-info">
                <div className="discord-sale-field">
                  <span className="discord-sale-label">Manual ALP</span>
                  <span className="discord-sale-value">${manualAlp.toFixed(2)}</span>
                </div>
                <div className="discord-sale-field">
                  <span className="discord-sale-label">Manual Refs</span>
                  <span className="discord-sale-value">{manualRefs}</span>
                </div>
              </div>
              <div className="discord-sale-actions">
                <button
                  className="discord-sale-edit-btn"
                  onClick={handleManualEditStart}
                >
                  Edit Manual
                </button>
              </div>
            </div>

            <div className="discord-sales-total">
              <span>Total ALP: ${manualAlp.toFixed(2)}</span>
              <span>Total Refs: {manualRefs}</span>
              <span>Manual Entries Only</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="expanded-content">
        <div className="no-discord-sales">
          No Discord sales or manual entries recorded for {dateString}
        </div>
      </div>
    );
  }

  return (
    <div className="expanded-content">
      <div className="discord-sales-container">
        <div className="discord-sales-header">
          <h4 className="discord-sales-title">Discord Sales for {dateString}</h4>
          <span className="discord-sales-count">{salesData.length} sale{salesData.length !== 1 ? 's' : ''}</span>
        </div>

        {salesData.map((sale) => (
          <div key={sale.id} className="discord-sale-item">
            {editingSale === sale.id ? (
              // Edit mode
              <div className="discord-sale-info">
                <div className="discord-sale-field">
                  <label className="discord-sale-label">ALP</label>
                  <input
                    type="number"
                    value={editFormData.alp}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, alp: e.target.value }))}
                    style={{ width: '80px', padding: '2px 4px', fontSize: '12px' }}
                    step="0.01"
                  />
                </div>
                <div className="discord-sale-field">
                  <label className="discord-sale-label">Refs</label>
                  <input
                    type="number"
                    value={editFormData.refs}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, refs: e.target.value }))}
                    style={{ width: '60px', padding: '2px 4px', fontSize: '12px' }}
                  />
                </div>
                <div className="discord-sale-field">
                  <label className="discord-sale-label">Lead Type</label>
                  <select
                    value={editFormData.lead_type}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, lead_type: e.target.value }))}
                    style={{ padding: '2px 4px', fontSize: '12px' }}
                  >
                    <option value="union">Union</option>
                    <option value="credit_union">Credit Union</option>
                    <option value="association">Association</option>
                    <option value="pos">POS</option>
                    <option value="ref">Ref</option>
                    <option value="child_safe">Child Safe</option>
                    <option value="free_will_kit">Free Will Kit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="discord-sale-field">
                  <div className="discord-sale-timestamp">
                    {formatTimestamp(sale.ts)}
                  </div>
                  {sale.image_url && (
                    <a 
                      href={sale.image_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="discord-sale-image-link"
                    >
                      📷 View Image
                    </a>
                  )}
                </div>
              </div>
            ) : (
              // View mode
              <div className="discord-sale-info">
                <div className="discord-sale-field">
                  <span className="discord-sale-label">ALP</span>
                  <span className="discord-sale-value">${parseFloat(sale.alp).toFixed(2)}</span>
                </div>
                <div className="discord-sale-field">
                  <span className="discord-sale-label">Refs</span>
                  <span className="discord-sale-value">{sale.refs}</span>
                </div>
                <div className="discord-sale-field">
                  <span className="discord-sale-label">Lead Type</span>
                  <span className="discord-sale-value">
                    <span className="lead-type-badge">{formatLeadType(sale.lead_type)}</span>
                  </span>
                </div>
                <div className="discord-sale-field">
                  <div className="discord-sale-timestamp">
                    {formatTimestamp(sale.ts)}
                  </div>
                  {sale.image_url && (
                    <a 
                      href={sale.image_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="discord-sale-image-link"
                    >
                      📷 View Image
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="discord-sale-actions">
              {editingSale === sale.id ? (
                <>
                  <button
                    className="discord-sale-edit-btn"
                    onClick={() => handleEditSave(sale.id)}
                  >
                    Save
                  </button>
                  <button
                    className="discord-sale-delete-btn"
                    onClick={handleEditCancel}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="discord-sale-edit-btn"
                    onClick={() => handleEditStart(sale)}
                  >
                    Edit
                  </button>
                  <button
                    className="discord-sale-delete-btn"
                    onClick={() => handleDelete(sale.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Manual Addition Row */}
        <div className="discord-sale-item manual-addition-item">
          <div className="manual-addition-header">
          </div>
          
          {editingManual ? (
            // Edit mode for manual amounts
            <div className="discord-sale-info">
              <div className="discord-sale-field">
                <label className="discord-sale-label">Manual ALP</label>
                <input
                  type="number"
                  value={manualFormData.alp}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, alp: e.target.value }))}
                  style={{ width: '80px', padding: '2px 4px', fontSize: '12px' }}
                  step="0.01"
                />
              </div>
              <div className="discord-sale-field">
                <label className="discord-sale-label">Manual Refs</label>
                <input
                  type="number"
                  value={manualFormData.refs}
                  onChange={(e) => setManualFormData(prev => ({ ...prev, refs: e.target.value }))}
                  style={{ width: '60px', padding: '2px 4px', fontSize: '12px' }}
                />
              </div>
              <div className="discord-sale-field">
                <div className="discord-sale-timestamp">
                  Additional amounts not tracked via Discord
                </div>
              </div>
            </div>
          ) : (
            // View mode for manual amounts
            <div className="discord-sale-info">
              <div className="discord-sale-field">
                <span className="discord-sale-label">Manual ALP</span>
                <span className="discord-sale-value">${manualAlp.toFixed(2)}</span>
              </div>
              <div className="discord-sale-field">
                <span className="discord-sale-label">Manual Refs</span>
                <span className="discord-sale-value">{manualRefs}</span>
              </div>
              <div className="discord-sale-field">
                <div className="discord-sale-timestamp">
                  Additional amounts not tracked via Discord
                </div>
              </div>
            </div>
          )}

          <div className="discord-sale-actions">
            {editingManual ? (
              <>
                <button
                  className="discord-sale-edit-btn"
                  onClick={handleManualEditSave}
                >
                  Save
                </button>
                <button
                  className="discord-sale-delete-btn"
                  onClick={handleManualEditCancel}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="discord-sale-edit-btn"
                onClick={handleManualEditStart}
              >
                Edit Manual
              </button>
            )}
          </div>
        </div>

        <div className="discord-sales-total">
          <span>Discord ALP: ${totals.alp.toFixed(2)}</span>
          <span>Manual ALP: ${manualAlp.toFixed(2)}</span>
          <span>Total ALP: ${totalAlp.toFixed(2)}</span>
          <br />
          <span>Discord Refs: {totals.refs}</span>
          <span>Manual Refs: {manualRefs}</span>
          <span>Total Refs: {totalRefs}</span>
          <br />
        </div>
      </div>
    </div>
  );
};

export default DiscordSalesExpanded; 