const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const verifyToken = require('../middleware/verifyToken');
const { query } = require('../db');

// Mount roleplay sub-routes
const roleplayRoutes = require('./roleplay');
router.use('/roleplay', roleplayRoutes);

// GET /api/training/updates - Get all updates
// Helper to normalize a URL or path to just a path starting with '/'
function normalizeToPathOnly(input) {
    if (!input || typeof input !== 'string') return null;
    try {
        // Already a path
        if (input.startsWith('/')) {
            return input;
        }
        // Try to parse as URL and extract pathname and search
        const u = new URL(input);
        const pathWithQuery = `${u.pathname}${u.search || ''}`;
        return pathWithQuery || '/';
    } catch (_) {
        // Fallback: ensure it begins with '/'
        return input.startsWith('/') ? input : `/${input}`;
    }
}

router.get('/updates', async (req, res) => {
    try {
        const updatesQuery = `
            SELECT 
                u.id,
                u.title,
                u.content,
                u.type,
                u.priority,
                u.tutorialUrl,
                u.pageUrl,
                u.releaseId,
                u.version,
                u.targetDevice,
                r.version AS releaseVersion,
                r.title   AS releaseTitle,
                u.createdAt,
                u.updatedAt,
                au.lagnname as authorName
            FROM app_updates u
            LEFT JOIN activeusers au ON u.authorId = au.id
            LEFT JOIN app_releases r ON r.id = u.releaseId
            ORDER BY u.createdAt DESC
        `;

        const updates = await query(updatesQuery);

        // Attach images to each update (if any)
        const updateIds = Array.isArray(updates) ? updates.map(u => u.id) : [];
        let imagesByUpdateId = {};
        if (updateIds.length > 0) {
            const placeholders = updateIds.map(() => '?').join(',');
            const imagesSql = `
                SELECT updateId, id, url, deleteHash, caption, sortOrder
                FROM app_update_images
                WHERE updateId IN (${placeholders})
                ORDER BY sortOrder, id
            `;
            const imagesRows = await query(imagesSql, updateIds);
            imagesByUpdateId = imagesRows.reduce((acc, row) => {
                if (!acc[row.updateId]) acc[row.updateId] = [];
                acc[row.updateId].push({
                    id: row.id,
                    url: row.url,
                    deleteHash: row.deleteHash,
                    caption: row.caption,
                    sortOrder: row.sortOrder
                });
                return acc;
            }, {});
        }

        const enriched = updates.map(u => ({
            ...u,
            images: imagesByUpdateId[u.id] || []
        }));

        res.status(200).json({
            success: true,
            data: enriched,
            message: `Retrieved ${enriched.length} updates`
        });
    } catch (error) {
        console.error('[Training] Error fetching updates:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching updates',
            error: error.message
        });
    }
});

// GET /api/training/releases - List releases with child update counts
router.get('/releases', async (req, res) => {
    try {
        const sql = `
            SELECT r.id, r.version, r.title, r.notes, r.createdAt,
                   COALESCE(cnt.numUpdates, 0) AS updatesCount
            FROM app_releases r
            LEFT JOIN (
              SELECT releaseId, COUNT(*) AS numUpdates
              FROM app_updates
              WHERE releaseId IS NOT NULL
              GROUP BY releaseId
            ) cnt ON cnt.releaseId = r.id
            ORDER BY r.createdAt DESC
        `;
        const rows = await query(sql);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('[Training] Error fetching releases:', error);
        res.status(500).json({ success: false, message: 'Error fetching releases', error: error.message });
    }
});

// POST /api/training/releases - Create a new release (Admin/App team only)
router.post('/releases', verifyToken, async (req, res) => {
    try {
        const { version = null, title = null, notes = null } = req.body || {};
        const userId = req.user.userId;

        const [userResult] = await query('SELECT Role, teamRole FROM activeusers WHERE id = ?', [userId]);
        if (!userResult || (userResult.Role !== 'Admin' && userResult.teamRole !== 'app')) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions to create releases' });
        }

        if (!version && !title) {
            return res.status(400).json({ success: false, message: 'Version or title is required' });
        }

        const insertSql = `INSERT INTO app_releases (version, title, notes, createdAt) VALUES (?, ?, ?, NOW())`;
        const result = await query(insertSql, [version, title, notes]);
        res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Release created' });
    } catch (error) {
        console.error('[Training] Error creating release:', error);
        res.status(500).json({ success: false, message: 'Error creating release', error: error.message });
    }
});

// POST /api/training/updates - Create new update (Admin/App team only)
router.post('/updates', verifyToken, async (req, res) => {
    try {
        let { title, content, type = 'update', priority = 'normal', tutorialUrl = null, pageUrl = null, releaseId = null, version = null, targetDevice = null } = req.body;
        const userId = req.user.userId;

        // Check if user can create updates (Admin or app team)
        const userCheckQuery = `
            SELECT Role, teamRole 
            FROM activeusers 
            WHERE id = ?
        `;
        const [userResult] = await query(userCheckQuery, [userId]);

        if (!userResult || (userResult.Role !== 'Admin' && userResult.teamRole !== 'app')) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to create updates'
            });
        }

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        // Validate type and priority
        const validTypes = ['update', 'feature', 'bugfix'];
        const validPriorities = ['low', 'normal', 'high'];

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid update type'
            });
        }

        if (!validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid priority level'
            });
        }

        // Normalize links to path-only
        tutorialUrl = normalizeToPathOnly(tutorialUrl);
        pageUrl = normalizeToPathOnly(pageUrl);

        // Validate targetDevice if provided
        if (targetDevice && !['mobile', 'desktop'].includes(targetDevice)) {
            return res.status(400).json({ success: false, message: 'Invalid targetDevice' });
        }

        const insertQuery = `
            INSERT INTO app_updates (title, content, type, priority, tutorialUrl, pageUrl, releaseId, version, targetDevice, authorId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;

        const result = await query(insertQuery, [title, content, type, priority, tutorialUrl, pageUrl, releaseId, version, targetDevice, userId]);

        res.status(201).json({
            success: true,
            data: { id: result.insertId },
            message: 'Update created successfully'
        });
    } catch (error) {
        console.error('[Training] Error creating update:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating update',
            error: error.message
        });
    }
});

// PUT /api/training/updates/:id - Update existing update (Admin/App team only)
router.put('/updates/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        let { title, content, type, priority, tutorialUrl = null, pageUrl = null, releaseId = null, version = null, targetDevice = null } = req.body;
        const userId = req.user.userId;

        // Check if user can edit updates (Admin or app team)
        const userCheckQuery = `
            SELECT Role, teamRole 
            FROM activeusers 
            WHERE id = ?
        `;
        const [userResult] = await query(userCheckQuery, [userId]);

        if (!userResult || (userResult.Role !== 'Admin' && userResult.teamRole !== 'app')) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to edit updates'
            });
        }

        // Check if update exists
        const existingUpdateQuery = `
            SELECT id FROM app_updates WHERE id = ?
        `;
        const [existingUpdate] = await query(existingUpdateQuery, [id]);

        if (!existingUpdate) {
            return res.status(404).json({
                success: false,
                message: 'Update not found'
            });
        }

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        // Validate type and priority
        const validTypes = ['update', 'feature', 'bugfix'];
        const validPriorities = ['low', 'normal', 'high'];

        if (type && !validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid update type'
            });
        }

        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid priority level'
            });
        }

        // Normalize links to path-only
        tutorialUrl = normalizeToPathOnly(tutorialUrl);
        pageUrl = normalizeToPathOnly(pageUrl);

        if (targetDevice && !['mobile', 'desktop'].includes(targetDevice)) {
            return res.status(400).json({ success: false, message: 'Invalid targetDevice' });
        }

        const updateQuery = `
            UPDATE app_updates 
            SET title = ?, content = ?, type = ?, priority = ?, tutorialUrl = ?, pageUrl = ?, releaseId = ?, version = ?, targetDevice = ?, updatedAt = NOW()
            WHERE id = ?
        `;

        await query(updateQuery, [title, content, type, priority, tutorialUrl, pageUrl, releaseId, version, targetDevice, id]);

        res.status(200).json({
            success: true,
            data: { id },
            message: 'Update updated successfully'
        });
    } catch (error) {
        console.error('[Training] Error updating update:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating update',
            error: error.message
        });
    }
});

// DELETE /api/training/updates/:id - Delete update (Admin/App team only)
router.delete('/updates/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if user can delete updates (Admin or app team)
        const userCheckQuery = `
            SELECT Role, teamRole 
            FROM activeusers 
            WHERE id = ?
        `;
        const [userResult] = await query(userCheckQuery, [userId]);

        if (!userResult || (userResult.Role !== 'Admin' && userResult.teamRole !== 'app')) {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions to delete updates'
            });
        }

        // Check if update exists
        const existingUpdateQuery = `
            SELECT id FROM app_updates WHERE id = ?
        `;
        const [existingUpdate] = await query(existingUpdateQuery, [id]);

        if (!existingUpdate) {
            return res.status(404).json({
                success: false,
                message: 'Update not found'
            });
        }

        const deleteQuery = `
            DELETE FROM app_updates WHERE id = ?
        `;

        await query(deleteQuery, [id]);

        res.status(200).json({
            success: true,
            message: 'Update deleted successfully'
        });
    } catch (error) {
        console.error('[Training] Error deleting update:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting update',
            error: error.message
        });
    }
});

// POST /api/training/updates/:id/images - Attach images to an update
router.post('/updates/:id/images', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { images } = req.body; // [{url, deleteHash, caption, sortOrder}]

        if (!Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, message: 'No images provided' });
        }

        // Ensure update exists
        const [existingUpdate] = await query('SELECT id FROM app_updates WHERE id = ?', [id]);
        if (!existingUpdate) {
            return res.status(404).json({ success: false, message: 'Update not found' });
        }

        // Insert images
        const values = [];
        const placeholders = images.map(img => {
            values.push(id, img.url || null, img.deleteHash || null, img.caption || null, img.sortOrder ?? 0);
            return '(?, ?, ?, ?, ?)';
        }).join(',');

        const insertSql = `
            INSERT INTO app_update_images (updateId, url, deleteHash, caption, sortOrder)
            VALUES ${placeholders}
        `;

        await query(insertSql, values);

        res.status(201).json({ success: true, message: 'Images attached successfully' });
    } catch (error) {
        console.error('[Training] Error attaching images:', error);
        res.status(500).json({ success: false, message: 'Error attaching images', error: error.message });
    }
});

// GET /api/training/updates/:id/images - Get images for an update
router.get('/updates/:id/images', async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await query('SELECT id, url, deleteHash, caption, sortOrder FROM app_update_images WHERE updateId = ? ORDER BY sortOrder, id', [id]);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('[Training] Error fetching update images:', error);
        res.status(500).json({ success: false, message: 'Error fetching update images', error: error.message });
    }
});

// DELETE /api/training/updates/:id/images/:imageId - Delete a specific image from an update
router.delete('/updates/:id/images/:imageId', verifyToken, async (req, res) => {
    try {
        const { id, imageId } = req.params;
        const userId = req.user.userId;

        // Check if user can edit updates (Admin or app team)
        const [userResult] = await query('SELECT Role, teamRole FROM activeusers WHERE id = ?', [userId]);
        if (!userResult || (userResult.Role !== 'Admin' && userResult.teamRole !== 'app')) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions to delete image' });
        }

        // Ensure image belongs to the update
        const [img] = await query('SELECT id FROM app_update_images WHERE id = ? AND updateId = ?', [imageId, id]);
        if (!img) {
            return res.status(404).json({ success: false, message: 'Image not found for this update' });
        }

        await query('DELETE FROM app_update_images WHERE id = ?', [imageId]);
        res.status(200).json({ success: true, message: 'Image deleted' });
    } catch (error) {
        console.error('[Training] Error deleting update image:', error);
        res.status(500).json({ success: false, message: 'Error deleting update image', error: error.message });
    }
});

module.exports = router;
