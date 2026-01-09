const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { query } = require('../db');

// Developer name check - only this user can manage feedback
const DEVELOPER_NAME = 'VANBIBBER KYLE A';

// Helper to check if user is the developer
const isDeveloper = async (userId) => {
    const [user] = await query('SELECT lagnname FROM activeusers WHERE id = ?', [userId]);
    return user && user.lagnname === DEVELOPER_NAME;
};

// Helper to attach images to feedback items
const attachImagesToFeedback = async (feedbackItems) => {
    if (!feedbackItems || feedbackItems.length === 0) return feedbackItems;
    
    const feedbackIds = feedbackItems.map(f => f.id);
    const placeholders = feedbackIds.map(() => '?').join(',');
    
    const imagesSql = `
        SELECT feedbackId, id, url, deleteHash, caption, sortOrder
        FROM app_feedback_images
        WHERE feedbackId IN (${placeholders})
        ORDER BY sortOrder, id
    `;
    
    const images = await query(imagesSql, feedbackIds);
    
    // Group images by feedbackId
    const imagesByFeedbackId = images.reduce((acc, img) => {
        if (!acc[img.feedbackId]) acc[img.feedbackId] = [];
        acc[img.feedbackId].push({
            id: img.id,
            url: img.url,
            deleteHash: img.deleteHash,
            caption: img.caption,
            sortOrder: img.sortOrder
        });
        return acc;
    }, {});
    
    // Attach images to each feedback item
    return feedbackItems.map(f => ({
        ...f,
        images: imagesByFeedbackId[f.id] || []
    }));
};

// GET /api/feedback - Get all public feedback items (for regular users)
router.get('/', async (req, res) => {
    try {
        const sql = `
            SELECT 
                f.id,
                f.type,
                f.title,
                f.description,
                f.status,
                f.priority,
                f.authorName,
                f.developerNotes,
                f.estimatedCompletion,
                f.createdAt,
                f.updatedAt,
                f.completedAt
            FROM app_feedback f
            WHERE f.isPublic = TRUE
            ORDER BY 
                CASE f.status 
                    WHEN 'in_progress' THEN 1
                    WHEN 'approved' THEN 2
                    WHEN 'completed' THEN 3
                    WHEN 'pending' THEN 4
                    WHEN 'rejected' THEN 5
                END,
                f.priority DESC,
                f.createdAt DESC
        `;
        
        let results = await query(sql);
        results = await attachImagesToFeedback(results);
        
        res.status(200).json({
            success: true,
            data: results,
            message: `Retrieved ${results.length} feedback items`
        });
    } catch (error) {
        console.error('[Feedback] Error fetching feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching feedback',
            error: error.message
        });
    }
});

// GET /api/feedback/all - Get ALL feedback items (developer only)
router.get('/all', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Check if user is developer
        const canManage = await isDeveloper(userId);
        if (!canManage) {
            return res.status(403).json({
                success: false,
                message: 'Only the developer can view all feedback items'
            });
        }

        const sql = `
            SELECT 
                f.id,
                f.type,
                f.title,
                f.description,
                f.status,
                f.priority,
                f.authorId,
                f.authorName,
                f.developerNotes,
                f.isPublic,
                f.estimatedCompletion,
                f.createdAt,
                f.updatedAt,
                f.completedAt
            FROM app_feedback f
            ORDER BY 
                CASE f.status 
                    WHEN 'pending' THEN 1
                    WHEN 'in_progress' THEN 2
                    WHEN 'approved' THEN 3
                    WHEN 'completed' THEN 4
                    WHEN 'rejected' THEN 5
                END,
                f.priority DESC,
                f.createdAt DESC
        `;
        
        let results = await query(sql);
        results = await attachImagesToFeedback(results);
        
        res.status(200).json({
            success: true,
            data: results,
            message: `Retrieved ${results.length} feedback items`
        });
    } catch (error) {
        console.error('[Feedback] Error fetching all feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching feedback',
            error: error.message
        });
    }
});

// POST /api/feedback - Submit new bug report or feature request
router.post('/', verifyToken, async (req, res) => {
    try {
        const { type, title, description, images } = req.body;
        const userId = req.user.userId;

        if (!type || !title || !description) {
            return res.status(400).json({
                success: false,
                message: 'Type, title, and description are required'
            });
        }

        if (!['bug', 'feature'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "bug" or "feature"'
            });
        }

        // Get user's name
        const [user] = await query('SELECT lagnname FROM activeusers WHERE id = ?', [userId]);
        const authorName = user?.lagnname || 'Unknown User';

        const insertSql = `
            INSERT INTO app_feedback (type, title, description, authorId, authorName, status, isPublic)
            VALUES (?, ?, ?, ?, ?, 'pending', FALSE)
        `;
        
        const result = await query(insertSql, [type, title.trim(), description.trim(), userId, authorName]);
        const feedbackId = result.insertId;

        // Insert images if provided
        if (images && Array.isArray(images) && images.length > 0) {
            const imageValues = [];
            const imagePlaceholders = images.map((img, idx) => {
                imageValues.push(feedbackId, img.url, img.deleteHash || null, img.caption || null, idx);
                return '(?, ?, ?, ?, ?)';
            }).join(',');

            const imagesSql = `
                INSERT INTO app_feedback_images (feedbackId, url, deleteHash, caption, sortOrder)
                VALUES ${imagePlaceholders}
            `;
            await query(imagesSql, imageValues);
        }

        res.status(201).json({
            success: true,
            data: { id: feedbackId },
            message: 'Feedback submitted successfully. It will be reviewed by the developer.'
        });
    } catch (error) {
        console.error('[Feedback] Error submitting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting feedback',
            error: error.message
        });
    }
});

// PUT /api/feedback/:id - Update feedback item (developer only)
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { status, priority, developerNotes, isPublic, estimatedCompletion, title, description } = req.body;

        // Check if user is developer
        const canManage = await isDeveloper(userId);
        if (!canManage) {
            return res.status(403).json({
                success: false,
                message: 'Only the developer can update feedback items'
            });
        }

        // Check if feedback exists
        const [existing] = await query('SELECT id FROM app_feedback WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Feedback item not found'
            });
        }

        // Validate status if provided
        const validStatuses = ['pending', 'approved', 'in_progress', 'completed', 'rejected'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Validate priority if provided
        const validPriorities = ['low', 'medium', 'high'];
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid priority'
            });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title.trim());
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description.trim());
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
            
            // Set completedAt if status is completed
            if (status === 'completed') {
                updates.push('completedAt = NOW()');
            } else {
                updates.push('completedAt = NULL');
            }
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            values.push(priority);
        }
        if (developerNotes !== undefined) {
            updates.push('developerNotes = ?');
            values.push(developerNotes);
        }
        if (isPublic !== undefined) {
            updates.push('isPublic = ?');
            values.push(isPublic ? 1 : 0);
        }
        if (estimatedCompletion !== undefined) {
            updates.push('estimatedCompletion = ?');
            values.push(estimatedCompletion || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        values.push(id);
        const updateSql = `UPDATE app_feedback SET ${updates.join(', ')} WHERE id = ?`;
        await query(updateSql, values);

        res.status(200).json({
            success: true,
            message: 'Feedback updated successfully'
        });
    } catch (error) {
        console.error('[Feedback] Error updating feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating feedback',
            error: error.message
        });
    }
});

// DELETE /api/feedback/:id - Delete feedback item (developer only)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if user is developer
        const canManage = await isDeveloper(userId);
        if (!canManage) {
            return res.status(403).json({
                success: false,
                message: 'Only the developer can delete feedback items'
            });
        }

        // Check if feedback exists
        const [existing] = await query('SELECT id FROM app_feedback WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Feedback item not found'
            });
        }

        await query('DELETE FROM app_feedback WHERE id = ?', [id]);

        res.status(200).json({
            success: true,
            message: 'Feedback deleted successfully'
        });
    } catch (error) {
        console.error('[Feedback] Error deleting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting feedback',
            error: error.message
        });
    }
});

// GET /api/feedback/check-developer - Check if current user is the developer
router.get('/check-developer', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const canManage = await isDeveloper(userId);
        
        res.status(200).json({
            success: true,
            isDeveloper: canManage
        });
    } catch (error) {
        console.error('[Feedback] Error checking developer status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking developer status',
            error: error.message
        });
    }
});

// POST /api/feedback/:id/images - Add images to existing feedback
router.post('/:id/images', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { images } = req.body;
        const userId = req.user.userId;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No images provided'
            });
        }

        // Check if feedback exists and user owns it or is developer
        const [feedback] = await query('SELECT authorId FROM app_feedback WHERE id = ?', [id]);
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback item not found'
            });
        }

        const canManage = await isDeveloper(userId);
        if (feedback.authorId !== userId && !canManage) {
            return res.status(403).json({
                success: false,
                message: 'You can only add images to your own feedback'
            });
        }

        // Get current max sortOrder
        const [maxOrder] = await query(
            'SELECT COALESCE(MAX(sortOrder), -1) as maxOrder FROM app_feedback_images WHERE feedbackId = ?',
            [id]
        );
        let nextOrder = (maxOrder?.maxOrder || -1) + 1;

        const imageValues = [];
        const imagePlaceholders = images.map((img) => {
            imageValues.push(id, img.url, img.deleteHash || null, img.caption || null, nextOrder++);
            return '(?, ?, ?, ?, ?)';
        }).join(',');

        const imagesSql = `
            INSERT INTO app_feedback_images (feedbackId, url, deleteHash, caption, sortOrder)
            VALUES ${imagePlaceholders}
        `;
        await query(imagesSql, imageValues);

        res.status(201).json({
            success: true,
            message: 'Images added successfully'
        });
    } catch (error) {
        console.error('[Feedback] Error adding images:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding images',
            error: error.message
        });
    }
});

// DELETE /api/feedback/:id/images/:imageId - Delete an image from feedback
router.delete('/:id/images/:imageId', verifyToken, async (req, res) => {
    try {
        const { id, imageId } = req.params;
        const userId = req.user.userId;

        // Check if feedback exists and user owns it or is developer
        const [feedback] = await query('SELECT authorId FROM app_feedback WHERE id = ?', [id]);
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback item not found'
            });
        }

        const canManage = await isDeveloper(userId);
        if (feedback.authorId !== userId && !canManage) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete images from your own feedback'
            });
        }

        // Check if image exists and belongs to this feedback
        const [image] = await query(
            'SELECT id FROM app_feedback_images WHERE id = ? AND feedbackId = ?',
            [imageId, id]
        );
        if (!image) {
            return res.status(404).json({
                success: false,
                message: 'Image not found'
            });
        }

        await query('DELETE FROM app_feedback_images WHERE id = ?', [imageId]);

        res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('[Feedback] Error deleting image:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting image',
            error: error.message
        });
    }
});

module.exports = router;

