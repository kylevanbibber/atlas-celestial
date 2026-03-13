import React from 'react';
import { FiX, FiDownload, FiClock, FiFile, FiExternalLink } from 'react-icons/fi';
import { BsFiletypeXlsx } from 'react-icons/bs';
import './ReportVersionModal.css';

const ReportVersionModal = ({ report, isOpen, onClose }) => {
  if (!isOpen || !report) return null;

  const handleDownload = (version, event) => {
    event.stopPropagation();
    const downloadUrl = version.onedrive_url || version.downloadUrl;
    if (downloadUrl) {
      console.log('Downloading version:', version.fileName || version.file_name);
      window.open(downloadUrl, '_blank');
    }
  };

  const formatFileSize = (sizeStr) => {
    // Helper to format file size consistently
    return sizeStr || 'Unknown size';
  };

  const getRelativeTime = (date) => {
    let dateObj;
    
    // Handle different date formats
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return 'Unknown date';
    }
    
    const now = new Date();
    const diff = now - dateObj;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const formatDate = (date) => {
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return 'Unknown date';
    }
    
    return dateObj.toLocaleDateString();
  };

  const getFileName = (version) => {
    return version.fileName || version.file_name || 'Unknown file';
  };

  const getFileSize = (version) => {
    return version.fileSize || version.file_size || 'Unknown size';
  };

  const getVersionDate = (version) => {
    return version.date || version.upload_date || version.created_at;
  };

  const getVersionNotes = (version) => {
    return version.description || version.version_notes || null;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="version-modal" onClick={(e) => e.stopPropagation()}>
        <div className="version-modal-header">
          <div className="version-modal-title-section">
            <h3>{report.title || report.report_name} - Version History</h3>
            <p>{report.versions?.length || 0} versions available</p>
          </div>
          <button className="version-modal-close" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="version-modal-content">
          {report.versions && report.versions.length > 0 ? (
            <div className="version-list">
              {report.versions.map((version, index) => {
                const versionDate = getVersionDate(version);
                const fileName = getFileName(version);
                const fileSize = getFileSize(version);
                const versionNotes = getVersionNotes(version);
                const downloadUrl = version.onedrive_url || version.downloadUrl;
                
                return (
                  <div key={index} className={`version-item ${index === 0 ? 'latest' : ''}`}>
                    <div className="version-icon">
                      <BsFiletypeXlsx size={24} />
                    </div>
                    
                    <div className="version-info">
                      <div className="version-header">
                        <div className="version-name">
                          <span className="file-name">{fileName}</span>
                          {index === 0 && <span className="latest-badge">Latest</span>}
                          {version.is_current && <span className="latest-badge">Current</span>}
                        </div>
                        <div className="version-meta">
                          <span className="version-date">
                            <FiClock size={14} />
                            {formatDate(versionDate)}
                          </span>
                          <span className="version-relative">
                            {getRelativeTime(versionDate)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="version-details">
                        <span className="file-size">{formatFileSize(fileSize)}</span>
                        {versionNotes && (
                          <span className="version-description">{versionNotes}</span>
                        )}
                        {version.created_by_name && (
                          <span className="version-author">by {version.created_by_name}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="version-actions">
                      {downloadUrl ? (
                        <>
                          <button 
                            className="version-action-btn download"
                            onClick={(e) => handleDownload(version, e)}
                            title="Download this version"
                          >
                            <FiDownload size={16} />
                            Download
                          </button>
                          <button 
                            className="version-action-btn view"
                            onClick={() => window.open(downloadUrl, '_blank')}
                            title="Open in OneDrive"
                          >
                            <FiExternalLink size={16} />
                            View
                          </button>
                        </>
                      ) : (
                        <span className="version-unavailable">Not available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-versions">
              <FiFile size={48} />
              <h4>No version history available</h4>
              <p>This report doesn't have multiple versions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportVersionModal; 