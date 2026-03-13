const express = require('express');
const router = express.Router();
const db = require('../db');
const twilioService = require('../services/twilio');
const { v4: uuidv4 } = require('uuid');

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'https://atlas-celest-backend-3bb2fea96236.herokuapp.com';
const VERIFY_STATUS_CALLBACK_URL = `${BACKEND_BASE_URL}/api/verify/webhook/status`;

// Route to handle verification form submission
router.post('/', async (req, res) => {
    try {
        const {
            userId,
            client_name,
            client_phoneNumber,
            client_email,
            agent_name,
            agent_email,
            primary_info,
            spouse_info,
            child1_info,
            child2_info,
            child3_info,
            child4_info,
            child5_info,
            child6_info,
            child7_info,
            child8_info,
            child9_info,
            dui_answer,
            arrested_answer,
            heart_issues_answer,
            high_blood_pressure_answer,
            diabetes_answer,
            anxiety_depression_answer,
            cancer_answer,
            medications_answer,
            er_visit_answer,
            chronic_illness_answer,
            senior_rejected_answer,
            heart_lung_answer,
            cirrhosis_answer,
            amputation_answer,
            cancer_senior_answer,
            oxygen_answer,
            total_annual_premium,
            total_trial_premium,
        } = req.body;

        // Generate application_id using uuidv4
        const application_id = uuidv4();

        // Set bank default to 'Yes'
        const bank = 'Yes';

        // Get agent_ip from the request
        const agent_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);

        // Check total_annual_premium to set status
        const status = total_annual_premium < 1440 ? 'Not at Threshold' : 'Queued';

        // Build url using application_id - this should be the client-facing URL, not the admin panel
        const url = `https://ariaslife.com/verify/clients.html?${application_id}`;

        // Prepare the INSERT query
        const insertQuery = `
            INSERT INTO verify (
                userId, client_name, client_phoneNumber, client_email, agent_name, agent_email,
                primary_info, spouse_info, child1_info, child2_info, child3_info, child4_info,
                child5_info, child6_info, child7_info, child8_info, child9_info,
                dui_answer, arrested_answer, heart_issues_answer, high_blood_pressure_answer,
                diabetes_answer, anxiety_depression_answer, cancer_answer, medications_answer,
                er_visit_answer, chronic_illness_answer, senior_rejected_answer, heart_lung_answer,
                cirrhosis_answer, amputation_answer, cancer_senior_answer, oxygen_answer,
                application_id, bank, agent_ip, status, url, total_annual_premium, total_trial_premium
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            userId, client_name, client_phoneNumber, client_email, agent_name, agent_email,
            primary_info, spouse_info, child1_info, child2_info, child3_info, child4_info,
            child5_info, child6_info, child7_info, child8_info, child9_info,
            dui_answer, arrested_answer, heart_issues_answer, high_blood_pressure_answer,
            diabetes_answer, anxiety_depression_answer, cancer_answer, medications_answer,
            er_visit_answer, chronic_illness_answer, senior_rejected_answer, heart_lung_answer,
            cirrhosis_answer, amputation_answer, cancer_senior_answer, oxygen_answer,
            application_id, bank, agent_ip, status, url, total_annual_premium, total_trial_premium
        ];

        await db.query(insertQuery, values);

        res.status(200).json({ success: true, message: 'Verification data submitted successfully' });
    } catch (error) {
        console.error('Error inserting verification data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get distinct agent names for the agent filter dropdown
router.get('/agents', async (req, res) => {
    try {
        const results = await db.query(
            "SELECT DISTINCT agent_name FROM verify WHERE agent_name IS NOT NULL AND agent_name != '' ORDER BY agent_name ASC"
        );
        res.status(200).json({ success: true, data: results.map(r => r.agent_name) });
    } catch (error) {
        console.error('Error fetching verify agents:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get agent profile info from activeusers by lagnname
router.get('/agent-profile/:agentName', async (req, res) => {
    try {
        const { agentName } = req.params;
        const results = await db.query(
            `SELECT au.id, au.lagnname, au.mga, au.rga, au.ga, au.sa, au.clname,
                    au.esid, au.agtnum, au.profpic, au.Active,
                    COALESCE(au.email, '') AS email,
                    COALESCE(au.phone, '') AS phone
             FROM activeusers au
             WHERE au.lagnname = ?
             LIMIT 1`,
            [agentName]
        );
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }
        res.status(200).json({ success: true, data: results[0] });
    } catch (error) {
        console.error('Error fetching agent profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get all-time verify + verify_client data for an agent (for stats computation)
router.get('/agent-alltime/:agentName', async (req, res) => {
    try {
        const { agentName } = req.params;

        const verifyResults = await db.query(
            `SELECT * FROM verify WHERE agent_name = ? AND status != 'Not at Threshold' ORDER BY created_at DESC`,
            [agentName]
        );

        let clientResults = [];
        if (verifyResults.length > 0) {
            clientResults = await db.query(
                `SELECT vc.*, v.client_email, v.client_phoneNumber
                 FROM verify_client vc
                 JOIN verify v ON vc.application_id = v.application_id
                 WHERE v.agent_name = ?`,
                [agentName]
            );
        }

        res.status(200).json({
            success: true,
            verifyData: verifyResults,
            verifyClientData: clientResults
        });
    } catch (error) {
        console.error('Error fetching agent all-time data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to fetch all data from the verify table except for status 'Not at Threshold'
router.get('/all', async (req, res) => {
    try {
        const { archive, monthFrom, monthTo, agent } = req.query;
        let queryText;
        const params = [];

        if (archive === 'true') {
            // Show archived records with optional month range and agent filters
            queryText = "SELECT * FROM verify WHERE status != 'Not at Threshold' AND archive = 'y'";

            // Filter by month range (format: YYYY-MM) using verify.created_at
            if (monthFrom && monthTo) {
                queryText += " AND DATE_FORMAT(created_at, '%Y-%m') >= ? AND DATE_FORMAT(created_at, '%Y-%m') <= ?";
                params.push(monthFrom, monthTo);
            } else if (monthFrom) {
                queryText += " AND DATE_FORMAT(created_at, '%Y-%m') >= ?";
                params.push(monthFrom);
            } else if (monthTo) {
                queryText += " AND DATE_FORMAT(created_at, '%Y-%m') <= ?";
                params.push(monthTo);
            }

            // Filter by agent name (exact match)
            if (agent) {
                queryText += " AND agent_name = ?";
                params.push(agent);
            }

            queryText += " ORDER BY created_at DESC";
        } else {
            // Show non-archived records (default behavior)
            queryText = "SELECT * FROM verify WHERE status != 'Not at Threshold' AND (archive IS NULL OR archive != 'y') ORDER BY created_at DESC";
        }

        const results = await db.query(queryText, params);

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching all verify data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to fetch data from verify table and check if the application is completed in verify_client table
router.get('/getpackage', async (req, res) => {
    const { application_id } = req.query;

    if (!application_id) {
        return res.status(400).json({ success: false, message: 'Missing application_id' });
    }

    try {
        // First, check if the application_id exists in the verify table
        const verifyQuery = 'SELECT * FROM verify WHERE application_id = ?';
        const verifyResults = await db.query(verifyQuery, [application_id]);

        if (verifyResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Now, check if the application_id exists in the verify_client table
        const verifyClientQuery = `
            SELECT vc.*, v.client_email, v.client_phoneNumber 
            FROM verify_client vc 
            JOIN verify v ON vc.application_id = v.application_id 
            WHERE vc.application_id = ?
        `;
        const verifyClientResults = await db.query(verifyClientQuery, [application_id]);

        if (verifyClientResults.length > 0) {
            return res.status(200).json({
                success: true,
                data: verifyResults[0],
                clientData: verifyClientResults[0],
                message: 'Survey already completed',
            });
        }

        return res.status(200).json({
            success: true,
            data: verifyResults[0],
            message: 'Survey not completed yet',
        });
    } catch (error) {
        console.error('Error fetching application data:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to submit client verification
router.post('/verifyclient', async (req, res) => {
    try {
        const {
            application_id,
            medical_answers,
            account_verification,
            application_verification,
            agent_contact_request
        } = req.body;

        if (!application_id) {
            return res.status(400).json({ success: false, message: 'Missing application_id' });
        }

        // Check if the application_id already exists in the verify_client table
        const checkExistingQuery = `SELECT * FROM verify_client WHERE application_id = ?`;
        const existingRecord = await db.query(checkExistingQuery, [application_id]);

        if (existingRecord.length > 0) {
            return res.status(400).json({ success: false, message: 'Survey has already been completed for this application.' });
        }

        const client_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || (req.connection.socket ? req.connection.socket.remoteAddress : null);

        // Insert data to verify_client table
        const insertQuery = `
            INSERT INTO verify_client (
                application_id, high_blood_pressure, diabetes, anxiety_depression, medications,
                er_visit, arrested, dui, cancer, heart_issues, chronic_illness, senior_rejected,
                heart_lung, cirrhosis, amputation, cancer_senior, oxygen, account_verification,
                application_verification, agent_contact_request, client_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            application_id,
            medical_answers?.high_blood_pressure || 'n',
            medical_answers?.diabetes || 'n',
            medical_answers?.anxiety_depression || 'n',
            medical_answers?.medications || 'n',
            medical_answers?.er_visit || 'n',
            medical_answers?.arrested || 'n',
            medical_answers?.dui || 'n',
            medical_answers?.cancer || 'n',
            medical_answers?.heart_issues || 'n',
            medical_answers?.chronic_illness || 'n',
            medical_answers?.senior_rejected || 'n',
            medical_answers?.heart_lung || 'n',
            medical_answers?.cirrhosis || 'n',
            medical_answers?.amputation || 'n',
            medical_answers?.cancer_senior || 'n',
            medical_answers?.oxygen || 'n',
            account_verification || 'n',
            application_verification || 'n',
            agent_contact_request || 'No',
            client_ip
        ];

        await db.query(insertQuery, values);

        // Update the status in the verify table
        const updateStatusQuery = `UPDATE verify SET status = 'Received' WHERE application_id = ?`;
        await db.query(updateStatusQuery, [application_id]);

        res.status(200).json({
            success: true,
            message: 'Survey responses saved successfully.',
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to fetch all data from the verify_client table
router.get('/verifyclient/all', async (req, res) => {
    try {
        const { archive, monthFrom, monthTo, agent } = req.query;
        let queryText;
        const params = [];

        if (archive === 'true') {
            // Show client responses for archived applications with optional filters
            queryText = `
                SELECT vc.*, v.client_email, v.client_phoneNumber
                FROM verify_client vc
                JOIN verify v ON vc.application_id = v.application_id
                WHERE v.archive = 'y'
            `;

            if (monthFrom && monthTo) {
                queryText += " AND DATE_FORMAT(v.created_at, '%Y-%m') >= ? AND DATE_FORMAT(v.created_at, '%Y-%m') <= ?";
                params.push(monthFrom, monthTo);
            } else if (monthFrom) {
                queryText += " AND DATE_FORMAT(v.created_at, '%Y-%m') >= ?";
                params.push(monthFrom);
            } else if (monthTo) {
                queryText += " AND DATE_FORMAT(v.created_at, '%Y-%m') <= ?";
                params.push(monthTo);
            }

            if (agent) {
                queryText += " AND v.agent_name = ?";
                params.push(agent);
            }

            queryText += " ORDER BY vc.submission_date DESC";
        } else {
            // Show client responses for non-archived applications (default behavior)
            queryText = `
                SELECT vc.*, v.client_email, v.client_phoneNumber
                FROM verify_client vc
                JOIN verify v ON vc.application_id = v.application_id
                WHERE (v.archive IS NULL OR v.archive != 'y')
                ORDER BY vc.submission_date DESC
            `;
        }

        const results = await db.query(queryText, params);

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching all verify_client data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to update client email and phone number
router.put('/update-client-info', async (req, res) => {
    const { application_id, client_email, client_phoneNumber } = req.body;

    try {
        if (!application_id || !client_email || !client_phoneNumber) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const updateQuery = `
            UPDATE verify 
            SET client_email = ?, client_phoneNumber = ? 
            WHERE application_id = ?
        `;

        await db.query(updateQuery, [client_email, client_phoneNumber, application_id]);

        res.status(200).json({ success: true, message: 'Client information updated successfully' });
    } catch (error) {
        console.error('Error updating client information:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to update individual client contact fields (email or phone)
router.put('/update-client-contact', async (req, res) => {
    try {
        const { application_id, client_email, client_phoneNumber } = req.body;
        
        // Check if user has app admin permissions
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No authorization token provided' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const userId = decoded.id || decoded.userId;
            
            const userQuery = 'SELECT teamRole, Role FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);

            if (userResult.length === 0 || (userResult[0].teamRole !== 'app' && userResult[0].Role !== 'Admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Only app admins can update client contact information.'
                });
            }
        } catch (jwtError) {
            return res.status(401).json({ success: false, message: 'Invalid authorization token' });
        }

        if (!application_id) {
            return res.status(400).json({ success: false, message: 'Missing application_id' });
        }

        if (!client_email && !client_phoneNumber) {
            return res.status(400).json({ success: false, message: 'Must provide either client_email or client_phoneNumber' });
        }

        // Build dynamic update query based on provided fields
        let updateQuery = 'UPDATE verify SET ';
        let updateValues = [];
        let updateFields = [];

        if (client_email !== undefined) {
            updateFields.push('client_email = ?');
            updateValues.push(client_email);
        }

        if (client_phoneNumber !== undefined) {
            updateFields.push('client_phoneNumber = ?');
            updateValues.push(client_phoneNumber);
        }

        updateQuery += updateFields.join(', ') + ' WHERE application_id = ?';
        updateValues.push(application_id);

        await db.query(updateQuery, updateValues);

        res.status(200).json({ 
            success: true, 
            message: 'Client contact information updated successfully',
            updatedFields: {
                client_email: client_email !== undefined ? client_email : 'unchanged',
                client_phoneNumber: client_phoneNumber !== undefined ? client_phoneNumber : 'unchanged'
            }
        });
    } catch (error) {
        console.error('Error updating client contact information:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to archive an application
router.put('/archive', async (req, res) => {
    const { application_id } = req.body;

    try {
        if (!application_id) {
            return res.status(400).json({ success: false, message: 'Missing application_id' });
        }

        const updateQuery = `UPDATE verify SET archive = 'y' WHERE application_id = ?`;
        await db.query(updateQuery, [application_id]);

        res.status(200).json({ success: true, message: 'Application archived successfully' });
    } catch (error) {
        console.error('Error archiving application:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to unarchive an application
router.put('/unarchive', async (req, res) => {
    const { application_id } = req.body;

    try {
        if (!application_id) {
            return res.status(400).json({ success: false, message: 'Missing application_id' });
        }

        const updateQuery = `UPDATE verify SET archive = 'n' WHERE application_id = ?`;
        await db.query(updateQuery, [application_id]);

        res.status(200).json({ success: true, message: 'Application unarchived successfully' });
    } catch (error) {
        console.error('Error unarchiving application:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to search agents by user ID - returns agents based on hierarchy
router.post('/searchByUserId', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        // Get the user's info to determine their role and hierarchy
        const userQuery = `
            SELECT au.*
            FROM activeusers au
            WHERE au.id = ?
        `;
        const userResult = await db.query(userQuery, [userId]);
        
        if (userResult.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const user = userResult[0];
        let agentData = [];
        let defaultAgent = '';

        // Based on user role, fetch appropriate agents
        if (user.clname === 'AGT') {
            // For agents, return only themselves
            agentData = [user];
            defaultAgent = user.lagnname;
        } else if (user.clname === 'SA') {
            // For SAs, return all agents under them PLUS themselves
            const query = `
                SELECT au.*
                FROM activeusers au
                WHERE au.sa = ? AND au.clname = "AGT" AND au.managerActive = "y" AND au.Active = "y"
                ORDER BY au.lagnname ASC
            `;
            agentData = await db.query(query, [user.lagnname]);
            // Add the SA themselves to the beginning of the list
            agentData.unshift(user);
            defaultAgent = user.lagnname;
        } else if (user.clname === 'GA') {
            // For GAs, return all agents under them PLUS themselves
            const query = `
                SELECT au.*
                FROM activeusers au
                WHERE au.ga = ? AND au.clname = "AGT" AND au.managerActive = "y" AND au.Active = "y"
                ORDER BY au.lagnname ASC
            `;
            agentData = await db.query(query, [user.lagnname]);
            // Add the GA themselves to the beginning of the list
            agentData.unshift(user);
            defaultAgent = user.lagnname;
        } else if (user.clname === 'MGA') {
            // For MGAs, return all agents under them PLUS themselves
            const query = `
                SELECT au.*
                FROM activeusers au
                WHERE au.mga = ? AND au.clname = "AGT" AND au.managerActive = "y" AND au.Active = "y"
                ORDER BY au.lagnname ASC
            `;
            agentData = await db.query(query, [user.lagnname]);
            // Add the MGA themselves to the beginning of the list
            agentData.unshift(user);
            defaultAgent = user.lagnname;
        } else if (user.clname === 'RGA') {
            // For RGAs, return all agents under them PLUS themselves
            const query = `
                SELECT au.*
                FROM activeusers au
                WHERE au.rga = ? AND au.clname = "AGT" AND au.managerActive = "y" AND au.Active = "y"
                ORDER BY au.lagnname ASC
            `;
            agentData = await db.query(query, [user.lagnname]);
            // Add the RGA themselves to the beginning of the list
            agentData.unshift(user);
            defaultAgent = user.lagnname;
        } else {
            // For other roles (admin, etc.), return all active agents
            const query = `
                SELECT au.*
                FROM activeusers au
                WHERE au.clname = "AGT" AND au.managerActive = "y" AND au.Active = "y"
                ORDER BY au.lagnname ASC
            `;
            agentData = await db.query(query);
            defaultAgent = agentData.length > 0 ? agentData[0].lagnname : '';
        }

        res.status(200).json({
            success: true,
            data: agentData,
            agnName: defaultAgent
        });
    } catch (error) {
        console.error('Error searching agents by user ID:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to send emails to all queued applications (Send Early functionality)
router.post('/send-queued', async (req, res) => {
    try {
        // Check if user has app admin permissions
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No authorization token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const userId = decoded.id || decoded.userId;
            
            // Check if user has teamRole = "app" or Role = "Admin"
            const userQuery = 'SELECT teamRole, Role FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);

            if (userResult.length === 0 || (userResult[0].teamRole !== 'app' && userResult[0].Role !== 'Admin')) {
                return res.status(403).json({ success: false, message: 'Access denied. Only app admins can send verification emails.' });
            }
        } catch (jwtError) {
            return res.status(401).json({ success: false, message: 'Invalid authorization token' });
        }

        const query = `
            SELECT application_id, client_email, agent_email, agent_name, url, client_phoneNumber
            FROM verify
            WHERE status = 'Queued'
        `;

        const results = await db.query(query);

        if (results.length === 0) {
            return res.status(200).json({ success: true, message: 'No queued applications to send.' });
        }

        // Setup nodemailer transporter
        const nodemailer = require('nodemailer');
        const axios = require('axios');
        
        const transporter = nodemailer.createTransport({
            host: 'mail.ariaslife.com',
            port: 465,
            secure: true,
            auth: {
                user: 'noreply@ariaslife.com',
                pass: 'Ariaslife123!'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        let successCount = 0;
        let failCount = 0;

        // Process each queued application
        for (const row of results) {
            try {
                const mailOptions = {
                    from: 'noreply@ariaslife.com',
                    to: row.client_email,
                    subject: 'Welcome to Globe Life - AIL/NIL Arias Organization',
                    html: `
                        <p>Thank you for choosing us to protect you and your family.</p>
                        <p>Please use this <a href="${row.url}">link</a> to verify your application information.</p>
                        <p>This checklist is required to move forward with the application process.</p>
                        <p>If you have any questions, please reach out to your agent.</p>
                    `
                };

                // Send email
                await transporter.sendMail(mailOptions);

                // Log email in verify_messages
                await db.query(
                    `INSERT INTO verify_messages (application_id, recipient_email, phone_number, direction, message_type, message, status)
                     VALUES (?, ?, NULL, 'outbound', 'email', ?, 'sent')`,
                    [row.application_id, row.client_email, `Verification survey email sent to ${row.client_email}`]
                );

                // Send SMS if phone number exists
                if (row.client_phoneNumber) {
                    try {
                        const smsMessage = `Please review your American Income Life application survey: ${row.url}`;
                        const smsResult = await twilioService.sendSMS({
                            toNumber: row.client_phoneNumber,
                            message: smsMessage,
                            userId: null,
                            statusCallback: VERIFY_STATUS_CALLBACK_URL
                        });
                        if (smsResult.success) {
                            await db.query(
                                `INSERT INTO verify_messages (application_id, phone_number, direction, message_type, message, twilio_sid, status)
                                 VALUES (?, ?, 'outbound', 'sms', ?, ?, 'sent')`,
                                [row.application_id, row.client_phoneNumber, smsMessage, smsResult.messageId]
                            );
                        }
                    } catch (smsError) {
                        console.error(`SMS failed for ${row.application_id}:`, smsError.message);
                    }
                }

                // Update status to 'Sent'
                const updateQuery = `UPDATE verify SET status = 'Sent' WHERE application_id = ?`;
                await db.query(updateQuery, [row.application_id]);

                successCount++;
            } catch (error) {
                console.error(`Failed to send for ${row.application_id}:`, error);
                failCount++;
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `Processed ${results.length} applications. Success: ${successCount}, Failed: ${failCount}` 
        });
    } catch (error) {
        console.error('Error in send-queued:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to resend email/SMS for a specific application
router.post('/resend', async (req, res) => {
    const { application_id } = req.body;

    if (!application_id) {
        return res.status(400).json({ success: false, message: 'Application ID is required' });
    }

    try {
        // Check if user has app admin permissions
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No authorization token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const userId = decoded.id || decoded.userId;
            
            // Check if user has teamRole = "app" or Role = "Admin"
            const userQuery = 'SELECT teamRole, Role FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);

            if (userResult.length === 0 || (userResult[0].teamRole !== 'app' && userResult[0].Role !== 'Admin')) {
                return res.status(403).json({ success: false, message: 'Access denied. Only app admins can resend verification emails.' });
            }
        } catch (jwtError) {
            return res.status(401).json({ success: false, message: 'Invalid authorization token' });
        }

        // Fetch application data
        const query = `
            SELECT client_email, agent_email, agent_name, url, client_phoneNumber, resend_count
            FROM verify
            WHERE application_id = ?
        `;

        const results = await db.query(query, [application_id]);

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const { client_email, agent_email, agent_name, url, client_phoneNumber, resend_count } = results[0];

        // Setup nodemailer transporter
        const nodemailer = require('nodemailer');
        const axios = require('axios');
        
        const transporter = nodemailer.createTransport({
            host: 'mail.ariaslife.com',
            port: 465,
            secure: true,
            auth: {
                user: 'noreply@ariaslife.com',
                pass: 'Ariaslife123!'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: 'noreply@ariaslife.com',
            to: client_email,
            subject: 'Welcome to Globe Life - AIL Division',
            html: `
                <p>Thank you for choosing us to protect you and your family.</p>
                <p>Please use this <a href="${url}">link</a> to verify your application information.</p>
                <p>This checklist is required to move forward with the application process.</p>
                <p>If you have any questions, please reach out to your agent.</p>
            `
        };

        // Send email (wrapped so a failure doesn't block SMS)
        let emailSent = false;
        if (client_email) {
            try {
                await transporter.sendMail(mailOptions);
                emailSent = true;

                // Log email in verify_messages
                await db.query(
                    `INSERT INTO verify_messages (application_id, recipient_email, phone_number, direction, message_type, message, status)
                     VALUES (?, ?, NULL, 'outbound', 'email', ?, 'sent')`,
                    [application_id, client_email, `Verification survey email resent to ${client_email} (resend #${(resend_count || 0) + 1})`]
                );
            } catch (emailError) {
                console.error('Email error during resend:', emailError.message);
            }
        }

        // Send SMS if phone number exists
        let smsSent = false;
        if (client_phoneNumber) {
            try {
                const smsMessage = `Please review your American Income Life application survey: ${url}`;
                const smsResult = await twilioService.sendSMS({
                    toNumber: client_phoneNumber,
                    message: smsMessage,
                    userId: null,
                    statusCallback: VERIFY_STATUS_CALLBACK_URL
                });
                if (smsResult.success) {
                    smsSent = true;
                    await db.query(
                        `INSERT INTO verify_messages (application_id, phone_number, direction, message_type, message, twilio_sid, status)
                         VALUES (?, ?, 'outbound', 'sms', ?, ?, 'sent')`,
                        [application_id, client_phoneNumber, smsMessage, smsResult.messageId]
                    );
                }
            } catch (smsError) {
                console.error('SMS error during resend:', smsError.message);
            }
        }

        // Only update status if at least one channel succeeded
        if (!emailSent && !smsSent) {
            return res.status(500).json({ success: false, message: 'Failed to send both email and SMS' });
        }

        // Update resend count and status
        const updateQuery = `
            UPDATE verify
            SET resend_count = ?, status = 'Resent by Staff', resent_time = NOW()
            WHERE application_id = ?
        `;
        await db.query(updateQuery, [(resend_count || 0) + 1, application_id]);

        const channels = [emailSent && 'email', smsSent && 'SMS'].filter(Boolean).join(' and ');
        res.status(200).json({
            success: true,
            message: `Resent via ${channels} to ${client_email || client_phoneNumber}`
        });
    } catch (error) {
        console.error('Error in resend:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to send email for a single application (Individual Send Early functionality)
router.post('/send-early/:applicationId', async (req, res) => {
    try {
        const { applicationId } = req.params;

        // Check if user has app admin permissions
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No authorization token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const userId = decoded.id || decoded.userId;
            
            // Check if user has teamRole = "app" or Role = "Admin"
            const userQuery = 'SELECT teamRole, Role FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);

            if (userResult.length === 0 || (userResult[0].teamRole !== 'app' && userResult[0].Role !== 'Admin')) {
                return res.status(403).json({ success: false, message: 'Access denied. Only app admins can send verification emails.' });
            }
        } catch (jwtError) {
            return res.status(401).json({ success: false, message: 'Invalid authorization token' });
        }

        // Get the specific application
        const query = `
            SELECT application_id, client_email, agent_email, agent_name, url, client_phoneNumber, status
            FROM verify
            WHERE application_id = ?
        `;

        const results = await db.query(query, [applicationId]);

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        const application = results[0];

        // Check if application is already sent
        if (application.status === 'Sent') {
            return res.status(400).json({ success: false, message: 'Application has already been sent.' });
        }

        // Check if application is queued (optional validation)
        if (application.status !== 'Queued') {
            console.warn(`Application ${applicationId} status is '${application.status}', but proceeding with send early.`);
        }

        // Setup nodemailer transporter
        const nodemailer = require('nodemailer');
        const axios = require('axios');
        
        const transporter = nodemailer.createTransport({
            host: 'mail.ariaslife.com',
            port: 465,
            secure: true,
            auth: {
                user: 'noreply@ariaslife.com',
                pass: 'Ariaslife123!'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        try {
            const mailOptions = {
                from: 'noreply@ariaslife.com',
                to: application.client_email,
                subject: 'Welcome to Globe Life - AIL/NIL Arias Organization',
                html: `
                    <p>Thank you for choosing us to protect you and your family.</p>
                    <p>Please use this <a href="${application.url}">link</a> to verify your application information.</p>
                    <p>This checklist is required to move forward with the application process.</p>
                    <p>If you have any questions, please reach out to your agent.</p>
                `
            };

            // Send email
            await transporter.sendMail(mailOptions);

            // Log email in verify_messages
            await db.query(
                `INSERT INTO verify_messages (application_id, recipient_email, phone_number, direction, message_type, message, status)
                 VALUES (?, ?, NULL, 'outbound', 'email', ?, 'sent')`,
                [application.application_id, application.client_email, `Verification survey email sent early to ${application.client_email}`]
            );

            // Send SMS if phone number exists
            if (application.client_phoneNumber) {
                try {
                    const smsMessage = `Please review your American Income Life application survey: ${application.url}`;
                    const smsResult = await twilioService.sendSMS({
                        toNumber: application.client_phoneNumber,
                        message: smsMessage,
                        userId: null,
                        statusCallback: VERIFY_STATUS_CALLBACK_URL
                    });
                    if (smsResult.success) {
                        await db.query(
                            `INSERT INTO verify_messages (application_id, phone_number, direction, message_type, message, twilio_sid, status)
                             VALUES (?, ?, 'outbound', 'sms', ?, ?, 'sent')`,
                            [application.application_id, application.client_phoneNumber, smsMessage, smsResult.messageId]
                        );
                    }
                } catch (smsError) {
                    console.error(`SMS failed for ${application.application_id}:`, smsError.message);
                }
            }

            // Update status to 'Sent'
            const updateQuery = `UPDATE verify SET status = 'Sent' WHERE application_id = ?`;
            await db.query(updateQuery, [application.application_id]);

            res.status(200).json({ 
                success: true, 
                message: `Application ${application.application_id} sent successfully.`,
                application_id: application.application_id
            });

        } catch (error) {
            console.error(`Failed to send application ${applicationId}:`, error);
            res.status(500).json({ success: false, message: 'Failed to send application.' });
        }

    } catch (error) {
        console.error('Error in send-early:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to get promotion tracking data
router.get('/promotion-tracking', async (req, res) => {
    try {
        // Check if user has app admin permissions
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No authorization token provided' });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const userId = decoded.id || decoded.userId;
            
            const userQuery = 'SELECT teamRole, Role FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);

            if (userResult.length === 0 || (userResult[0].teamRole !== 'app' && userResult[0].Role !== 'Admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Only app admins can access promotion tracking.'
                });
            }
        } catch (jwtError) {
            return res.status(401).json({ success: false, message: 'Invalid authorization token' });
        }

        // Normalize months param and tracking period
        const trackingPeriod = req.query.trackingPeriod || '2month';
        const rawMonths = req.query.months;
        let months = [];
        if (Array.isArray(rawMonths)) {
            months = rawMonths;
        } else if (typeof rawMonths === 'string') {
            // Support single month sent as string
            months = [rawMonths];
        }

        let month1, month2;
        const useSingleMonth = (trackingPeriod === '1month' && months.length >= 1) || months.length === 1;

        if (useSingleMonth) {
            // Use just the one month provided
            month1 = months[0];
        } else if (months.length === 2) {
            // Use two months from frontend
            month1 = months[0];
            month2 = months[1];
        } else {
            // Default to past two months
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
            const currentYear = now.getFullYear();
            
            // Calculate previous month
            let prevMonth = currentMonth - 1;
            let prevYear = currentYear;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear = currentYear - 1;
            }
            
            // Calculate two months ago
            let twoMonthsAgo = prevMonth - 1;
            let twoMonthsAgoYear = prevYear;
            if (twoMonthsAgo === 0) {
                twoMonthsAgo = 12;
                twoMonthsAgoYear = prevYear - 1;
            }
            
            // Format months as MM/YYYY
            const formatMonth = (month, year) => `${month.toString().padStart(2, '0')}/${year}`;
            
            month1 = formatMonth(twoMonthsAgo, twoMonthsAgoYear);
            month2 = formatMonth(prevMonth, prevYear);
        }

        // Get agent type from query parameters (default to GA)
        const agentType = req.query.agentType || 'GA';
        const isSA = agentType === 'SA';


        // Build query for promotion tracking data based on agent type and period length
        let promotionQuery;
        let queryParams = [];
        if (isSA) {
            // SA agents use LVL_2_* fields
            if (useSingleMonth) {
                promotionQuery = `
                    SELECT
                        m.LagnName,
                        COALESCE(SUM(m.LVL_2_NET), 0) AS lvl_2_net_total,
                        COALESCE(SUM(m.LVL_2_F6_NET), 0) AS lvl_2_f6_net_total,
                        COALESCE(SUM(m.LVL_2_NET + m.LVL_2_F6_NET), 0) AS combined_total,
                        a.lagnname,
                        a.clname AS currentLevel,
                        a.mga
                    FROM Monthly_ALP AS m
                    JOIN activeusers AS a ON m.LagnName = a.lagnname
                    WHERE a.clname = 'SA'
                        AND a.Active = 'y'
                        AND m.Month = ?
                    GROUP BY m.LagnName, a.lagnname, a.clname, a.mga
                    ORDER BY combined_total DESC, m.LagnName
                `;
                queryParams = [month1];
            } else {
                promotionQuery = `
                    SELECT
                        m.LagnName,
                        COALESCE(SUM(m.LVL_2_NET), 0) AS lvl_2_net_total,
                        COALESCE(SUM(m.LVL_2_F6_NET), 0) AS lvl_2_f6_net_total,
                        COALESCE(SUM(m.LVL_2_NET + m.LVL_2_F6_NET), 0) AS combined_total,
                        a.lagnname,
                        a.clname AS currentLevel,
                        a.mga
                    FROM Monthly_ALP AS m
                    JOIN activeusers AS a ON m.LagnName = a.lagnname
                    WHERE a.clname = 'SA'
                        AND a.Active = 'y'
                        AND m.Month IN (?, ?)
                    GROUP BY m.LagnName, a.lagnname, a.clname, a.mga
                    ORDER BY combined_total DESC, m.LagnName
                `;
                queryParams = [month1, month2];
            }
        } else {
            // GA agents use LVL_3_* fields
            if (useSingleMonth) {
                promotionQuery = `
                    SELECT
                        m.LagnName,
                        COALESCE(SUM(m.LVL_3_NET), 0) AS lvl_2_net_total,
                        COALESCE(SUM(m.LVL_3_F6_NET), 0) AS lvl_2_f6_net_total,
                        COALESCE(SUM(m.LVL_3_NET + m.LVL_3_F6_NET), 0) AS combined_total,
                        a.lagnname,
                        a.clname AS currentLevel,
                        a.mga
                    FROM Monthly_ALP AS m
                    JOIN activeusers AS a ON m.LagnName = a.lagnname
                    WHERE a.clname = 'GA'
                        AND a.Active = 'y'
                        AND m.Month = ?
                    GROUP BY m.LagnName, a.lagnname, a.clname, a.mga
                    ORDER BY combined_total DESC, m.LagnName
                `;
                queryParams = [month1];
            } else {
                promotionQuery = `
                    SELECT
                        m.LagnName,
                        COALESCE(SUM(m.LVL_3_NET), 0) AS lvl_2_net_total,
                        COALESCE(SUM(m.LVL_3_F6_NET), 0) AS lvl_2_f6_net_total,
                        COALESCE(SUM(m.LVL_3_NET + m.LVL_3_F6_NET), 0) AS combined_total,
                        a.lagnname,
                        a.clname AS currentLevel,
                        a.mga
                    FROM Monthly_ALP AS m
                    JOIN activeusers AS a ON m.LagnName = a.lagnname
                    WHERE a.clname = 'GA'
                        AND a.Active = 'y'
                        AND m.Month IN (?, ?)
                    GROUP BY m.LagnName, a.lagnname, a.clname, a.mga
                    ORDER BY combined_total DESC, m.LagnName
                `;
                queryParams = [month1, month2];
            }
        }

        const promotionResults = await db.query(promotionQuery, queryParams);

        // Calculate statistics
        const totalAgents = promotionResults.length;
        const avgCombinedTotal = totalAgents > 0 
            ? Math.round(promotionResults.reduce((sum, agent) => sum + parseFloat(agent.combined_total), 0) / totalAgents)
            : 0;
        
        // Define promotion thresholds based on agent type
        let netLvl3Threshold, f6Lvl3Threshold;
        if (isSA) {
            netLvl3Threshold = 50000;  // $50,000 lvl 2 net for SA
            f6Lvl3Threshold = 25000;   // $25,000 lvl 2 f6 net for SA
        } else {
            netLvl3Threshold = 120000; // $120,000 net lvl 3 alp for GA
            f6Lvl3Threshold = 60000;   // $60,000 f6 lvl 3 net alp for GA
        }
        
        // Check if agent meets BOTH requirements
        const eligibleForPromotion = promotionResults.filter(agent => {
            const netLvl3Total = parseFloat(agent.lvl_2_net_total);
            const f6Lvl3Total = parseFloat(agent.lvl_2_f6_net_total);
            
            return netLvl3Total >= netLvl3Threshold && f6Lvl3Total >= f6Lvl3Threshold;
        });

        res.status(200).json({
            success: true,
            data: {
                agents: promotionResults,
                statistics: {
                    totalAgents,
                    avgCombinedTotal,
                    eligibleForPromotion: eligibleForPromotion.length,
                    netLvl3Threshold,
                    f6Lvl3Threshold
                },
                months: useSingleMonth ? [month1] : [month1, month2],
                selectedMonths: useSingleMonth ? [month1] : [month1, month2],
                agentType: agentType
            }
        });

    } catch (error) {
        console.error('Error fetching promotion tracking data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Promotion history from activeusers_archive
router.get('/promotion-history', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No authorization token provided' });
        }

        const token = authHeader.replace('Bearer ', '');
        const jwt = require('jsonwebtoken');

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
            const userId = decoded.id || decoded.userId;
            const userQuery = 'SELECT teamRole, Role FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);
            if (userResult.length === 0 || (userResult[0].teamRole !== 'app' && userResult[0].Role !== 'Admin')) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        } catch (jwtError) {
            return res.status(401).json({ success: false, message: 'Invalid authorization token' });
        }

        const { startDate, endDate } = req.query;

        // Get consecutive date pairs in range
        const datesQuery = `
            SELECT DISTINCT reportdate FROM activeusers_archive
            WHERE reportdate IS NOT NULL
            ${startDate ? 'AND reportdate >= ?' : ''}
            ${endDate ? 'AND reportdate <= ?' : ''}
            ORDER BY reportdate
        `;
        const datesParams = [];
        if (startDate) datesParams.push(startDate);
        if (endDate) datesParams.push(endDate);
        const dates = await db.query(datesQuery, datesParams);
        const reportDates = dates.map(d => d.reportdate);

        if (reportDates.length < 2) {
            return res.json({ success: true, data: { promotions: [], summary: [] } });
        }

        // Include one date before the range to catch promotions on the first date
        let priorDate = null;
        if (startDate) {
            const priorQuery = `SELECT MAX(reportdate) as d FROM activeusers_archive WHERE reportdate < ? AND reportdate IS NOT NULL`;
            const priorResult = await db.query(priorQuery, [startDate]);
            if (priorResult.length > 0 && priorResult[0].d) {
                priorDate = priorResult[0].d;
            }
        }

        // Build date pairs for comparison
        const allDates = priorDate ? [priorDate, ...reportDates] : reportDates;
        const datePairs = [];
        for (let i = 1; i < allDates.length; i++) {
            datePairs.push([allDates[i - 1], allDates[i]]);
        }

        // Compare each consecutive pair using efficient two-date join
        const promotions = [];
        for (const [prevDate, currDate] of datePairs) {
            const pairQuery = `
                SELECT
                    curr.lagnname,
                    prev.clname AS old_clname,
                    curr.clname AS new_clname,
                    ? AS prev_date,
                    ? AS promotion_date,
                    prev.mga AS mga,
                    prev.rga AS rga,
                    prev.rept_name
                FROM activeusers_archive curr
                JOIN activeusers_archive prev
                    ON curr.lagnname = prev.lagnname
                    AND prev.reportdate = ?
                WHERE curr.reportdate = ?
                    AND curr.clname != prev.clname
                    AND (
                        (prev.clname = 'AGT' AND curr.clname IN ('SA', 'GA', 'MGA'))
                        OR (prev.clname = 'SA' AND curr.clname IN ('GA', 'MGA'))
                        OR (prev.clname = 'GA' AND curr.clname = 'MGA')
                    )
            `;
            const pairResults = await db.query(pairQuery, [prevDate, currDate, prevDate, currDate]);
            promotions.push(...pairResults);
        }

        // Sort by date desc, then mga, then name
        promotions.sort((a, b) => {
            const dateA = new Date(a.promotion_date);
            const dateB = new Date(b.promotion_date);
            if (dateB - dateA !== 0) return dateB - dateA;
            const mgaA = a.mga || '';
            const mgaB = b.mga || '';
            if (mgaA !== mgaB) return mgaA.localeCompare(mgaB);
            return (a.lagnname || '').localeCompare(b.lagnname || '');
        });

        // Build summary by MGA
        const mgaSummary = {};
        for (const p of promotions) {
            const mgaKey = p.mga || 'Unknown';
            if (!mgaSummary[mgaKey]) {
                mgaSummary[mgaKey] = { mga: mgaKey, rga: p.rga || '', rept_name: p.rept_name || '', total: 0, agt_to_sa: 0, agt_to_ga: 0, agt_to_mga: 0, sa_to_ga: 0, sa_to_mga: 0, ga_to_mga: 0 };
            }
            mgaSummary[mgaKey].total++;
            if (p.old_clname === 'AGT' && p.new_clname === 'SA') mgaSummary[mgaKey].agt_to_sa++;
            else if (p.old_clname === 'AGT' && p.new_clname === 'GA') mgaSummary[mgaKey].agt_to_ga++;
            else if (p.old_clname === 'AGT' && p.new_clname === 'MGA') mgaSummary[mgaKey].agt_to_mga++;
            else if (p.old_clname === 'SA' && p.new_clname === 'GA') mgaSummary[mgaKey].sa_to_ga++;
            else if (p.old_clname === 'SA' && p.new_clname === 'MGA') mgaSummary[mgaKey].sa_to_mga++;
            else if (p.old_clname === 'GA' && p.new_clname === 'MGA') mgaSummary[mgaKey].ga_to_mga++;
        }

        res.json({
            success: true,
            data: {
                promotions,
                summary: Object.values(mgaSummary).sort((a, b) => b.total - a.total)
            }
        });
    } catch (error) {
        console.error('Error fetching promotion history:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Twilio status webhook for verification SMS
router.post('/webhook/status', async (req, res) => {
    try {
        const { MessageSid, MessageStatus } = req.body;
        if (MessageSid && MessageStatus) {
            await db.query(
                'UPDATE verify_messages SET status = ? WHERE twilio_sid = ?',
                [MessageStatus, MessageSid]
            );
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('[Verify Webhook] Status update error:', error);
        res.status(200).send('OK');
    }
});

// Get all verify conversations (applications with message activity)
router.get('/conversations', async (req, res) => {
    try {
        const { status, search } = req.query;

        let queryText = `
            SELECT v.application_id, v.client_name, v.client_phoneNumber, v.client_email,
                   v.agent_name, v.status, v.created_at,
                   vm.last_message, vm.last_message_at, vm.last_direction, vm.last_message_type,
                   vm.message_count, vm.inbound_count, vm.email_count, vm.sms_count
            FROM verify v
            INNER JOIN (
                SELECT application_id,
                       MAX(created_at) AS last_message_at,
                       COUNT(*) AS message_count,
                       SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound_count,
                       SUM(CASE WHEN message_type = 'email' THEN 1 ELSE 0 END) AS email_count,
                       SUM(CASE WHEN message_type = 'sms' THEN 1 ELSE 0 END) AS sms_count,
                       (SELECT message FROM verify_messages vm2 WHERE vm2.application_id = verify_messages.application_id ORDER BY vm2.created_at DESC LIMIT 1) AS last_message,
                       (SELECT direction FROM verify_messages vm3 WHERE vm3.application_id = verify_messages.application_id ORDER BY vm3.created_at DESC LIMIT 1) AS last_direction,
                       (SELECT message_type FROM verify_messages vm4 WHERE vm4.application_id = verify_messages.application_id ORDER BY vm4.created_at DESC LIMIT 1) AS last_message_type
                FROM verify_messages
                GROUP BY application_id
            ) vm ON v.application_id = vm.application_id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'all') {
            if (status === 'replied') {
                queryText += " AND vm.inbound_count > 0";
            } else if (status === 'no_reply') {
                queryText += " AND vm.inbound_count = 0";
            }
        }

        if (search) {
            queryText += " AND (v.client_name LIKE ? OR v.agent_name LIKE ? OR v.client_phoneNumber LIKE ? OR v.application_id LIKE ?)";
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        queryText += " ORDER BY vm.last_message_at DESC";

        const results = await db.query(queryText, params);
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching verify conversations:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get SMS messages for a verification application
router.get('/:applicationId/messages', async (req, res) => {
    try {
        const { applicationId } = req.params;

        // Get application info
        const appResults = await db.query(
            'SELECT application_id, client_name, client_phoneNumber, client_email, status FROM verify WHERE application_id = ?',
            [applicationId]
        );

        if (appResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const contact = appResults[0];

        // Get messages
        const messages = await db.query(
            'SELECT * FROM verify_messages WHERE application_id = ? ORDER BY created_at ASC',
            [applicationId]
        );

        res.status(200).json({
            success: true,
            data: {
                contact: {
                    application_id: contact.application_id,
                    client_name: contact.client_name,
                    client_phoneNumber: contact.client_phoneNumber,
                    client_email: contact.client_email,
                    status: contact.status
                },
                messages
            }
        });
    } catch (error) {
        console.error('Error fetching verify messages:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Send a reply SMS to a verification client
router.post('/:applicationId/reply', async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        // Get application info
        const appResults = await db.query(
            'SELECT application_id, client_phoneNumber FROM verify WHERE application_id = ?',
            [applicationId]
        );

        if (appResults.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const app = appResults[0];
        if (!app.client_phoneNumber) {
            return res.status(400).json({ success: false, message: 'No phone number on file for this client' });
        }

        // Get user ID from token
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'default_secret');
                userId = decoded.id || decoded.userId;
            } catch (e) { /* ignore */ }
        }

        const smsResult = await twilioService.sendSMS({
            toNumber: app.client_phoneNumber,
            message: message.trim(),
            userId,
            statusCallback: VERIFY_STATUS_CALLBACK_URL
        });

        if (!smsResult.success) {
            return res.status(500).json({ success: false, message: smsResult.error || 'Failed to send SMS' });
        }

        await db.query(
            `INSERT INTO verify_messages (application_id, phone_number, direction, message_type, message, twilio_sid, status, sent_by)
             VALUES (?, ?, 'outbound', 'sms', ?, ?, 'sent', ?)`,
            [applicationId, app.client_phoneNumber, message.trim(), smsResult.messageId, userId]
        );

        res.status(200).json({ success: true, message: 'Reply sent' });
    } catch (error) {
        console.error('Error sending verify reply:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;