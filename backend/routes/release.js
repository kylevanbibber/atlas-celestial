const express = require('express');
const router = express.Router();
const { query } = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { createNotificationInternal } = require('./notifications');
const emailService = require('../services/emailService');

// Apply authentication middleware to all release routes
router.use(verifyToken);

// Debug middleware to capture all requests to release routes
router.use((req, res, next) => {
    const requestId = req.body?.requestId || 'NO-REQUEST-ID';
    
    // Log all requests to release routes to debug userId issue
    

    next();
});

// Update progress for a user's checklist
router.post('/update-progress', async (req, res) => {
    try {
        const { userId, updates } = req.body;
        
        // For manager functionality: use userId from body if provided, otherwise use authenticated user
        const targetUserId = userId || req.userId;


        if (!targetUserId || !updates) {
            return res.status(400).json({ success: false, message: 'Missing userId or updates' });
        }

        // Check if user exists
        const userCheckQuery = 'SELECT id FROM activeusers WHERE id = ?';
        const userExists = await query(userCheckQuery, [targetUserId]);

        if (userExists.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if checklist progress exists for this user
        const checkQuery = 'SELECT * FROM checklist_progress WHERE user_id = ?';
        const existingRecords = await query(checkQuery, [targetUserId]);

        if (existingRecords.length === 0) {
            // Insert new row with default values
            const defaultValues = {
                user_id: targetUserId,
                video_done: false,
                arias_training: false,
                booking_done: false,
                leadership_track: false,
                practice_pres: 0,
                refs_25: 0,
                sale_1k: false,
                build_team: '',
                know_team: '',
                contract_2nd: null,
                bonus_90d: null,
                bonus_after_90d: null,
                ready_release: '',
                know_more: null,
                entrance_start: false,
                referral_open: false,
                texting_referral: false,
                closing_rebuttals: false,
                personal_recruit: false,
                reviewed_by: null,
                on_script: false,
                warmup_conf: false,
                create_need: false,
                sale_cemented: false,
                would_sell: false,
                ride_days_trainee: 0,
                ride_days_trainer: 0,
                pres_done_trainee: 0,
                pres_done_trainer: 0,
                ref_pres_done_trainee: 0,
                ref_pres_done_trainer: 0,
                ref_sold_trainee: 0,
                ref_sold_trainer: 0,
                ref_collected_trainee: 0,
                ref_collected_trainer: 0,
                sales_done_trainee: 0,
                sales_done_trainer: 0,
                alp_written_trainee: 0,
                alp_written_trainer: 0,
                appts_set_trainee: 0,
                appts_set_trainer: 0,
                recruits_trainee: 0,
                recruits_trainer: 0,
                appts_weekly: 0,
                pres_weekly: 0,
                refs_per_home: 0,
                alp_week: 0,
                start_wkdy: null,
                start_wknd: null,
                last_updated: new Date()
            };

            const updateField = Object.keys(updates)[0];
            defaultValues[updateField] = updates[updateField];

            const insertQuery = `
                INSERT INTO checklist_progress (${Object.keys(defaultValues).join(', ')})
                VALUES (${Object.keys(defaultValues).map(() => '?').join(', ')})
            `;

            await query(insertQuery, Object.values(defaultValues));
            res.status(201).json({ success: true, message: 'Checklist progress created successfully' });
        } else {
            const updateFields = Object.keys(updates)
                .map((field) => `${field} = ?`)
                .join(', ');
            const updateValues = Object.values(updates);

            const updateQuery = `
                UPDATE checklist_progress
                SET ${updateFields}, last_updated = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `;
            await query(updateQuery, [...updateValues, targetUserId]);

            res.status(200).json({ success: true, message: 'Checklist progress updated successfully' });
        }
    } catch (error) {
        console.error('Error updating checklist progress:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get checklist data for a user
router.get('/get-checklist', async (req, res) => {
    // For manager functionality: use userId from query parameter if provided, otherwise use authenticated user
    const targetUserId = req.query.userId || req.userId;


    if (!targetUserId) {
        return res.status(400).json({ success: false, message: 'Missing userId in request' });
    }

    try {
        // Query to get the checklist data and released status from activeusers
        const checkQuery = `
            SELECT cp.*, u.released 
            FROM checklist_progress cp
            JOIN activeusers u ON cp.user_id = u.id
            WHERE cp.user_id = ?
        `;
        const userChecklist = await query(checkQuery, [targetUserId]);

        if (userChecklist.length === 0) {
            return res.status(404).json({ success: false, message: 'Checklist not found for the provided userId' });
        }

        res.status(200).json({ success: true, checklist: userChecklist[0] });
    } catch (error) {
        console.error('Error retrieving checklist data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get all releases not yet scheduled (release_scheduled IS NULL)
router.get('/get-unscheduled-releases', async (req, res) => {
    try {
        const rows = await query(
            'SELECT * FROM JA_Release WHERE release_scheduled IS NULL'
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching unscheduled releases:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving unscheduled releases',
        });
    }
});

// Schedule a release call for a user
router.post('/schedule-release', async (req, res) => {
    const { userId } = req.body;
    
    // For manager functionality: use userId from body if provided, otherwise use authenticated user
    const targetUserId = userId || req.userId;


    try {
        // Check if a row already exists in `JA_Release` for this user
        const existingRow = await query(
            'SELECT * FROM JA_Release WHERE user_id = ? LIMIT 1',
            [targetUserId]
        );

        if (existingRow.length > 0) {
            return res.status(409).json({ success: false, message: 'Release call already scheduled' });
        }

        // Retrieve user details - using mga as the manager
        const user = await query(
            'SELECT lagnname, mga FROM activeusers WHERE id = ? LIMIT 1',
            [targetUserId]
        );

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { mga, lagnname } = user[0];
        const timestamp = new Date();

        // Insert new row into `JA_Release` - including mga and lagnname
        await query(
            'INSERT INTO JA_Release (user_id, mga, lagnname, time_submitted) VALUES (?, ?, ?, ?)',
            [targetUserId, mga, lagnname, timestamp]
        );

        res.status(201).json({ success: true, message: 'Release call scheduled successfully' });
    } catch (error) {
        console.error('Error scheduling release call:', error);
        res.status(500).json({ success: false, message: 'An error occurred while scheduling release call' });
    }
});

// Update release_scheduled by JA_Release.id
router.put('/schedule-release/:userId', async (req, res) => {
    const { userId } = req.params;
    const { releaseScheduled } = req.body;

    if (!releaseScheduled) {
        return res
            .status(400)
            .json({ success: false, message: 'Must provide releaseScheduled in request body' });
    }

    try {
        // Update the release_scheduled field by user_id (not primary key)
        const result = await query(
            'UPDATE JA_Release SET release_scheduled = ? WHERE user_id = ?',
            [releaseScheduled, userId]
        );

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'No JA_Release row found with that user_id' });
        }

        res.json({ success: true, message: 'Release scheduled date updated' });
    } catch (error) {
        console.error('Error updating release_scheduled:', error);
        res
            .status(500)
            .json({ success: false, message: 'Internal server error' });
    }
});

// Update leads_released
router.put('/leads-released/:id', async (req, res) => {
    const { id } = req.params;
    const { sent_date, last_updated, img, sent, notes, reasoning, rowcolor, archive, reason_archive, archived_date } = req.body;

    // Allow partial updates: at least one field must be provided
    if (
        typeof sent_date === 'undefined' &&
        typeof last_updated === 'undefined' &&
        typeof img === 'undefined' &&
        typeof sent === 'undefined' &&
        typeof notes === 'undefined' &&
        typeof reasoning === 'undefined' &&
        typeof rowcolor === 'undefined' &&
        typeof archive === 'undefined' &&
        typeof reason_archive === 'undefined' &&
        typeof archived_date === 'undefined'
    ) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    try {
        const fields = [];
        const values = [];
        if (sent_date) { fields.push('sent_date = ?'); values.push(sent_date); }
        if (last_updated) { fields.push('last_updated = ?'); values.push(last_updated); }
        if (typeof img !== 'undefined') { fields.push('img = ?'); values.push(img || null); }
        if (typeof sent !== 'undefined') { fields.push('sent = ?'); values.push(sent ? 1 : 0); }
        if (typeof notes !== 'undefined') { fields.push('notes = ?'); values.push(notes || null); }
        if (typeof reasoning !== 'undefined') { fields.push('reasoning = ?'); values.push(reasoning || null); }
        if (typeof rowcolor !== 'undefined') { fields.push('rowcolor = ?'); values.push(rowcolor || null); }
        if (typeof archive !== 'undefined') { fields.push('archive = ?'); values.push(archive ? 1 : 0); }
        if (typeof reason_archive !== 'undefined') { fields.push('reason_archive = ?'); values.push(reason_archive || null); }
        if (archived_date) { fields.push('archived_date = ?'); values.push(archived_date); }
        
        // Log archive-related updates for debugging
        if (typeof archive !== 'undefined' || typeof reason_archive !== 'undefined') {
            console.log(`[ARCHIVE DEBUG] Updating leads_released ${id}:`, {
                archive: archive,
                reason_archive: reason_archive,
                archived_date: archived_date
            });
        }
        
        // fields length already guaranteed by earlier guard
        const sql = `UPDATE leads_released SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);
        
        console.log(`[SQL DEBUG] Executing: ${sql}`, values);
        const result = await query(sql, values);
        console.log(`[SQL DEBUG] Result:`, { affectedRows: result.affectedRows });

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'leads_released row not found' });
        }

        // Send notifications if reasoning, notes, or sent status were updated
        if (typeof reasoning !== 'undefined' || typeof notes !== 'undefined' || typeof sent !== 'undefined') {
            try {
                // Get the leads_released record to find the userId
                const leadRecord = await query('SELECT userId, lagnname FROM leads_released WHERE id = ?', [id]);
                if (leadRecord.length > 0) {
                    const { userId, lagnname } = leadRecord[0];
                    
                    // Get agent info and their MGA
                    const agentInfo = await query('SELECT id, lagnname, mga FROM activeusers WHERE id = ?', [userId]);
                    if (agentInfo.length > 0) {
                        const agent = agentInfo[0];
                        const agentId = agent.id;
                        const agentName = agent.lagnname;
                        const mgaName = agent.mga;
                        
                        // Handle different types of updates
                        if (typeof sent !== 'undefined' && sent == 1) {
                            // Pack was marked as sent
                            await createNotificationInternal({
                                title: 'Code Pack Sent',
                                message: 'Your code pack has been marked as sent!',
                                type: 'success',
                                user_id: agentId,
                                link_url: '/utilities/leads'
                            });
                            
                            // Notify MGA
                            if (mgaName) {
                                const mgaInfo = await query('SELECT id FROM activeusers WHERE lagnname = ? LIMIT 1', [mgaName]);
                                if (mgaInfo.length > 0) {
                                    const mgaId = mgaInfo[0].id;
                                    
                                    await createNotificationInternal({
                                        title: 'Agent Code Pack Sent',
                                        message: `Code pack has been sent to ${agentName}.`,
                                        type: 'success',
                                        user_id: mgaId,
                                        link_url: '/utilities/leads'
                                    });
                                }
                            }
                            
                            // Complete the appropriate checklist item if agent has a pipeline
                            try {
                                // Check if agent has a pipeline_id
                                const pipelineCheck = await query('SELECT pipeline_id FROM activeusers WHERE id = ?', [agentId]);
                                if (pipelineCheck.length > 0 && pipelineCheck[0].pipeline_id) {
                                    const pipelineId = pipelineCheck[0].pipeline_id;
                                    
                                    // Get the pack type to determine which checklist item to complete
                                    const packInfo = await query('SELECT type FROM leads_released WHERE id = ?', [id]);
                                    const packType = packInfo.length > 0 ? packInfo[0].type : null;
                                    
                                    let checklistItemName = '';
                                    if (packType === '1st Pack' || packType === 'First Pack') {
                                        checklistItemName = 'Receive First Lead Pack';
                                    } else if (packType === '2nd Pack' || packType === 'Second Pack' || packType === 'Release Pack') {
                                        checklistItemName = 'Receive Release Pack';
                                    }
                                    
                                    if (checklistItemName) {
                                        // Find the checklist item
                                        const checklistItem = await query(`
                                            SELECT id 
                                            FROM pipeline_checklist_items 
                                            WHERE item_name LIKE ?
                                            AND stage_name = 'Training'
                                            AND active = 1
                                            LIMIT 1
                                        `, [`%${checklistItemName}%`]);
                                        
                                        if (checklistItem.length > 0) {
                                            const checklistItemId = checklistItem[0].id;
                                            
                                            // Check if already completed
                                            const existingProgress = await query(`
                                                SELECT id, completed 
                                                FROM pipeline_checklist_progress 
                                                WHERE recruit_id = ? AND checklist_item_id = ?
                                            `, [pipelineId, checklistItemId]);
                                            
                                            if (existingProgress.length > 0) {
                                                // Update to completed if not already
                                                if (existingProgress[0].completed === 0) {
                                                    await query(`
                                                        UPDATE pipeline_checklist_progress 
                                                        SET completed = 1, 
                                                            started_at = COALESCE(started_at, NOW()),
                                                            completed_at = NOW()
                                                        WHERE id = ?
                                                    `, [existingProgress[0].id]);
                                                    console.log(`✓ Completed "${checklistItemName}" checklist item for pipeline ${pipelineId}`);
                                                }
                                            } else {
                                                // Insert new completed record
                                                await query(`
                                                    INSERT INTO pipeline_checklist_progress 
                                                    (recruit_id, checklist_item_id, completed, started_at, completed_at)
                                                    VALUES (?, ?, 1, NOW(), NOW())
                                                `, [pipelineId, checklistItemId]);
                                                console.log(`✓ Created and completed "${checklistItemName}" checklist item for pipeline ${pipelineId}`);
                                            }
                                        } else {
                                            console.log(`⚠️  "${checklistItemName}" checklist item not found`);
                                        }
                                    } else {
                                        console.log(`⚠️  Unknown pack type: ${packType} - checklist item not updated`);
                                    }
                                } else {
                                    console.log(`⚠️  Agent ${agentId} does not have a pipeline_id - checklist item not updated`);
                                }
                            } catch (checklistError) {
                                console.error('Error completing checklist item:', checklistError);
                                // Don't fail the entire request if checklist update fails
                            }
                        } else if (typeof reasoning !== 'undefined' || typeof notes !== 'undefined') {
                            // Reasoning or notes were updated
                            let updateType = '';
                            if (typeof reasoning !== 'undefined' && typeof notes !== 'undefined') {
                                updateType = 'reasoning and notes';
                            } else if (typeof reasoning !== 'undefined') {
                                updateType = 'reasoning';
                            } else {
                                updateType = 'notes';
                            }
                            
                            // Send notification to the agent
                            await createNotificationInternal({
                                title: 'Code Pack Update',
                                message: `Your code pack ${updateType} has been updated.`,
                                type: 'info',
                                user_id: agentId,
                                link_url: '/utilities/leads'
                            });
                            
                            // Find MGA user by matching lagnname with the mga field
                            if (mgaName) {
                                const mgaInfo = await query('SELECT id FROM activeusers WHERE lagnname = ? LIMIT 1', [mgaName]);
                                if (mgaInfo.length > 0) {
                                    const mgaId = mgaInfo[0].id;
                                    
                                    // Send notification to the MGA
                                    await createNotificationInternal({
                                        title: 'Agent Code Pack Update',
                                        message: `Code pack ${updateType} updated for ${agentName}.`,
                                        type: 'info',
                                        user_id: mgaId,
                                        link_url: '/utilities/leads'
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (notificationError) {
                console.error('Error sending notifications for leads_released update:', notificationError);
                // Don't fail the main request if notification fails
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating leads_released:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Check if release is scheduled for a user
router.get('/check-release-scheduled', async (req, res) => {
    // For manager functionality: use userId from query parameter if provided, otherwise use authenticated user
    const targetUserId = req.query.userId || req.userId;


    try {
        const result = await query(
            'SELECT release_scheduled FROM JA_Release WHERE user_id = ? LIMIT 1',
            [targetUserId]
        );
        const allRowsResult = await query('SELECT * FROM JA_Release');

        if (result.length > 0) {
            const releaseScheduled = result[0].release_scheduled;
            const isScheduled = releaseScheduled !== null;
            res.json({ success: true, isScheduled, release_scheduled: releaseScheduled, allRowsResult });
        } else {
            res.json({ success: false, isScheduled: false, release_scheduled: null, allRowsResult });
        }
    } catch (error) {
        console.error('Error checking release schedule status:', error);
        res.status(500).json({ success: false, message: 'An error occurred while checking release schedule status' });
    }
});

// Check if user is released
router.get('/check-released', async (req, res) => {
    // For manager functionality: use userId from query parameter if provided, otherwise use authenticated user
    const targetUserId = req.query.userId || req.userId;


    try {
        const result = await query(
            'SELECT released FROM activeusers WHERE id = ? LIMIT 1',
            [targetUserId]
        );

        if (result.length > 0) {
            const released = result[0].released;
            const isReleased = released === 1;
            res.json({ success: true, isReleased, released, result });
        } else {
            res.json({ success: true, isReleased: false, released: null });
        }
    } catch (error) {
        console.error('Error checking release status:', error);
        res.status(500).json({ success: false, message: 'An error occurred while checking release status' });
    }
});

// Get unreleased users with checklist data
router.get('/get-unreleased-users-checklist', async (req, res) => {
    try {
        // Query to get all users from activeusers where released is 0,
        // and left join with checklist_progress and JA_Release tables.
        const unreleasedUsersQuery = `
            SELECT a.*, c.*, j.*, a.lagnname, a.esid, a.sa, a.ga, a.mga, a.rga, a.rept_name, a.id,
                   mga_table.rept_name AS mga_rept_name,
                   p.PendingDate,
                   CASE 
                       WHEN p.PendingDate IS NOT NULL AND a.esid IS NOT NULL 
                       THEN DATEDIFF(STR_TO_DATE(a.esid, '%Y-%m-%d'), STR_TO_DATE(p.PendingDate, '%Y-%m-%d'))
                       ELSE NULL 
                   END AS days_to_code
            FROM activeusers AS a
            LEFT JOIN checklist_progress AS c ON a.id = c.user_id
            LEFT JOIN JA_Release AS j ON a.id = j.user_id
            LEFT JOIN pending p ON a.lagnname = p.LagnName
            LEFT JOIN MGAs mga_table ON a.mga = mga_table.lagnname
            WHERE a.Active = 'y' AND a.managerActive = 'y'
        `;
        const unreleasedUsers = await query(unreleasedUsersQuery);

        res.status(200).json({
            success: true,
            data: unreleasedUsers,
        });
    } catch (error) {
        console.error('Error retrieving unreleased users with checklist and release data:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving unreleased users with checklist and release data',
        });
    }
});

// Get hierarchy users with checklist and release data for managers
router.post('/get-hierarchy-users-checklist', async (req, res) => {
    try {
        const { userId } = req.body;
        
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // First get the manager's hierarchy
        const hierarchyQuery = `
            SELECT * FROM activeusers 
            WHERE (sa = ? OR ga = ? OR mga = ? OR rga = ?)
            AND Active = 'y'
        `;
        
        let hierarchyUsers = await query(hierarchyQuery, [userId, userId, userId, userId]);
        
        // Get the user's lagnname to check for special case
        const userResult = await query(`SELECT lagnname FROM activeusers WHERE id = ?`, [userId]);
        const userLagnname = userResult.length > 0 ? userResult[0].lagnname : null;
        
        // Special case: For MAUGHANEVANSON BRODY W, also include all LOCKER-ROTOLO users
        if (userLagnname === 'MAUGHANEVANSON BRODY W') {
            const lockerRotoloUsers = await query(`
                SELECT * FROM activeusers 
                WHERE rept_name = 'LOCKER-ROTOLO'
                AND Active = 'y'
            `);
            
            // Merge LOCKER-ROTOLO users with existing hierarchy, avoiding duplicates
            const existingIds = new Set(hierarchyUsers.map(u => u.id));
            const newUsers = lockerRotoloUsers.filter(u => !existingIds.has(u.id));
            hierarchyUsers = [...hierarchyUsers, ...newUsers];
        }
        
        if (hierarchyUsers.length === 0) {
            // Try without managerActive filter in case that's the issue
            const hierarchyQueryNoManager = `
                SELECT * FROM activeusers 
                WHERE (sa = ? OR ga = ? OR mga = ? OR rga = ?)
                AND Active = 'y'
            `;
            const hierarchyUsersNoManager = await query(hierarchyQueryNoManager, [userId, userId, userId, userId]);
            
            if (hierarchyUsersNoManager.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }
        }

        // Get the user IDs from hierarchy
        const userIds = hierarchyUsers.map(user => user.id);
        const placeholders = userIds.map(() => '?').join(',');
        
        
        // Now get the full data with checklist and release info for these users
        const fullDataQuery = `
            SELECT a.*, c.*, j.*, a.lagnname, a.esid, a.sa, a.ga, a.mga, a.rga, a.id,
                   p.PendingDate,
                   CASE 
                       WHEN p.PendingDate IS NOT NULL AND a.esid IS NOT NULL 
                       THEN DATEDIFF(STR_TO_DATE(a.esid, '%Y-%m-%d'), STR_TO_DATE(p.PendingDate, '%Y-%m-%d'))
                       ELSE NULL 
                   END AS days_to_code
            FROM activeusers AS a
            LEFT JOIN checklist_progress AS c ON a.id = c.user_id
            LEFT JOIN JA_Release AS j ON a.id = j.user_id
            LEFT JOIN pending p ON a.lagnname = p.LagnName
            WHERE a.id IN (${placeholders})
            AND a.Active = 'y'
        `;
        
        const fullData = await query(fullDataQuery, userIds);

        res.status(200).json({
            success: true,
            data: fullData,
        });
    } catch (error) {
        console.error('Error retrieving hierarchy users with checklist and release data:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while retrieving hierarchy users with checklist and release data',
        });
    }
});

// Pass a user (mark as released)
router.post('/pass-user', async (req, res) => {

    
    const { userId } = req.body;

    try {
        // Check if the userId exists in activeusers
        const activeUserCheck = await query(`SELECT * FROM activeusers WHERE id = ?`, [userId]);

        if (activeUserCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found in activeusers',
            });
        }

        const user = activeUserCheck[0];

        // Update `released` to 1 in `activeusers` if user exists
        const activeUserUpdateResult = await query(`UPDATE activeusers SET released = 1 WHERE id = ?`, [userId]);

        // Check if the userId exists in JA_Release before attempting update
        const jaReleaseCheck = await query(`SELECT * FROM JA_Release WHERE user_id = ?`, [userId]);

        let jaReleaseUpdateResult;
        if (jaReleaseCheck.length === 0) {
            // User doesn't exist in JA_Release table - create a new entry
            jaReleaseUpdateResult = await query(
                `INSERT INTO JA_Release (user_id, passed) VALUES (?, 'y')`, 
                [userId]
            );
        } else {
            // Update `passed` to 'y' in `JA_Release` if the userId exists
            jaReleaseUpdateResult = await query(`UPDATE JA_Release SET passed = 'y' WHERE user_id = ?`, [userId]);
        }

        // Check if a 2nd Pack leads_released entry already exists for this user
        const existing2ndPack = await query(
            `SELECT * FROM leads_released WHERE userId = ? AND type = '2nd Pack'`,
            [userId]
        );

        // If no 2nd Pack entry exists, create one
        if (existing2ndPack.length === 0) {
            const now = new Date();
            const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
            
            await query(
                `INSERT INTO leads_released (userId, lagnname, type, sent, created_at) VALUES (?, ?, '2nd Pack', 0, ?)`,
                [userId, user.lagnname, createdAt]
            );
            
            console.log(`Created 2nd Pack leads_released entry for user ${userId} (${user.lagnname})`);
        } else {
            console.log(`2nd Pack leads_released entry already exists for user ${userId} (${user.lagnname})`);
        }

        // Complete the "Attend and Pass Release Call" checklist item if agent has a pipeline
        try {
            // Check if agent has a pipeline_id
            const pipelineCheck = await query('SELECT pipeline_id FROM activeusers WHERE id = ?', [userId]);
            if (pipelineCheck.length > 0 && pipelineCheck[0].pipeline_id) {
                const pipelineId = pipelineCheck[0].pipeline_id;
                
                // Find the "Attend and Pass Release Call" checklist item
                const checklistItem = await query(`
                    SELECT id 
                    FROM pipeline_checklist_items 
                    WHERE (item_name LIKE '%Attend and Pass Release Call%' 
                           OR item_name LIKE '%Pass Release Call%'
                           OR item_name LIKE '%Attend Release%')
                    AND stage_name = 'Training'
                    AND active = 1
                    LIMIT 1
                `);
                
                if (checklistItem.length > 0) {
                    const checklistItemId = checklistItem[0].id;
                    
                    // Check if already completed
                    const existingProgress = await query(`
                        SELECT id, completed 
                        FROM pipeline_checklist_progress 
                        WHERE recruit_id = ? AND checklist_item_id = ?
                    `, [pipelineId, checklistItemId]);
                    
                    if (existingProgress.length > 0) {
                        // Update to completed if not already
                        if (existingProgress[0].completed === 0) {
                            await query(`
                                UPDATE pipeline_checklist_progress 
                                SET completed = 1, 
                                    started_at = COALESCE(started_at, NOW()),
                                    completed_at = NOW()
                                WHERE id = ?
                            `, [existingProgress[0].id]);
                            console.log(`✓ Completed "Attend and Pass Release Call" checklist item for pipeline ${pipelineId}`);
                        }
                    } else {
                        // Insert new completed record
                        await query(`
                            INSERT INTO pipeline_checklist_progress 
                            (recruit_id, checklist_item_id, completed, started_at, completed_at)
                            VALUES (?, ?, 1, NOW(), NOW())
                        `, [pipelineId, checklistItemId]);
                        console.log(`✓ Created and completed "Attend and Pass Release Call" checklist item for pipeline ${pipelineId}`);
                    }
                } else {
                    console.log(`⚠️  "Attend and Pass Release Call" checklist item not found`);
                }
            } else {
                console.log(`⚠️  Agent ${userId} does not have a pipeline_id - checklist item not updated`);
            }
        } catch (checklistError) {
            console.error('Error completing checklist item for pass-user:', checklistError);
            // Don't fail the entire request if checklist update fails
        }

        res.status(200).json({
            success: true,
            message: `User with ID ${userId} has been marked as passed.`,
        });
    } catch (error) {
        console.error('Error passing user:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while passing the user',
        });
    }
});

// Fail a user (reschedule release)
router.post('/fail-user', async (req, res) => {

    
    const { userId, requestId } = req.body;

    try {
        // Retrieve the current `passed` and `release_scheduled` values
        const userReleaseData = await query(`SELECT passed, release_scheduled FROM JA_Release WHERE user_id = ?`, [userId]);

        if (userReleaseData.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found in JA_Release' });
        }

        const { passed, release_scheduled } = userReleaseData[0];

        const today = new Date();
        let newReleaseScheduled;

        if (passed === null) {
            // Set release_scheduled to the upcoming Wednesday at 19:00
            const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7;
            newReleaseScheduled = new Date(today);
            newReleaseScheduled.setDate(today.getDate() + daysUntilWednesday);
            newReleaseScheduled.setHours(19, 0, 0, 0);
        } else if (passed === 0) {
            // Set release_scheduled to the upcoming Monday at 19:00
            const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7;
            newReleaseScheduled = new Date(today);
            newReleaseScheduled.setDate(today.getDate() + daysUntilMonday);
            newReleaseScheduled.setHours(19, 0, 0, 0);
        } else {
            return res.status(400).json({ success: false, message: 'User has already passed, cannot fail' });
        }

        // Format `newReleaseScheduled` to `yyyy-mm-dd hh:mm:ss`
        const formattedDate = newReleaseScheduled.toISOString().slice(0, 19).replace('T', ' ');

        // Update `release_scheduled` in `JA_Release`
        const updateResult = await query(`UPDATE JA_Release SET release_scheduled = ? WHERE user_id = ?`, [formattedDate, userId]);

        res.status(200).json({
            success: true,
            message: `User with ID ${userId} has been marked as failed, release scheduled updated.`,
        });
    } catch (error) {
        console.error('Error failing user:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while failing the user',
        });
    }
});

// Delete a user from release schedule
router.delete('/delete-user/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // Check if the userId exists in JA_Release before attempting delete
        const jaReleaseCheck = await query(`SELECT * FROM JA_Release WHERE user_id = ?`, [userId]);

        if (jaReleaseCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: `User with ID ${userId} not found in JA_Release table.`,
            });
        }

        // Delete the row from JA_Release
        const deleteResult = await query(`DELETE FROM JA_Release WHERE user_id = ?`, [userId]);

        res.status(200).json({
            success: true,
            message: `User with ID ${userId} has been deleted from release schedule.`,
        });
    } catch (error) {
        console.error('Error deleting user from release schedule:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deleting the user from release schedule',
        });
    }
});

// Toggle hide status endpoint
router.post('/toggle-hide', async (req, res) => {
    try {
        const { userId, hide } = req.body;
        
        // Update the hide status in checklist_progress table
        const updateQuery = `
            UPDATE checklist_progress 
            SET hide = ? 
            WHERE user_id = ?
        `;
        await query(updateQuery, [hide, userId]);
        
        res.status(200).json({
            success: true,
            message: 'Hide status updated successfully'
        });
    } catch (error) {
        console.error('Error updating hide status:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating hide status'
        });
    }
});

// Get eligible users for First Pack request
router.get('/first-pack/eligible', async (req, res) => {
    try {
        // Optional: scope by managerId if provided later; for now return all eligible
        const eligibleQuery = `
            SELECT 
                au.id,
                au.lagnname,
                au.clname,
                au.esid,
                au.sa,
                au.ga,
                au.mga,
                au.rga,
                au.rept_name,
                au.pending,
                au.managerActive,
                mga_table.rept_name AS mga_rept_name,
                lr.id AS lead_id,
                lr.created_at AS created_at,
                lr.sent AS lr_sent,
                lr.type AS lr_type,
                lr.img AS lr_img,
                lr.rowcolor,
                ls.licensed_states AS licensed_states,
                p.PendingDate,
                CASE 
                    WHEN p.PendingDate IS NOT NULL AND au.esid IS NOT NULL 
                    THEN DATEDIFF(STR_TO_DATE(au.esid, '%Y-%m-%d'), STR_TO_DATE(p.PendingDate, '%Y-%m-%d'))
                    ELSE NULL 
                END AS days_to_code
            FROM activeusers au
            LEFT JOIN leads_released lr 
                ON lr.userId = au.id AND lr.type IN ('1st Pack','First Pack')
            LEFT JOIN (
                SELECT 
                    userId,
                    GROUP_CONCAT(state ORDER BY state SEPARATOR ', ') AS licensed_states
                FROM licensed_states
                WHERE (
                    expiry_date IS NULL OR expiry_date = '' OR 
                    COALESCE(
                        STR_TO_DATE(expiry_date, '%m/%d/%Y'),
                        STR_TO_DATE(expiry_date, '%Y-%m-%d')
                    ) > CURDATE()
                )
                GROUP BY userId
            ) ls ON ls.userId = au.id
            LEFT JOIN pending p ON au.lagnname = p.LagnName
            LEFT JOIN MGAs mga_table ON au.mga = mga_table.lagnname
            WHERE au.pending IN (0,1)
              AND au.released = 0
              AND au.Active = 'y'
              AND au.esid IS NOT NULL AND au.esid <> ''
              AND STR_TO_DATE(au.esid, '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        `;
        const result = await query(eligibleQuery);
        // Debug specific user 26816
        try {
            const debugUserId = 26816;
            const debugRow = result.find(r => String(r.id) === String(debugUserId));
            if (debugRow) {
                console.log('[DEBUG /release/first-pack/eligible] Row for 26816:', debugRow);
            } else {
                console.log('[DEBUG /release/first-pack/eligible] No row found for 26816');
            }
            const ls = await query('SELECT * FROM licensed_states WHERE userId = ?', [debugUserId]);
            console.log('[DEBUG licensed_states] Raw rows for 26816:', ls);
        } catch (e) {}
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching eligible first pack users:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Create a First Pack request for a user
router.post('/first-pack/request', async (req, res) => {
    try {
        const { userId, lagnname } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        // Verify user exists
        const userRows = await query(
            `SELECT id, lagnname FROM activeusers WHERE id = ? LIMIT 1`,
            [userId]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check for existing 1st Pack record (support legacy label)
        const existing = await query(
            `SELECT id FROM leads_released WHERE userId = ? AND type IN ('1st Pack','First Pack') LIMIT 1`,
            [userId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'First Code Pack already requested' });
        }

        const user = userRows[0];
        const now = new Date();
        await query(
            `INSERT INTO leads_released (type, notes, last_updated, userId, lagnname, sent, sent_date, sent_by)
             VALUES ('1st Pack', NULL, ?, ?, ?, 0, NULL, NULL)`,
            [now, user.id, lagnname || user.lagnname]
        );

        res.status(201).json({ success: true, message: 'First Code Pack request created' });
    } catch (error) {
        console.error('Error creating First Code Pack request:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get all leads released data
router.get('/leads-released', async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                lr.*,
                ls.licensed_states AS licensed_states,
                au.lagnname       AS au_lagnname,
                au.mga            AS au_mga,
                au.esid           AS au_esid,
                au.Active         AS au_Active,
                au.released       AS au_released,
                au.pending        AS au_pending
            FROM leads_released lr
            LEFT JOIN (
                SELECT 
                    userId,
                    GROUP_CONCAT(state ORDER BY state SEPARATOR ', ') AS licensed_states
                FROM licensed_states
                WHERE (
                    expiry_date IS NULL OR expiry_date = '' OR 
                    COALESCE(
                        STR_TO_DATE(expiry_date, '%m/%d/%Y'),
                        STR_TO_DATE(expiry_date, '%Y-%m-%d')
                    ) > CURDATE()
                )
                GROUP BY userId
            ) ls ON ls.userId = lr.userId
            LEFT JOIN activeusers au ON au.id = lr.userId
            ORDER BY lr.last_updated DESC
        `);
        // Debug specific user 26816
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching leads released data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// (Removed) Upload or update image for First Pack in leads_released

// Create new leads released record
router.post('/leads-released', async (req, res) => {
    const { type, notes, reasoning, last_updated, userId, lagnname, sent, sent_date, sent_by, img } = req.body;
    try {
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing required field: userId' });
        }
        let effectiveName = lagnname;
        if (!effectiveName) {
            const nameRows = await query('SELECT lagnname FROM activeusers WHERE id = ? LIMIT 1', [userId]);
            effectiveName = (nameRows[0] && nameRows[0].lagnname) || null;
        }
        if (!effectiveName) {
            // As last resort, allow empty name instead of failing the request
            effectiveName = '';
        }

        const insertQuery = `
            INSERT INTO leads_released (type, notes, reasoning, last_updated, userId, lagnname, sent, sent_date, sent_by, img)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await query(insertQuery, [
            type || '1st Pack',
            notes || null,
            reasoning || null,
            last_updated || new Date(),
            userId,
            effectiveName,
            typeof sent === 'number' ? sent : 0,
            sent_date || null,
            sent_by || null,
            img || null
        ]);

        // Return the created record
        const newRecord = await query('SELECT * FROM leads_released WHERE id = ?', [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Leads released record created successfully',
            data: newRecord[0]
        });
    } catch (error) {
        console.error('Error creating leads released record:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


// Get licensed states data
router.get('/licensed-states', async (req, res) => {
    try {
        // Return ALL licenses including those with NULL expiry_date
        // Frontend will handle display logic (color-coding for expired/no expiry)
        const result = await query(`
            SELECT userId, state, expiry_date 
            FROM licensed_states 
            ORDER BY userId, state
        `);
        
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching licensed states data:', error);
        
        // If the table doesn't exist, return empty data instead of error
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.warn('licensed_states table does not exist, returning empty data');
            res.status(200).json({ success: true, data: [] });
        } else {
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
});

// Send second pack to a user
router.post('/second-pack', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }

        // Get user details
        const user = await query(
            'SELECT lagnname FROM activeusers WHERE id = ? LIMIT 1',
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const { lagnname } = user[0];
        const now = new Date();

        // Check if there's already a 2nd Pack record for this user (NOT 1st Pack!)
        const existingSecondPack = await query(
            'SELECT * FROM leads_released WHERE userId = ? AND type IN (?, ?) LIMIT 1',
            [userId, '2nd Pack', 'Second Pack']
        );

        if (existingSecondPack.length > 0) {
            // Update existing 2nd Pack record to mark as sent
            await query(
                'UPDATE leads_released SET sent = 1, sent_date = ?, last_updated = ? WHERE id = ?',
                [now, now, existingSecondPack[0].id]
            );
        } else {
            // Create new record for second pack (keeps 1st Pack record intact)
            await query(
                'INSERT INTO leads_released (userId, lagnname, type, sent, sent_date, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, lagnname, 'Second Pack', 1, now, now]
            );
        }

        // Send notifications for second pack being sent
        try {
            // Get agent info and their MGA
            const agentInfo = await query('SELECT id, lagnname, mga FROM activeusers WHERE id = ?', [userId]);
            if (agentInfo.length > 0) {
                const agent = agentInfo[0];
                const agentId = agent.id;
                const agentName = agent.lagnname;
                const mgaName = agent.mga;
                
                // Send notification to the agent
                await createNotificationInternal({
                    title: 'Second Code Pack Sent',
                    message: 'Your second code pack has been sent!',
                    type: 'success',
                    user_id: agentId,
                    link_url: '/utilities/leads'
                });
                
                // Find MGA user by matching lagnname with the mga field
                if (mgaName) {
                    const mgaInfo = await query('SELECT id FROM activeusers WHERE lagnname = ? LIMIT 1', [mgaName]);
                    if (mgaInfo.length > 0) {
                        const mgaId = mgaInfo[0].id;
                        
                        // Send notification to the MGA
                        await createNotificationInternal({
                            title: 'Agent Second Code Pack Sent',
                            message: `Second code pack has been sent to ${agentName}.`,
                            type: 'success',
                            user_id: mgaId,
                            link_url: '/utilities/leads'
                        });
                    }
                }
            }
        } catch (notificationError) {
            console.error('Error sending notifications for second code pack:', notificationError);
            // Don't fail the main request if notification fails
        }

        // Complete the "Receive Release Pack" checklist item and move to Career Path stage
        try {
            // Check if agent has a pipeline_id
            const pipelineCheck = await query('SELECT pipeline_id FROM activeusers WHERE id = ?', [userId]);
            if (pipelineCheck.length > 0 && pipelineCheck[0].pipeline_id) {
                const pipelineId = pipelineCheck[0].pipeline_id;
                
                // Find the "Receive Release Pack" checklist item
                const checklistItem = await query(`
                    SELECT id 
                    FROM pipeline_checklist_items 
                    WHERE (item_name LIKE '%Receive Release Pack%' 
                           OR item_name LIKE '%2nd Pack%'
                           OR item_name LIKE '%Second Pack%')
                    AND stage_name = 'Training'
                    AND active = 1
                    LIMIT 1
                `);
                
                if (checklistItem.length > 0) {
                    const checklistItemId = checklistItem[0].id;
                    
                    // Check if already completed
                    const existingProgress = await query(`
                        SELECT id, completed 
                        FROM pipeline_checklist_progress 
                        WHERE recruit_id = ? AND checklist_item_id = ?
                    `, [pipelineId, checklistItemId]);
                    
                    if (existingProgress.length > 0) {
                        // Update to completed if not already
                        if (existingProgress[0].completed === 0) {
                            await query(`
                                UPDATE pipeline_checklist_progress 
                                SET completed = 1, 
                                    started_at = COALESCE(started_at, NOW()),
                                    completed_at = NOW()
                                WHERE id = ?
                            `, [existingProgress[0].id]);
                            console.log(`✓ Completed "Receive Release Pack" checklist item for pipeline ${pipelineId}`);
                        }
                    } else {
                        // Insert new completed record
                        await query(`
                            INSERT INTO pipeline_checklist_progress 
                            (recruit_id, checklist_item_id, completed, started_at, completed_at)
                            VALUES (?, ?, 1, NOW(), NOW())
                        `, [pipelineId, checklistItemId]);
                        console.log(`✓ Created and completed "Receive Release Pack" checklist item for pipeline ${pipelineId}`);
                    }
                } else {
                    console.log(`⚠️  "Receive Release Pack" checklist item not found`);
                }
                
                // Update pipeline step to "Career Path"
                const pipelineData = await query('SELECT step FROM pipeline WHERE id = ?', [pipelineId]);
                if (pipelineData.length > 0) {
                    const currentStep = pipelineData[0].step;
                    
                    // Only update if not already at Career Path
                    if (currentStep !== 'Career Path') {
                        // Update pipeline table
                        await query(`
                            UPDATE pipeline 
                            SET step = 'Career Path', date_last_updated = NOW()
                            WHERE id = ?
                        `, [pipelineId]);
                        console.log(`✓ Updated pipeline ${pipelineId} from ${currentStep} to Career Path`);
                        
                        // Close previous stage in pipeline_steps
                        await query(`
                            UPDATE pipeline_steps
                            SET date_exited = NOW()
                            WHERE recruit_id = ? AND step = ? AND date_exited IS NULL
                        `, [pipelineId, currentStep]);
                        
                        // Record new Career Path stage
                        await query(`
                            INSERT INTO pipeline_steps (recruit_id, step, date_entered)
                            VALUES (?, 'Career Path', NOW())
                        `, [pipelineId]);
                        console.log(`✓ Recorded new pipeline step "Career Path" for pipeline ${pipelineId}`);
                    } else {
                        console.log(`⚠️  Pipeline ${pipelineId} already at Career Path stage`);
                    }
                }
            } else {
                console.log(`⚠️  Agent ${userId} does not have a pipeline_id - pipeline not updated`);
            }
        } catch (pipelineError) {
            console.error('Error updating pipeline for second-pack:', pipelineError);
            // Don't fail the entire request if pipeline update fails
        }

        res.status(200).json({ 
            success: true, 
            message: 'Second code pack marked as sent successfully' 
        });
    } catch (error) {
        console.error('Error sending second code pack:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Mark a user's checklist as 100% complete by setting the minimum
// set of fields used by the progress calculation to their target values
router.post('/mark-checklist-complete', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        // Ensure the user exists
        const userRows = await query('SELECT id FROM activeusers WHERE id = ? LIMIT 1', [userId]);
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Target values that produce 100% in AgentProgressTable.calculateProgress
        const target = {
            video_done: 1,
            arias_training: 1,
            booking_done: 1,
            leadership_track: 1,
            practice_pres: 10,   // capped at 10 in calc
            refs_25: 25,         // capped at 25 in calc
            sale_1k: 1,
            build_team: 'y',
            know_team: 'y',
            ready_release: 'y',
            contract_2nd: '45',
            bonus_90d: '750',
            bonus_after_90d: '250',
            entrance_start: 1,
            referral_open: 1,
            texting_referral: 1,
            closing_rebuttals: 1,
            personal_recruit: 1,
            on_script: 1,
            warmup_conf: 1,
            create_need: 1,
            sale_cemented: 1,
            would_sell: 1
        };

        // Does a record already exist?
        const existing = await query('SELECT id FROM checklist_progress WHERE user_id = ? LIMIT 1', [userId]);

        if (existing.length === 0) {
            // Construct a full insert using defaults + target values
            const defaults = {
                user_id: userId,
                video_done: 0,
                arias_training: 0,
                booking_done: 0,
                leadership_track: 0,
                practice_pres: 0,
                refs_25: 0,
                sale_1k: 0,
                build_team: '',
                know_team: '',
                contract_2nd: null,
                bonus_90d: null,
                bonus_after_90d: null,
                ready_release: '',
                know_more: null,
                entrance_start: 0,
                referral_open: 0,
                texting_referral: 0,
                closing_rebuttals: 0,
                personal_recruit: 0,
                reviewed_by: null,
                on_script: 0,
                warmup_conf: 0,
                create_need: 0,
                sale_cemented: 0,
                would_sell: 0,
                ride_days_trainee: 0,
                ride_days_trainer: 0,
                pres_done_trainee: 0,
                pres_done_trainer: 0,
                ref_pres_done_trainee: 0,
                ref_pres_done_trainer: 0,
                ref_sold_trainee: 0,
                ref_sold_trainer: 0,
                ref_collected_trainee: 0,
                ref_collected_trainer: 0,
                sales_done_trainee: 0,
                sales_done_trainer: 0,
                alp_written_trainee: 0,
                alp_written_trainer: 0,
                appts_set_trainee: 0,
                appts_set_trainer: 0,
                recruits_trainee: 0,
                recruits_trainer: 0,
                appts_weekly: 0,
                pres_weekly: 0,
                refs_per_home: 0,
                alp_week: 0,
                start_wkdy: null,
                start_wknd: null,
                hide: 0,
                last_updated: new Date()
            };

            const payload = { ...defaults, ...target };
            const insertSql = `INSERT INTO checklist_progress (${Object.keys(payload).join(', ')}) VALUES (${Object.keys(payload).map(() => '?').join(', ')})`;
            await query(insertSql, Object.values(payload));
        } else {
            // Update existing row with target values
            const setClause = Object.keys(target).map(k => `${k} = ?`).join(', ');
            const params = [...Object.values(target), userId];
            const updateSql = `UPDATE checklist_progress SET ${setClause}, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?`;
            await query(updateSql, params);
        }

        // Optionally return the updated row
        const [updated] = await query('SELECT * FROM checklist_progress WHERE user_id = ? LIMIT 1', [userId]);
        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        console.error('Error marking checklist complete:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Send release email to selected agents with MGA CC'd
router.post('/send-release-email', async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No user IDs provided' });
        }

        // Get user details and their MGA information
        const usersQuery = `
            SELECT 
                u.id,
                u.lagnname,
                u.email,
                u.mga,
                mga_user.email as mga_email,
                jr.release_scheduled
            FROM activeusers u
            LEFT JOIN activeusers mga_user ON u.mga = mga_user.lagnname AND mga_user.clname IN ('MGA', 'RGA')
            LEFT JOIN JA_Release jr ON u.id = jr.user_id
            WHERE u.id IN (${userIds.map(() => '?').join(', ')})
        `;
        
        const users = await query(usersQuery, userIds);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'No users found' });
        }

        const emailResults = [];
        
        for (const user of users) {
            try {
                // Skip if user doesn't have an email
                if (!user.email) {
                    emailResults.push({
                        userId: user.id,
                        agentName: user.lagnname,
                        success: false,
                        error: 'No email address on file'
                    });
                    continue;
                }

                const agentName = user.lagnname;
                
                // Extract first name from lagnname (format: Last First Middle Suffix)
                const nameParts = agentName ? agentName.split(' ').filter(Boolean) : [];
                const firstName = nameParts.length >= 2 ? nameParts[1] : agentName;
                
                // Convert UTC time to EST properly
                let releaseDate = 'Not yet scheduled';
                if (user.release_scheduled) {
                    // Parse the UTC datetime string and add 'Z' to ensure it's treated as UTC
                    const utcDate = new Date(user.release_scheduled + (user.release_scheduled.includes('Z') ? '' : 'Z'));
                    releaseDate = utcDate.toLocaleString('en-US', { 
                        timeZone: 'America/New_York',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                }

                // Email subject
                const subject = `Release Call Scheduled - ${releaseDate} - ${agentName}`;

                // Email body
                const body = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #00558c;">Congratulations on Your Upcoming Release!</h2>
                        
                        <p>Dear ${firstName},</p>
                        
                        <p>We are excited to inform you about your upcoming release call!</p>
                        
                        <div style="background-color: #f0f8ff; padding: 15px; border-left: 4px solid #00558c; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #00558c;">Release Call Details</h3>
                            <p><strong>Agent:</strong> ${agentName}</p>
                            <p><strong>Scheduled Date:</strong> ${releaseDate}</p>
                            <p><strong>MGA:</strong> ${user.mga || 'N/A'}</p>
                        </div>
                        
                        <h3 style="color: #00558c;">Zoom Meeting Information</h3>
                        <p><strong>Meeting Link:</strong> <a href="https://zoom.us/j/6233180376">Join Zoom Meeting</a></p>
                        <p><strong>Meeting ID:</strong> 623 318 0376</p>
                        <p><strong>Password:</strong> 1234</p>
                        
                        <h3 style="color: #00558c;">Preparation</h3>
                        <p>Please review the <a href="https://aagencies-my.sharepoint.com/:b:/g/personal/kvanbibber_ariasagencies_com/Edr14iXcerVHoroIJvQd5gMB-BCqDoRpg-tzI2vVElfbDg">Release Questions PDF</a> to prepare for your call.</p>
                        
                        <p>This is an important milestone in your journey with us. During this call, you'll demonstrate your knowledge and readiness to operate independently as a licensed agent.</p>
                        
                        <p>If you have any questions, please reach out to your ${user.mga ? 'MGA' : 'manager'}.</p>
                        
                        <p>Best regards,<br>
                        <strong>Arias Agencies Team</strong></p>
                    </div>
                `;

                // Prepare CC list (MGA email if available)
                const ccEmails = [];
                if (user.mga_email) ccEmails.push(user.mga_email);

                // Send email
                const emailOptions = {};
                if (ccEmails.length > 0) {
                    emailOptions.cc = ccEmails.join(', ');
                }

                await emailService.sendEmail(user.email, subject, body, emailOptions);

                emailResults.push({
                    userId: user.id,
                    agentName: agentName,
                    success: true,
                    email: user.email,
                    ccEmails: ccEmails
                });

            } catch (error) {
                console.error(`Failed to send email to user ${user.id}:`, error);
                emailResults.push({
                    userId: user.id,
                    agentName: user.lagnname,
                    success: false,
                    error: error.message
                });
            }
        }

        // Check if all emails failed
        const successCount = emailResults.filter(r => r.success).length;
        const failCount = emailResults.filter(r => !r.success).length;

        if (successCount === 0) {
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to send all emails',
                results: emailResults
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: `Successfully sent ${successCount} email(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
            results: emailResults
        });

    } catch (error) {
        console.error('Error sending release emails:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router; 