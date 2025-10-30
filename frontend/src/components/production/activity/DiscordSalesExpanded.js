import React, { useState, useMemo, useEffect } from 'react';
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
      console.log('[DiscordSalesExpanded] Saving sale edit', { saleId, editFormData });
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
      console.log('[DiscordSalesExpanded] Deleting sale', { saleId });
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
    console.log('[DiscordSalesExpanded] Starting manual edit with defaults', {
      manual_alp: breakdownData?.manual_alp || 0,
      manual_refs: breakdownData?.manual_refs || 0
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

  // Deduplicate sales by id to prevent double-counting on refresh
  const uniqueSales = useMemo(() => {
    const seen = new Set();
    return (salesData || []).filter((sale) => {
      if (!sale || sale.id == null) return false;
      if (seen.has(sale.id)) return false;
      seen.add(sale.id);
      return true;
    });
  }, [salesData]);

  // Debug: incoming props and deduplication summary
  useEffect(() => {
    try {
      console.groupCollapsed('[DiscordSalesExpanded] Props snapshot');
      console.log('dateString:', dateString);
      console.log('salesData count:', Array.isArray(salesData) ? salesData.length : 0);
      console.log('salesData ids:', Array.isArray(salesData) ? salesData.map(s => s?.id) : []);
      console.log('breakdownData:', breakdownData);
      console.groupEnd();

      // Duplicate id detection
      const idCounts = new Map();
      (salesData || []).forEach(s => {
        const id = s?.id;
        if (id == null) return;
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      });
      const duplicates = Array.from(idCounts.entries()).filter(([_, c]) => c > 1).map(([id, c]) => ({ id, count: c }));
      console.groupCollapsed('[DiscordSalesExpanded] Dedup summary');
      console.log('input count:', (salesData || []).length);
      console.log('unique count:', uniqueSales.length);
      if (duplicates.length) {
        console.log('duplicate ids:', duplicates);
      }
      console.groupEnd();
    } catch (e) {}
  }, [salesData, breakdownData, dateString, uniqueSales]);

  // Calculate totals from unique sales only
  const totals = uniqueSales.reduce((acc, sale) => {
    acc.alp += parseFloat(sale.alp) || 0;
    acc.refs += parseInt(sale.refs) || 0;
    acc.sales += 1;
    return acc;
  }, { alp: 0, refs: 0, sales: 0 });

  // Get manual amounts from breakdown data
  const manualAlp = breakdownData?.manual_alp || 0;
  const manualRefs = breakdownData?.manual_refs || 0;
  const totalAlp = (breakdownData?.total_alp ?? null) !== null && breakdownData?.total_alp !== undefined
    ? Number(breakdownData.total_alp) || 0
    : (totals.alp + manualAlp);
  const totalRefs = (breakdownData?.total_refs ?? null) !== null && breakdownData?.total_refs !== undefined
    ? Number(breakdownData.total_refs) || 0
    : (totals.refs + manualRefs);

  // Debug: totals overview
  useEffect(() => {
    try {
      console.groupCollapsed('[DiscordSalesExpanded] Totals overview');
      console.table({
        discord_alp: Number(totals.alp || 0).toFixed(2),
        discord_refs: totals.refs || 0,
        discord_sales: totals.sales || 0,
        manual_alp: Number(manualAlp || 0).toFixed(2),
        manual_refs: manualRefs || 0,
        total_alp: Number(totalAlp || 0).toFixed(2),
        total_refs: totalRefs || 0
      });
      console.groupEnd();
    } catch (e) {}
  }, [totals, manualAlp, manualRefs, totalAlp, totalRefs]);

  if (!uniqueSales || uniqueSales.length === 0) {
    // No Discord sales — render empty Discord section and then Arias Life section if any
    return (
      <div className="expanded-content">
        <div className="discord-sales-container">
          {/* Reported on Discord */}
          <div className="discord-sales-header">
            <h4 className="discord-sales-title">Reported on Discord</h4>
            <span className="discord-sales-count">0 sales</span>
          </div>
          <div className="no-discord-sales" style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>
            No Discord sales recorded for {dateString}
          </div>
          <div className="discord-sales-total" style={{ marginTop: '6px' }}>
            <span>Discord Totals — ALP: ${totals.alp.toFixed(2)}</span>
            <span>Refs: {totals.refs}</span>
            <span>Closes: {totals.sales}</span>
          </div>

          {/* Removed Arias Life section */}
        </div>
      </div>
    );
  }

  return (
    <div className="expanded-content">
      <div className="discord-sales-container">
        {/* Reported on Discord */}
        <div className="discord-sales-header">
          <h4 className="discord-sales-title">Reported on Discord</h4>
          <span className="discord-sales-count">{uniqueSales.length} sale{uniqueSales.length !== 1 ? 's' : ''}</span>
        </div>

        {uniqueSales.map((sale) => (
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

        {/* Discord subtotal under list */}
        <div className="discord-sales-total" style={{ marginTop: '6px' }}>
          <span>Discord Totals — ALP: ${totals.alp.toFixed(2)}</span>
          <span>Refs: {totals.refs}</span>
          <span>Closes: {totals.sales}</span>
        </div>

        {/* Removed Arias Life manual section */}

        {/* Bottom totals removed per simplification */}
      </div>
    </div>
  );
};

export default DiscordSalesExpanded; 