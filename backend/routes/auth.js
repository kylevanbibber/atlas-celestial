// auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB limit
    fieldSize: 25 * 1024 * 1024 // 25MB field size limit
  }
});

// Import your database connection and query functions
const { query } = require("../db");

// Import any middleware (e.g., for verifying tokens)
const verifyToken = require("../middleware/verifyToken");

// Configure Express body parser limits
const bodyParserLimit = '50mb';

// Imgur credentials
const IMGUR_CLIENT_ID = 'd08c81e700c9978';

/* ----------------------
   Active Users Routes
------------------------- */
// Get a single user by ID
router.get("/activeusers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM activeusers WHERE id = ? AND Active = "y"',
      [id]
    );
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ success: false, message: "Error fetching user data" });
  }
});

// Get users by lagnname (for reassignment)
router.get("/activeusers", async (req, res) => {
  try {
    const { lagnname, active, managerActive } = req.query;
    
    let queryText = 'SELECT * FROM activeusers WHERE Active = "y"';
    const params = [];

    if (lagnname) {
      queryText += ' AND (lagnname = ? OR sa = ? OR ga = ? OR mga = ? OR rga = ?)';
      params.push(lagnname, lagnname, lagnname, lagnname, lagnname);
    }

    if (active === 'y') {
      queryText += ' AND Active = "y"';
    }

    if (managerActive === 'y') {
      queryText += ' AND managerActive = "y"';
    }

    const results = await query(queryText, params);
    res.json(results);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ success: false, message: "Error fetching active users" });
  }
});

/* ----------------------
   Username → MGA helper (public)
------------------------- */
router.get('/username-mgas', async (req, res) => {
  try {
    const rawUsername = String(req.query.username || '').trim().toLowerCase();
    if (!rawUsername) {
      return res.status(400).json({ success: false, message: 'username is required' });
    }

    // Pull minimal fields to derive usernames client-side
    const rows = await query(
      `SELECT lagnname, mga FROM activeusers WHERE Active = 'y'`
    );

    const computeUsername = (lagnname) => {
      if (!lagnname) return null;
      const parts = String(lagnname).trim().split(/\s+/);
      const lastName = (parts[0] || '').toLowerCase();
      const firstInitial = (parts[1] ? parts[1][0] : (parts[0] ? parts[0][0] : '')).toLowerCase();
      return (firstInitial + lastName) || null;
    };

    const matching = rows.filter(r => computeUsername(r.lagnname) === rawUsername);
    const mgaOptions = Array.from(new Set(matching.map(r => r.mga).filter(Boolean)));

    return res.json({ success: true, username: rawUsername, mgaOptions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error searching username options' });
  }
});

/* ----------------------
   Password Assist: send credentials to MGA email (public)
------------------------- */
router.post('/password-assist/send-to-mga', async (req, res) => {
  try {
    const { username, mga } = req.body || {};
    if (!username || !mga) {
      return res.status(400).json({ success: false, message: 'username and mga are required' });
    }

    // Find user by derived username and MGA
    const users = await query(
      `SELECT id, lagnname, agtnum, email, password, mga FROM activeusers WHERE Active = 'y'`
    );

    const computeUsername = (lagnname) => {
      if (!lagnname) return null;
      const parts = String(lagnname).trim().split(/\s+/);
      const lastName = (parts[0] || '').toLowerCase();
      const firstInitial = (parts[1] ? parts[1][0] : (parts[0] ? parts[0][0] : '')).toLowerCase();
      return (firstInitial + lastName) || null;
    };

    const target = users.find(u => (computeUsername(u.lagnname) === String(username).trim().toLowerCase()) && String(u.mga || '') === mga);
    if (!target) {
      return res.status(404).json({ success: false, message: 'No user found for that username and MGA' });
    }

    // Find MGA email (prefer usersinfo, fallback to activeusers)
    const mgaRow = await query(
      `SELECT au.lagnname, COALESCE(ui.email, au.email, '') AS email
       FROM activeusers au
       LEFT JOIN usersinfo ui ON ui.lagnname = au.lagnname AND ui.esid = au.esid
       WHERE au.lagnname = ? LIMIT 1`,
      [mga]
    );
    const destinationEmail = (mgaRow && mgaRow[0] && mgaRow[0].email) ? mgaRow[0].email : '';
    if (!destinationEmail) {
      return res.status(400).json({ success: false, message: 'MGA does not have an email on file' });
    }

    // Reset password to default if needed
    const currentPassword = String(target.password || '').trim();
    if (currentPassword !== 'default') {
      await query(`UPDATE activeusers SET password = 'default' WHERE id = ?`, [target.id]);
    }

    // Build email
    const subject = `Arias Life – Account Details for ${target.lagnname}`;
    const derivedUsername = computeUsername(target.lagnname);
    const agtNumberPassword = String(target.agtnum || '').trim();
    const frontendUrl = process.env.FRONTEND_URL || 'https://agents.ariaslife.com';
    const loginUrl = `${frontendUrl.replace(/\/$/, '')}/login`;

    const html = `
      <div style="background:#f6f9fc;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#e2e8f0,#93c5fd);padding:24px 20px;">
            <h2 style="margin:0;font-size:20px;color:#0f172a">Account Assistance Request</h2>
            <p style="margin:8px 0 0 0;font-size:13px;color:#334155">The following user requested help with their login.</p>
          </div>
          <div style="padding:18px 20px 8px 20px;">
            <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fafafa">
              <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px">
                <span style="font-weight:600;color:#0f172a">Agent</span>
                <span style="color:#0f172a">${target.lagnname}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px">
                <span style="font-weight:600;color:#0f172a">Username</span>
                <span style="color:#0f172a">${derivedUsername}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:8px">
                <span style="font-weight:600;color:#0f172a">Password</span>
                <span style="color:#0f172a">${agtNumberPassword || '(not set)'} </span>
              </div>
            </div>
            <p style="margin:14px 0 0 0;font-size:13px;color:#334155">You can share these credentials with the agent and direct them to log in.</p>
            <div style="margin:16px 0 8px 0">
              <a href="${loginUrl}" style="display:inline-block;background:#0b5a8f;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open Login</a>
            </div>
          </div>
          <div style="padding:0 20px 18px 20px;color:#64748b;font-size:12px">
            <p style="margin:0">This message was sent to your MGA email because an agent under your hierarchy requested login help.</p>
          </div>
        </div>
      </div>`;

    const transporter = require('nodemailer').createTransport({
      host: 'mail.ariaslife.com',
      port: 465,
      secure: true,
      auth: { user: 'noreply@ariaslife.com', pass: 'Ariaslife123!' },
      tls: { rejectUnauthorized: false }
    });

    await transporter.sendMail({
      from: 'noreply@ariaslife.com',
      to: destinationEmail,
      subject,
      html
    });

    return res.json({ success: true, message: `Account details sent to MGA ${mga}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to send details to MGA' });
  }
});

/* ----------------------
   Toggle Manager Active Status Route
------------------------- */
router.post("/toggleActive", verifyToken, async (req, res) => {
  try {
    const { userId, currentStatus } = req.body;
    
    console.log('🔄 toggleActive called with:', { userId, currentStatus });
    
    if (!userId) {
      console.log('❌ No userId provided');
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    // First, let's get the user's ID from activeusers table to log it
    const userQuery = await query(
      'SELECT id, lagnname, managerActive FROM activeusers WHERE lagnname = ?',
      [userId]
    );
    
    if (userQuery.length === 0) {
      console.log('❌ User not found in activeusers table:', userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const user = userQuery[0];
    console.log('👤 Found user:', { 
      id: user.id, 
      lagnname: user.lagnname, 
      currentManagerActive: user.managerActive 
    });
    
    // Toggle the managerActive status (from 'y' to 'n' or 'n' to 'y')
    const newStatus = currentStatus && currentStatus.toLowerCase() === 'y' ? 'n' : 'y';
    console.log('🔄 Changing managerActive from', user.managerActive, 'to', newStatus);
    
    // Update the user's managerActive status
    const result = await query(
      'UPDATE activeusers SET managerActive = ? WHERE lagnname = ?',
      [newStatus, userId]
    );
    
    console.log('📝 Update result:', { affectedRows: result.affectedRows });
    
    if (result.affectedRows === 0) {
      console.log('❌ No rows affected in update');
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    console.log('✅ Successfully updated managerActive for user ID:', user.id, 'to', newStatus);
    
    res.json({ 
      success: true, 
      message: `User active status updated to ${newStatus === 'y' ? 'active' : 'inactive'}`,
      newStatus 
    });
  } catch (error) {
    console.error('❌ Error in toggleActive:', error);
    res.status(500).json({ success: false, message: "Error updating active status" });
  }
});

// Set user managerActive to inactive (n) - for context menu action
router.post("/setManagerInactive", verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    console.log('🔄 Setting managerActive to inactive for user ID:', userId);
    
    // Get user info first
    const userQuery = await query(
      'SELECT id, lagnname, managerActive FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (userQuery.length === 0) {
      console.log('❌ User not found in activeusers table with ID:', userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const user = userQuery[0];
    console.log('👤 Found user:', { 
      id: user.id, 
      lagnname: user.lagnname, 
      currentManagerActive: user.managerActive 
    });
    
    // Set managerActive to 'n' (inactive)
    const result = await query(
      'UPDATE activeusers SET managerActive = ? WHERE id = ?',
      ['n', userId]
    );
    
    console.log('📝 Update result:', { affectedRows: result.affectedRows });
    
    if (result.affectedRows === 0) {
      console.log('❌ No rows affected in update');
      return res.status(404).json({ success: false, message: "User not found or no changes made" });
    }
    
    console.log('✅ Successfully set managerActive to inactive for user:', user.lagnname);
    
    res.json({ 
      success: true, 
      message: `${user.lagnname} has been set to manager inactive`,
      userId: user.id,
      lagnname: user.lagnname,
      newStatus: 'n'
    });
  } catch (error) {
    console.error('❌ Error setting manager inactive:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

/* ----------------------
   Profile Route
------------------------- */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    const user = await query(
      'SELECT id, lagnname, email, phone, profpic, header_pic, clname, Role, screen_name, esid, mga, agtnum, bio, teamRole FROM activeusers WHERE id = ? AND Active = "y"',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Format the response to match frontend expectations
    res.json({
      userId: user[0].id,
      name: user[0].lagnname,
      email: user[0].email || '',
      phone: user[0].phone || '',
      profpic: user[0].profpic || '',
      profilePic: user[0].profpic || '',
      headerPic: user[0].header_pic || '',
      header_pic: user[0].header_pic || '',
      clname: user[0].clname || '',
      Role: user[0].Role || '',
      permissions: user[0].Role || '',
      lagnname: user[0].lagnname || '',
      agnName: user[0].lagnname || '',
      screenName: user[0].screen_name || '',
      esid: user[0].esid || '',
      mga: user[0].mga || '',
      agtnum: user[0].agtnum || '',
      bio: user[0].bio || '',
      teamRole: user[0].teamRole || ''
    });
  } catch (error) {
    console.error('Error fetching profile data:', error);
    res.status(500).json({ success: false, message: "Error fetching profile data" });
  }
});

/* ----------------------
   Login Route
------------------------- */
/* ----------------------
   Validate Token Route (for presentation system)
------------------------- */
router.post("/validate-token", async (req, res) => {
  const { userToken } = req.body;

  if (!userToken) {
    return res.status(400).json({ success: false, message: 'Token is required.' });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
    const userId = decoded.userId || decoded.id; // Support both old and new token formats

    // Check if token exists in database and is valid
    const tokenCheck = await query(
      'SELECT * FROM user_tokens WHERE userToken = ? AND valid = "y"',
      [userToken]
    );

    if (tokenCheck.length === 0) {
      return res.status(401).json({ success: false, message: 'Token not found or invalid.' });
    }

    // Token is valid
    return res.json({ 
      success: true, 
      message: 'Token is valid',
      userId: userId 
    });

  } catch (error) {
    console.error('Token validation error:', error);
    
    // Check if it's a JWT error (expired, malformed, etc.)
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }
    
    return res.status(401).json({ success: false, message: 'Token is no longer valid.' });
  }
});

/* ----------------------
   New Login Route
------------------------- */
router.post("/newlogin", async (req, res) => {
  const { username, password } = req.body;

  try {


    // Check both tables simultaneously
    const [regularUsers, adminUsers] = await Promise.all([
      // Check regular users table (now includes teamRole)
      query('SELECT *, teamRole FROM activeusers WHERE Active = "y"'),
      // Check admin users table
      query('SELECT * FROM admin_logins WHERE Username = ?', [username])
    ]);



    // Check regular users first
    const matchingRegularUsers = regularUsers.filter(user => {
      const parts = user.lagnname.split(" ").filter(Boolean);
      const lastName = parts[0];
      const firstNameInitial = parts.length > 1 ? parts[1].charAt(0) : "";
      const constructedUsername = `${firstNameInitial}${lastName}`.toLowerCase();
      return constructedUsername === username.toLowerCase();
    });



    // Try to authenticate as regular user first
    if (matchingRegularUsers.length > 0) {

      
      const validRegularUser = await Promise.all(
        matchingRegularUsers.map(async (user) => {
          if (user.Password && user.Password !== "default") {
            const isMatch = await bcrypt.compare(password, user.Password);
            return isMatch ? user : null;
          } else {
            return password.toUpperCase() === user.agtnum.toUpperCase() ? user : null;
          }
        })
      ).then(users => users.find(user => user !== null));

      if (validRegularUser) {


        if (parseInt(validRegularUser.redeemed) === 1) {
          // Log successful login
          try {
            const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            
            await query(
              `INSERT INTO login_logs (user_id, lagnname, timestamp, ip_address, user_agent) 
               VALUES (?, ?, UTC_TIMESTAMP(), ?, ?)`,
              [validRegularUser.id, validRegularUser.lagnname, clientIp, userAgent]
            );

          } catch (logError) {

            // Don't fail the login if logging fails
          }

          // Create token payload for regular user (now includes teamRole from activeusers)
          const tokenPayload = {
            userId: validRegularUser.id,
            id: validRegularUser.id,
            clname: validRegularUser.clname,
            lagnname: validRegularUser.lagnname,
            email: validRegularUser.email || null,
            profpic: validRegularUser.profpic || null,
            headerPic: validRegularUser.header_pic || null,
            Role: validRegularUser.Role || null,
            teamRole: validRegularUser.teamRole || null,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          };

          const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
          await query("INSERT INTO user_tokens (userId, userToken, valid) VALUES (?, ?, 'y')", [validRegularUser.id, token]);

          res.cookie("auth_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
            domain: ".ariaslife.com",
            maxAge: 24 * 60 * 60 * 1000,
          });

          // Check if user is an RGA or MGA and fetch additional data if needed
          if (validRegularUser.clname === "RGA" || validRegularUser.clname === "MGA") {
            const mgaRgaData = await query("SELECT * FROM MGA_RGA WHERE Name = ?", [validRegularUser.lagnname]);
            return res.status(200).send({
              success: true,
              message: "Login successful",
              token: token,
              userId: validRegularUser.id,
              clname: validRegularUser.clname,
              agnName: validRegularUser.lagnname,
              mgaRgaData: mgaRgaData[0] || null,
              email: validRegularUser.email || null,
              phone: validRegularUser.phone || null,
              screenName: validRegularUser.screen_name || null,
              esid: validRegularUser.esid || null,
              mga: validRegularUser.mga || null,
              profpic: validRegularUser.profpic || null,
              profilePic: validRegularUser.profpic || null,
              headerPic: validRegularUser.header_pic || null,
              header_pic: validRegularUser.header_pic || null,
              agtnum: validRegularUser.agtnum || null,
              Role: validRegularUser.Role || null,
              teamRole: validRegularUser.teamRole || null,
            });
          } else {
            return res.status(200).send({
              success: true,
              message: "Login successful",
              token: token,
              clname: validRegularUser.clname,
              userId: validRegularUser.id,
              agnName: validRegularUser.lagnname,
              email: validRegularUser.email || null,
              phone: validRegularUser.phone || null,
              screenName: validRegularUser.screen_name || null,
              esid: validRegularUser.esid || null,
              mga: validRegularUser.mga || null,
              profpic: validRegularUser.profpic || null,
              profilePic: validRegularUser.profpic || null,
              headerPic: validRegularUser.header_pic || null,
              header_pic: validRegularUser.header_pic || null,
              agtnum: validRegularUser.agtnum || null,
              Role: validRegularUser.Role || null,
              teamRole: validRegularUser.teamRole || null,
            });
          }
        } else {
          // Redirect to account setup if not redeemed

          return res.status(200).send({
            success: true,
            message: "Please complete account setup",
            redirectUrl: "/setup.html",
            lagnname: validRegularUser.lagnname,
            esid: validRegularUser.esid,
            email: validRegularUser.email || null,
            phone: validRegularUser.phone || null,
            screenName: validRegularUser.screen_name || null,
            id: validRegularUser.id,
            agtnum: validRegularUser.agtnum || null,
            Role: validRegularUser.Role || null,
            teamRole: validRegularUser.teamRole || null,
          });
        }
      }
    }

    // If no valid regular user found, try admin authentication
    if (adminUsers.length > 0) {

      
      const admin = adminUsers[0];
      
      if (!admin.Password) {

        return res.status(401).send({ 
          success: false, 
          message: "Admin account is not properly configured. Please contact system administrator.",
          errorType: "PASSWORD_NOT_SET",
          details: "The admin account exists but has no password configured."
        });
      }

      // Verify admin password - since passwords are stored as plain text

      
      // Direct string comparison for plain text passwords
      const isAdminPasswordValid = (password === admin.Password);
      
      if (isAdminPasswordValid) {


        // Log successful admin login
        try {
          const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
          const userAgent = req.headers['user-agent'] || 'unknown';
          
          await query(
            `INSERT INTO login_logs (user_id, lagnname, timestamp, ip_address, user_agent) 
             VALUES (?, ?, UTC_TIMESTAMP(), ?, ?)`,
            [admin.id, admin.Username, clientIp, userAgent]
          );

        } catch (logError) {

          // Don't fail the login if logging fails
        }

        // Create token payload for admin user
        const adminTokenPayload = {
          userId: admin.id,
          id: admin.id,
          username: admin.Username,
          Role: 'Admin',
          adminLevel: admin.Admin_Level,
          agency: admin.Agency,
          teamRole: admin.teamRole,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400
        };

        const adminToken = jwt.sign(adminTokenPayload, process.env.JWT_SECRET);
        await query("INSERT INTO user_tokens (userId, userToken, valid) VALUES (?, ?, 'y')", [admin.id, adminToken]);

        res.cookie("auth_token", adminToken, {
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          domain: ".ariaslife.com",
          maxAge: 24 * 60 * 60 * 1000,
        });

        // Return admin-specific response structure
        return res.status(200).send({
          success: true,
          message: "Login successful",
          token: adminToken,
          userId: admin.id,
          id: admin.id,
          email: admin.Email || null,
          screenName: admin.Screen_Name || null,
          adminLevel: admin.Admin_Level || null,
          agency: admin.Agency || null,
          teamRole: admin.teamRole || null,
          Role: 'Admin',
          username: admin.Username,
        });
      } else {

        return res.status(401).send({ 
          success: false, 
          message: "Incorrect password. Please try again.",
          errorType: "INVALID_PASSWORD",
          details: "The password provided does not match the admin account."
        });
      }
    }

    // If we get here, no valid user was found in either table

    return res.status(404).send({ 
      success: false, 
      message: "Username not found. Please check your credentials.",
      errorType: "USERNAME_NOT_FOUND",
      details: "The provided username does not exist in our system."
    });

  } catch (error) {

    return res.status(500).send({ 
      success: false, 
      message: "An error occurred during login. Please try again.",
      errorType: "LOGIN_ERROR",
      details: "Server error during login process."
    });
  }
});

/* ----------------------
   Admin Login Route
------------------------- */
router.post("/adminlogin", async (req, res) => {
  const { username, password } = req.body;

  try {


    // Check admin_logins table
    const adminUsers = await query('SELECT * FROM admin_logins WHERE Username = ?', [username]);
    


    if (adminUsers.length === 0) {

      return res.status(404).send({ 
        success: false, 
        message: "Username not found. Please check your credentials.",
        errorType: "USERNAME_NOT_FOUND"
      });
    }

    const admin = adminUsers[0];
    
    if (!admin.Password) {

      return res.status(401).send({ 
        success: false, 
        message: "Admin account is not properly configured. Please contact system administrator.",
        errorType: "PASSWORD_NOT_SET"
      });
    }

    // Verify admin password - since passwords are stored as plain text

    
    // Direct string comparison for plain text passwords
    const isAdminPasswordValid = (password === admin.Password);
    
    if (!isAdminPasswordValid) {

      return res.status(401).send({ 
        success: false, 
        message: "Incorrect password. Please try again.",
        errorType: "INVALID_PASSWORD"
      });
    }



    // Create token payload for admin user (excluding password)
    const adminTokenPayload = {
      userId: admin.id,
      id: admin.id,
      username: admin.Username,
      email: admin.Email,
      screenName: admin.Screen_Name,
      adminLevel: admin.Admin_Level,
      agency: admin.Agency,
      teamRole: admin.teamRole,
      Role: 'Admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
    };

    const adminToken = jwt.sign(adminTokenPayload, process.env.JWT_SECRET);
    
    // Store token in database
    await query("INSERT INTO user_tokens (userId, userToken, valid) VALUES (?, ?, 'y')", [admin.id, adminToken]);

    // Set cookie
    res.cookie("auth_token", adminToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      domain: ".ariaslife.com",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Return admin-specific response structure (all columns except password)
    return res.status(200).send({
      success: true,
      message: "Admin login successful",
      token: adminToken,
      user: {
        id: admin.id,
        userId: admin.id,
        username: admin.Username,
        email: admin.Email || null,
        screenName: admin.Screen_Name || null,
        adminLevel: admin.Admin_Level || null,
        agency: admin.Agency || null,
        teamRole: admin.teamRole || null,
        Role: 'Admin'
      }
    });

  } catch (error) {

    return res.status(500).send({ 
      success: false, 
      message: "An error occurred during admin login. Please try again.",
      errorType: "LOGIN_ERROR"
    });
  }
});

/* ----------------------
   Check User Info Route
------------------------- */
router.post("/checkUserInfo", async (req, res) => {
  const { email, phone, esid, lagnname } = req.body;
  const checkEsidLagnnameQuery = `
      SELECT id, email, phone, screen_name, esid, lagnname 
      FROM activeusers 
      WHERE esid = ? AND lagnname = ?
      LIMIT 1;
  `;
  try {
    let results = await query(checkEsidLagnnameQuery, [esid, lagnname]);
    if (results.length > 0) {
      return res.json({
        success: false,
        message: "Account already redeemed.",
        data: results[0],
      });
    } else {
      const checkEmailPhoneQuery = `
          SELECT id, email, phone, screen_name, esid, lagnname 
          FROM activeusers 
          WHERE email = ? OR phone = ?
          LIMIT 1;
      `;
      results = await query(checkEmailPhoneQuery, [email, phone]);
      if (results.length > 0) {
        return res.json({
          success: false,
          message: "Existing user information found.",
          data: results[0],
        });
      } else {
        return res.json({
          success: true,
          message: "No existing user found with the provided information.",
        });
      }
    }
  } catch (error) {
    console.error('Error checking user information:', error);
    return res.status(500).send({ success: false, message: "An error occurred while checking user information." });
  }
});

/* ----------------------
   Confirm Identity Route
------------------------- */
router.post("/users/confirmIdentity", async (req, res) => {
  const { email, phone, esid, lagnname } = req.body;
  const queryText = `UPDATE usersinfo SET esid = ?, lagnname = ? WHERE email = ? OR phone = ?`;
  try {
    const result = await query(queryText, [esid, lagnname, email, phone]);
    if (result.affectedRows > 0) {
      res.json({ success: true, message: "User information updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (error) {
    console.error('Error updating user information:', error);
    res.status(500).json({ success: false, message: "An error occurred while updating user information." });
  }
});

/* ----------------------
   Handle User Info Route
------------------------- */
router.post("/handleUserInfo", async (req, res) => {
  const { id, screenName, email, phone, esid, lagnname, decision } = req.body;

  function formatPhoneNumber(phone) {
    const cleaned = ("" + phone).replace(/\D/g, "");
    const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `1(${match[1]})${match[2]}-${match[3]}`;
    }
    return null;
  }

  try {
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      return res.status(400).json({ success: false, message: "Invalid phone number format" });
    }

    const updateResult = await query(
      `UPDATE activeusers 
       SET screen_name = ?, email = ?, phone = ?, lagnname = ?, redeemed = 1
       WHERE id = ?`,
      [screenName, email, formattedPhone, lagnname, id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found with the provided ID" });
    }

    const searchPattern = `${screenName} - ${formattedPhone}`;
    const activityResult = await query(
      `UPDATE Daily_Activity 
       SET esid = ?, agent = ? 
       WHERE esid = ?`,
      [esid, lagnname, searchPattern]
    );

    res.json({ success: true, message: "User info updated successfully" });
  } catch (error) {
    console.error('Error updating user info:', error);
    res.status(500).json({ success: false, message: "An error occurred while updating user info" });
  }
});

/* ----------------------
   Confirm Fresh Start Route
------------------------- */
router.post("/confirmStartFresh", async (req, res) => {
  const { screenName, email, phone, esid, lagnname } = req.body;

  try {
    const updateQuery = `
      UPDATE activeusers 
      SET email = ?, phone = ?, screen_name = ? 
      WHERE lagnname = ? AND esid = ?
    `;
    const result = await query(updateQuery, [email, phone, screenName, lagnname, esid]);
    if (result.affectedRows > 0) {
      res.json({ success: true, message: "Fresh start confirmed, user information updated successfully." });
    } else {
      res.status(404).json({ success: false, message: "No matching user found for the provided lagnname and esid." });
    }
  } catch (error) {
    console.error('Error confirming fresh start:', error);
    res.status(500).json({ success: false, message: "An error occurred while confirming fresh start." });
  }
});

/* ----------------------
   Validate Token Route
------------------------- */
router.post("/validateToken", verifyToken, (req, res) => {
  res.json({ auth: true, message: "Token is valid" });
});

/* ----------------------
   User Hierarchy Route (Simplified for Activity View)
------------------------- */
router.post("/userHierarchy", verifyToken, async (req, res) => {
  const { userId } = req.body;

  
  try {

    const userResult = await query(
      `SELECT lagnname, clname FROM activeusers WHERE id = ? AND Active = 'y' LIMIT 1`,
      [userId]
    );


    if (userResult.length === 0) {

      return res.json({ success: false, message: "User not found" });
    }

    const agnName = userResult[0].lagnname;
    const clName = userResult[0].clname;
    let lagnnameList = [agnName];


    if (clName === "RGA") {

      const mgaResults = await query(
        `SELECT lagnname FROM MGAs WHERE (rga = ? OR legacy = ? OR tree = ?) AND (active = 'y' OR active IS NULL) AND (hide = 'n' OR hide IS NULL)`,
        [agnName, agnName, agnName]
      );

      
      if (mgaResults.length > 0) {
        const mgaNames = mgaResults.map(row => row.lagnname);
        lagnnameList = [...lagnnameList, ...mgaNames];

      }
    }

    const placeholders = lagnnameList.map(() => "?").join(", ");

    
    // Include PNP data similar to searchByUserId (with JSON_OBJECT; fallback below handles older MySQL)
    let queryText = `
      SELECT 
          au.id,
          au.lagnname, 
          au.rept_name, 
          au.clname,
          au.Active,
          au.managerActive,
          au.redeemed,
          au.released,
          au.profpic,
          au.phone,
          au.esid,
          COALESCE(main_ui.email, au.email, '') AS email, 
          au.sa, 
          au.ga, 
          au.mga, 
          au.rga,
          (
            SELECT JSON_OBJECT(
              'curr_mo_4mo_rate_1', (
                SELECT p1.curr_mo_4mo_rate FROM pnp p1 
                WHERE (p1.name_line = au.lagnname OR au.lagnname LIKE CONCAT(p1.name_line, ' %'))
                  AND ABS(DATEDIFF(STR_TO_DATE(p1.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
                  AND p1.agent_num LIKE '%-1%'
                ORDER BY STR_TO_DATE(p1.date, '%m/%d/%y') DESC
                LIMIT 1
              ),
              'curr_mo_4mo_rate_2', (
                SELECT p2.curr_mo_4mo_rate FROM pnp p2 
                WHERE (p2.name_line = au.lagnname OR au.lagnname LIKE CONCAT(p2.name_line, ' %'))
                  AND ABS(DATEDIFF(STR_TO_DATE(p2.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
                  AND p2.agent_num LIKE '%-2%'
                ORDER BY STR_TO_DATE(p2.date, '%m/%d/%y') DESC
                LIMIT 1
              ),
              'curr_mo_4mo_rate_3', (
                SELECT p3.curr_mo_4mo_rate FROM pnp p3 
                WHERE (p3.name_line = au.lagnname OR au.lagnname LIKE CONCAT(p3.name_line, ' %'))
                  AND ABS(DATEDIFF(STR_TO_DATE(p3.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
                  AND p3.agent_num LIKE '%-3%'
                ORDER BY STR_TO_DATE(p3.date, '%m/%d/%y') DESC
                LIMIT 1
              )
            )
          ) AS pnp_data
      FROM activeusers au
      LEFT JOIN usersinfo main_ui ON au.lagnname = main_ui.lagnname AND au.esid = main_ui.esid
      WHERE au.Active = 'y'
          AND (
              au.lagnname = ?
              OR (au.clname = 'RGA' AND au.lagnname = ?)
              OR au.sa IN (${placeholders})
              OR au.ga IN (${placeholders})
              OR au.mga IN (${placeholders})
              OR au.rga IN (${placeholders})
          )
      ORDER BY au.lagnname;
    `;
    
    const queryParams = [
      agnName, // au.lagnname = ? (include self)
      agnName, // (au.clname = 'RGA' AND au.lagnname = ?)
      ...lagnnameList, // au.sa IN (...)
      ...lagnnameList, // au.ga IN (...)
      ...lagnnameList, // au.mga IN (...)
      ...lagnnameList  // au.rga IN (...)
    ];
    

    let results;
    try {
      results = await query(queryText, queryParams);
    } catch (jsonErr) {
      // Fallback without JSON_OBJECT; attach PNP in a second pass
      const fallbackQuery = `
        SELECT 
            au.id,
            au.lagnname, 
            au.rept_name, 
            au.clname,
            au.Active,
            au.managerActive,
            au.redeemed,
            au.released,
            au.profpic,
            au.phone,
            au.esid,
            COALESCE(main_ui.email, au.email, '') AS email, 
            au.sa, 
            au.ga, 
            au.mga, 
            au.rga
        FROM activeusers au
        LEFT JOIN usersinfo main_ui ON au.lagnname = main_ui.lagnname AND au.esid = main_ui.esid
        WHERE au.Active = 'y'
            AND (
                au.lagnname = ?
                OR (au.clname = 'RGA' AND au.lagnname = ?)
                OR au.sa IN (${placeholders})
                OR au.ga IN (${placeholders})
                OR au.mga IN (${placeholders})
                OR au.rga IN (${placeholders})
            )
        ORDER BY au.lagnname;
      `;
      results = await query(fallbackQuery, queryParams);
      // Attach minimal PNP data best-effort
      const names = results.map(r => r.lagnname).filter(Boolean);
      if (names.length > 0) {
        const namePlaceholders = names.map(() => '?').join(',');
      const pnpRows = await query(`
          SELECT name_line, curr_mo_4mo_rate, proj_plus_1, date AS pnp_date, agent_num
          FROM pnp
          WHERE name_line IN (${namePlaceholders})
          ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
        `, names);
        const byName = {};
        for (const row of pnpRows) {
          const nm = row.name_line;
          if (!byName[nm]) byName[nm] = { '-1': null, '-2': null, '-3': null };
          const suffix = (row.agent_num || '').includes('-1') ? '-1' : (row.agent_num || '').includes('-2') ? '-2' : (row.agent_num || '').includes('-3') ? '-3' : null;
          if (!suffix) continue;
          // Only set if not set yet (rows are date-desc already)
          if (!byName[nm][suffix]) byName[nm][suffix] = row;
        }
        results = results.map(r => {
          const entry = byName[r.lagnname];
          return {
            ...r,
            pnp_data: entry ? {
              curr_mo_4mo_rate_1: entry['-1'] ? entry['-1'].curr_mo_4mo_rate : null,
              curr_mo_4mo_rate_2: entry['-2'] ? entry['-2'].curr_mo_4mo_rate : null,
              curr_mo_4mo_rate_3: entry['-3'] ? entry['-3'].curr_mo_4mo_rate : null
            } : null
          };
        });
      }
    }


    if (results.length > 0) {

      res.json({ success: true, data: results, agnName });
    } else {

      res.json({ success: false, message: "No data found" });
    }
  } catch (err) {

    res.status(500).json({ success: false, message: "Error retrieving data" });
  }
});

/* ----------------------
   Search by User ID Route
------------------------- */
router.post("/searchByUserId", async (req, res) => {
  const { userId } = req.body;

  
  try {
    const userResult = await query(
      `SELECT lagnname, clname, teamRole FROM activeusers WHERE id = ? AND Active = 'y' LIMIT 1`,
      [userId]
    );

    if (userResult.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const agnName = userResult[0].lagnname;
    const clName = userResult[0].clname;
    let lagnnameList = [agnName];

    if (clName === "RGA") {
      const mgaResults = await query(
        `SELECT lagnname FROM MGAs WHERE (rga = ? OR legacy = ? OR tree = ?) AND (active = 'y' OR active IS NULL) AND (hide = 'n' OR hide IS NULL)`,
        [agnName, agnName, agnName]
      );
      
      if (mgaResults.length > 0) {
        const mgaNames = mgaResults.map(row => row.lagnname);
        lagnnameList = [...lagnnameList, ...mgaNames];
      }
    }

    const placeholders = lagnnameList.map(() => "?").join(", ");
    
    // Try to use JSON_ARRAYAGG for efficiency, but be prepared for fallback
    let queryText;
    try {
      // Modified query to include license data using JSON_ARRAYAGG (MySQL 5.7.22+ or 8.0+)
      queryText = `
        SELECT 
            au.id,
            au.lagnname, 
            au.rept_name, 
            au.clname,
            au.Active,
            au.managerActive,
            au.redeemed,
            au.released,
            au.profpic,
            au.phone,
            au.agtnum,
            au.esid,
            au.teamRole,
            COALESCE(main_ui.email, au.email, '') AS email, 
            au.sa, 
            COALESCE(sa_ui.email, '') AS sa_email, 
            au.ga, 
            COALESCE(ga_ui.email, '') AS ga_email, 
            au.mga, 
            COALESCE(mga_ui.email, '') AS mga_email, 
            au.rga, 
            COALESCE(rga_ui.email, '') AS rga_email,
            (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', ls.id,
                  'state', ls.state,
                  'license_number', ls.license_number,
                  'expiry_date', ls.expiry_date,
                  'resident_state', ls.resident_state
                )
              )
              FROM licensed_states ls
              WHERE ls.userId = au.id
            ) AS licenses,
            (
              SELECT JSON_OBJECT(
                'curr_mo_4mo_rate', pnp.curr_mo_4mo_rate,
                'proj_plus_1', pnp.proj_plus_1,
                'pnp_date', pnp.date,
                'agent_num', pnp.agent_num
              )
              FROM pnp
              WHERE (pnp.name_line = au.lagnname OR au.lagnname LIKE CONCAT(pnp.name_line, ' %'))
                AND ABS(DATEDIFF(STR_TO_DATE(pnp.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
              ORDER BY STR_TO_DATE(pnp.date, '%m/%d/%y') DESC
              LIMIT 1
            ) AS pnp_data
        FROM activeusers au
        LEFT JOIN usersinfo main_ui ON au.lagnname = main_ui.lagnname AND au.esid = main_ui.esid
        LEFT JOIN usersinfo sa_ui ON au.sa = sa_ui.lagnname AND sa_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.sa LIMIT 1)
        LEFT JOIN usersinfo ga_ui ON au.ga = ga_ui.lagnname AND ga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.ga LIMIT 1)
        LEFT JOIN usersinfo mga_ui ON au.mga = mga_ui.lagnname AND mga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.mga LIMIT 1)
        LEFT JOIN usersinfo rga_ui ON au.rga = rga_ui.lagnname AND rga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.rga LIMIT 1)
        WHERE au.Active = 'y'
            AND (
                au.lagnname = ?
                OR (au.clname = 'RGA' AND au.lagnname = ?)
                OR au.sa IN (${placeholders})
                OR au.ga IN (${placeholders})
                OR au.mga IN (${placeholders})
                OR au.rga IN (${placeholders})
            )
        ORDER BY au.lagnname;
      `;
      
      // Add a diagnostic query to check directly on the PNP table
      try {
        const pnpDiagnosticQuery = `
          SELECT name_line, esid, date, curr_mo_4mo_rate, proj_plus_1 
          FROM pnp 
          LIMIT 5
        `;
        const pnpSample = await query(pnpDiagnosticQuery);
      } catch (diagErr) {
      }
    } catch (err) {
      // Fallback query without JSON functions (for MySQL < 5.7.22)

      queryText = `
        SELECT 
            au.id,
            au.lagnname, 
            au.rept_name, 
            au.clname,
            au.Active,
            au.managerActive,
            au.redeemed,
            au.released,
            au.profpic,
            au.phone,
            au.esid,
            au.teamRole,
            COALESCE(main_ui.email, au.email, '') AS email, 
            au.sa, 
            COALESCE(sa_ui.email, '') AS sa_email, 
            au.ga, 
            COALESCE(ga_ui.email, '') AS ga_email, 
            au.mga, 
            COALESCE(mga_ui.email, '') AS mga_email, 
            au.rga, 
            COALESCE(rga_ui.email, '') AS rga_email
        FROM activeusers au
        LEFT JOIN usersinfo main_ui ON au.lagnname = main_ui.lagnname AND au.esid = main_ui.esid
        LEFT JOIN usersinfo sa_ui ON au.sa = sa_ui.lagnname AND sa_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.sa LIMIT 1)
        LEFT JOIN usersinfo ga_ui ON au.ga = ga_ui.lagnname AND ga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.ga LIMIT 1)
        LEFT JOIN usersinfo mga_ui ON au.mga = mga_ui.lagnname AND mga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.mga LIMIT 1)
        LEFT JOIN usersinfo rga_ui ON au.rga = rga_ui.lagnname AND rga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.rga LIMIT 1)
        WHERE au.Active = 'y'
            AND (
                au.lagnname = ?
                OR (au.clname = 'RGA' AND au.lagnname = ?)
                OR au.sa IN (${placeholders})
                OR au.ga IN (${placeholders})
                OR au.mga IN (${placeholders})
                OR au.rga IN (${placeholders})
            )
        ORDER BY au.lagnname;
      `;
    }
    
    const queryParams = [
      agnName, // au.lagnname = ? (include self)
      agnName, // (au.clname = 'RGA' AND au.lagnname = ?)
      ...lagnnameList, // au.sa IN (...)
      ...lagnnameList, // au.ga IN (...)
      ...lagnnameList, // au.mga IN (...)
      ...lagnnameList  // au.rga IN (...)
    ];
    
    const results = await query(queryText, queryParams);

    // Add diagnostic query to check for each user's PNP data
    for (const user of results.slice(0, 5)) { // Limit to first 5 users to avoid too much logging
      if (!user.lagnname || !user.esid) continue;
      
      
      try {
        // Try to format the ESID to check conversions
        const userEsidDate = new Date(user.esid);
        if (!isNaN(userEsidDate.getTime())) {
          
          // Format as MM/DD/YY to match PNP format
          const month = (userEsidDate.getMonth() + 1).toString().padStart(2, '0');
          const day = userEsidDate.getDate().toString().padStart(2, '0');
          const year = userEsidDate.getFullYear().toString().slice(2);
          const formattedEsid = `${month}/${day}/${year}`;
          
          // Look for matches in PNP
          const pnpMatchQuery = `
            SELECT * FROM pnp 
            WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
            AND esid = ?
            ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
            LIMIT 1
          `;
          const pnpMatches = await query(pnpMatchQuery, [user.lagnname, user.lagnname, formattedEsid]);
          if (pnpMatches.length > 0) {
          } else {
            // If no exact match, try a more lenient search to see what records exist
            const lenientSearchQuery = `
              SELECT name_line, esid, date, curr_mo_4mo_rate, proj_plus_1 
              FROM pnp 
              WHERE (name_line = ? OR ? LIKE CONCAT(name_line, ' %'))
              LIMIT 3
            `;
            const lenientResults = await query(lenientSearchQuery, [user.lagnname, user.lagnname]);
            if (lenientResults.length > 0) {
            
            } else {
            }
          }
        } else {
        }
      } catch (pnpErr) {

      }
    }

    if (results.length > 0) {
      // If we have results, check if we need to fetch licenses separately (fallback mode)
      let needToFetchLicenses = false;
      
      // Check the first result to see if it has licenses field
      if (results[0].hasOwnProperty('licenses')) {
        // Parse license JSON data for each user
        results.forEach(user => {
          try {
            if (user.licenses) {
              user.licenses = JSON.parse(user.licenses);
            } else {
              user.licenses = [];
            }
          } catch (e) {

            user.licenses = [];
          }
        });
      } else {
        // No licenses field in results, need to fetch them separately
        needToFetchLicenses = true;
      }
      
      // Fetch licenses separately if needed (fallback method)
      if (needToFetchLicenses) {
        
        // Get all user IDs from the results
        const userIds = results.map(user => user.id);
        const userIdPlaceholders = userIds.map(() => "?").join(",");
        
        // Fetch all licenses for these users in a single query
        const licensesQuery = `
          SELECT * FROM licensed_states 
          WHERE userId IN (${userIdPlaceholders})
        `;
        
        const licensesResults = await query(licensesQuery, userIds);
        
        // Create a map of licenses by userId
        const licensesByUser = {};
        licensesResults.forEach(license => {
          if (!licensesByUser[license.userId]) {
            licensesByUser[license.userId] = [];
          }
          licensesByUser[license.userId].push(license);
        });
        
        // Attach licenses to each user in the results
        results.forEach(user => {
          user.licenses = licensesByUser[user.id] || [];
        });
      }
      
      // Fetch PNP data separately for fallback method
      
      try {
        // Create placeholders for user names
        const userNames = results.map(user => user.lagnname).filter(Boolean);
        if (userNames.length > 0) {
          
          // Log ESID conversions for better diagnosis - check first few users
          for (const user of results.slice(0, 3)) {
            if (user.esid) {
              
              try {
                // Convert to Date
                const userEsidDate = new Date(user.esid);
                if (!isNaN(userEsidDate.getTime())) {
                  // Format MM/DD/YY for PNP comparison
                  const month = (userEsidDate.getMonth() + 1).toString().padStart(2, '0');
                  const day = userEsidDate.getDate().toString().padStart(2, '0');
                  const year = userEsidDate.getFullYear().toString().slice(2);
                  const mmddyyFormat = `${month}/${day}/${year}`;
                } else {
                }
              } catch (dateError) {
              }
            }
          }
          
          const userNamePlaceholders = userNames.map(() => "?").join(",");
          
          // First, check if PNP table exists and has data
          const pnpTableCheckQuery = `
            SHOW TABLES LIKE 'pnp'
          `;
          const pnpTableCheck = await query(pnpTableCheckQuery);
          if (pnpTableCheck.length === 0) {
          } else {
            
            // Get a sample of PNP data to see what's available
            const pnpSampleQuery = `
              SELECT * FROM pnp LIMIT 5
            `;
            const pnpSample = await query(pnpSampleQuery);
          }
          
          // Fetch PNP data for each user by name and matching ESID
          const pnpQuery = `
            SELECT 
              pnp.name_line, 
              pnp.curr_mo_4mo_rate,
              pnp.proj_plus_1,
              pnp.date,
              pnp.esid,
              pnp.agent_num
            FROM pnp
            WHERE pnp.name_line IN (${userNamePlaceholders})
            ORDER BY STR_TO_DATE(pnp.date, '%m/%d/%y') DESC,
              CASE WHEN pnp.agent_num LIKE '%-1%' THEN 0 ELSE 1 END ASC
          `;
          
          const pnpResults = await query(pnpQuery, userNames);
          
          // Log a sample of the results
          if (pnpResults.length > 0) {
          } else {
          }
          
          // Create a map to find the latest PNP data by user name and matching ESID
          const latestPnpByUser = {};
          
          // Process all PNP results to find the latest for each user with matching ESID
          pnpResults.forEach(pnpRecord => {
            // Find matching users by name_line and ESID (convert formats)
            results.forEach(user => {
              if (user.lagnname === pnpRecord.name_line) {
                try {
                  // Convert ESIDs to Date objects for comparison
                  const userEsidDate = new Date(user.esid); // YYYY-MM-DD
                  
                  // Convert MM/DD/YY to Date
                  const pnpEsid = pnpRecord.esid;
                  let pnpEsidParts = pnpEsid.split('/');
                  if (pnpEsidParts.length === 3) {
                    // Log each ESID comparison for debugging
                    
                    // Add '20' prefix to year if it's just 2 digits
                    if (pnpEsidParts[2].length === 2) {
                      pnpEsidParts[2] = '20' + pnpEsidParts[2];
                    }
                    const pnpEsidDate = new Date(
                      parseInt(pnpEsidParts[2]), 
                      parseInt(pnpEsidParts[0]) - 1, 
                      parseInt(pnpEsidParts[1])
                    );
                    
                    
                    // Check if dates match
                    const userDateString = userEsidDate.toISOString().split('T')[0];
                    const pnpDateString = pnpEsidDate.toISOString().split('T')[0];
                    
                    
                    // Calculate day difference instead of requiring exact match
                    const dayDiff = Math.abs((userEsidDate - pnpEsidDate) / (1000 * 60 * 60 * 24));
                    
                    // Allow matches within 7 days
                    if (dayDiff <= 7) {
                      // If we haven't stored this user's PNP data yet, or this record is newer
                      if (!latestPnpByUser[user.lagnname] || 
                          new Date(pnpRecord.date) > new Date(latestPnpByUser[user.lagnname].date) ||
                          (new Date(pnpRecord.date).getTime() === new Date(latestPnpByUser[user.lagnname].date).getTime() &&
                           pnpRecord.agent_num?.includes('-1') && !latestPnpByUser[user.lagnname].agent_num?.includes('-1'))) {
                        latestPnpByUser[user.lagnname] = pnpRecord;
                      }
                    }
                  }
                } catch (dateError) {

                }
              }
            });
          });
          
          // Attach PNP data to each user
          results.forEach(user => {
            if (latestPnpByUser[user.lagnname]) {
              user.pnp_data = {
                curr_mo_4mo_rate: latestPnpByUser[user.lagnname].curr_mo_4mo_rate,
                proj_plus_1: latestPnpByUser[user.lagnname].proj_plus_1,
                pnp_date: latestPnpByUser[user.lagnname].date,
                agent_num: latestPnpByUser[user.lagnname].agent_num
              };
            } else {
              user.pnp_data = null;
            }
          });
          
        }
      } catch (pnpError) {

      }
      
      // Log just the first result as a sample and the count
      res.json({ success: true, data: results, agnName });
    } else {
      res.json({ success: false, message: "No data found" });
    }
  } catch (err) {

    res.status(500).json({ success: false, message: "Error retrieving data" });
  }
});

/* ----------------------
   Search by User ID (Lite for MGA view)
   - Minimal fields needed for hierarchy/teams
   - Preserves original route above unchanged
------------------------- */
router.post("/searchByUserIdLite", async (req, res) => {
  const { userId, includeInactive = false } = req.body;
  try {
    // Find requesting user's lagnname and role
    const userResult = await query(
      `SELECT lagnname, clname FROM activeusers WHERE id = ? AND Active = 'y' LIMIT 1`,
      [userId]
    );
    if (userResult.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const agnName = userResult[0].lagnname;
    const clName = userResult[0].clname;
    let lagnnameList = [agnName];

    // If RGA, include their MGAs (filtered by MGAs table active/hide)
    let allowedMgas = [];
    if (clName === 'RGA') {
      const mgaResults = await query(
        `SELECT lagnname 
         FROM MGAs 
         WHERE (rga = ? OR legacy = ? OR tree = ?) 
           AND (active = 'y' OR active IS NULL) 
           AND (hide = 'n' OR hide IS NULL)`,
        [agnName, agnName, agnName]
      );
      if (mgaResults.length > 0) {
        allowedMgas = mgaResults.map(r => r.lagnname);
        lagnnameList = [...lagnnameList, ...allowedMgas];
      }
    }

    // Global allowlist of active (not hidden) MGAs for component-level filtering
    let allowedMgasGlobal = [];
    try {
      const globalMgas = await query(
        `SELECT lagnname 
         FROM MGAs 
         WHERE (active = 'y' OR active IS NULL) 
           AND (hide = 'n' OR hide IS NULL)`
      );
      allowedMgasGlobal = globalMgas.map(r => r.lagnname);
    } catch (e) {
      // Non-fatal; proceed without global filtering list
      allowedMgasGlobal = [];
    }

  
    const placeholders = lagnnameList.map(() => "?").join(", ");

    // Build the WHERE clause based on includeInactive parameter
    const managerActiveFilter = includeInactive ? 
      "(au.managerActive = 'y' OR au.managerActive = 'n')" : 
      "au.managerActive = 'y'";

    // Minimal hierarchy pull from activeusers only
    const queryText = `
      SELECT 
        au.id,
        au.lagnname,
        au.clname,
        au.Active,
        au.managerActive,
        au.esid,
        au.sa,
        au.ga,
        au.mga,
        au.rga
      FROM activeusers au
      WHERE au.Active = 'y' AND ${managerActiveFilter}
        AND (
          au.lagnname = ?
          OR (au.clname = 'RGA' AND au.lagnname = ?)
          OR au.sa IN (${placeholders})
          OR au.ga IN (${placeholders})
          OR au.mga IN (${placeholders})
          OR au.rga IN (${placeholders})
        )
      ORDER BY au.managerActive DESC, au.lagnname
    `;

    const params = [
      agnName,
      agnName,
      ...lagnnameList,
      ...lagnnameList,
      ...lagnnameList,
      ...lagnnameList,
    ];

    let results = await query(queryText, params);

    // Ensure uplines (SA/GA/MGA) are included even if not managerActive
    try {
      const uplineNames = new Set();
      results.forEach(row => {
        ['sa','ga','mga'].forEach(k => {
          const v = row[k];
          if (v && typeof v === 'string' && v.trim().length > 0) {
            uplineNames.add(v.trim());
          }
        });
      });
      // Remove any already present
      const present = new Set(results.map(r => r.lagnname));
      const missing = Array.from(uplineNames).filter(name => !present.has(name));
      if (missing.length > 0) {
        const placeholders2 = missing.map(() => '?').join(',');
      const uplinesRows = await query(
          `SELECT id, lagnname, clname, Active, managerActive, agtnum, esid, sa, ga, mga, rga
           FROM activeusers 
           WHERE Active = 'y' AND lagnname IN (${placeholders2})`,
          missing
        );
        if (uplinesRows && uplinesRows.length > 0) {
          // Merge and de-dup
          const mergedMap = new Map();
          [...results, ...uplinesRows].forEach(r => {
            if (!mergedMap.has(r.lagnname)) mergedMap.set(r.lagnname, r);
          });
          results = Array.from(mergedMap.values());
        }
      }
    } catch (e) {

    }

    // For non-RGA users, include the full MGA team they belong to (all users whose mga = user's MGA)
    try {
      if (clName !== 'RGA') {
        // Determine the user's MGA
        let myMgaName = null;
        const selfRow = results.find(r => r.lagnname === agnName);
        if (selfRow && selfRow.mga) {
          myMgaName = selfRow.mga;
        } else {
          const me = await query(`SELECT mga FROM activeusers WHERE id = ? LIMIT 1`, [userId]);
          if (me && me.length > 0) myMgaName = me[0].mga;
        }
        if (myMgaName) {
          const teamRows = await query(
            `SELECT id, lagnname, clname, Active, managerActive, agtnum, esid, sa, ga, mga, rga
             FROM activeusers
             WHERE Active = 'y' AND managerActive = 'y' AND (mga = ? OR lagnname = ?)`,
            [myMgaName, myMgaName]
          );
          if (teamRows && teamRows.length > 0) {
            const byName = new Map(results.map(r => [r.lagnname, r]));
            teamRows.forEach(r => { if (!byName.has(r.lagnname)) byName.set(r.lagnname, r); });
            results = Array.from(byName.values());
          }
        }
      }
    } catch (e) {

    }

    return res.json({ success: true, data: results, agnName, allowedMgas, allowedMgasGlobal });
  } catch (err) {

    return res.status(500).json({ success: false, message: 'Error retrieving data' });
  }
});

/* ----------------------
   Upload Profile Picture to Imgur
------------------------- */
router.post("/upload-profile-picture", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }
    
    
    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    
    // Determine image size
    const sizeInMB = req.file.size / (1024 * 1024);
    
    // Create params for Imgur API
    const params = new URLSearchParams();
    params.append('image', base64Image);
    params.append('type', 'base64');
    

    
    // Enhanced upload with retry logic and rate limit handling
    const uploadToImgur = async () => {
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const response = await axios.post('https://api.imgur.com/3/image', params, {
            headers: {
              'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000 // 30 second timeout
          });
          
          return response; // Success, return response
        } catch (error) {
          retryCount++;
          
          // Log detailed error information
          // Log detailed error information (removed for production)
          
          // Check if it's a rate limiting issue (429)
          if (error.response?.status === 429) {
            // Get reset time from headers if available
            const resetTime = error.response.headers['x-ratelimit-clientreset'] || 
                             error.response.headers['x-ratelimit-userreset'];
            
            // Calculate wait time with exponential backoff and jitter
            const baseWaitTime = resetTime ? parseInt(resetTime) * 1000 : 1000;
            const waitTime = Math.min(
              baseWaitTime * Math.pow(2, retryCount-1) * (0.5 + Math.random()), 
              60000 // Max 60 seconds
            );
            

            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.response?.status === 503) {
            // Service unavailable, use exponential backoff
            const waitTime = Math.min(2000 * Math.pow(2, retryCount-1), 30000);

            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT' || error.code === 'ECONNABORTED') {
            // Connection timeout, retry with longer timeout
            const waitTime = 3000 * retryCount;

            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // For other errors, use simple exponential backoff
            const waitTime = 1000 * Math.pow(2, retryCount-1) * (0.5 + Math.random());

            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // If we've reached max retries, throw the error
          if (retryCount >= maxRetries) throw error;
        }
      }
    };
    
    // Execute the upload with retry logic
    const imgurResponse = await uploadToImgur();
    
    if (!imgurResponse || !imgurResponse.data.success) {
      return res.status(500).json({ success: false, message: "Failed to upload image to Imgur" });
    }
    
    // Get the URL from the Imgur response
    const imageUrl = imgurResponse.data.data.link;

    
    // Update user's profile picture in database
    await query(
      'UPDATE activeusers SET profpic = ? WHERE id = ?',
      [imageUrl, userId]
    );
    
    // Get updated user data to return
    const user = await query(
      'SELECT id, lagnname, email, phone, profpic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Create a new token with updated profile picture
    const tokenPayload = {
      userId: user[0].id,
      id: user[0].id,
      clname: user[0].clname,
      lagnname: user[0].lagnname,
      email: user[0].email || null,
      profpic: imageUrl,
      headerPic: user[0].header_pic || null,
      Role: user[0].Role || null,
      teamRole: user[0].teamRole || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    
    // Return success with updated user data and new token
    res.json({
      success: true,
      message: "Profile picture updated successfully",
      profpic: imageUrl,
      token: token
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error uploading profile picture", 
      error: error.message 
    });
  }
});

// Dedicated endpoint for removing profile picture
router.post("/remove-profile-picture", verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    // Update user's profile picture in database to null
    await query(
      'UPDATE activeusers SET profpic = NULL WHERE id = ?',
      [userId]
    );
    
    // Get updated user data
    const user = await query(
      'SELECT id, lagnname, email, phone, profpic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Create a new token with updated profile picture (null)
    const tokenPayload = {
      userId: user[0].id,
      id: user[0].id,
      clname: user[0].clname,
      lagnname: user[0].lagnname,
      email: user[0].email || null,
      profpic: null,
      headerPic: null,
      Role: user[0].Role || null,
      teamRole: user[0].teamRole || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };
    
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    
    // Return success with updated user data and new token
    res.json({
      success: true,
      message: "Profile picture removed successfully",
      token: token
    });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    res.status(500).json({ success: false, message: "Error removing profile picture" });
  }
});

/* ----------------------
   Upload Header Image to Imgur
------------------------- */
router.post("/upload-header-image", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { userId } = req.body;
    

    
    if (!userId) {

      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    if (!req.file) {

      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }
    
    
    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    
    // Determine image size
    const sizeInMB = req.file.size / (1024 * 1024);
    
    // Create params for Imgur API
    const params = new URLSearchParams();
    params.append('image', base64Image);
    params.append('type', 'base64');
    

    
    // Enhanced upload with retry logic and rate limit handling
    const uploadToImgur = async () => {
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const response = await axios.post('https://api.imgur.com/3/image', params, {
            headers: {
              'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000 // 30 second timeout
          });
          
          return response; // Success, return response
        } catch (error) {
          retryCount++;
          
          // Log detailed error information
          // Log detailed error information (removed for production)
          
          // Check if it's a rate limiting issue (429)
          if (error.response?.status === 429) {
            // Get reset time from headers if available
            const resetTime = error.response.headers['x-ratelimit-clientreset'] || 
                             error.response.headers['x-ratelimit-userreset'];
            
            // Calculate wait time with exponential backoff and jitter
            const baseWaitTime = resetTime ? parseInt(resetTime) * 1000 : 1000;
            const waitTime = Math.min(
              baseWaitTime * Math.pow(2, retryCount-1) * (0.5 + Math.random()), 
              60000 // Max 60 seconds
            );
            

            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.response?.status === 503) {
            // Service unavailable, use exponential backoff
            const waitTime = Math.min(2000 * Math.pow(2, retryCount-1), 30000);

            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT' || error.code === 'ECONNABORTED') {
            // Connection timeout, retry with longer timeout
            const waitTime = 3000 * retryCount;

            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // For other errors, use simple exponential backoff
            const waitTime = 1000 * Math.pow(2, retryCount-1) * (0.5 + Math.random());

            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // If we've reached max retries, throw the error
          if (retryCount >= maxRetries) throw error;
        }
      }
    };
    
    // Execute the upload with retry logic
    const imgurResponse = await uploadToImgur();
    
    if (!imgurResponse || !imgurResponse.data.success) {
      return res.status(500).json({ success: false, message: "Failed to upload header image to Imgur" });
    }
    
    // Get the URL from the Imgur response
    const imageUrl = imgurResponse.data.data.link;

    
    // Update user's header image in database
    await query(
      'UPDATE activeusers SET header_pic = ? WHERE id = ?',
      [imageUrl, userId]
    );
    
    // Get updated user data to return
    const user = await query(
      'SELECT id, lagnname, email, phone, profpic, header_pic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Return success with updated user data
    res.json({
      success: true,
      message: "Header image updated successfully",
      headerPic: imageUrl
    });
  } catch (error) {
    console.error('Error uploading header image:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error uploading header image", 
      error: error.message 
    });
  }
});

// Dedicated endpoint for removing header image
router.post("/remove-header-image", verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    // Update user's header image in database to null
    await query(
      'UPDATE activeusers SET header_pic = NULL WHERE id = ?',
      [userId]
    );
    
    // Get updated user data
    const user = await query(
      'SELECT id, lagnname, email, phone, profpic, header_pic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Return success with updated user data
    res.json({
      success: true,
      message: "Header image removed successfully"
    });
  } catch (error) {
    console.error('Error removing header image:', error);
    res.status(500).json({ success: false, message: "Error removing header image" });
  }
});

/* ----------------------
   Update Profile Information
------------------------- */
router.post("/update-profile-info", verifyToken, async (req, res) => {
  try {
    const { userId, screenName, email, phone, bio } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    // Check if user exists
    const userCheck = await query('SELECT id FROM activeusers WHERE id = ?', [userId]);
    if (userCheck.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Build update query dynamically based on provided fields
    let updateFields = [];
    const updateValues = [];
    
    if (screenName !== undefined) {
      updateFields.push('screen_name = ?');
      updateValues.push(screenName);
    }
    
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    
    if (phone !== undefined) {
      // Format phone number if needed
      const formattedPhone = formatPhoneNumber(phone);
      updateFields.push('phone = ?');
      updateValues.push(formattedPhone || phone);
    }
    
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }
    
    // If no fields to update, return error
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: "No profile information provided to update" });
    }
    
    // Add userId to values array for WHERE clause
    updateValues.push(userId);
    
    // Execute update query
    const updateQuery = `UPDATE activeusers SET ${updateFields.join(', ')} WHERE id = ?`;
    const updateResult = await query(updateQuery, updateValues);
    
    if (updateResult.affectedRows === 0) {
      return res.status(500).json({ success: false, message: "Failed to update profile information" });
    }
    
    // Get updated user data
    const user = await query(
      'SELECT id, lagnname, email, phone, screen_name, bio, profpic, header_pic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    // Return success with updated user data
    res.json({
      success: true,
      message: "Profile information updated successfully",
      user: user[0]
    });
  } catch (error) {

    res.status(500).json({ 
      success: false, 
      message: "Error updating profile information", 
      error: error.message 
    });
  }
});

/* ----------------------
   Get Profile Information
------------------------- */
router.get("/profile-info/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    // Get user data
    const user = await query(
      'SELECT id, lagnname, email, phone, screen_name, bio, profpic, header_pic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Transform user data to ensure consistent property names
    const transformedUser = {
      ...user[0],
      headerPic: user[0].header_pic,
      screenName: user[0].screen_name
    };
    
    // Return user data
    res.json({
      success: true,
      user: transformedUser
    });
  } catch (error) {
    console.error('Error fetching profile information:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching profile information" 
    });
  }
});

/* ----------------------
   Update Profile Information via PUT (for frontend compatibility)
------------------------- */
router.put("/profile", verifyToken, upload.fields([
  { name: 'profilePic', maxCount: 1 }, 
  { name: 'profileBanner', maxCount: 1 },  // Match frontend field name
  { name: 'headerPic', maxCount: 1 }  // Keep original name for backward compatibility
]), async (req, res) => {


  try {
    // Extract basic user data from request body
    const { userId, name, email, phone, screenName, bio } = req.body;
    
    if (!userId) {

      return res.status(400).json({ success: false, message: "User ID is required" });
    }


    
    // Check if user exists
    const userCheck = await query('SELECT id FROM activeusers WHERE id = ?', [userId]);
    if (userCheck.length === 0) {

      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Handle file uploads if present
    let profilePicUrl = null;
    let headerPicUrl = null;
    
    // Process header image if uploaded (handle both field names)
    const headerFile = (req.files && req.files.profileBanner && req.files.profileBanner.length > 0) 
                       ? req.files.profileBanner[0] 
                       : (req.files && req.files.headerPic && req.files.headerPic.length > 0) 
                         ? req.files.headerPic[0] 
                         : null;
    
    if (headerFile) {

      
      // Process image from buffer directly if it's in the files object
      const base64Header = headerFile.buffer.toString('base64');
      
      // Create params for Imgur API
      const headerParams = new URLSearchParams();
      headerParams.append('image', base64Header);
      headerParams.append('type', 'base64');
      
      // Use retry logic for header image upload
      let retryCount = 0;
      const maxRetries = 3;
      let headerUploadSuccess = false;
      
      while (retryCount < maxRetries && !headerUploadSuccess) {
        try {

          const headerResponse = await axios.post('https://api.imgur.com/3/image', headerParams, {
            headers: {
              'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
          });
          
          headerPicUrl = headerResponse.data.data.link;

          headerUploadSuccess = true;
        } catch (uploadError) {
          retryCount++;

          
          if (uploadError.response) {


            
            // Check if it's a rate limiting issue (429)
            if (uploadError.response.status === 429) {
              const resetTime = uploadError.response.headers['x-ratelimit-clientreset'] || 
                              uploadError.response.headers['x-ratelimit-userreset'];
              const waitTime = resetTime ? parseInt(resetTime) * 1000 : 1000 * retryCount;

              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (uploadError.response.status === 503) {
              const waitTime = 2000 * retryCount;

              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          } else {
            // For connection timeouts or network errors
            const waitTime = 2000 * retryCount;

            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // If we've reached max retries
          if (retryCount >= maxRetries) {

          }
        }
      }
    } else {
      // Check if profileBanner is in the body as base64 and not in files
      if (req.body.profileBanner && typeof req.body.profileBanner === 'string' && req.body.profileBanner.startsWith('data:image')) {

        
        // Extract base64 data from data URL
        const base64Data = req.body.profileBanner.split(',')[1];
        if (base64Data) {

          
          // Create params for Imgur API
          const headerParams = new URLSearchParams();
          headerParams.append('image', base64Data);
          headerParams.append('type', 'base64');
          
          // Use retry logic for header image upload
          let retryCount = 0;
          const maxRetries = 3;
          let headerUploadSuccess = false;
          
          while (retryCount < maxRetries && !headerUploadSuccess) {
            try {
    
              const headerResponse = await axios.post('https://api.imgur.com/3/image', headerParams, {
                headers: {
                  'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000
              });
              
              headerPicUrl = headerResponse.data.data.link;
    
              headerUploadSuccess = true;
            } catch (uploadError) {
              retryCount++;
    
              
              if (uploadError.response) {
    
    
                
                // Check if it's a rate limiting issue (429)
                if (uploadError.response.status === 429) {
                  const resetTime = uploadError.response.headers['x-ratelimit-clientreset'] || 
                                  uploadError.response.headers['x-ratelimit-userreset'];
                  const waitTime = resetTime ? parseInt(resetTime) * 1000 : 1000 * retryCount;
    
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                } else if (uploadError.response.status === 503) {
                  const waitTime = 2000 * retryCount;
    
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              } else {
                // For connection timeouts or network errors
                const waitTime = 2000 * retryCount;
    
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              // If we've reached max retries
              if (retryCount >= maxRetries) {
    
              }
            }
          }
        }
      }
    }
    
    // Process profile pic if uploaded
    if (req.files && req.files.profilePic && req.files.profilePic.length > 0) {

      
      const profileFile = req.files.profilePic[0];

      const base64Profile = profileFile.buffer.toString('base64');
      
      // Create params for Imgur API
      const profileParams = new URLSearchParams();
      profileParams.append('image', base64Profile);
      profileParams.append('type', 'base64');
      
      // Use retry logic for profile image upload
      let retryCount = 0;
      const maxRetries = 3;
      let profileUploadSuccess = false;
      
      while (retryCount < maxRetries && !profileUploadSuccess) {
        try {

          const profileResponse = await axios.post('https://api.imgur.com/3/image', profileParams, {
            headers: {
              'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
          });
          
          profilePicUrl = profileResponse.data.data.link;

          profileUploadSuccess = true;
        } catch (uploadError) {
          retryCount++;

          
          if (uploadError.response) {


            
            // Check if it's a rate limiting issue (429)
            if (uploadError.response.status === 429) {
              const resetTime = uploadError.response.headers['x-ratelimit-clientreset'] || 
                              uploadError.response.headers['x-ratelimit-userreset'];
              const waitTime = resetTime ? parseInt(resetTime) * 1000 : 1000 * retryCount;

              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (uploadError.response.status === 503) {
              const waitTime = 2000 * retryCount;

              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          } else {
            // For connection timeouts or network errors
            const waitTime = 2000 * retryCount;

            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // If we've reached max retries
          if (retryCount >= maxRetries) {

          }
        }
      }
    }
    
    // Build update query dynamically based on provided fields
    let updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('lagnname = ?');
      updateValues.push(name);
    }
    
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    
    if (phone !== undefined) {
      // Format phone number if needed
      const formattedPhone = formatPhoneNumber(phone);
      updateFields.push('phone = ?');
      updateValues.push(formattedPhone || phone);
    }
    
    if (screenName !== undefined) {
      updateFields.push('screen_name = ?');
      updateValues.push(screenName);
    }
    
    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }
    
    // Add profile picture URL if uploaded
    if (profilePicUrl) {
      updateFields.push('profpic = ?');
      updateValues.push(profilePicUrl);
    }
    
    // Add header picture URL if uploaded
    if (headerPicUrl) {
      updateFields.push('header_pic = ?');
      updateValues.push(headerPicUrl);
    }
    
    // If no fields to update, return success but notify nothing changed
    if (updateFields.length === 0) {

      return res.json({ 
        success: true, 
        message: "Profile unchanged - no updateable fields provided" 
      });
    }
    
    // Add userId to values array for WHERE clause
    updateValues.push(userId);
    
    // Execute update query
    const updateQuery = `UPDATE activeusers SET ${updateFields.join(', ')} WHERE id = ?`;

    
    const updateResult = await query(updateQuery, updateValues);

    
    if (updateResult.affectedRows === 0) {

      return res.status(500).json({ success: false, message: "Failed to update profile information" });
    }
    
    // Get updated user data
    const user = await query(
      'SELECT id, lagnname, email, phone, screen_name, bio, profpic, header_pic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {

      return res.status(404).json({ success: false, message: "User not found after update" });
    }
    
    // If profile pic was updated, update the token
    let token = null;
    if (profilePicUrl || headerPicUrl) {
      // Create a new token with updated profile picture and header image
      const tokenPayload = {
        userId: user[0].id,
        id: user[0].id,
        clname: user[0].clname,
        lagnname: user[0].lagnname,
        email: user[0].email || null,
        profpic: profilePicUrl || user[0].profpic || null,
        headerPic: headerPicUrl || user[0].header_pic || null,
        Role: user[0].Role || null,
        teamRole: user[0].teamRole || null,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      };
      
      token = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    }
    
    // Return success response

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user[0],
      token: token // Only included if profile pic was updated
    });
  } catch (error) {
    console.error('Error updating profile information (route 2):', error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating profile information", 
      error: error.message 
    });
  }
});

/* ----------------------
   License Management Routes
------------------------- */
// License management routes have been moved to routes/licensing.js

/* ----------------------
   Get Agent Details by User ID (for recruitment form)
------------------------- */
router.get("/getagent/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // First, query to get the user's lagnname and esid based on userId
    const userResult = await query(
      'SELECT lagnname, esid, email FROM activeusers WHERE id = ? AND Active = "y" LIMIT 1',
      [userId]
    );

    if (userResult.length > 0) {
      const { lagnname, esid, email: activeusersEmail } = userResult[0];

      // Query to get the user's email from usersinfo if not in activeusers
      let email = activeusersEmail;
      if (!email) {
        const emailResult = await query(
          'SELECT email FROM usersinfo WHERE lagnname = ? AND esid = ? LIMIT 1',
          [lagnname, esid]
        );
        email = emailResult.length > 0 ? emailResult[0].email : '';
      }

      // Combine the original user data with the email
      const agentData = { ...userResult[0], email };

      res.status(200).json({ success: true, data: agentData });
    } else {
      res.status(404).json({ success: false, message: 'User not found or not active' });
    }
  } catch (error) {
    console.error('Error retrieving agent information:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ----------------------
   Debug Routes
------------------------- */
// Route to test PNP data directly
router.get("/debug/pnp", async (req, res) => {
  try {
    // Check if PNP table exists
    const tableCheck = await query("SHOW TABLES LIKE 'pnp'");
    
    if (tableCheck.length === 0) {
      return res.json({
        success: false,
        message: "PNP table does not exist"
      });
    }
    
    // Get sample data
    const sampleData = await query("SELECT * FROM pnp LIMIT 10");
    
    // Get count of records
    const countResult = await query("SELECT COUNT(*) as total FROM pnp");
    const totalRecords = countResult[0]?.total || 0;
    
    // Get column info
    const columnInfo = await query("DESCRIBE pnp");
    
    return res.json({
      success: true,
      tableExists: true,
      totalRecords,
      columnInfo,
      sampleData
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug route to check PNP data for a specific user
router.get("/debug/pnp/:name", async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name parameter is required"
      });
    }
    
    // Find records for this name
    const records = await query(
      "SELECT *, CASE WHEN agent_num LIKE '%-1%' THEN 'CONTAINS -1' ELSE 'NO -1' END as agent_num_status FROM pnp WHERE name_line = ? ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC, CASE WHEN agent_num LIKE '%-1%' THEN 0 ELSE 1 END ASC LIMIT 10",
      [name]
    );
    
    // Get count of records
    const countResult = await query(
      "SELECT COUNT(*) as total FROM pnp WHERE name_line = ?",
      [name]
    );
    const totalRecords = countResult[0]?.total || 0;
    
    // Get count of records with -1 in agent_num
    const countWithDash1 = await query(
      "SELECT COUNT(*) as total FROM pnp WHERE name_line = ? AND agent_num LIKE '%-1%'",
      [name]
    );
    const totalWithDash1 = countWithDash1[0]?.total || 0;
    
    return res.json({
      success: true,
      name,
      totalRecords,
      totalWithDash1,
      records
    });
  } catch (error) {
    console.error('Error in final route:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
