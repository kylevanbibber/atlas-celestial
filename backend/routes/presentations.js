const express = require('express');
const router = express.Router();
const { query: dbQuery } = require('../db'); // query from db.js is already promise-based!
const verifyToken = require('../middleware/verifyToken');

// Apply authentication middleware to all presentation routes
router.use(verifyToken);

// Get all presentations
router.get('/', async (req, res) => {
  try {
    console.log('[Presentations] GET / - Fetching all presentations');
    
    // First get presentations
    const presentations = await dbQuery(`
      SELECT p.*, u.lagnname as creator_name
      FROM presentations p
      LEFT JOIN activeusers u ON p.created_by = u.id
      ORDER BY p.updated_at DESC
    `);
    
    console.log('[Presentations] Found', presentations.length, 'presentations');
    
    // Then get slide counts for each
    for (let pres of presentations) {
      const slideCountResult = await dbQuery(
        'SELECT COUNT(*) as count FROM presentation_slides WHERE presentation_id = ? AND is_hidden = 0',
        [pres.id]
      );
      pres.slide_count = slideCountResult[0].count;
    }
    
    console.log('[Presentations] Added slide counts, sending response');
    res.json({ success: true, data: presentations });
  } catch (error) {
    console.error('[Presentations] Error fetching presentations:', error);
    console.error('[Presentations] Error details:', error.message, error.code);
    res.status(500).json({ success: false, message: 'Failed to fetch presentations', error: error.message });
  }
});

// Get single presentation with slides
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeHidden } = req.query;
    
    const presentations = await dbQuery('SELECT * FROM presentations WHERE id = ?', [id]);
    const presentation = presentations[0];
    
    if (!presentation) {
      return res.status(404).json({ success: false, message: 'Presentation not found' });
    }
    
    let slidesQuery = `
      SELECT * FROM presentation_slides 
      WHERE presentation_id = ?
    `;
    
    if (includeHidden !== 'true') {
      slidesQuery += ' AND is_hidden = 0';
    }
    
    slidesQuery += ' ORDER BY slide_order ASC';
    
    const slides = await dbQuery(slidesQuery, [id]);
    
    presentation.slides = slides;
    
    res.json({ success: true, data: presentation });
  } catch (error) {
    console.error('[Presentations] Error fetching presentation:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch presentation' });
  }
});

// Create new presentation
router.post('/', async (req, res) => {
  try {
    console.log('[Presentations] POST / - Creating presentation with body:', req.body);
    const { title, description, userId } = req.body;
    
    if (!title || !userId) {
      console.log('[Presentations] Validation failed - title:', title, 'userId:', userId);
      return res.status(400).json({ success: false, message: 'Title and userId are required' });
    }
    
    console.log('[Presentations] Executing INSERT query...');
    const result = await dbQuery(
      'INSERT INTO presentations (title, description, created_by) VALUES (?, ?, ?)',
      [title, description, userId]
    );
    
    console.log('[Presentations] Presentation created successfully, ID:', result.insertId);
    res.json({ success: true, presentationId: result.insertId });
  } catch (error) {
    console.error('[Presentations] Error creating presentation:', error);
    console.error('[Presentations] Error details:', error.message, error.code);
    res.status(500).json({ success: false, message: 'Failed to create presentation', error: error.message });
  }
});

// Update presentation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;
    
    await dbQuery(
      `UPDATE presentations 
       SET title = ?, description = ?, is_active = ? 
       WHERE id = ?`,
      [title, description, isActive, id]
    );
    
    res.json({ success: true, message: 'Presentation updated successfully' });
  } catch (error) {
    console.error('[Presentations] Error updating presentation:', error);
    res.status(500).json({ success: false, message: 'Failed to update presentation' });
  }
});

// Delete presentation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Note: Images are hosted on Imgur, so we don't need to delete them from local storage
    // Delete presentation (cascades to slides due to foreign key)
    await dbQuery('DELETE FROM presentations WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Presentation deleted successfully' });
  } catch (error) {
    console.error('[Presentations] Error deleting presentation:', error);
    res.status(500).json({ success: false, message: 'Failed to delete presentation' });
  }
});

// Add slide to presentation
router.post('/:id/slides', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, script, notes, duration, transitionType, imageUrl } = req.body;
    
    // Get current max order
    const maxOrderResult = await dbQuery(
      'SELECT MAX(slide_order) as max_order FROM presentation_slides WHERE presentation_id = ?',
      [id]
    );
    
    const slideOrder = (maxOrderResult[0]?.max_order ?? -1) + 1;
    
    const result = await dbQuery(
      `INSERT INTO presentation_slides 
       (presentation_id, slide_order, title, image_url, script, notes, duration, transition_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, slideOrder, title, imageUrl || null, script, notes, duration || 0, transitionType || 'fade']
    );
    
    // Update presentation updated_at
    await dbQuery('UPDATE presentations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    res.json({ success: true, slideId: result.insertId, imageUrl });
  } catch (error) {
    console.error('[Presentations] Error adding slide:', error);
    res.status(500).json({ success: false, message: 'Failed to add slide' });
  }
});

// Update slide
router.put('/:id/slides/:slideId', async (req, res) => {
  try {
    const { id, slideId } = req.params;
    const { title, script, notes, duration, transitionType, isHidden, imageUrl } = req.body;
    
    // Get existing slide
    const existingSlides = await dbQuery('SELECT * FROM presentation_slides WHERE id = ?', [slideId]);
    const existingSlide = existingSlides[0];
    
    if (!existingSlide) {
      return res.status(404).json({ success: false, message: 'Slide not found' });
    }
    
    // Use provided imageUrl or keep existing one
    const finalImageUrl = imageUrl !== undefined ? imageUrl : existingSlide.image_url;
    
    await dbQuery(
      `UPDATE presentation_slides 
       SET title = ?, image_url = ?, script = ?, notes = ?, duration = ?, 
           transition_type = ?, is_hidden = ? 
       WHERE id = ?`,
      [title, finalImageUrl, script, notes, duration || 0, transitionType || 'fade', isHidden ? 1 : 0, slideId]
    );
    
    // Update presentation updated_at
    await dbQuery('UPDATE presentations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    res.json({ success: true, imageUrl: finalImageUrl });
  } catch (error) {
    console.error('[Presentations] Error updating slide:', error);
    res.status(500).json({ success: false, message: 'Failed to update slide' });
  }
});

// Reorder slides
router.put('/:id/slides/reorder', async (req, res) => {
  try {
    const { id } = req.params;
    const { slideIds } = req.body; // Array of slide IDs in new order
    
    if (!Array.isArray(slideIds)) {
      return res.status(400).json({ success: false, message: 'slideIds must be an array' });
    }
    
    // Update order for each slide
    for (let i = 0; i < slideIds.length; i++) {
      await dbQuery(
        'UPDATE presentation_slides SET slide_order = ? WHERE id = ? AND presentation_id = ?',
        [i, slideIds[i], id]
      );
    }
    
    // Update presentation updated_at
    await dbQuery('UPDATE presentations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Slides reordered successfully' });
  } catch (error) {
    console.error('[Presentations] Error reordering slides:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder slides' });
  }
});

// Delete slide
router.delete('/:id/slides/:slideId', async (req, res) => {
  try {
    const { id, slideId } = req.params;
    
    // Note: Images are hosted on Imgur, so we don't need to delete them from local storage
    // Delete slide
    await dbQuery('DELETE FROM presentation_slides WHERE id = ?', [slideId]);
    
    // Get all remaining slides and reorder them
    const remainingSlides = await dbQuery(
      'SELECT id FROM presentation_slides WHERE presentation_id = ? ORDER BY slide_order ASC',
      [id]
    );
    
    // Update order for each remaining slide
    for (let i = 0; i < remainingSlides.length; i++) {
      await dbQuery(
        'UPDATE presentation_slides SET slide_order = ? WHERE id = ?',
        [i, remainingSlides[i].id]
      );
    }
    
    // Update presentation updated_at
    await dbQuery('UPDATE presentations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Slide deleted successfully' });
  } catch (error) {
    console.error('[Presentations] Error deleting slide:', error);
    res.status(500).json({ success: false, message: 'Failed to delete slide' });
  }
});

module.exports = router;

