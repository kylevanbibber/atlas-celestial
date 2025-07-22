const express = require('express');
const router = express.Router();
const { query } = require('../db');

// Update progress for a user's checklist
router.post('/update-progress', async (req, res) => {
    try {
        const { userId, updates } = req.body;

        if (!userId || !updates) {
            return res.status(400).json({ success: false, message: 'Missing userId or updates' });
        }

        // Check if user exists
        const userCheckQuery = 'SELECT id FROM activeusers WHERE id = ?';
        const userExists = await query(userCheckQuery, [userId]);

        if (userExists.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if checklist progress exists for this user
        const checkQuery = 'SELECT * FROM checklist_progress WHERE user_id = ?';
        const existingRecords = await query(checkQuery, [userId]);

        if (existingRecords.length === 0) {
            // Insert new row with default values
            const defaultValues = {
                user_id: userId,
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
            await query(updateQuery, [...updateValues, userId]);

            res.status(200).json({ success: true, message: 'Checklist progress updated successfully' });
        }
    } catch (error) {
        console.error('Error updating checklist progress:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get checklist data for a user
router.get('/get-checklist', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
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
        const userChecklist = await query(checkQuery, [userId]);

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

    try {
        // Check if a row already exists in `JA_Release` for this user
        const existingRow = await query(
            'SELECT * FROM JA_Release WHERE user_id = ? LIMIT 1',
            [userId]
        );

        if (existingRow.length > 0) {
            return res.status(409).json({ success: false, message: 'Release call already scheduled' });
        }

        // Retrieve user details - using mga as the manager
        const user = await query(
            'SELECT lagnname, mga FROM activeusers WHERE id = ? LIMIT 1',
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { mga, lagnname } = user[0];
        const timestamp = new Date();

        // Insert new row into `JA_Release` - including mga and lagnname
        await query(
            'INSERT INTO JA_Release (user_id, mga, lagnname, time_submitted) VALUES (?, ?, ?, ?)',
            [userId, mga, lagnname, timestamp]
        );

        res.status(201).json({ success: true, message: 'Release call scheduled successfully' });
    } catch (error) {
        console.error('Error scheduling release call:', error);
        res.status(500).json({ success: false, message: 'An error occurred while scheduling release call' });
    }
});

// Update release_scheduled by JA_Release.id
router.put('/schedule-release/:id', async (req, res) => {
    const { id } = req.params;
    const { releaseScheduled } = req.body;

    if (!releaseScheduled) {
        return res
            .status(400)
            .json({ success: false, message: 'Must provide releaseScheduled in request body' });
    }

    try {
        // Update the release_scheduled field by the row's primary key id
        const result = await query(
            'UPDATE JA_Release SET release_scheduled = ? WHERE id = ?',
            [releaseScheduled, id]
        );

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'No JA_Release row found with that id' });
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
    const { sent_date, last_updated } = req.body;

    if (!sent_date || !last_updated) {
        return res.status(400).json({ success: false, message: 'Missing sent_date or last_updated' });
    }

    try {
        const result = await query(
            `UPDATE leads_released
             SET sent_date = ?, last_updated = ?
             WHERE id = ?`,
            [sent_date, last_updated, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'leads_released row not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating leads_released:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Check if release is scheduled for a user
router.get('/check-release-scheduled', async (req, res) => {
    const { userId } = req.query;

    try {
        const result = await query(
            'SELECT release_scheduled FROM JA_Release WHERE user_id = ? LIMIT 1',
            [userId]
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
    const { userId } = req.query;

    try {
        const result = await query(
            'SELECT released FROM activeusers WHERE id = ? LIMIT 1',
            [userId]
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
            SELECT a.*, c.*, j.*, a.lagnname, a.esid, a.sa, a.ga, a.mga, a.rga, a.id
            FROM activeusers AS a
            LEFT JOIN checklist_progress AS c ON a.id = c.user_id
            LEFT JOIN JA_Release AS j ON a.id = j.user_id
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
        
        console.log('get-hierarchy-users-checklist called with userId:', userId);
        
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
        
        console.log('Executing hierarchy query with userId:', userId);
        const hierarchyUsers = await query(hierarchyQuery, [userId, userId, userId, userId]);
        console.log('Hierarchy users found:', hierarchyUsers.length);
        
        if (hierarchyUsers.length === 0) {
            console.log('No hierarchy users found, trying without managerActive filter...');
            // Try without managerActive filter in case that's the issue
            const hierarchyQueryNoManager = `
                SELECT * FROM activeusers 
                WHERE (sa = ? OR ga = ? OR mga = ? OR rga = ?)
                AND Active = 'y'
            `;
            const hierarchyUsersNoManager = await query(hierarchyQueryNoManager, [userId, userId, userId, userId]);
            console.log('Hierarchy users without managerActive filter:', hierarchyUsersNoManager.length);
            
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
        
        console.log('User IDs to get full data for:', userIds);
        
        // Now get the full data with checklist and release info for these users
        const fullDataQuery = `
            SELECT a.*, c.*, j.*, a.lagnname, a.esid, a.sa, a.ga, a.mga, a.rga, a.id
            FROM activeusers AS a
            LEFT JOIN checklist_progress AS c ON a.id = c.user_id
            LEFT JOIN JA_Release AS j ON a.id = j.user_id
            WHERE a.id IN (${placeholders})
            AND a.Active = 'y'
        `;
        
        const fullData = await query(fullDataQuery, userIds);
        console.log('Full data results:', fullData.length);

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
    console.log(`Received pass request for userId: ${userId}`);

    try {
        // Check if the userId exists in activeusers
        const activeUserCheck = await query(`SELECT * FROM activeusers WHERE id = ?`, [userId]);
        console.log(`activeusers table check for userId ${userId}:`, activeUserCheck);

        // Update `released` to 1 in `activeusers` if user exists
        const activeUserUpdateResult = await query(`UPDATE activeusers SET released = 1 WHERE id = ?`, [userId]);
        console.log(`activeusers table update result for userId ${userId}:`, activeUserUpdateResult);

        // Check if the userId exists in JA_Release before attempting update
        const jaReleaseCheck = await query(`SELECT * FROM JA_Release WHERE user_id = ?`, [userId]);
        console.log(`JA_Release table check for userId ${userId}:`, jaReleaseCheck);

        if (jaReleaseCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: `User with ID ${userId} not found in JA_Release table.`,
            });
        }

        // Update `passed` to 'y' in `JA_Release` if the userId exists
        const jaReleaseUpdateResult = await query(`UPDATE JA_Release SET passed = 'y' WHERE user_id = ?`, [userId]);
        console.log(`JA_Release table update result for userId ${userId}:`, jaReleaseUpdateResult);

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
    const { userId } = req.body;
    console.log(`Received fail request for userId: ${userId}`);

    try {
        // Retrieve the current `passed` and `release_scheduled` values
        console.log(`Fetching current 'passed' and 'release_scheduled' values from 'JA_Release' for userId: ${userId}`);
        const userReleaseData = await query(`SELECT passed, release_scheduled FROM JA_Release WHERE user_id = ?`, [userId]);

        if (userReleaseData.length === 0) {
            console.log(`No entry found in JA_Release for userId: ${userId}`);
            return res.status(404).json({ success: false, message: 'User not found in JA_Release' });
        }

        const { passed, release_scheduled } = userReleaseData[0];
        console.log(`Current 'passed' value for userId ${userId}: ${passed}`);
        console.log(`Current 'release_scheduled' value for userId ${userId}: ${release_scheduled}`);

        const today = new Date();
        let newReleaseScheduled;

        if (passed === null) {
            // Set release_scheduled to the upcoming Wednesday at 19:00
            const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7;
            newReleaseScheduled = new Date(today);
            newReleaseScheduled.setDate(today.getDate() + daysUntilWednesday);
            newReleaseScheduled.setHours(19, 0, 0, 0);
            console.log(`Setting new release_scheduled to upcoming Wednesday at 19:00 for userId ${userId}`);
        } else if (passed === 0) {
            // Set release_scheduled to the upcoming Monday at 19:00
            const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7;
            newReleaseScheduled = new Date(today);
            newReleaseScheduled.setDate(today.getDate() + daysUntilMonday);
            newReleaseScheduled.setHours(19, 0, 0, 0);
            console.log(`Setting new release_scheduled to upcoming Monday at 19:00 for userId ${userId}`);
        } else {
            console.log(`User with ID ${userId} has already passed; cannot fail`);
            return res.status(400).json({ success: false, message: 'User has already passed, cannot fail' });
        }

        // Format `newReleaseScheduled` to `yyyy-mm-dd hh:mm:ss`
        const formattedDate = newReleaseScheduled.toISOString().slice(0, 19).replace('T', ' ');
        console.log(`Formatted new release_scheduled date for userId ${userId}: ${formattedDate}`);

        // Update `release_scheduled` in `JA_Release`
        const updateResult = await query(`UPDATE JA_Release SET release_scheduled = ? WHERE user_id = ?`, [formattedDate, userId]);
        console.log(`JA_Release table update result for release_scheduled of userId ${userId}:`, updateResult);

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
    console.log(`Received delete request for userId: ${userId}`);

    try {
        // Check if the userId exists in JA_Release before attempting delete
        const jaReleaseCheck = await query(`SELECT * FROM JA_Release WHERE user_id = ?`, [userId]);
        console.log(`JA_Release table check for userId ${userId}:`, jaReleaseCheck);

        if (jaReleaseCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: `User with ID ${userId} not found in JA_Release table.`,
            });
        }

        // Delete the row from JA_Release
        const deleteResult = await query(`DELETE FROM JA_Release WHERE user_id = ?`, [userId]);
        console.log(`JA_Release table delete result for userId ${userId}:`, deleteResult);

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

// Get all leads released data
router.get('/leads-released', async (req, res) => {
    try {
        const result = await query('SELECT * FROM leads_released ORDER BY last_updated DESC');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching leads released data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Create new leads released record
router.post('/leads-released', async (req, res) => {
    const { type, notes, last_updated, userId, lagnname, sent, sent_date, sent_by } = req.body;

    if (!userId || !lagnname) {
        return res.status(400).json({ success: false, message: 'Missing required fields: userId, lagnname' });
    }

    try {
        const insertQuery = `
            INSERT INTO leads_released (type, notes, last_updated, userId, lagnname, sent, sent_date, sent_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await query(insertQuery, [
            type || null,
            notes || null,
            last_updated || new Date(),
            userId,
            lagnname,
            sent || 0,
            sent_date || null,
            sent_by || null
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
        // Assuming there's a licensed_states table with userId, state, expiry_date columns
        // If the table doesn't exist, you might need to create it or adjust the query
        const result = await query(`
            SELECT userId, state, expiry_date 
            FROM licensed_states 
            WHERE expiry_date IS NOT NULL 
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

module.exports = router; 