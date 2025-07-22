/**
 * Team Customization Routes
 * -----------------------
 * API endpoints for managing team customization settings
 * including logos, colors, and layout preferences.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');

/**
 * @route GET /api/custom/settings/:userId
 * @desc Get custom settings for a user based on their team hierarchy
 * @access Private
 */
router.get('/settings/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First, get the user's team info
    const userResult = await query(
      'SELECT id, mga, rga, clname FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (userResult.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = userResult[0];
    
    // Query for customization settings based on user's team hierarchy
    // Prioritize RGA settings over MGA settings
    const customResult = await query(`
      SELECT tc.*
      FROM team_custom tc
      WHERE (tc.team_type = 'MGA' AND tc.team_id = ?) 
         OR (tc.team_type = 'RGA' AND tc.team_id = ?)
      ORDER BY tc.team_type = 'RGA' DESC
      LIMIT 1
    `, [user.mga, user.rga]);
    
    if (customResult.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No custom settings found, using defaults',
        settings: null
      });
    }
    
    // Return the custom settings
    res.json({
      success: true,
      settings: customResult[0]
    });
    
  } catch (error) {
    console.error('Error fetching custom settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route GET /api/custom/team/:teamType/:teamId
 * @desc Get custom settings for a specific team
 * @access Private (Admin, RGA, MGA only)
 */
router.get('/team/:teamType/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamType, teamId } = req.params;
    
    // Validate team type
    if (!['MGA', 'RGA'].includes(teamType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid team type' });
    }
    
    // Get team customization settings
    const teamSettings = await query(
      'SELECT * FROM team_custom WHERE team_type = ? AND team_id = ?',
      [teamType.toUpperCase(), teamId]
    );
    
    if (teamSettings.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No custom settings found for this team',
        settings: null
      });
    }
    
    res.json({
      success: true,
      settings: teamSettings[0]
    });
    
  } catch (error) {
    console.error('Error fetching team settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route POST /api/custom/team/:teamType/:teamId
 * @desc Create or update team custom settings
 * @access Private (Admin, RGA, MGA only)
 */
router.post('/team/:teamType/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamType, teamId } = req.params;
    const { 
      team_name,
      primary_color, 
      secondary_color, 
      accent_color, 
      custom_font,
      custom_css,
      dashboard_layout 
    } = req.body;
    
    // Validate team type
    if (!['MGA', 'RGA'].includes(teamType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid team type' });
    }
    
    // Validate colors if provided (simple hex validation)
    const validateHexColor = (color) => {
      return !color || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    };
    
    if (!validateHexColor(primary_color) || 
        !validateHexColor(secondary_color) || 
        !validateHexColor(accent_color)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid color format. Please use hex format (e.g., #007BFF)' 
      });
    }
    
    // Check if settings already exist for this team
    const existingSettings = await query(
      'SELECT id FROM team_custom WHERE team_type = ? AND team_id = ?',
      [teamType.toUpperCase(), teamId]
    );
    
    // Get user ID from token
    const userId = req.userId;
    
    let result;
    
    if (existingSettings.length > 0) {
      // Update existing settings
      result = await query(`
        UPDATE team_custom
        SET team_name = ?,
            primary_color = ?,
            secondary_color = ?,
            accent_color = ?,
            custom_font = ?,
            custom_css = ?,
            dashboard_layout = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE team_type = ? AND team_id = ?
      `, [
        team_name || 'Arias Organization',
        primary_color || null,
        secondary_color || null,
        accent_color || null,
        custom_font || null,
        custom_css || null,
        dashboard_layout ? JSON.stringify(dashboard_layout) : null,
        teamType.toUpperCase(),
        teamId
      ]);
      
      res.json({
        success: true,
        message: 'Team customization settings updated successfully'
      });
      
    } else {
      // Create new settings
      result = await query(`
        INSERT INTO team_custom (
          team_id,
          team_type,
          team_name,
          primary_color,
          secondary_color,
          accent_color,
          custom_font,
          custom_css,
          dashboard_layout,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        teamId,
        teamType.toUpperCase(),
        team_name || 'Arias Organization',
        primary_color || null,
        secondary_color || null,
        accent_color || null,
        custom_font || null,
        custom_css || null,
        dashboard_layout ? JSON.stringify(dashboard_layout) : null,
        userId
      ]);
      
      res.json({
        success: true,
        message: 'Team customization settings created successfully',
        id: result.insertId
      });
    }
    
  } catch (error) {
    console.error('Error updating team settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route POST /api/custom/logo/:teamType/:teamId
 * @desc Set or remove a logo URL for a team
 * @access Private (Admin, RGA, MGA only)
 */
router.post('/logo/:teamType/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamType, teamId } = req.params;
    const { logoUrl, logoWidth, logoHeight } = req.body;
    
    // Validate team type
    if (!['MGA', 'RGA'].includes(teamType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid team type' });
    }
    
    // Check if we're removing the logo (logoUrl is null)
    const isRemoving = logoUrl === null;
    
    // If setting a logo, logoUrl must be provided
    if (!isRemoving && !logoUrl) {
      return res.status(400).json({ success: false, message: 'No logo URL provided' });
    }
    
    // Default dimensions if not provided
    const width = logoWidth || 200;
    const height = logoHeight || 80;
    
    // Update the team_custom table with the new logo information
    const existingSettings = await query(
      'SELECT id FROM team_custom WHERE team_type = ? AND team_id = ?',
      [teamType.toUpperCase(), teamId]
    );
    
    if (existingSettings.length > 0) {
      // Update existing settings with new logo or remove logo
      await query(`
        UPDATE team_custom
        SET logo_url = ?,
            logo_width = ?,
            logo_height = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE team_type = ? AND team_id = ?
      `, [
        logoUrl,
        isRemoving ? null : width,
        isRemoving ? null : height,
        teamType.toUpperCase(),
        teamId
      ]);
      
      if (isRemoving) {
        return res.json({
          success: true,
          message: 'Logo removed successfully'
        });
      }
    } else if (!isRemoving) {
      // Only create new settings if we're not trying to remove a logo that doesn't exist
      await query(`
        INSERT INTO team_custom (
          team_id,
          team_type,
          logo_url,
          logo_width,
          logo_height,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        teamId,
        teamType.toUpperCase(),
        logoUrl,
        width,
        height,
        req.userId
      ]);
    } else {
      // If trying to remove a logo but no settings exist, just return success
      return res.json({
        success: true,
        message: 'No logo to remove'
      });
    }
    
    res.json({
      success: true,
      message: 'Logo updated successfully',
      logo: {
        url: logoUrl,
        width,
        height
      }
    });
    
  } catch (error) {
    console.error('Error updating logo:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route DELETE /api/custom/team/:teamType/:teamId
 * @desc Reset/remove custom settings for a team
 * @access Private (Admin, RGA, MGA only)
 */
router.delete('/team/:teamType/:teamId', verifyToken, async (req, res) => {
  try {
    const { teamType, teamId } = req.params;
    
    // Validate team type
    if (!['MGA', 'RGA'].includes(teamType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid team type' });
    }
    
    // Check if settings exist
    const existingSettings = await query(
      'SELECT logo_url FROM team_custom WHERE team_type = ? AND team_id = ?',
      [teamType.toUpperCase(), teamId]
    );
    
    if (existingSettings.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No custom settings found for this team' 
      });
    }
    
    // Delete the team settings
    await query(
      'DELETE FROM team_custom WHERE team_type = ? AND team_id = ?',
      [teamType.toUpperCase(), teamId]
    );
    
    res.json({
      success: true,
      message: 'Team customization settings removed successfully'
    });
    
  } catch (error) {
    console.error('Error deleting team settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 