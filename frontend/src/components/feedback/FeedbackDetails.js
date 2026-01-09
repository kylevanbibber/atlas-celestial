import React, { useState } from 'react';
import { FiX, FiAlertCircle, FiZap, FiPlus, FiTrash2, FiImage } from 'react-icons/fi';
import api from '../../api';
import './FeedbackDetails.css';

const FeedbackDetails = ({ data, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    title: data?.title || '',
    description: data?.description || '',
    status: data?.status || 'pending',
    priority: data?.priority || 'medium',
    developerNotes: data?.developerNotes || '',
    isPublic: data?.isPublic || false,
    estimatedCompletion: data?.estimatedCompletion ? data.estimatedCompletion.split('T')[0] : '',
    images: data?.images || []
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const formDataUpload = new FormData();
      formDataUpload.append('image', file);
      
      const res = await api.post('/upload/imgur', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data?.success) {
        const newImage = {
          url: res.data.data.url,
          deleteHash: res.data.data.deleteHash
        };
        
        // If editing existing feedback, add image to backend
        if (data?.id) {
          await api.post(`/feedback/${data.id}/images`, { images: [newImage] });
        }
        
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, newImage]
        }));
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Remove image
  const handleRemoveImage = async (index, imageId) => {
    try {
      if (data?.id && imageId) {
        await api.delete(`/feedback/${data.id}/images/${imageId}`);
      }
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    } catch (err) {
      console.error('Failed to remove image:', err);
      alert('Failed to remove image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const result = await onSave({
        ...formData,
        id: data?.id
      });
      
      if (result !== false) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving feedback:', err);
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <div className="feedback-details">
      {/* Header */}
      <div className="feedback-details-header">
        <div className="feedback-details-header-left">
          <span className={`feedback-type-badge ${data?.type}`}>
            {data?.type === 'bug' ? <><FiAlertCircle size={12} /> Bug</> : <><FiZap size={12} /> Feature</>}
          </span>
          <span className="feedback-details-chip">Edit Feedback</span>
        </div>
        <button className="close-button" onClick={onClose}>
          <FiX />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="feedback-details-form">
        <div className="feedback-details-section">
          <label className="feedback-details-label">Title</label>
          <input
            type="text"
            className="feedback-details-input"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />
        </div>

        <div className="feedback-details-section">
          <label className="feedback-details-label">Description</label>
          <textarea
            className="feedback-details-textarea"
            rows={4}
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            required
          />
        </div>

        <div className="feedback-details-row">
          <div className="feedback-details-section">
            <label className="feedback-details-label">Status</label>
            <select
              className="feedback-details-select"
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
            >
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="feedback-details-section">
            <label className="feedback-details-label">Priority</label>
            <select
              className="feedback-details-select"
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="feedback-details-row">
          <div className="feedback-details-section">
            <label className="feedback-details-label">Visibility</label>
            <select
              className="feedback-details-select"
              value={formData.isPublic ? 'public' : 'private'}
              onChange={(e) => handleChange('isPublic', e.target.value === 'public')}
            >
              <option value="private">Hidden</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="feedback-details-section">
            <label className="feedback-details-label">Estimated Completion</label>
            <input
              type="date"
              className="feedback-details-input"
              value={formData.estimatedCompletion}
              onChange={(e) => handleChange('estimatedCompletion', e.target.value)}
            />
          </div>
        </div>

        <div className="feedback-details-section">
          <label className="feedback-details-label">Developer Notes</label>
          <textarea
            className="feedback-details-textarea"
            rows={3}
            placeholder="Add notes about progress, next steps, or why this was rejected..."
            value={formData.developerNotes}
            onChange={(e) => handleChange('developerNotes', e.target.value)}
          />
        </div>

        {/* Images Section */}
        <div className="feedback-details-section">
          <label className="feedback-details-label">
            <FiImage size={14} style={{ marginRight: 4 }} /> Screenshots
          </label>
          <div className="feedback-details-images">
            {formData.images.map((img, idx) => (
              <div key={img.id || idx} className="feedback-details-image">
                <img 
                  src={img.url} 
                  alt={`Screenshot ${idx + 1}`}
                  onClick={() => setImagePreview(img.url)}
                />
                <button
                  type="button"
                  className="feedback-details-image-remove"
                  onClick={() => handleRemoveImage(idx, img.id)}
                  title="Remove image"
                >
                  <FiTrash2 size={12} />
                </button>
              </div>
            ))}
            <label className="feedback-details-image-add">
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
                  <FiPlus size={16} />
                  <span>Add</span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Meta info */}
        {data?.authorName && (
          <div className="feedback-details-meta">
            <span>Submitted by: <strong>{data.authorName}</strong></span>
            {data.createdAt && (
              <span>on {new Date(data.createdAt).toLocaleDateString()}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="feedback-details-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className="feedback-details-preview-overlay"
          onClick={() => setImagePreview(null)}
        >
          <div className="feedback-details-preview-modal" onClick={(e) => e.stopPropagation()}>
            <img src={imagePreview} alt="Preview" />
            <button 
              className="feedback-details-preview-close"
              onClick={() => setImagePreview(null)}
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackDetails;

