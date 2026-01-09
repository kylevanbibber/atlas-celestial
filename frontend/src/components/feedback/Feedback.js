import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FiAlertCircle, FiZap, FiPlus, FiEdit3, FiTrash2, FiUser, FiCalendar, FiClock, FiCheck, FiX, FiMessageSquare, FiEye, FiEyeOff, FiImage, FiSearch } from 'react-icons/fi';
import api from '../../api';
import RightDetails from '../utils/RightDetails';
import FilterMenu from '../common/FilterMenu';
import './Feedback.css';

const Feedback = () => {
  const { user } = useAuth();
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'bugs', 'features', 'pending' (dev only)
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [imagePreview, setImagePreview] = useState({ open: false, url: '', caption: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter state
  const [filters, setFilters] = useState({
    // Type filters
    bug: true,
    feature: true,
    // Status filters
    pending: true,
    approved: true,
    in_progress: true,
    completed: true,
    rejected: true,
    // Priority filters (developer only)
    low: true,
    medium: true,
    high: true
  });
  
  // Form states
  const [submitType, setSubmitType] = useState('bug');
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitImages, setSubmitImages] = useState([]); // [{url, deleteHash}]
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [developerChecked, setDeveloperChecked] = useState(false);

  // Check if user is developer
  useEffect(() => {
    const checkDeveloper = async () => {
      try {
        const res = await api.get('/feedback/check-developer');
        setIsDeveloper(res.data?.isDeveloper || false);
      } catch (err) {
        setIsDeveloper(false);
      } finally {
        setDeveloperChecked(true);
      }
    };
    checkDeveloper();
  }, []);

  // Fetch feedback items - only after developer check is complete
  const fetchFeedback = useCallback(async () => {
    if (!developerChecked) return; // Wait for developer check
    
    try {
      setLoading(true);
      const endpoint = isDeveloper ? '/feedback/all' : '/feedback';
      const res = await api.get(endpoint);
      if (res.data?.success) {
        setFeedbackItems(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching feedback:', err);
    } finally {
      setLoading(false);
    }
  }, [isDeveloper, developerChecked]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  // Filter toggle handler
  const handleFilterToggle = (filterKey) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  // Toggle all filters in a category
  const handleToggleAllInCategory = (filterKeys, value) => {
    setFilters(prev => {
      const updated = { ...prev };
      filterKeys.forEach(key => {
        updated[key] = value;
      });
      return updated;
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      bug: true,
      feature: true,
      pending: true,
      approved: true,
      in_progress: true,
      completed: true,
      rejected: true,
      low: true,
      medium: true,
      high: true
    });
  };

  // Filter categories for FilterMenu
  const typeFilters = ['bug', 'feature'];
  const statusFilterKeys = ['pending', 'approved', 'in_progress', 'completed', 'rejected'];
  const priorityFilters = ['low', 'medium', 'high'];

  const filterCategories = [
    {
      name: 'Type',
      filters: typeFilters,
      onToggle: handleFilterToggle,
      onToggleAll: (value) => handleToggleAllInCategory(typeFilters, value)
    },
    {
      name: 'Status',
      filters: statusFilterKeys,
      onToggle: handleFilterToggle,
      onToggleAll: (value) => handleToggleAllInCategory(statusFilterKeys, value)
    },
    ...(isDeveloper ? [{
      name: 'Priority',
      filters: priorityFilters,
      onToggle: handleFilterToggle,
      onToggleAll: (value) => handleToggleAllInCategory(priorityFilters, value)
    }] : [])
  ];

  // Get filter label for display
  const getFilterLabel = (filter) => {
    const labels = {
      bug: 'Bug',
      feature: 'Feature',
      pending: 'Pending',
      approved: 'Approved',
      in_progress: 'In Progress',
      completed: 'Completed',
      rejected: 'Rejected',
      low: 'Low',
      medium: 'Medium',
      high: 'High'
    };
    return labels[filter] || filter;
  };

  // Filter items based on active tab, filters, and search query
  const filteredItems = feedbackItems.filter(item => {
    // Tab filter (quick filter, takes precedence)
    if (activeTab === 'bugs' && item.type !== 'bug') return false;
    if (activeTab === 'features' && item.type !== 'feature') return false;
    if (activeTab === 'pending' && item.status !== 'pending') return false;
    
    // Type filter (only applies when viewing "all" tab)
    if (activeTab === 'all') {
      if (!filters[item.type]) return false;
    }
    
    // Status filter
    if (!filters[item.status]) return false;
    
    // Priority filter (developer only)
    if (isDeveloper && !filters[item.priority]) return false;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        (item.title || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        (item.authorName || '').toLowerCase().includes(query) ||
        (item.developerNotes || '').toLowerCase().includes(query) ||
        (item.status || '').toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Count items by category
  const counts = {
    all: feedbackItems.length,
    bugs: feedbackItems.filter(i => i.type === 'bug').length,
    features: feedbackItems.filter(i => i.type === 'feature').length,
    pending: feedbackItems.filter(i => i.status === 'pending').length
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await api.post('/upload/imgur', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data?.success) {
        const newImage = {
          url: res.data.data.url,
          deleteHash: res.data.data.deleteHash
        };
        setSubmitImages(prev => [...prev, newImage]);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Remove image from submit form
  const handleRemoveImage = (index) => {
    setSubmitImages(prev => prev.filter((_, i) => i !== index));
  };

  // Handle submit new feedback
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submitTitle.trim() || !submitDescription.trim()) {
      alert('Please fill in both title and description');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/feedback', {
        type: submitType,
        title: submitTitle.trim(),
        description: submitDescription.trim(),
        images: submitImages
      });

      if (res.data?.success) {
        setSuccessMessage(res.data.message || 'Feedback submitted successfully!');
        setSubmitTitle('');
        setSubmitDescription('');
        setSubmitImages([]);
        setShowSubmitForm(false);
        fetchFeedback();
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert(err.response?.data?.message || 'Error submitting feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle update feedback (developer only) - called from RightDetails
  const handleUpdate = async (formData) => {
    if (!formData?.id) return false;

    try {
      const res = await api.put(`/feedback/${formData.id}`, {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        developerNotes: formData.developerNotes,
        isPublic: formData.isPublic,
        estimatedCompletion: formData.estimatedCompletion || null
      });

      if (res.data?.success) {
        fetchFeedback();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating feedback:', err);
      alert(err.response?.data?.message || 'Error updating feedback');
      return false;
    }
  };

  // Handle delete feedback (developer only)
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feedback item?')) {
      return;
    }

    try {
      const res = await api.delete(`/feedback/${id}`);
      if (res.data?.success) {
        fetchFeedback();
      }
    } catch (err) {
      console.error('Error deleting feedback:', err);
      alert(err.response?.data?.message || 'Error deleting feedback');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status label
  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending Review',
      approved: 'Approved',
      in_progress: 'In Progress',
      completed: 'Completed',
      rejected: 'Rejected'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="feedback-container">
        <div className="feedback-loading">
          <div className="loading-spinner"></div>
          <p>Loading feedback...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-container">
      {/* Header */}
      <div className="settings-header" style={{ marginBottom: '12px' }}>
        <h1 className="settings-section-title">Bug Reports & Feature Requests</h1>
        <button
          className="settings-icon-button"
          onClick={() => setShowSubmitForm(!showSubmitForm)}
          aria-label="Submit feedback"
          title="Submit feedback"
        >
          <FiPlus />
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="feedback-success-message">
          <FiCheck size={18} />
          {successMessage}
        </div>
      )}

      {/* Search Bar and Filters */}
      <div className="feedback-toolbar">
        <div className="feedback-search">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button 
                className="search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
        </div>
        <FilterMenu
          activeFilters={filters}
          filterCategories={filterCategories}
          onResetFilters={handleResetFilters}
          getFilterLabel={getFilterLabel}
          menuType="expandable"
          position="bottom-right"
          buttonLabel="Filters"
        />
      </div>

      {/* Submit Form */}
      {showSubmitForm && (
        <div className="feedback-submit-card">
          <h3>
            <FiMessageSquare /> Submit Feedback
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="feedback-type-toggle">
              <button
                type="button"
                className={`feedback-type-btn ${submitType === 'bug' ? 'active bug' : ''}`}
                onClick={() => setSubmitType('bug')}
              >
                <FiAlertCircle /> Bug Report
              </button>
              <button
                type="button"
                className={`feedback-type-btn ${submitType === 'feature' ? 'active feature' : ''}`}
                onClick={() => setSubmitType('feature')}
              >
                <FiZap /> Feature Request
              </button>
            </div>

            <div className="feedback-form-group">
              <label>Title</label>
              <input
                type="text"
                className="form-input"
                placeholder={submitType === 'bug' ? 'Brief description of the bug...' : 'What feature would you like?'}
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                required
              />
            </div>

            <div className="feedback-form-group">
              <label>Description</label>
              <textarea
                className="form-textarea"
                placeholder={submitType === 'bug' 
                  ? 'Describe what happened, what you expected to happen, and steps to reproduce...'
                  : 'Describe the feature in detail and why it would be useful...'
                }
                rows={5}
                value={submitDescription}
                onChange={(e) => setSubmitDescription(e.target.value)}
                required
              />
            </div>

            {/* Image Upload Section */}
            <div className="feedback-form-group">
              <label><FiImage size={14} style={{ marginRight: 4 }} /> Screenshots (optional)</label>
              <div className="feedback-images-container">
                {submitImages.map((img, idx) => (
                  <div key={idx} className="feedback-image-preview">
                    <img 
                      src={img.url} 
                      alt={`Screenshot ${idx + 1}`}
                      onClick={() => setImagePreview({ open: true, url: img.url, caption: '' })}
                    />
                    <button
                      type="button"
                      className="feedback-image-remove"
                      onClick={() => handleRemoveImage(idx)}
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="feedback-image-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ display: 'none' }}
                  />
                  {uploadingImage ? (
                    <span className="loading-spinner" style={{ width: 16, height: 16 }}></span>
                  ) : (
                    <>
                      <FiPlus size={14} />
                      <span>Add Image</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => setShowSubmitForm(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="feedback-tabs">
        <button
          className={`feedback-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
          <span className="feedback-tab-count">{counts.all}</span>
        </button>
        <button
          className={`feedback-tab ${activeTab === 'bugs' ? 'active' : ''}`}
          onClick={() => setActiveTab('bugs')}
        >
          <FiAlertCircle size={14} /> Bugs
          <span className="feedback-tab-count">{counts.bugs}</span>
        </button>
        <button
          className={`feedback-tab ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <FiZap size={14} /> Features
          <span className="feedback-tab-count">{counts.features}</span>
        </button>
        {isDeveloper && (
          <button
            className={`feedback-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending
            <span className="feedback-tab-count">{counts.pending}</span>
          </button>
        )}
      </div>

      {/* Feedback List */}
      <div className="feedback-list">
        {filteredItems.length === 0 ? (
          <div className="feedback-empty">
            <FiMessageSquare size={48} className="feedback-empty-icon" />
            <h3>No feedback items yet</h3>
            <p>
              {activeTab === 'pending' 
                ? 'No pending items to review.'
                : 'Be the first to submit a bug report or feature request!'}
            </p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div 
              key={item.id} 
              className={`feedback-item type-${item.type} status-${item.status}`}
            >
              <div className="feedback-item-header">
                <div className="feedback-item-meta">
                  <span className={`feedback-type-badge ${item.type}`}>
                    {item.type === 'bug' ? <><FiAlertCircle size={12} /> Bug</> : <><FiZap size={12} /> Feature</>}
                  </span>
                  <span className={`feedback-status-badge ${item.status}`}>
                    {getStatusLabel(item.status)}
                  </span>
                  {isDeveloper && (
                    <span className={`feedback-priority-badge ${item.priority}`}>
                      {item.priority}
                    </span>
                  )}
                  {isDeveloper && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {item.isPublic ? <FiEye size={12} title="Public" /> : <FiEyeOff size={12} title="Hidden" />}
                    </span>
                  )}
                </div>
                {isDeveloper && (
                  <div className="feedback-item-actions">
                    <button
                      className="feedback-action-btn"
                      onClick={() => setEditingItem({ ...item })}
                      title="Edit"
                    >
                      <FiEdit3 size={16} />
                    </button>
                    <button
                      className="feedback-action-btn delete"
                      onClick={() => handleDelete(item.id)}
                      title="Delete"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              <h4 className="feedback-item-title">{item.title}</h4>
              
              <div className="feedback-item-description">
                {item.description.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {/* Display images */}
              {item.images && item.images.length > 0 && (
                <div className="feedback-images-display">
                  {item.images.map((img, idx) => (
                    <img
                      key={img.id || idx}
                      src={img.url}
                      alt={img.caption || `Screenshot ${idx + 1}`}
                      className="feedback-image-thumb"
                      onClick={() => setImagePreview({ open: true, url: img.url, caption: img.caption || '' })}
                    />
                  ))}
                </div>
              )}

              {item.developerNotes && (
                <div className="feedback-developer-notes">
                  <div className="feedback-developer-notes-label">Developer Notes</div>
                  <div className="feedback-developer-notes-content">{item.developerNotes}</div>
                </div>
              )}

              <div className="feedback-item-footer">
                <span className="feedback-item-author">
                  <FiUser size={14} />
                  {item.authorName || 'Anonymous'}
                </span>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {item.estimatedCompletion && item.status !== 'completed' && (
                    <span className="feedback-eta">
                      <FiClock size={14} />
                      ETA: {formatDate(item.estimatedCompletion)}
                    </span>
                  )}
                  {item.completedAt && (
                    <span className="feedback-item-date" style={{ color: '#10b981' }}>
                      <FiCheck size={14} />
                      Completed: {formatDate(item.completedAt)}
                    </span>
                  )}
                  <span className="feedback-item-date">
                    <FiCalendar size={14} />
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Panel (Developer Only) - Using RightDetails */}
      {editingItem && (
        <RightDetails
          fromPage="Feedback"
          data={{ ...editingItem, __isFeedbackDetails: true }}
          onSave={handleUpdate}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Image Preview Modal */}
      {imagePreview.open && (
        <div
          className="feedback-image-modal-overlay"
          onClick={() => setImagePreview({ open: false, url: '', caption: '' })}
        >
          <div
            className="feedback-image-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={imagePreview.url} 
              alt={imagePreview.caption || 'Screenshot'} 
            />
            {imagePreview.caption && (
              <div className="feedback-image-modal-caption">{imagePreview.caption}</div>
            )}
            <button
              className="feedback-image-modal-close"
              onClick={() => setImagePreview({ open: false, url: '', caption: '' })}
              title="Close"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;

