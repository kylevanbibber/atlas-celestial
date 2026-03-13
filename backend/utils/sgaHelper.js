const db = require('../db.js');

/**
 * Resolve any SGA name (primary, alternative, or display) to the canonical report name
 * @param {string} name - The name to look up
 * @returns {Promise<string|null>} - The canonical report name or null if not found
 */
async function resolveSgaName(name) {
  if (!name) return null;

  try {
    const query = `
      SELECT DISTINCT s.rept_name
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.active = 1
        AND (s.rept_name = ? OR san.alternative_name = ? OR s.display_name = ?)
      LIMIT 1
    `;

    const result = await db.query(query, [name, name, name]);
    return result && result.length > 0 ? result[0].rept_name : null;
  } catch (error) {
    console.error('[SGA Helper] Error resolving SGA name:', error);
    return null;
  }
}

/**
 * Get the default SGA's report name
 * @returns {Promise<string|null>} - The default SGA report name
 */
async function getDefaultSgaName() {
  try {
    const query = 'SELECT rept_name FROM sgas WHERE is_default = 1 AND active = 1 LIMIT 1';
    const result = await db.query(query);
    return result && result.length > 0 ? result[0].rept_name : 'ARIAS ORGANIZATION';
  } catch (error) {
    console.error('[SGA Helper] Error fetching default SGA:', error);
    return 'ARIAS ORGANIZATION'; // Fallback to hardcoded default
  }
}

/**
 * Get all active SGAs with their alternative names
 * @returns {Promise<Array>} - Array of SGAs with their alternative names
 */
async function getActiveSgas() {
  try {
    const query = `
      SELECT 
        s.id,
        s.rept_name,
        s.display_name,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.active = 1 AND s.hide = 0
      GROUP BY s.id
      ORDER BY s.is_default DESC, s.rept_name ASC
    `;

    const result = await db.query(query);
    return result.map(sga => ({
      ...sga,
      alternative_names: sga.alternative_names 
        ? sga.alternative_names.split('|').filter(Boolean) 
        : []
    }));
  } catch (error) {
    console.error('[SGA Helper] Error fetching active SGAs:', error);
    return [];
  }
}

/**
 * Get SQL WHERE clause to match any SGA name for a given column
 * @param {string} columnName - The column name to match against (e.g., 'MGA')
 * @param {string} sgaName - The SGA name to look up
 * @returns {Promise<{clause: string, params: Array}>} - WHERE clause and parameters
 */
async function getSgaWhereClause(columnName, sgaName) {
  try {
    // First resolve the SGA name to get the canonical name and alternatives
    const query = `
      SELECT 
        s.rept_name,
        s.display_name,
        GROUP_CONCAT(san.alternative_name SEPARATOR '|') as alternative_names
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.active = 1
        AND (s.rept_name = ? OR san.alternative_name = ? OR s.display_name = ?)
      GROUP BY s.id
      LIMIT 1
    `;

    const result = await db.query(query, [sgaName, sgaName, sgaName]);
    
    if (!result || result.length === 0) {
      // If not found, just use the provided name
      return {
        clause: `${columnName} = ?`,
        params: [sgaName]
      };
    }

    const sga = result[0];
    const allNames = [
      sga.rept_name,
      sga.display_name,
      ...(sga.alternative_names ? sga.alternative_names.split('|').filter(Boolean) : [])
    ].filter(Boolean);

    // Remove duplicates
    const uniqueNames = [...new Set(allNames)];

    // Build WHERE clause with OR conditions for all names
    const placeholders = uniqueNames.map(() => `${columnName} = ?`).join(' OR ');
    
    return {
      clause: `(${placeholders})`,
      params: uniqueNames
    };
  } catch (error) {
    console.error('[SGA Helper] Error building WHERE clause:', error);
    return {
      clause: `${columnName} = ?`,
      params: [sgaName]
    };
  }
}

/**
 * Check if a name matches any SGA (primary or alternative)
 * @param {string} name - The name to check
 * @returns {Promise<boolean>} - True if matches an active SGA
 */
async function isSgaName(name) {
  if (!name) return false;

  try {
    const query = `
      SELECT COUNT(*) as count
      FROM sgas s
      LEFT JOIN sga_alternative_names san ON s.id = san.sga_id
      WHERE s.active = 1
        AND (s.rept_name = ? OR san.alternative_name = ? OR s.display_name = ?)
    `;

    const result = await db.query(query, [name, name, name]);
    return result && result.length > 0 && result[0].count > 0;
  } catch (error) {
    console.error('[SGA Helper] Error checking SGA name:', error);
    return false;
  }
}

module.exports = {
  resolveSgaName,
  getDefaultSgaName,
  getActiveSgas,
  getSgaWhereClause,
  isSgaName
};

