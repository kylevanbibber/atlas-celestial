import { useState } from 'react';
import api from '../../api';
import CreateCampaignModal from './CreateCampaignModal';
import CsvUploadModal from './CsvUploadModal';
import { FiPlus, FiSend, FiTrash2, FiUpload, FiEdit3, FiMessageSquare } from 'react-icons/fi';

const CampaignList = ({ campaigns, loading, selectedCampaignId, onSelectCampaign, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [uploadCampaignId, setUploadCampaignId] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return;
    try {
      await api.delete(`/text-campaigns/${id}`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete campaign');
    }
  };

  const handleSend = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Send this campaign to all pending contacts?')) return;
    try {
      setSendingId(id);
      const response = await api.post(`/text-campaigns/${id}/send`);
      alert(response.data.message || 'Campaign is sending!');
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send campaign');
    } finally {
      setSendingId(null);
    }
  };

  const handleEdit = (e, campaign) => {
    e.stopPropagation();
    setEditingCampaign(campaign);
    setShowCreateModal(true);
  };

  const handleUpload = (e, id) => {
    e.stopPropagation();
    setUploadCampaignId(id);
  };

  const handleCampaignSaved = () => {
    setShowCreateModal(false);
    setEditingCampaign(null);
    onRefresh();
  };

  const handleUploadComplete = () => {
    setUploadCampaignId(null);
    onRefresh();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'var(--text-secondary)';
      case 'sending': return '#f57c00';
      case 'sent': return '#388e3c';
      case 'failed': return '#d32f2f';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="tc-sidebar">
      <div className="tc-sidebar-header">
        <h3>Campaigns</h3>
        <button
          className="tc-sidebar-add-btn"
          onClick={() => { setEditingCampaign(null); setShowCreateModal(true); }}
          title="New Campaign"
        >
          <FiPlus />
        </button>
      </div>

      <div className="tc-sidebar-list">
        {loading ? (
          <div className="tc-sidebar-empty">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="tc-sidebar-empty">No campaigns yet</div>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              className={`tc-sidebar-item ${selectedCampaignId === c.id ? 'selected' : ''}`}
              onClick={() => onSelectCampaign(c.id)}
            >
              <div className="tc-sidebar-item-icon">
                <FiMessageSquare />
              </div>
              <div className="tc-sidebar-item-content">
                <div className="tc-sidebar-item-name">{c.name}</div>
                <div className="tc-sidebar-item-meta">
                  <span className="tc-sidebar-item-status" style={{ color: getStatusColor(c.status) }}>
                    {c.status}
                  </span>
                  <span className="tc-sidebar-item-count">
                    {c.total_contacts || 0} contacts
                  </span>
                  {c.follow_up_count > 0 && (
                    <span className="tc-sidebar-item-count">
                      {c.follow_up_count} FU
                    </span>
                  )}
                </div>
                {(c.responded_count > 0) && (
                  <div className="tc-sidebar-item-badge">{c.responded_count}</div>
                )}
              </div>

              {/* Inline actions on hover */}
              {c.status === 'draft' && (
                <div className="tc-sidebar-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => handleEdit(e, c)} title="Edit"><FiEdit3 size={13} /></button>
                  <button onClick={(e) => handleUpload(e, c.id)} title="Upload CSV"><FiUpload size={13} /></button>
                  <button
                    onClick={(e) => handleSend(e, c.id)}
                    disabled={sendingId === c.id || !c.total_contacts}
                    title="Send"
                  >
                    <FiSend size={13} />
                  </button>
                  <button onClick={(e) => handleDelete(e, c.id)} title="Delete" className="tc-action-danger">
                    <FiTrash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          campaign={editingCampaign}
          onSave={handleCampaignSaved}
          onClose={() => { setShowCreateModal(false); setEditingCampaign(null); }}
        />
      )}

      {uploadCampaignId && (
        <CsvUploadModal
          campaignId={uploadCampaignId}
          onComplete={handleUploadComplete}
          onClose={() => setUploadCampaignId(null)}
        />
      )}
    </div>
  );
};

export default CampaignList;
