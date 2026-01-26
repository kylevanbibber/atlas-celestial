const express = require('express');
const router = express.Router();
const db = require('../db.js');
const verifyToken = require('../middleware/verifyToken');

/**
 * Get all SGAs with their alternative names
 * GET /api/sgas
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { includeHidden, includeInactive } = req.query;

    let whereConditions = [];
    if (includeHidden !== 'true') {
      whereConditions.push('s.hide = 0');
    }
    if (includeInactive !== 'true') {
      whereConditions.push('s.active = 1');
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get all SGAs with their alternative names
    const query = `
      SELECT 
        s.id,
        s.rept_name,
        s.display_name,
        s.active,
        s.hide,
        s.is_default,
        s.created,
        s.updated,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.is_default DESC, s.rept_name ASC
    `;

    const sgas = await db.query(query);

    // Format the response
    const formattedSgas = sgas.map(sga => ({
      ...sga,
      alternative_names: sga.alternative_names 
        ? sga.alternative_names.split('|').filter(Boolean) 
        : []
    }));

    res.json({
      success: true,
      data: formattedSgas
    });
  } catch (error) {
    console.error('[SGAs] Error fetching SGAs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SGAs',
      error: error.message
    });
  }
});

/**
 * Get a single SGA by ID with alternative names
 * GET /api/sgas/:id
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get SGA details
    const sgaQuery = 'SELECT * FROM sgas WHERE id = ?';
    const sgas = await db.query(sgaQuery, [id]);

    if (!sgas || sgas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SGA not found'
      });
    }

    // Get alternative names
    const altNamesQuery = `
      SELECT id, alternative_name, created 
      FROM sga_alternative_names 
      WHERE sga_id = ?
      ORDER BY alternative_name ASC
    `;
    const alternativeNames = await db.query(altNamesQuery, [id]);

    res.json({
      success: true,
      data: {
        ...sgas[0],
        alternative_names: alternativeNames
      }
    });
  } catch (error) {
    console.error('[SGAs] Error fetching SGA:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SGA',
      error: error.message
    });
  }
});

/**
 * Create a new SGA
 * POST /api/sgas
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { rept_name, display_name, active, hide, alternative_names } = req.body;

    if (!rept_name) {
      return res.status(400).json({
        success: false,
        message: 'rept_name is required'
      });
    }

    // Check if rept_name already exists
    const existingQuery = 'SELECT id FROM sgas WHERE rept_name = ?';
    const existing = await db.query(existingQuery, [rept_name]);

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An SGA with this report name already exists'
      });
    }

    // Insert new SGA
    const insertQuery = `
      INSERT INTO sgas (rept_name, display_name, active, hide, is_default)
      VALUES (?, ?, ?, ?, 0)
    `;
    const result = await db.query(insertQuery, [
      rept_name,
      display_name || null,
      active !== undefined ? active : 1,
      hide !== undefined ? hide : 0
    ]);

    const newSgaId = result.insertId;

    // Add alternative names if provided
    if (alternative_names && Array.isArray(alternative_names) && alternative_names.length > 0) {
      const altNamesQuery = `
        INSERT INTO sga_alternative_names (sga_id, alternative_name)
        VALUES ?
      `;
      const altNamesValues = alternative_names
        .filter(name => name && name.trim())
        .map(name => [newSgaId, name.trim()]);

      if (altNamesValues.length > 0) {
        await db.query(altNamesQuery, [altNamesValues]);
      }
    }

    // Fetch the newly created SGA
    const newSgaQuery = `
      SELECT 
        s.*,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.id = ?
      GROUP BY s.id
    `;
    const newSgas = await db.query(newSgaQuery, [newSgaId]);
    const newSga = newSgas[0];

    res.json({
      success: true,
      message: 'SGA created successfully',
      data: {
        ...newSga,
        alternative_names: newSga.alternative_names 
          ? newSga.alternative_names.split('|').filter(Boolean) 
          : []
      }
    });
  } catch (error) {
    console.error('[SGAs] Error creating SGA:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating SGA',
      error: error.message
    });
  }
});

/**
 * Update an SGA
 * PUT /api/sgas/:id
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rept_name, display_name, active, hide, alternative_names } = req.body;

    // Check if SGA exists
    const checkQuery = 'SELECT id, is_default FROM sgas WHERE id = ?';
    const existing = await db.query(checkQuery, [id]);

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SGA not found'
      });
    }

    // Prevent disabling the default SGA
    if (existing[0].is_default === 1 && active === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate the default SGA'
      });
    }

    // Update SGA
    const updateQuery = `
      UPDATE sgas 
      SET rept_name = ?, display_name = ?, active = ?, hide = ?
      WHERE id = ?
    `;
    await db.query(updateQuery, [
      rept_name,
      display_name || null,
      active !== undefined ? active : 1,
      hide !== undefined ? hide : 0,
      id
    ]);

    // Update alternative names if provided
    if (alternative_names !== undefined && Array.isArray(alternative_names)) {
      // Delete existing alternative names
      await db.query('DELETE FROM sga_alternative_names WHERE sga_id = ?', [id]);

      // Insert new alternative names
      if (alternative_names.length > 0) {
        const altNamesQuery = `
          INSERT INTO sga_alternative_names (sga_id, alternative_name)
          VALUES ?
        `;
        const altNamesValues = alternative_names
          .filter(name => name && name.trim())
          .map(name => [id, name.trim()]);

        if (altNamesValues.length > 0) {
          await db.query(altNamesQuery, [altNamesValues]);
        }
      }
    }

    // Fetch updated SGA
    const updatedQuery = `
      SELECT 
        s.*,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.id = ?
      GROUP BY s.id
    `;
    const updated = await db.query(updatedQuery, [id]);

    res.json({
      success: true,
      message: 'SGA updated successfully',
      data: {
        ...updated[0],
        alternative_names: updated[0].alternative_names 
          ? updated[0].alternative_names.split('|').filter(Boolean) 
          : []
      }
    });
  } catch (error) {
    console.error('[SGAs] Error updating SGA:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating SGA',
      error: error.message
    });
  }
});

/**
 * Delete an SGA
 * DELETE /api/sgas/:id
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if SGA exists and is not default
    const checkQuery = 'SELECT id, is_default, rept_name FROM sgas WHERE id = ?';
    const existing = await db.query(checkQuery, [id]);

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SGA not found'
      });
    }

    if (existing[0].is_default === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the default SGA'
      });
    }

    // Delete SGA (alternative names will be cascade deleted)
    await db.query('DELETE FROM sgas WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `SGA "${existing[0].rept_name}" deleted successfully`
    });
  } catch (error) {
    console.error('[SGAs] Error deleting SGA:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting SGA',
      error: error.message
    });
  }
});

/**
 * Get default SGA
 * GET /api/sgas/default
 */
router.get('/default/get', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.is_default = 1
      GROUP BY s.id
    `;
    const result = await db.query(query);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No default SGA found'
      });
    }

    res.json({
      success: true,
      data: {
        ...result[0],
        alternative_names: result[0].alternative_names 
          ? result[0].alternative_names.split('|').filter(Boolean) 
          : []
      }
    });
  } catch (error) {
    console.error('[SGAs] Error fetching default SGA:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching default SGA',
      error: error.message
    });
  }
});

/**
 * Find SGA by any name (primary or alternative)
 * GET /api/sgas/lookup/:name
 */
router.get('/lookup/:name', verifyToken, async (req, res) => {
  try {
    const { name } = req.params;

    const query = `
      SELECT DISTINCT
        s.id,
        s.rept_name,
        s.display_name,
        s.active,
        s.hide,
        s.is_default,
        s.created,
        s.updated
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.rept_name = ? 
         OR san.alternative_name = ?
         OR s.display_name = ?
      LIMIT 1
    `;

    const result = await db.query(query, [name, name, name]);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SGA not found'
      });
    }

    // Get alternative names for the found SGA
    const altNamesQuery = `
      SELECT alternative_name 
      FROM sga_alternative_names 
      WHERE sga_id = ?
    `;
    const alternativeNames = await db.query(altNamesQuery, [result[0].id]);

    res.json({
      success: true,
      data: {
        ...result[0],
        alternative_names: alternativeNames.map(an => an.alternative_name)
      }
    });
  } catch (error) {
    console.error('[SGAs] Error looking up SGA:', error);
    res.status(500).json({
      success: false,
      message: 'Error looking up SGA',
      error: error.message
    });
  }
});

/**
 * Get agencies for a specific user (with page permissions)
 * GET /api/sgas/user/:userId/agencies
 */
router.get('/user/:userId/agencies', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        s.id,
        s.rept_name,
        s.display_name,
        s.is_default,
        ua.is_primary,
        GROUP_CONCAT(DISTINCT san.alternative_name SEPARATOR '|') as alternative_names
      FROM user_agencies ua
      JOIN sgas s ON ua.sga_id = s.id
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE ua.user_id = ? AND s.active = 1 AND s.hide = 0
      GROUP BY s.id, ua.is_primary
      ORDER BY ua.is_primary DESC, s.is_default DESC, s.rept_name ASC
    `;

    const agencies = await db.query(query, [userId]);

    // Get page permissions for each agency
    const agenciesWithPermissions = await Promise.all(agencies.map(async (agency) => {
      const permissionsQuery = `
        SELECT page_key
        FROM sga_page_permissions
        WHERE sga_id = ?
        ORDER BY page_key
      `;
      
      const permissions = await db.query(permissionsQuery, [agency.id]);
      
      console.log('[SGAs API] Fetched permissions for agency:', {
        agencyId: agency.id,
        agencyName: agency.rept_name,
        permissionsCount: permissions.length,
        permissions: permissions.map(p => p.page_key)
      });
      
      return {
        ...agency,
        alternative_names: agency.alternative_names 
          ? agency.alternative_names.split('|').filter(Boolean) 
          : [],
        allowed_pages: permissions.map(p => p.page_key)
      };
    }));

    res.json({
      success: true,
      data: agenciesWithPermissions
    });
  } catch (error) {
    console.error('[SGAs] Error fetching user agencies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user agencies',
      error: error.message
    });
  }
});

/**
 * Get user's currently selected agency
 * GET /api/sgas/user/:userId/selected
 */
router.get('/user/:userId/selected', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        s.id,
        s.rept_name,
        s.display_name,
        s.is_default,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM user_selected_agency usa
      JOIN sgas s ON usa.sga_id = s.id
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE usa.user_id = ?
      GROUP BY s.id
    `;

    const result = await db.query(query, [userId]);

    if (!result || result.length === 0) {
      // Return default SGA if no selection
      const defaultQuery = `
        SELECT 
          s.id,
          s.rept_name,
          s.display_name,
          s.is_default,
          GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
        FROM sgas s
        LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
        WHERE s.is_default = 1
        GROUP BY s.id
      `;
      const defaultResult = await db.query(defaultQuery);
      
      if (defaultResult && defaultResult.length > 0) {
        // Get permissions for default agency
        const permissionsQuery = `
          SELECT page_key
          FROM sga_page_permissions
          WHERE sga_id = ?
          ORDER BY page_key
        `;
        const permissions = await db.query(permissionsQuery, [defaultResult[0].id]);
        
        console.log('[SGAs API] Fetched permissions for default selected agency:', {
          agencyId: defaultResult[0].id,
          agencyName: defaultResult[0].rept_name,
          permissionsCount: permissions.length,
          permissions: permissions.map(p => p.page_key)
        });
        
        return res.json({
          success: true,
          data: {
            ...defaultResult[0],
            alternative_names: defaultResult[0].alternative_names 
              ? defaultResult[0].alternative_names.split('|').filter(Boolean) 
              : [],
            allowed_pages: permissions.map(p => p.page_key)
          }
        });
      }
    }

    // Get permissions for selected agency
    const permissionsQuery = `
      SELECT page_key
      FROM sga_page_permissions
      WHERE sga_id = ?
      ORDER BY page_key
    `;
    const permissions = await db.query(permissionsQuery, [result[0].id]);
    
    console.log('[SGAs API] Fetched permissions for selected agency:', {
      agencyId: result[0].id,
      agencyName: result[0].rept_name,
      permissionsCount: permissions.length,
      permissions: permissions.map(p => p.page_key)
    });

    res.json({
      success: true,
      data: {
        ...result[0],
        alternative_names: result[0].alternative_names 
          ? result[0].alternative_names.split('|').filter(Boolean) 
          : [],
        allowed_pages: permissions.map(p => p.page_key)
      }
    });
  } catch (error) {
    console.error('[SGAs] Error fetching selected agency:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching selected agency',
      error: error.message
    });
  }
});

/**
 * Set user's selected agency
 * POST /api/sgas/user/:userId/selected
 */
router.post('/user/:userId/selected', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { sgaId } = req.body;

    // Verify user has access to this agency
    const accessQuery = 'SELECT id FROM user_agencies WHERE user_id = ? AND sga_id = ?';
    const access = await db.query(accessQuery, [userId, sgaId]);

    if (!access || access.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User does not have access to this agency'
      });
    }

    // Update or insert selected agency
    const updateQuery = `
      INSERT INTO user_selected_agency (user_id, sga_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE sga_id = ?, updated = NOW()
    `;
    await db.query(updateQuery, [userId, sgaId, sgaId]);

    // Get the updated selection
    const selectedQuery = `
      SELECT 
        s.id,
        s.rept_name,
        s.display_name,
        s.is_default,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM user_selected_agency usa
      JOIN sgas s ON usa.sga_id = s.id
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE usa.user_id = ?
      GROUP BY s.id
    `;
    const result = await db.query(selectedQuery, [userId]);

    res.json({
      success: true,
      message: 'Selected agency updated successfully',
      data: {
        ...result[0],
        alternative_names: result[0].alternative_names 
          ? result[0].alternative_names.split('|').filter(Boolean) 
          : []
      }
    });
  } catch (error) {
    console.error('[SGAs] Error updating selected agency:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating selected agency',
      error: error.message
    });
  }
});

/**
 * Add agency access for a user
 * POST /api/sgas/user/:userId/agencies
 */
router.post('/user/:userId/agencies', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { sgaId, isPrimary } = req.body;

    const insertQuery = `
      INSERT INTO user_agencies (user_id, sga_id, is_primary)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_primary = ?
    `;
    await db.query(insertQuery, [userId, sgaId, isPrimary ? 1 : 0, isPrimary ? 1 : 0]);

    res.json({
      success: true,
      message: 'Agency access added successfully'
    });
  } catch (error) {
    console.error('[SGAs] Error adding agency access:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding agency access',
      error: error.message
    });
  }
});

/**
 * Remove agency access for a user
 * DELETE /api/sgas/user/:userId/agencies/:sgaId
 */
router.delete('/user/:userId/agencies/:sgaId', verifyToken, async (req, res) => {
  try {
    const { userId, sgaId } = req.params;

    await db.query('DELETE FROM user_agencies WHERE user_id = ? AND sga_id = ?', [userId, sgaId]);

    res.json({
      success: true,
      message: 'Agency access removed successfully'
    });
  } catch (error) {
    console.error('[SGAs] Error removing agency access:', error);
    res.json({
      success: false,
      message: 'Error removing agency access',
      error: error.message
    });
  }
});

/**
 * Get page permissions for a specific SGA
 * GET /api/sgas/:sgaId/permissions
 */
router.get('/:sgaId/permissions', verifyToken, async (req, res) => {
  try {
    const { sgaId } = req.params;

    const query = `
      SELECT page_key
      FROM sga_page_permissions
      WHERE sga_id = ?
      ORDER BY page_key
    `;

    const permissions = await db.query(query, [sgaId]);

    res.json({
      success: true,
      data: permissions.map(p => p.page_key)
    });
  } catch (error) {
    console.error('[SGAs] Error fetching SGA permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SGA permissions',
      error: error.message
    });
  }
});

/**
 * Update page permissions for an SGA
 * PUT /api/sgas/:sgaId/permissions
 * Body: { page_keys: ['production', 'recruiting', ...] }
 */
router.put('/:sgaId/permissions', verifyToken, async (req, res) => {
  try {
    const { sgaId } = req.params;
    const { page_keys } = req.body;

    if (!Array.isArray(page_keys)) {
      return res.status(400).json({
        success: false,
        message: 'page_keys must be an array'
      });
    }

    // Delete all existing permissions for this SGA
    await db.query('DELETE FROM sga_page_permissions WHERE sga_id = ?', [sgaId]);

    // Insert new permissions
    if (page_keys.length > 0) {
      const values = page_keys.map(key => [sgaId, key]);
      await db.query(
        'INSERT INTO sga_page_permissions (sga_id, page_key) VALUES ?',
        [values]
      );
    }

    res.json({
      success: true,
      message: 'Page permissions updated successfully'
    });
  } catch (error) {
    console.error('[SGAs] Error updating permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating permissions',
      error: error.message
    });
  }
});

/**
 * Check if user has access to a specific page through their selected agency
 * GET /api/sgas/check-access/:pageKey
 */
router.get('/check-access/:pageKey', verifyToken, async (req, res) => {
  try {
    const { pageKey } = req.params;
    const userId = req.user?.userId || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get user's selected agency
    const selectedQuery = `
      SELECT usa.sga_id
      FROM user_selected_agency usa
      WHERE usa.user_id = ?
    `;
    const selected = await db.query(selectedQuery, [userId]);

    if (!selected || selected.length === 0) {
      // No selected agency, use default
      const defaultQuery = 'SELECT id FROM sgas WHERE is_default = 1 LIMIT 1';
      const defaultSga = await db.query(defaultQuery);
      
      if (!defaultSga || defaultSga.length === 0) {
        return res.json({ success: true, hasAccess: true }); // Fail open
      }
      
      selected[0] = { sga_id: defaultSga[0].id };
    }

    const sgaId = selected[0].sga_id;

    // Check if permission exists
    const permQuery = `
      SELECT COUNT(*) as count
      FROM sga_page_permissions
      WHERE sga_id = ? AND page_key = ?
    `;
    const perms = await db.query(permQuery, [sgaId, pageKey]);

    const hasAccess = perms && perms.length > 0 && perms[0].count > 0;

    res.json({
      success: true,
      hasAccess
    });
  } catch (error) {
    console.error('[SGAs] Error checking page access:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking page access',
      error: error.message
    });
  }
});

module.exports = router;

