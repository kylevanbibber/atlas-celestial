const express = require('express');
const router = express.Router();
const db = require('../db');
const twilioService = require('../services/twilio');
const { v4: uuidv4 } = require('uuid');

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

// Route to fetch all data from the verify table except for status 'Not at Threshold'
router.get('/all', async (req, res) => {
    try {
        const { archive } = req.query;
        let queryText;
        
        if (archive === 'true') {
            // Show archived records
            queryText = "SELECT * FROM verify WHERE status != 'Not at Threshold' AND archive = 'y' ORDER BY created_at DESC";
        } else {
            // Show non-archived records (default behavior)
            queryText = "SELECT * FROM verify WHERE status != 'Not at Threshold' AND (archive IS NULL OR archive != 'y') ORDER BY created_at DESC";
        }
        
        const results = await db.query(queryText);

        if (results.length > 0) {
            res.status(200).json({ success: true, data: results });
        } else {
            res.status(200).json({ success: true, data: [] });
        }
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
        const { archive } = req.query;
        let queryText;
        
        if (archive === 'true') {
            // Show client responses for archived applications
            queryText = `
                SELECT vc.*, v.client_email, v.client_phoneNumber 
                FROM verify_client vc 
                JOIN verify v ON vc.application_id = v.application_id 
                WHERE v.archive = 'y' 
                ORDER BY vc.submission_date DESC
            `;
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
        
        const results = await db.query(queryText);

        if (results.length > 0) {
            res.status(200).json({ success: true, data: results });
        } else {
            res.status(200).json({ success: true, data: [] });
        }
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
            
            const userQuery = 'SELECT teamRole FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);
            
            if (userResult.length === 0 || userResult[0].teamRole !== 'app') {
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
            SELECT au.*, COALESCE(ui.email, '') AS email 
            FROM activeusers au
            LEFT JOIN usersinfo ui ON au.lagnname = ui.lagnname AND au.esid = ui.esid
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
                SELECT au.*, COALESCE(ui.email, '') AS email 
                FROM activeusers au
                LEFT JOIN usersinfo ui ON au.lagnname = ui.lagnname AND au.esid = ui.esid
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
                SELECT au.*, COALESCE(ui.email, '') AS email 
                FROM activeusers au
                LEFT JOIN usersinfo ui ON au.lagnname = ui.lagnname AND au.esid = ui.esid
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
                SELECT au.*, COALESCE(ui.email, '') AS email 
                FROM activeusers au
                LEFT JOIN usersinfo ui ON au.lagnname = ui.lagnname AND au.esid = ui.esid
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
                SELECT au.*, COALESCE(ui.email, '') AS email 
                FROM activeusers au
                LEFT JOIN usersinfo ui ON au.lagnname = ui.lagnname AND au.esid = ui.esid
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
                SELECT au.*, COALESCE(ui.email, '') AS email 
                FROM activeusers au
                LEFT JOIN usersinfo ui ON au.lagnname = ui.lagnname AND au.esid = ui.esid
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
            
            // Check if user has teamRole = "app"
            const userQuery = 'SELECT teamRole FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);
            
            if (userResult.length === 0 || userResult[0].teamRole !== 'app') {
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

                // Send SMS if phone number exists
                if (row.client_phoneNumber) {
                    try {
                        await twilioService.sendSMS({
                            toNumber: row.client_phoneNumber,
                            message: `Please review your American Income Life application survey: ${row.url}`,
                            userId: null
                        });
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
            
            // Check if user has teamRole = "app"
            const userQuery = 'SELECT teamRole FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);
            
            if (userResult.length === 0 || userResult[0].teamRole !== 'app') {
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

        // Send email
        await transporter.sendMail(mailOptions);

        // Send SMS if phone number exists
        if (client_phoneNumber) {
            try {
                await twilioService.sendSMS({
                    toNumber: client_phoneNumber,
                    message: `Please review your American Income Life application survey: ${url}`,
                    userId: null
                });
            } catch (smsError) {
                console.error('SMS error:', smsError.message);
            }
        }

        // Update resend count and status
        const updateQuery = `
            UPDATE verify 
            SET resend_count = ?, status = 'Resent by Staff', resent_time = NOW() 
            WHERE application_id = ?
        `;
        await db.query(updateQuery, [(resend_count || 0) + 1, application_id]);

        res.status(200).json({ 
            success: true, 
            message: `Email and SMS resent to ${client_email}` 
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
            
            // Check if user has teamRole = "app"
            const userQuery = 'SELECT teamRole FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);
            
            if (userResult.length === 0 || userResult[0].teamRole !== 'app') {
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

            // Send SMS if phone number exists
            if (application.client_phoneNumber) {
                try {
                    await twilioService.sendSMS({
                        toNumber: application.client_phoneNumber,
                        message: `Please review your American Income Life application survey: ${application.url}`,
                        userId: null
                    });
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
            
            const userQuery = 'SELECT teamRole FROM activeusers WHERE id = ?';
            const userResult = await db.query(userQuery, [userId]);
            
            if (userResult.length === 0 || userResult[0].teamRole !== 'app') {
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

module.exports = router; 