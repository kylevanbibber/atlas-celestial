const express = require('express');
const router = express.Router();
const db = require('../db');
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
        const status = total_annual_premium < 1200 ? 'Not at Threshold' : 'Queued';

        // Build url using application_id
        const url = `https://atlas.ariaslife.com/verify/clients.html?${application_id}`;

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
        const verifyClientQuery = 'SELECT * FROM verify_client WHERE application_id = ?';
        const verifyClientResults = await db.query(verifyClientQuery, [application_id]);

        if (verifyClientResults.length > 0) {
            return res.status(200).json({
                success: true,
                data: verifyResults[0],
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
                SELECT vc.* FROM verify_client vc 
                JOIN verify v ON vc.application_id = v.application_id 
                WHERE v.archive = 'y' 
                ORDER BY vc.submission_date DESC
            `;
        } else {
            // Show client responses for non-archived applications (default behavior)
            queryText = `
                SELECT vc.* FROM verify_client vc 
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
        const userQuery = 'SELECT * FROM activeusers WHERE id = ?';
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
            // For SAs, return all agents under them
            const query = 'SELECT * FROM activeusers WHERE sa = ? AND clname = "AGT" AND managerActive = "y"';
            agentData = await db.query(query, [user.lagnname]);
            defaultAgent = agentData.length > 0 ? agentData[0].lagnname : '';
        } else if (user.clname === 'GA') {
            // For GAs, return all agents under them
            const query = 'SELECT * FROM activeusers WHERE ga = ? AND clname = "AGT" AND managerActive = "y"';
            agentData = await db.query(query, [user.lagnname]);
            defaultAgent = agentData.length > 0 ? agentData[0].lagnname : '';
        } else if (user.clname === 'MGA') {
            // For MGAs, return all agents under them
            const query = 'SELECT * FROM activeusers WHERE mga = ? AND clname = "AGT" AND managerActive = "y"';
            agentData = await db.query(query, [user.lagnname]);
            defaultAgent = agentData.length > 0 ? agentData[0].lagnname : '';
        } else if (user.clname === 'RGA') {
            // For RGAs, return all agents under them
            const query = 'SELECT * FROM activeusers WHERE rga = ? AND clname = "AGT" AND managerActive = "y"';
            agentData = await db.query(query, [user.lagnname]);
            defaultAgent = agentData.length > 0 ? agentData[0].lagnname : '';
        } else {
            // For other roles (admin, etc.), return all active agents
            const query = 'SELECT * FROM activeusers WHERE clname = "AGT" AND managerActive = "y"';
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
        
        const transporter = nodemailer.createTransporter({
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
                    const cleanedPhoneNumber = row.client_phoneNumber.replace(/\D/g, '');
                    const formattedPhoneNumber = `1${cleanedPhoneNumber}`;

                    const smsPayload = {
                        phones: formattedPhoneNumber,
                        text: `Please review your American Income Life application survey: ${row.url}`
                    };

                    const smsOptions = {
                        headers: {
                            'Authorization': 'Basic ' + Buffer.from('kylevanbibber:KhOgOwCHQVhUMXR2h37tV3HTZym2pb').toString('base64'),
                            'Content-Type': 'application/json'
                        }
                    };

                    try {
                        await axios.post('https://rest.textmagic.com/api/v2/messages', smsPayload, smsOptions);
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
        
        const transporter = nodemailer.createTransporter({
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
            const cleanedPhoneNumber = client_phoneNumber.replace(/\D/g, '');
            const formattedPhoneNumber = `1${cleanedPhoneNumber}`;

            const smsPayload = {
                phones: formattedPhoneNumber,
                text: `Please review your American Income Life application survey: ${url}`
            };

            const smsOptions = {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('kylevanbibber:KhOgOwCHQVhUMXR2h37tV3HTZym2pb').toString('base64'),
                    'Content-Type': 'application/json'
                }
            };

            try {
                await axios.post('https://rest.textmagic.com/api/v2/messages', smsPayload, smsOptions);
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

module.exports = router; 