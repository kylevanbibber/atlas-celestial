const { query } = require('../db');

/**
 * Replace variables in SMS message with actual recruit data
 * @param {string} message - The message template with {{variables}}
 * @param {number} recruitId - The pipeline recruit ID
 * @param {number} userId - The user ID (optional, for agent variables)
 * @returns {Promise<string>} - The message with variables replaced
 */
async function replaceVariables(message, recruitId, userId = null) {
  if (!message || !recruitId) {
    console.log('[SMS Variable Replacer] Missing message or recruitId');
    return message;
  }

  try {
    console.log('[SMS Variable Replacer] Starting replacement for recruit:', recruitId, 'user:', userId);
    
    // Fetch recruit data
    const recruits = await query(
      `SELECT * FROM pipeline WHERE id = ? LIMIT 1`,
      [recruitId]
    );

    if (!recruits || recruits.length === 0) {
      console.warn('[SMS Variable Replacer] Recruit not found:', recruitId);
      return message;
    }

    const recruit = recruits[0];
    console.log('[SMS Variable Replacer] Found recruit:', recruit.recruit_first, recruit.recruit_last);
    let processedMessage = message;

    // Fetch manager/user data if userId is provided or if manager variables are in the message
    let managerData = null;
    if (userId || processedMessage.includes('{{manager_')) {
      const userIdToFetch = userId || recruit.recruiting_agent_id;
      if (userIdToFetch) {
        const managers = await query(
          `SELECT lagnname, screen_name, email, phone FROM activeusers WHERE id = ? LIMIT 1`,
          [userIdToFetch]
        );
        if (managers && managers.length > 0) {
          managerData = managers[0];
          // Map screen_name to screenName for consistency
          managerData.screenName = managerData.screen_name || managerData.lagnname;
        }
      }
    }

    // System variables
    const now = new Date();
    const systemVars = {
      current_date: now.toLocaleDateString('en-US'),
      current_time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      current_datetime: now.toLocaleString('en-US')
    };

    // Replace system variables
    Object.entries(systemVars).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      processedMessage = processedMessage.replace(regex, value || '');
    });

    // Replace manager/user variables
    if (managerData) {
      const managerVars = {
        manager_lagnname: managerData.lagnname,
        manager_screen_name: managerData.screenName, // New snake_case format
        manager_screenName: managerData.screenName,  // Legacy camelCase format for backwards compatibility
        manager_email: managerData.email,
        manager_phone: managerData.phone
      };

      Object.entries(managerVars).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'gi');
        processedMessage = processedMessage.replace(regex, value || '');
      });
    }

    // Replace recruit field variables
    Object.entries(recruit).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      // Convert dates to readable format
      let displayValue = value;
      if (value instanceof Date) {
        displayValue = value.toLocaleDateString('en-US');
      } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        // Check if it looks like a date string
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          displayValue = date.toLocaleDateString('en-US');
        }
      }
      processedMessage = processedMessage.replace(regex, displayValue || '');
    });

    // Fetch and replace checklist item values
    const checklistMatches = processedMessage.match(/{{checklist_(\d+)}}/gi);
    if (checklistMatches) {
      const checklistIds = [...new Set(checklistMatches.map(m => m.match(/\d+/)[0]))];
      
      for (const itemId of checklistIds) {
        const progress = await query(
          `SELECT cp.value, cp.completed, ci.item_name, ci.item_type
           FROM pipeline_checklist_progress cp
           JOIN pipeline_checklist_items ci ON cp.checklist_item_id = ci.id
           WHERE cp.recruit_id = ? AND cp.checklist_item_id = ?
           LIMIT 1`,
          [recruitId, itemId]
        );

        let checklistValue = '';
        if (progress && progress.length > 0) {
          const item = progress[0];
          if (item.item_type === 'checkbox') {
            checklistValue = item.completed ? 'Complete' : 'Incomplete';
          } else {
            checklistValue = item.value || '';
          }
        }

        const regex = new RegExp(`{{checklist_${itemId}}}`, 'gi');
        processedMessage = processedMessage.replace(regex, checklistValue);
      }
    }

    // Fetch and replace state requirement values (if needed)
    const stateReqMatches = processedMessage.match(/{{state_req_[^}]+}}/gi);
    if (stateReqMatches && recruit.resident_state) {
      for (const match of stateReqMatches) {
        const varName = match.replace(/{{|}}/g, '');
        const parts = varName.split('_');
        
        if (parts.length >= 4) {
          const state = parts[2];
          const stageName = parts.slice(3, -1).join(' ');
          const targetItem = parts[parts.length - 1];

          if (state === recruit.resident_state) {
            const stateReqs = await query(
              `SELECT instructions FROM pipeline_state_requirements
               WHERE state = ? AND stage_name LIKE ? AND target_item_name LIKE ?
               AND active = 1
               LIMIT 1`,
              [state, `%${stageName}%`, `%${targetItem}%`]
            );

            const stateReqValue = stateReqs && stateReqs.length > 0 ? stateReqs[0].instructions : '';
            processedMessage = processedMessage.replace(match, stateReqValue || '');
          } else {
            // Different state, remove the variable
            processedMessage = processedMessage.replace(match, '');
          }
        }
      }
    }

    // Clean up any remaining unreplaced variables (optional - remove if you want to keep them)
    // processedMessage = processedMessage.replace(/{{[^}]+}}/g, '');

    console.log('[SMS Variable Replacer] Replacement complete. Original length:', message.length, 'Processed length:', processedMessage.length);
    return processedMessage;
  } catch (error) {
    console.error('[SMS Variable Replacer] Error replacing variables:', error);
    console.error('[SMS Variable Replacer] Error stack:', error.stack);
    return message; // Return original message on error
  }
}

module.exports = {
  replaceVariables
};

