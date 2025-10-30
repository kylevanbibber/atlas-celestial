import React, { useState, useEffect } from 'react';
import api from '../../api';
import './RecipientPreviewModal.css';

const RecipientPreviewModal = ({ filters, onClose }) => {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      setLoading(true);
      const response = await api.post('/email-campaigns/preview-recipients', {
        recipientFilter: filters
      });
      setRecipients(response.data.recipients || []);
      setError('');
    } catch (err) {
      console.error('Error fetching recipients:', err);
      setError('Failed to load recipients');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recipient-preview-overlay" onClick={onClose}>
      <div className="recipient-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Recipient Preview</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {loading && (
            <div className="loading-state">Loading recipients...</div>
          )}
          
          {error && (
            <div className="error-state">{error}</div>
          )}
          
          {!loading && !error && (
            <>
              <div className="recipient-count-header">
                <strong>{recipients.length}</strong> recipient(s) will receive this email
              </div>
              
              {recipients.length === 0 ? (
                <div className="empty-state">
                  No recipients match the current filters
                </div>
              ) : (
                <div className="recipients-table-container">
                  <table className="recipients-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>CL Name</th>
                        <th>ESID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((recipient) => (
                        <tr key={recipient.id}>
                          <td>{recipient.lagnname || 'N/A'}</td>
                          <td>{recipient.email}</td>
                          <td>{recipient.clname || 'N/A'}</td>
                          <td>{recipient.esid || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipientPreviewModal;
