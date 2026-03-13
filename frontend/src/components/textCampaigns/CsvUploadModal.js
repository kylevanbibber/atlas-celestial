import React, { useState, useRef } from 'react';
import api from '../../api';
import { FiUploadCloud } from 'react-icons/fi';

const CsvUploadModal = ({ campaignId, onComplete, onClose }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/text-campaigns/${campaignId}/upload-contacts`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000 // 5 minutes for large files
      });

      setResult(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDone = () => {
    onComplete();
  };

  return (
    <div className="tc-modal-overlay" onClick={onClose}>
      <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tc-modal-header">
          <h3>Upload Contacts</h3>
          <button className="tc-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="tc-modal-body">
          {error && <div className="tc-alert tc-alert-error">{error}</div>}

          <div className="tc-upload-zone" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
            />
            <FiUploadCloud size={32} color="#6c757d" />
            <p style={{ marginTop: 8, fontWeight: 500 }}>
              {file ? file.name : 'Click to select a CSV or Excel file'}
            </p>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
              File must include a <strong>phone</strong> column. A <strong>name</strong> column is recommended.
            </p>
          </div>

          {result && (
            <div className="tc-upload-results">
              <p className="success">
                <strong>{result.imported}</strong> contacts imported successfully
              </p>
              {result.skipped > 0 && (
                <p className="warning">
                  <strong>{result.skipped}</strong> skipped (invalid phone numbers)
                </p>
              )}
              {result.duplicates > 0 && (
                <p className="warning">
                  <strong>{result.duplicates}</strong> duplicates updated
                </p>
              )}
              {result.householdDupes > 0 && (
                <p className="warning">
                  <strong>{result.householdDupes}</strong> skipped (same household phone)
                </p>
              )}
              {result.dncSkipped > 0 && (
                <p className="warning">
                  <strong>{result.dncSkipped}</strong> skipped (opted out / DNC)
                </p>
              )}
              <p>
                <strong>{result.total}</strong> total contacts in campaign
              </p>
            </div>
          )}
        </div>

        <div className="tc-modal-footer">
          {result ? (
            <button className="tc-btn tc-btn-primary" onClick={handleDone}>
              Done
            </button>
          ) : (
            <>
              <button className="tc-btn tc-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="tc-btn tc-btn-primary"
                onClick={handleUpload}
                disabled={!file || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsvUploadModal;
