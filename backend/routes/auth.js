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
    console.error("Error fetching user:", error);
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
    console.error("Error fetching active users:", error);
    res.status(500).json({ success: false, message: "Error fetching active users" });
  }
});

/* ----------------------
   Toggle Manager Active Status Route
------------------------- */
router.post("/toggleActive", verifyToken, async (req, res) => {
  try {
    const { userId, currentStatus } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    // Toggle the managerActive status (from 'y' to 'n' or 'n' to 'y')
    const newStatus = currentStatus && currentStatus.toLowerCase() === 'y' ? 'n' : 'y';
    
    // Update the user's managerActive status
    const result = await query(
      'UPDATE activeusers SET managerActive = ? WHERE lagnname = ?',
      [newStatus, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({ 
      success: true, 
      message: `User active status updated to ${newStatus === 'y' ? 'active' : 'inactive'}`,
      newStatus 
    });
  } catch (error) {
    console.error("Error toggling manager active status:", error);
    res.status(500).json({ success: false, message: "Error updating active status" });
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
    console.error("Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Error fetching profile data" });
  }
});

/* ----------------------
   Login Route
------------------------- */
router.post("/newlogin", async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log('[Auth] Starting login process for username:', username);

    // Check both tables simultaneously
    const [regularUsers, adminUsers] = await Promise.all([
      // Check regular users table (now includes teamRole)
      query('SELECT *, teamRole FROM activeusers WHERE Active = "y"'),
      // Check admin users table
      query('SELECT * FROM admin_logins WHERE Username = ?', [username])
    ]);

    console.log('[Auth] Database query results:', {
      regularUsersFound: regularUsers.length,
      adminUsersFound: adminUsers.length,
      username: username
    });

    // Check regular users first
    const matchingRegularUsers = regularUsers.filter(user => {
      const parts = user.lagnname.split(" ").filter(Boolean);
      const lastName = parts[0];
      const firstNameInitial = parts.length > 1 ? parts[1].charAt(0) : "";
      const constructedUsername = `${firstNameInitial}${lastName}`.toLowerCase();
      return constructedUsername === username.toLowerCase();
    });

    console.log('[Auth] Regular user matching results:', {
      totalRegularUsers: regularUsers.length,
      matchingRegularUsers: matchingRegularUsers.length
    });

    // Try to authenticate as regular user first
    if (matchingRegularUsers.length > 0) {
      console.log('[Auth] Found matching regular users, attempting authentication');
      
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
        console.log('[Auth] ✅ Regular user authentication successful:', {
          userId: validRegularUser.id,
          name: validRegularUser.lagnname,
          role: validRegularUser.Role,
          clname: validRegularUser.clname
        });

        if (parseInt(validRegularUser.redeemed) === 1) {
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
          console.log('[Auth] ⚠️ Regular user needs account setup');
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
      console.log('[Auth] Found admin user, attempting admin authentication');
      
      const admin = adminUsers[0];
      
      if (!admin.Password) {
        console.log('[Auth] ❌ Admin authentication failed: No password set');
        return res.status(401).send({ 
          success: false, 
          message: "Admin account is not properly configured. Please contact system administrator.",
          errorType: "PASSWORD_NOT_SET",
          details: "The admin account exists but has no password configured."
        });
      }

      // Verify admin password - since passwords are stored as plain text
      console.log('[Auth] Admin password verification:', {
        providedPassword: password,
        storedPassword: admin.Password,
        passwordLength: admin.Password.length
      });
      
      // Direct string comparison for plain text passwords
      const isAdminPasswordValid = (password === admin.Password);
      
      if (isAdminPasswordValid) {
        console.log('[Auth] ✅ Admin user authentication successful:', {
          userId: admin.id,
          username: admin.Username,
          adminLevel: admin.Admin_Level,
          agency: admin.Agency
        });

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
        console.log('[Auth] ❌ Admin authentication failed: Invalid password');
        return res.status(401).send({ 
          success: false, 
          message: "Incorrect password. Please try again.",
          errorType: "INVALID_PASSWORD",
          details: "The password provided does not match the admin account."
        });
      }
    }

    // If we get here, no valid user was found in either table
    console.log('[Auth] ❌ Authentication failed: User not found in either table');
    return res.status(404).send({ 
      success: false, 
      message: "Username not found. Please check your credentials.",
      errorType: "USERNAME_NOT_FOUND",
      details: "The provided username does not exist in our system."
    });

  } catch (error) {
    console.error("❌ Login Error:", error);
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
    console.log('[AdminAuth] Starting admin login process for username:', username);

    // Check admin_logins table
    const adminUsers = await query('SELECT * FROM admin_logins WHERE Username = ?', [username]);
    
    console.log('[AdminAuth] Database query results:', {
      adminUsersFound: adminUsers.length,
      username: username
    });

    if (adminUsers.length === 0) {
      console.log('[AdminAuth] ❌ Admin authentication failed: Username not found');
      return res.status(404).send({ 
        success: false, 
        message: "Username not found. Please check your credentials.",
        errorType: "USERNAME_NOT_FOUND"
      });
    }

    const admin = adminUsers[0];
    
    if (!admin.Password) {
      console.log('[AdminAuth] ❌ Admin authentication failed: No password set');
      return res.status(401).send({ 
        success: false, 
        message: "Admin account is not properly configured. Please contact system administrator.",
        errorType: "PASSWORD_NOT_SET"
      });
    }

    // Verify admin password - since passwords are stored as plain text
    console.log('[AdminAuth] Admin password verification for user:', username);
    
    // Direct string comparison for plain text passwords
    const isAdminPasswordValid = (password === admin.Password);
    
    if (!isAdminPasswordValid) {
      console.log('[AdminAuth] ❌ Admin authentication failed: Invalid password');
      return res.status(401).send({ 
        success: false, 
        message: "Incorrect password. Please try again.",
        errorType: "INVALID_PASSWORD"
      });
    }

    console.log('[AdminAuth] ✅ Admin user authentication successful:', {
      userId: admin.id,
      username: admin.Username,
      adminLevel: admin.Admin_Level,
      agency: admin.Agency,
      teamRole: admin.teamRole
    });

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
    console.error("❌ Admin Login Error:", error);
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
    console.error("Database Query Error:", error);
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
    console.error("Error updating user information:", error);
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
    console.error("Error updating user info:", error);
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
    console.error("Error confirming fresh start:", error);
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
   Search by User ID Route
------------------------- */
router.post("/searchByUserId", async (req, res) => {
  const { userId } = req.body;
  console.log('\n[searchByUserId] Request received for userId:', userId);
  
  try {
    console.log('[searchByUserId] Querying activeusers for user data');
    const userResult = await query(
      `SELECT lagnname, clname, teamRole FROM activeusers WHERE id = ? AND Active = 'y' LIMIT 1`,
      [userId]
    );
    console.log('[searchByUserId] User query result:', userResult);

    if (userResult.length === 0) {
      console.log('[searchByUserId] User not found, returning error');
      return res.json({ success: false, message: "User not found" });
    }

    const agnName = userResult[0].lagnname;
    const clName = userResult[0].clname;
    let lagnnameList = [agnName];
    console.log('[searchByUserId] User found:', { agnName, clName });

    if (clName === "RGA") {
      console.log('[searchByUserId] User is RGA, searching for MGAs');
      const mgaResults = await query(
        `SELECT lagnname FROM MGAs WHERE rga = ? OR legacy = ? OR tree = ?`,
        [agnName, agnName, agnName]
      );
      console.log('[searchByUserId] MGA search results:', mgaResults);
      
      if (mgaResults.length > 0) {
        const mgaNames = mgaResults.map(row => row.lagnname);
        lagnnameList = [...lagnnameList, ...mgaNames];
        console.log('[searchByUserId] Extended lagnname list with MGAs:', lagnnameList);
      }
    }

    const placeholders = lagnnameList.map(() => "?").join(", ");
    console.log('[searchByUserId] Preparing hierarchy query with placeholders:', placeholders);
    
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
            au.esid,
            au.teamRole,
            COALESCE(main_ui.email, '') AS email, 
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
              WHERE pnp.name_line = au.lagnname
                AND ABS(DATEDIFF(STR_TO_DATE(pnp.esid, '%m/%d/%y'), STR_TO_DATE(au.esid, '%Y-%m-%d'))) <= 7
              ORDER BY STR_TO_DATE(pnp.date, '%m/%d/%y') DESC,
                CASE WHEN pnp.agent_num LIKE '%-1%' THEN 0 ELSE 1 END ASC
              LIMIT 1
            ) AS pnp_data
        FROM activeusers au
        LEFT JOIN usersinfo main_ui ON au.lagnname = main_ui.lagnname AND au.esid = main_ui.esid
        LEFT JOIN usersinfo sa_ui ON au.sa = sa_ui.lagnname AND sa_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.sa LIMIT 1)
        LEFT JOIN usersinfo ga_ui ON au.ga = ga_ui.lagnname AND ga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.ga LIMIT 1)
        LEFT JOIN usersinfo mga_ui ON au.mga = mga_ui.lagnname AND mga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.mga LIMIT 1)
        LEFT JOIN usersinfo rga_ui ON au.rga = rga_ui.lagnname AND rga_ui.esid = (SELECT esid FROM activeusers WHERE lagnname = au.rga LIMIT 1)
        WHERE au.Active = 'y'
            AND (au.lagnname IN (${placeholders}) OR au.sa IN (${placeholders}) OR au.ga IN (${placeholders}) OR au.mga IN (${placeholders}) OR au.rga IN (${placeholders}))
        ORDER BY au.lagnname;
      `;
      
      // Add a diagnostic query to check directly on the PNP table
      console.log('[searchByUserId] Executing diagnostic PNP query to check what data exists');
      try {
        const pnpDiagnosticQuery = `
          SELECT name_line, esid, date, curr_mo_4mo_rate, proj_plus_1 
          FROM pnp 
          LIMIT 5
        `;
        const pnpSample = await query(pnpDiagnosticQuery);
        console.log('[searchByUserId] PNP sample data:', pnpSample);
      } catch (diagErr) {
        console.log('[searchByUserId] Error executing PNP diagnostic query:', diagErr.message);
      }
    } catch (err) {
      // Fallback query without JSON functions (for MySQL < 5.7.22)
      console.warn('[searchByUserId] JSON_ARRAYAGG not supported, using fallback query without license data');
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
            COALESCE(main_ui.email, '') AS email, 
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
            AND (au.lagnname IN (${placeholders}) OR au.sa IN (${placeholders}) OR au.ga IN (${placeholders}) OR au.mga IN (${placeholders}) OR au.rga IN (${placeholders}))
        ORDER BY au.lagnname;
      `;
    }
    
    const queryParams = [
      ...lagnnameList,
      ...lagnnameList,
      ...lagnnameList,
      ...lagnnameList,
      ...lagnnameList
    ];
    
    console.log('[searchByUserId] Executing main hierarchy query with params:', queryParams);
    const results = await query(queryText, queryParams);
    console.log(`[searchByUserId] Query returned ${results.length} results`);

    // Add diagnostic query to check for each user's PNP data
    console.log('[searchByUserId] Checking PNP matches for each user:');
    for (const user of results.slice(0, 5)) { // Limit to first 5 users to avoid too much logging
      if (!user.lagnname || !user.esid) continue;
      
      console.log(`[searchByUserId] Checking PNP for user: ${user.lagnname}, ESID: ${user.esid}`);
      
      try {
        // Try to format the ESID to check conversions
        const userEsidDate = new Date(user.esid);
        if (!isNaN(userEsidDate.getTime())) {
          console.log(`[searchByUserId] User ESID as Date: ${userEsidDate.toISOString().split('T')[0]}`);
          
          // Format as MM/DD/YY to match PNP format
          const month = (userEsidDate.getMonth() + 1).toString().padStart(2, '0');
          const day = userEsidDate.getDate().toString().padStart(2, '0');
          const year = userEsidDate.getFullYear().toString().slice(2);
          const formattedEsid = `${month}/${day}/${year}`;
          console.log(`[searchByUserId] User ESID formatted as MM/DD/YY: ${formattedEsid}`);
          
          // Look for matches in PNP
          const pnpMatchQuery = `
            SELECT * FROM pnp 
            WHERE name_line = ? 
            AND esid = ?
            ORDER BY STR_TO_DATE(date, '%m/%d/%y') DESC
            LIMIT 1
          `;
          const pnpMatches = await query(pnpMatchQuery, [user.lagnname, formattedEsid]);
          console.log(`[searchByUserId] PNP matches for ${user.lagnname}: ${pnpMatches.length}`);
          if (pnpMatches.length > 0) {
            console.log(`[searchByUserId] Found PNP match:`, pnpMatches[0]);
          } else {
            // If no exact match, try a more lenient search to see what records exist
            const lenientSearchQuery = `
              SELECT name_line, esid, date, curr_mo_4mo_rate, proj_plus_1 
              FROM pnp 
              WHERE name_line = ?
              LIMIT 3
            `;
            const lenientResults = await query(lenientSearchQuery, [user.lagnname]);
            if (lenientResults.length > 0) {
              console.log(`[searchByUserId] Found similar PNP records for ${user.lagnname}:`, 
                lenientResults.map(r => ({
                  name_line: r.name_line,
                  esid: r.esid,
                  date: r.date
                }))
              );
            } else {
              console.log(`[searchByUserId] No PNP records found for name_line: ${user.lagnname}`);
            }
          }
        } else {
          console.log(`[searchByUserId] Invalid ESID format for user ${user.lagnname}: ${user.esid}`);
        }
      } catch (pnpErr) {
        console.error(`[searchByUserId] Error checking PNP data for user ${user.lagnname}:`, pnpErr);
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
            console.error(`[searchByUserId] Error parsing licenses for user ${user.lagnname}:`, e);
            user.licenses = [];
          }
        });
      } else {
        // No licenses field in results, need to fetch them separately
        needToFetchLicenses = true;
      }
      
      // Fetch licenses separately if needed (fallback method)
      if (needToFetchLicenses) {
        console.log('[searchByUserId] Fetching licenses separately (fallback method)');
        
        // Get all user IDs from the results
        const userIds = results.map(user => user.id);
        const userIdPlaceholders = userIds.map(() => "?").join(",");
        
        // Fetch all licenses for these users in a single query
        const licensesQuery = `
          SELECT * FROM licensed_states 
          WHERE userId IN (${userIdPlaceholders})
        `;
        
        const licensesResults = await query(licensesQuery, userIds);
        console.log(`[searchByUserId] Retrieved ${licensesResults.length} licenses for ${userIds.length} users`);
        
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
      console.log('[searchByUserId] Fetching PNP data separately (fallback method)');
      
      try {
        // Create placeholders for user names
        const userNames = results.map(user => user.lagnname).filter(Boolean);
        if (userNames.length > 0) {
          console.log(`[searchByUserId] Searching PNP data for ${userNames.length} users. First few names:`, userNames.slice(0, 3));
          
          // Log ESID conversions for better diagnosis - check first few users
          for (const user of results.slice(0, 3)) {
            if (user.esid) {
              console.log(`[searchByUserId] ESID format debugging for ${user.lagnname}:`);
              console.log(`[searchByUserId] Original ESID: ${user.esid}`);
              
              try {
                // Convert to Date
                const userEsidDate = new Date(user.esid);
                if (!isNaN(userEsidDate.getTime())) {
                  console.log(`[searchByUserId] ESID as Date: ${userEsidDate.toISOString()}`);
                  // Format MM/DD/YY for PNP comparison
                  const month = (userEsidDate.getMonth() + 1).toString().padStart(2, '0');
                  const day = userEsidDate.getDate().toString().padStart(2, '0');
                  const year = userEsidDate.getFullYear().toString().slice(2);
                  const mmddyyFormat = `${month}/${day}/${year}`;
                  console.log(`[searchByUserId] ESID formatted as MM/DD/YY: ${mmddyyFormat}`);
                } else {
                  console.log(`[searchByUserId] Invalid date format: ${user.esid}`);
                }
              } catch (dateError) {
                console.log(`[searchByUserId] Error formatting date: ${dateError.message}`);
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
            console.error('[searchByUserId] PNP table does not exist in the database');
          } else {
            console.log('[searchByUserId] PNP table exists in the database');
            
            // Get a sample of PNP data to see what's available
            const pnpSampleQuery = `
              SELECT * FROM pnp LIMIT 5
            `;
            const pnpSample = await query(pnpSampleQuery);
            console.log('[searchByUserId] Sample PNP data:', pnpSample);
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
          console.log(`[searchByUserId] Retrieved ${pnpResults.length} PNP records for ${userNames.length} users`);
          
          // Log a sample of the results
          if (pnpResults.length > 0) {
            console.log('[searchByUserId] Sample PNP results:', pnpResults.slice(0, 3));
          } else {
            console.log('[searchByUserId] No PNP records found for any user names');
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
                    console.log(`[searchByUserId] Comparing ESIDs for ${user.lagnname}:`);
                    console.log(`[searchByUserId] User ESID: ${user.esid} (${userEsidDate.toISOString()})`);
                    console.log(`[searchByUserId] PNP ESID: ${pnpEsid}`);
                    
                    // Add '20' prefix to year if it's just 2 digits
                    if (pnpEsidParts[2].length === 2) {
                      pnpEsidParts[2] = '20' + pnpEsidParts[2];
                    }
                    const pnpEsidDate = new Date(
                      parseInt(pnpEsidParts[2]), 
                      parseInt(pnpEsidParts[0]) - 1, 
                      parseInt(pnpEsidParts[1])
                    );
                    
                    console.log(`[searchByUserId] PNP ESID as Date: ${pnpEsidDate.toISOString()}`);
                    
                    // Check if dates match
                    const userDateString = userEsidDate.toISOString().split('T')[0];
                    const pnpDateString = pnpEsidDate.toISOString().split('T')[0];
                    
                    console.log(`[searchByUserId] Comparing: ${userDateString} === ${pnpDateString} => ${userDateString === pnpDateString}`);
                    
                    // Calculate day difference instead of requiring exact match
                    const dayDiff = Math.abs((userEsidDate - pnpEsidDate) / (1000 * 60 * 60 * 24));
                    console.log(`[searchByUserId] Date difference in days: ${dayDiff}`);
                    
                    // Allow matches within 7 days
                    if (dayDiff <= 7) {
                      console.log(`[searchByUserId] ✅ MATCH FOUND (within 7 days) for ${user.lagnname}: ${pnpRecord.date}`);
                      // If we haven't stored this user's PNP data yet, or this record is newer
                      if (!latestPnpByUser[user.lagnname] || 
                          new Date(pnpRecord.date) > new Date(latestPnpByUser[user.lagnname].date) ||
                          (new Date(pnpRecord.date).getTime() === new Date(latestPnpByUser[user.lagnname].date).getTime() &&
                           pnpRecord.agent_num?.includes('-1') && !latestPnpByUser[user.lagnname].agent_num?.includes('-1'))) {
                        console.log(`[searchByUserId] Selecting record with agent_num: ${pnpRecord.agent_num || 'N/A'}`);
                        latestPnpByUser[user.lagnname] = pnpRecord;
                      }
                    }
                  }
                } catch (dateError) {
                  console.error(`[searchByUserId] Error comparing dates for ${user.lagnname}:`, dateError);
                  console.error(`[searchByUserId] User ESID: ${user.esid}, PNP ESID: ${pnpRecord.esid}`);
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
          
          console.log(`[searchByUserId] Attached PNP data to ${Object.keys(latestPnpByUser).length} users`);
        }
      } catch (pnpError) {
        console.error('[searchByUserId] Error fetching PNP data:', pnpError);
      }
      
      console.log('[searchByUserId] Returning success with data');
      // Log just the first result as a sample and the count
      console.log('[searchByUserId] Sample result:', results[0]);
      res.json({ success: true, data: results, agnName });
    } else {
      console.log('[searchByUserId] No data found, returning error');
      res.json({ success: false, message: "No data found" });
    }
  } catch (err) {
    console.error("[searchByUserId] Error querying activeusers and usersinfo with userId", err);
    console.error("[searchByUserId] Error stack:", err.stack);
    res.status(500).json({ success: false, message: "Error retrieving data" });
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
    
    console.log("Processing profile picture upload for user:", userId);
    
    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    
    // Determine image size
    const sizeInMB = req.file.size / (1024 * 1024);
    console.log(`Image size: ${sizeInMB.toFixed(2)} MB`);
    
    // Create params for Imgur API
    const params = new URLSearchParams();
    params.append('image', base64Image);
    params.append('type', 'base64');
    
    console.log("Uploading image to Imgur...");
    
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
          console.error(`\n----- IMGUR UPLOAD ERROR (Attempt ${retryCount}/${maxRetries}) -----`);
          console.error(`Error Code: ${error.code || 'N/A'}`);
          console.error(`Error Message: ${error.message}`);
          
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Status Text: ${error.response.statusText}`);
            console.error(`Response Data:`, error.response.data);
            
            // Log rate limit information if available
            const rateHeaders = {};
            ['x-ratelimit-clientlimit', 'x-ratelimit-clientremaining', 'x-ratelimit-clientreset', 
             'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
             'x-post-rate-limit-limit', 'x-post-rate-limit-remaining', 'x-post-rate-limit-reset'].forEach(header => {
              if (error.response.headers[header]) {
                rateHeaders[header] = error.response.headers[header];
              }
            });
            
            if (Object.keys(rateHeaders).length > 0) {
              console.error('Rate Limit Headers:', rateHeaders);
            }
          } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server');
            console.error('Request details:', error.request._currentUrl || error.request.path);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error during request setup');
          }
          
          if (error.config) {
            console.error(`Request URL: ${error.config.url}`);
            console.error(`Request Method: ${error.config.method.toUpperCase()}`);
            // Don't log headers with authentication info
            console.error(`Request Timeout: ${error.config.timeout}ms`);
          }
          
          console.error('Stack trace:', error.stack);
          console.error(`----- END ERROR DETAILS -----\n`);
          
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
            
            console.log(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.response?.status === 503) {
            // Service unavailable, use exponential backoff
            const waitTime = Math.min(2000 * Math.pow(2, retryCount-1), 30000);
            console.log(`Imgur service unavailable. Waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT' || error.code === 'ECONNABORTED') {
            // Connection timeout, retry with longer timeout
            const waitTime = 3000 * retryCount;
            console.log(`Connection timeout. Waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // For other errors, use simple exponential backoff
            const waitTime = 1000 * Math.pow(2, retryCount-1) * (0.5 + Math.random());
            console.log(`Imgur upload attempt ${retryCount} failed: ${error.message}. Retrying in ${Math.ceil(waitTime/1000)}s...`);
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
    console.log("Image successfully uploaded to Imgur:", imageUrl);
    
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
    console.error("Error uploading profile picture:", error);
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
    console.error("Error removing profile picture:", error);
    res.status(500).json({ success: false, message: "Error removing profile picture" });
  }
});

/* ----------------------
   Upload Header Image to Imgur
------------------------- */
router.post("/upload-header-image", verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log("================= HEADER IMAGE UPLOAD =================");
    console.log(`Request received for header image upload. User ID: ${userId}`);
    console.log(`Request headers:`, req.headers);
    console.log(`Request body keys:`, Object.keys(req.body));
    
    if (!userId) {
      console.error("Error: No userId provided in request");
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    if (!req.file) {
      console.error("Error: No file uploaded in request");
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }
    
    console.log(`Processing header image upload for user: ${userId}`);
    console.log(`File details: ${req.file.originalname}, size: ${req.file.size} bytes, mime type: ${req.file.mimetype}`);
    
    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    
    // Determine image size
    const sizeInMB = req.file.size / (1024 * 1024);
    console.log(`Image size: ${sizeInMB.toFixed(2)} MB`);
    
    // Create params for Imgur API
    const params = new URLSearchParams();
    params.append('image', base64Image);
    params.append('type', 'base64');
    
    console.log("Initiating Imgur API upload request...");
    
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
          console.error(`\n----- IMGUR UPLOAD ERROR (Attempt ${retryCount}/${maxRetries}) -----`);
          console.error(`Error Code: ${error.code || 'N/A'}`);
          console.error(`Error Message: ${error.message}`);
          
          if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error(`Status Text: ${error.response.statusText}`);
            console.error(`Response Data:`, error.response.data);
            
            // Log rate limit information if available
            const rateHeaders = {};
            ['x-ratelimit-clientlimit', 'x-ratelimit-clientremaining', 'x-ratelimit-clientreset', 
             'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
             'x-post-rate-limit-limit', 'x-post-rate-limit-remaining', 'x-post-rate-limit-reset'].forEach(header => {
              if (error.response.headers[header]) {
                rateHeaders[header] = error.response.headers[header];
              }
            });
            
            if (Object.keys(rateHeaders).length > 0) {
              console.error('Rate Limit Headers:', rateHeaders);
            }
          } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received from server');
            console.error('Request details:', error.request._currentUrl || error.request.path);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error during request setup');
          }
          
          if (error.config) {
            console.error(`Request URL: ${error.config.url}`);
            console.error(`Request Method: ${error.config.method.toUpperCase()}`);
            // Don't log headers with authentication info
            console.error(`Request Timeout: ${error.config.timeout}ms`);
          }
          
          console.error('Stack trace:', error.stack);
          console.error(`----- END ERROR DETAILS -----\n`);
          
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
            
            console.log(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.response?.status === 503) {
            // Service unavailable, use exponential backoff
            const waitTime = Math.min(2000 * Math.pow(2, retryCount-1), 30000);
            console.log(`Imgur service unavailable. Waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT' || error.code === 'ECONNABORTED') {
            // Connection timeout, retry with longer timeout
            const waitTime = 3000 * retryCount;
            console.log(`Connection timeout. Waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            // For other errors, use simple exponential backoff
            const waitTime = 1000 * Math.pow(2, retryCount-1) * (0.5 + Math.random());
            console.log(`Imgur upload attempt ${retryCount} failed: ${error.message}. Retrying in ${Math.ceil(waitTime/1000)}s...`);
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
    console.log("Header image successfully uploaded to Imgur:", imageUrl);
    
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
    console.error("Error uploading header image:", error);
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
    console.error("Error removing header image:", error);
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
    console.error("Error updating profile information:", error);
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
    console.error("Error fetching profile information:", error);
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
  console.log("================= PUT /profile REQUEST =================");
  console.log(`Received profile update request. Body keys:`, Object.keys(req.body));
  console.log(`Request has files:`, !!req.files);
  if (req.files) {
    console.log(`Files included:`, Object.keys(req.files));
    // Log more detailed file info
    for (const [fieldName, files] of Object.entries(req.files)) {
      files.forEach((file, index) => {
        console.log(`File [${fieldName}][${index}]: name=${file.originalname}, size=${file.size} bytes, mimetype=${file.mimetype}`);
      });
    }
  }
  
  console.log("Raw body properties:");
  for (const [key, value] of Object.entries(req.body)) {
    if (key !== 'profilePic' && key !== 'profileBanner' && key !== 'headerPic') {
      console.log(`  ${key}: ${typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value}`);
    } else {
      console.log(`  ${key}: [LARGE BINARY DATA]`);
    }
  }

  try {
    // Extract basic user data from request body
    const { userId, name, email, phone, screenName, bio } = req.body;
    
    if (!userId) {
      console.error("Error: No userId provided in PUT /profile request");
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    console.log(`Processing profile update for user: ${userId}`);
    
    // Check if user exists
    const userCheck = await query('SELECT id FROM activeusers WHERE id = ?', [userId]);
    if (userCheck.length === 0) {
      console.error(`Error: User not found with ID ${userId}`);
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
      console.log("Header image file detected, processing upload to Imgur...");
      console.log(`Header file details: name=${headerFile.originalname}, size=${headerFile.size} bytes, type=${headerFile.mimetype}`);
      
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
          console.log(`Attempting to upload header image to Imgur (attempt ${retryCount + 1}/${maxRetries})...`);
          const headerResponse = await axios.post('https://api.imgur.com/3/image', headerParams, {
            headers: {
              'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
          });
          
          headerPicUrl = headerResponse.data.data.link;
          console.log(`Header image uploaded successfully to: ${headerPicUrl}`);
          headerUploadSuccess = true;
        } catch (uploadError) {
          retryCount++;
          console.error(`Header image upload attempt ${retryCount} failed:`, uploadError.message);
          
          if (uploadError.response) {
            console.error(`Status: ${uploadError.response.status}`);
            console.error(`Response data:`, uploadError.response.data);
            
            // Check if it's a rate limiting issue (429)
            if (uploadError.response.status === 429) {
              const resetTime = uploadError.response.headers['x-ratelimit-clientreset'] || 
                              uploadError.response.headers['x-ratelimit-userreset'];
              const waitTime = resetTime ? parseInt(resetTime) * 1000 : 1000 * retryCount;
              console.log(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (uploadError.response.status === 503) {
              const waitTime = 2000 * retryCount;
              console.log(`Service unavailable. Waiting ${waitTime/1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          } else {
            // For connection timeouts or network errors
            const waitTime = 2000 * retryCount;
            console.log(`Network error. Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // If we've reached max retries
          if (retryCount >= maxRetries) {
            console.error("Max retries reached for header image upload. Continuing without header image.");
          }
        }
      }
    } else {
      // Check if profileBanner is in the body as base64 and not in files
      if (req.body.profileBanner && typeof req.body.profileBanner === 'string' && req.body.profileBanner.startsWith('data:image')) {
        console.log("Found profileBanner as base64 string in request body");
        
        // Extract base64 data from data URL
        const base64Data = req.body.profileBanner.split(',')[1];
        if (base64Data) {
          console.log("Extracted base64 data from profileBanner");
          
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
              console.log(`Attempting to upload header image to Imgur (attempt ${retryCount + 1}/${maxRetries})...`);
              const headerResponse = await axios.post('https://api.imgur.com/3/image', headerParams, {
                headers: {
                  'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000
              });
              
              headerPicUrl = headerResponse.data.data.link;
              console.log(`Header image uploaded successfully to: ${headerPicUrl}`);
              headerUploadSuccess = true;
            } catch (uploadError) {
              retryCount++;
              console.error(`Header image upload attempt ${retryCount} failed:`, uploadError.message);
              
              if (uploadError.response) {
                console.error(`Status: ${uploadError.response.status}`);
                console.error(`Response data:`, uploadError.response.data);
                
                // Check if it's a rate limiting issue (429)
                if (uploadError.response.status === 429) {
                  const resetTime = uploadError.response.headers['x-ratelimit-clientreset'] || 
                                  uploadError.response.headers['x-ratelimit-userreset'];
                  const waitTime = resetTime ? parseInt(resetTime) * 1000 : 1000 * retryCount;
                  console.log(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                } else if (uploadError.response.status === 503) {
                  const waitTime = 2000 * retryCount;
                  console.log(`Service unavailable. Waiting ${waitTime/1000}s before retry...`);
                  await new Promise(resolve => setTimeout(resolve, waitTime));
                }
              } else {
                // For connection timeouts or network errors
                const waitTime = 2000 * retryCount;
                console.log(`Network error. Waiting ${waitTime/1000}s before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
              
              // If we've reached max retries
              if (retryCount >= maxRetries) {
                console.error("Max retries reached for header image upload. Continuing without header image.");
              }
            }
          }
        }
      }
    }
    
    // Process profile pic if uploaded
    if (req.files && req.files.profilePic && req.files.profilePic.length > 0) {
      console.log("Profile image file detected, processing upload to Imgur...");
      
      const profileFile = req.files.profilePic[0];
      console.log(`Profile file details: name=${profileFile.originalname}, size=${profileFile.size} bytes, type=${profileFile.mimetype}`);
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
          console.log(`Attempting to upload profile image to Imgur (attempt ${retryCount + 1}/${maxRetries})...`);
          const profileResponse = await axios.post('https://api.imgur.com/3/image', profileParams, {
            headers: {
              'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 30000
          });
          
          profilePicUrl = profileResponse.data.data.link;
          console.log(`Profile image uploaded successfully to: ${profilePicUrl}`);
          profileUploadSuccess = true;
        } catch (uploadError) {
          retryCount++;
          console.error(`Profile image upload attempt ${retryCount} failed:`, uploadError.message);
          
          if (uploadError.response) {
            console.error(`Status: ${uploadError.response.status}`);
            console.error(`Response data:`, uploadError.response.data);
            
            // Check if it's a rate limiting issue (429)
            if (uploadError.response.status === 429) {
              const resetTime = uploadError.response.headers['x-ratelimit-clientreset'] || 
                              uploadError.response.headers['x-ratelimit-userreset'];
              const waitTime = resetTime ? parseInt(resetTime) * 1000 : 1000 * retryCount;
              console.log(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else if (uploadError.response.status === 503) {
              const waitTime = 2000 * retryCount;
              console.log(`Service unavailable. Waiting ${waitTime/1000}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          } else {
            // For connection timeouts or network errors
            const waitTime = 2000 * retryCount;
            console.log(`Network error. Waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // If we've reached max retries
          if (retryCount >= maxRetries) {
            console.error("Max retries reached for profile image upload. Continuing without profile image update.");
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
      console.log(`No fields to update for user ${userId}`);
      return res.json({ 
        success: true, 
        message: "Profile unchanged - no updateable fields provided" 
      });
    }
    
    // Add userId to values array for WHERE clause
    updateValues.push(userId);
    
    // Execute update query
    const updateQuery = `UPDATE activeusers SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log(`Executing update query: ${updateQuery.replace(/\?/g, '***')}`);
    
    const updateResult = await query(updateQuery, updateValues);
    console.log(`Update result: ${JSON.stringify(updateResult)}`);
    
    if (updateResult.affectedRows === 0) {
      console.error(`Update failed for user ${userId} - no rows affected`);
      return res.status(500).json({ success: false, message: "Failed to update profile information" });
    }
    
    // Get updated user data
    const user = await query(
      'SELECT id, lagnname, email, phone, screen_name, bio, profpic, header_pic, clname, Role, teamRole FROM activeusers WHERE id = ?',
      [userId]
    );
    
    if (user.length === 0) {
      console.error(`Unexpected error: User ${userId} not found after update`);
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
    console.log(`Profile update successful for user ${userId}`);
    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user[0],
      token: token // Only included if profile pic was updated
    });
  } catch (error) {
    console.error("Error updating profile:", error);
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
    console.error("[debug/pnp] Error:", error);
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
    console.error(`[debug/pnp/${req.params.name}] Error:`, error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
