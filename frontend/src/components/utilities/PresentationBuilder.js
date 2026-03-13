import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { uploadImageToImgur } from '../../utils/imgurUploader';
import './PresentationBuilder.css';

const PresentationBuilder = () => {
  const { user } = useAuth();
  const [presentations, setPresentations] = useState([]);
  const [selectedPresentation, setSelectedPresentation] = useState(null);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [showNewPresentationModal, setShowNewPresentationModal] = useState(false);
  const [showAddSlideCard, setShowAddSlideCard] = useState(false);
  const [draggedSlide, setDraggedSlide] = useState(null);

  // New presentation form
  const [newPresentation, setNewPresentation] = useState({
    title: '',
    description: ''
  });

  // Slide form
  const [slideForm, setSlideForm] = useState({
    title: '',
    script: '',
    notes: '',
    duration: 0,
    transitionType: 'fade',
    isHidden: false,
    imageFile: null
  });

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      console.log('[PresentationBuilder] Loading presentations...');
      setLoading(true);
      const response = await api.get('/presentations');
      console.log('[PresentationBuilder] Response:', response.data);
      if (response.data.success) {
        console.log('[PresentationBuilder] Setting', response.data.data.length, 'presentations');
        setPresentations(response.data.data);
      } else {
        console.error('[PresentationBuilder] Response indicated failure:', response.data);
      }
    } catch (error) {
      console.error('[PresentationBuilder] Error loading presentations:', error);
      console.error('[PresentationBuilder] Error response:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const loadPresentation = async (presentationId) => {
    try {
      setLoading(true);
      const response = await api.get(`/presentations/${presentationId}?includeHidden=true`);
      if (response.data.success) {
        setSelectedPresentation(response.data.data);
        setSlides(response.data.data.slides || []);
      }
    } catch (error) {
      console.error('Error loading presentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePresentation = async (e) => {
    e.preventDefault();
    try {
      console.log('[PresentationBuilder] Creating presentation:', newPresentation, 'userId:', user.userId);
      const response = await api.post('/presentations', {
        ...newPresentation,
        userId: user.userId
      });
      console.log('[PresentationBuilder] Create response:', response.data);
      if (response.data.success) {
        console.log('[PresentationBuilder] Presentation created, reloading list...');
        await loadPresentations();
        setShowNewPresentationModal(false);
        setNewPresentation({ title: '', description: '' });
        loadPresentation(response.data.presentationId);
      }
    } catch (error) {
      console.error('[PresentationBuilder] Error creating presentation:', error);
      console.error('[PresentationBuilder] Error response:', error.response?.data);
      alert('Failed to create presentation: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddSlide = async (e) => {
    e.preventDefault();
    if (!selectedPresentation) return;

    try {
      let imageUrl = null;

      // Upload image to Imgur if provided
      if (slideForm.imageFile) {
        const uploadResult = await uploadImageToImgur(slideForm.imageFile);
        if (uploadResult.success) {
          imageUrl = uploadResult.data.link;
        } else {
          alert('Failed to upload image: ' + uploadResult.message);
          return;
        }
      }

      // Send slide data to backend
      const response = await api.post(`/presentations/${selectedPresentation.id}/slides`, {
        title: slideForm.title,
        script: slideForm.script,
        notes: slideForm.notes,
        duration: slideForm.duration,
        transitionType: slideForm.transitionType,
        imageUrl: imageUrl
      });

      if (response.data.success) {
        await loadPresentation(selectedPresentation.id);
        resetSlideForm();
        setShowAddSlideCard(false);
      }
    } catch (error) {
      console.error('Error adding slide:', error);
      alert('Failed to add slide');
    }
  };

  const handleUpdateSlide = async (e) => {
    e.preventDefault();
    if (!editingSlide) return;

    try {
      let imageUrl = editingSlide.image_url;

      // Upload new image to Imgur if provided
      if (slideForm.imageFile) {
        const uploadResult = await uploadImageToImgur(slideForm.imageFile);
        if (uploadResult.success) {
          imageUrl = uploadResult.data.link;
        } else {
          alert('Failed to upload image: ' + uploadResult.message);
          return;
        }
      }

      // Send slide data to backend
      const response = await api.put(
        `/presentations/${selectedPresentation.id}/slides/${editingSlide.id}`,
        {
          title: slideForm.title,
          script: slideForm.script,
          notes: slideForm.notes,
          duration: slideForm.duration,
          transitionType: slideForm.transitionType,
          isHidden: slideForm.isHidden,
          imageUrl: imageUrl
        }
      );

      if (response.data.success) {
        await loadPresentation(selectedPresentation.id);
        resetSlideForm();
        setEditingSlide(null);
      }
    } catch (error) {
      console.error('Error updating slide:', error);
      alert('Failed to update slide');
    }
  };

  const handleDeleteSlide = async (slideId) => {
    if (!window.confirm('Delete this slide?')) return;

    try {
      const response = await api.delete(`/presentations/${selectedPresentation.id}/slides/${slideId}`);
      if (response.data.success) {
        await loadPresentation(selectedPresentation.id);
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Failed to delete slide');
    }
  };

  const handleReorderSlides = async (newOrder) => {
    try {
      const slideIds = newOrder.map(slide => slide.id);
      const response = await api.put(`/presentations/${selectedPresentation.id}/slides/reorder`, {
        slideIds
      });
      if (response.data.success) {
        setSlides(newOrder);
      }
    } catch (error) {
      console.error('Error reordering slides:', error);
      alert('Failed to reorder slides');
    }
  };

  const resetSlideForm = () => {
    setSlideForm({
      title: '',
      script: '',
      notes: '',
      duration: 0,
      transitionType: 'fade',
      isHidden: false,
      imageFile: null
    });
  };

  const handleEditSlide = (slide) => {
    setEditingSlide(slide);
    setSlideForm({
      title: slide.title || '',
      script: slide.script || '',
      notes: slide.notes || '',
      duration: slide.duration || 0,
      transitionType: slide.transition_type || 'fade',
      isHidden: slide.is_hidden === 1,
      imageFile: null
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e, slide) => {
    setDraggedSlide(slide);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetSlide) => {
    e.preventDefault();
    if (!draggedSlide || draggedSlide.id === targetSlide.id) return;

    const newSlides = [...slides];
    const draggedIndex = newSlides.findIndex(s => s.id === draggedSlide.id);
    const targetIndex = newSlides.findIndex(s => s.id === targetSlide.id);

    newSlides.splice(draggedIndex, 1);
    newSlides.splice(targetIndex, 0, draggedSlide);

    // Update slide_order for each
    const reorderedSlides = newSlides.map((slide, index) => ({
      ...slide,
      slide_order: index
    }));

    handleReorderSlides(reorderedSlides);
    setDraggedSlide(null);
  };

  return (
    <div className="presentation-builder">
      <div className="builder-header">
        <h2>🛠️ Presentation Builder</h2>
        <button className="btn-primary" onClick={() => setShowNewPresentationModal(true)}>
          + New Presentation
        </button>
      </div>

      <div className="builder-content">
        {/* Presentations List */}
        <div className="presentations-sidebar">
          <h3>Presentations</h3>
          {loading && !selectedPresentation ? (
            <div className="pb-loading">Loading...</div>
          ) : (
            <div className="presentations-list">
              {presentations.map(pres => (
                <div
                  key={pres.id}
                  className={`presentation-item ${selectedPresentation?.id === pres.id ? 'active' : ''}`}
                  onClick={() => loadPresentation(pres.id)}
                >
                  <div className="presentation-title">{pres.title}</div>
                  <div className="presentation-meta">
                    {pres.slide_count} slides
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Editor Area */}
        <div className="editor-main">
          {!selectedPresentation ? (
            <div className="pb-empty-state">
              <p>Select a presentation or create a new one to get started</p>
            </div>
          ) : editingSlide ? (
            /* Presentation Mockup View for Editing */
            <div className="presentation-mockup">
              <div className="mockup-header">
                <button 
                  className="pb-btn-back"
                  onClick={() => {
                    setEditingSlide(null);
                    resetSlideForm();
                  }}
                >
                  ← Back to Slides
                </button>
                <div className="mockup-title">
                  <h3>{editingSlide.title || 'Untitled Slide'}</h3>
                  <span className="slide-indicator">
                    Slide {slides.findIndex(s => s.id === editingSlide.id) + 1} of {slides.length}
                  </span>
                </div>
                <div className="mockup-actions">
                  <button 
                    className="pb-btn-save"
                    onClick={(e) => {
                      e.preventDefault();
                      handleUpdateSlide(e);
                    }}
                  >
                    💾 Save Changes
                  </button>
                  <button 
                    className="pb-btn-delete-slide"
                    onClick={() => handleDeleteSlide(editingSlide.id)}
                    title="Delete Slide"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="mockup-container">
                {/* Slide Preview (Left) */}
                <div className="mockup-slide-preview">
                  <div className="wireframe-label">Slide Preview</div>
                  <div className="wireframe-slide">
                    {editingSlide.image_url || slideForm.imageFile ? (
                      <img 
                        src={slideForm.imageFile ? URL.createObjectURL(slideForm.imageFile) : editingSlide.image_url} 
                        alt="Slide preview" 
                        className="slide-preview-image"
                      />
                    ) : (
                      <div className="slide-placeholder">
                        <div className="placeholder-icon">🖼️</div>
                        <p>No image</p>
                      </div>
                    )}
                    <div className="slide-title-overlay">
                      <input
                        type="text"
                        value={slideForm.title}
                        onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })}
                        placeholder="Slide Title"
                        className="title-input"
                      />
                    </div>
                  </div>
                  
                  <div className="slide-meta-form">
                    <div className="meta-item">
                      <label>Image Upload</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSlideForm({ ...slideForm, imageFile: e.target.files[0] })}
                        className="file-input"
                      />
                    </div>
                    <div className="meta-row">
                      <div className="meta-item">
                        <label>Duration</label>
                        <input
                          type="number"
                          value={slideForm.duration}
                          onChange={(e) => setSlideForm({ ...slideForm, duration: parseInt(e.target.value) })}
                          min="0"
                          placeholder="Seconds"
                        />
                      </div>
                      <div className="meta-item">
                        <label>Transition</label>
                        <select
                          value={slideForm.transitionType}
                          onChange={(e) => setSlideForm({ ...slideForm, transitionType: e.target.value })}
                        >
                          <option value="fade">Fade</option>
                          <option value="slide">Slide</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      <div className="meta-item">
                        <label className="checkbox-label-inline">
                          <input
                            type="checkbox"
                            checked={slideForm.isHidden}
                            onChange={(e) => setSlideForm({ ...slideForm, isHidden: e.target.checked })}
                          />
                          Hide Slide
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Script Editor (Right) */}
                <div className="mockup-script-editor">
                  <div className="wireframe-label">Agent Script</div>
                  <div className="script-editor-panel">
                    <textarea
                      value={slideForm.script}
                      onChange={(e) => setSlideForm({ ...slideForm, script: e.target.value })}
                      placeholder="What should the agent say on this slide?

Example:
'Good evening! Thank you for meeting with me today. My name is [Your Name] and I represent American Income Life Insurance Company.'"
                      className="script-textarea"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Slides Grid View */
            <>
              <div className="presentation-header">
                <div>
                  <h3>{selectedPresentation.title}</h3>
                  <p>{selectedPresentation.description}</p>
                </div>
              </div>

              <div className="slides-section">
                <h4>Slides ({slides.length})</h4>
                <div className="slides-grid">
                  {slides.map((slide, index) => (
                    <div
                      key={slide.id}
                      className={`slide-card ${slide.is_hidden ? 'slide-hidden' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, slide)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, slide)}
                      onClick={() => handleEditSlide(slide)}
                    >
                      <div className="slide-number">{index + 1}</div>
                      {slide.image_url ? (
                        <img src={slide.image_url} alt={slide.title} className="slide-thumbnail" />
                      ) : (
                        <div className="slide-thumbnail-placeholder">
                          <div className="placeholder-icon-small">🖼️</div>
                        </div>
                      )}
                      <div className="slide-card-header">
                        <h5>{slide.title || 'Untitled Slide'}</h5>
                        <div className="slide-status-icons">
                          {slide.is_hidden ? (
                            <span className="status-icon hidden-icon" title="Hidden">👁️‍🗨️</span>
                          ) : (
                            <span className="status-icon active-icon" title="Active">✓</span>
                          )}
                          {slide.script ? (
                            <span className="status-icon script-icon" title="Has Script">📝</span>
                          ) : (
                            <span className="status-icon no-script-icon" title="No Script">⚠️</span>
                          )}
                        </div>
                      </div>
                      <div className="slide-actions" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this slide?')) {
                              handleDeleteSlide(slide.id);
                            }
                          }} 
                          title="Delete"
                          className="pb-delete-btn"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Slide Card */}
                  {showAddSlideCard ? (
                    <div className="slide-card add-slide-card-form">
                      <div className="add-slide-form">
                        <h5>New Slide</h5>
                        <input
                          type="text"
                          placeholder="Slide Title"
                          value={slideForm.title}
                          onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })}
                          className="add-slide-input"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSlideForm({ ...slideForm, imageFile: e.target.files[0] })}
                          className="add-slide-file"
                        />
                        <textarea
                          placeholder="Script (optional)"
                          value={slideForm.script}
                          onChange={(e) => setSlideForm({ ...slideForm, script: e.target.value })}
                          rows={3}
                          className="add-slide-textarea"
                        />
                        <div className="add-slide-actions">
                          <button 
                            onClick={async (e) => {
                              e.preventDefault();
                              await handleAddSlide(e);
                              setShowAddSlideCard(false);
                            }}
                            className="pb-btn-add-confirm"
                          >
                            Add
                          </button>
                          <button 
                            onClick={() => {
                              setShowAddSlideCard(false);
                              resetSlideForm();
                            }}
                            className="pb-btn-add-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="slide-card add-slide-card"
                      onClick={() => setShowAddSlideCard(true)}
                    >
                      <div className="add-slide-icon">+</div>
                      <h5>Add Slide</h5>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Presentation Modal */}
      {showNewPresentationModal && (
        <div className="pb-modal-overlay" onClick={() => setShowNewPresentationModal(false)}>
          <div className="pb-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Presentation</h3>
            <form onSubmit={handleCreatePresentation}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={newPresentation.title}
                  onChange={(e) => setNewPresentation({ ...newPresentation, title: e.target.value })}
                  required
                  placeholder="e.g., Welcome Presentation"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newPresentation.description}
                  onChange={(e) => setNewPresentation({ ...newPresentation, description: e.target.value })}
                  placeholder="Brief description of this presentation..."
                  rows={3}
                />
              </div>
              <div className="pb-modal-actions">
                <button type="submit" className="pb-btn-primary">Create</button>
                <button
                  type="button"
                  className="pb-btn-secondary"
                  onClick={() => setShowNewPresentationModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresentationBuilder;

