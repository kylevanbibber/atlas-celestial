const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    // Safely access cookies to avoid "Cannot read properties of undefined"
    let token = req?.cookies?.auth_token;
    
 
    
    if (!token && req.headers.authorization) {
      // Extract from Authorization: Bearer <token>
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      console.error('[Auth] JWT verification failed:', jwtError.message);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    // For onboarding users, skip the user_tokens table check
    // Onboarding users authenticate via the pipeline table, not activeusers
    const decodedUserId = decoded.userId || decoded.id;
    const decodedRole = decoded.role || decoded.Role;

    if (decodedRole === 'onboarding') {
      // Set user info to request
      req.user = { ...decoded, userId: decodedUserId, role: decodedRole };
      req.isOnboarding = true;
      return next();
    }
    
    // For regular users, check if token is valid in the database
    const tokenCheck = await query(
      "SELECT * FROM user_tokens WHERE userId = ? AND userToken = ? AND valid = 'y'",
      [decodedUserId, token]
    );
    
    if (tokenCheck.length === 0) {
      console.error('[Auth] Token not found in user_tokens table for userId:', decodedUserId);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    // Set user info to request
    req.user = { ...decoded, userId: decodedUserId, role: decodedRole };
    
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error.message);
    console.error('[Auth] Error stack:', error.stack);
    return res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// Middleware to verify admin role
const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    

    
    // Check if the user has admin permission - note 'Admin' is case-sensitive
    // Also check for 'admin' in lowercase for backward compatibility
    if (req.user.Role === 'Admin' || 
        req.user.Role === 'admin' || 
        req.user.Role === 'superadmin' || 
        req.user.Role === 'SuperAdmin') {
      next();
    } else {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
  } catch (error) {
    console.error('[Auth] Admin verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Admin verification failed' });
  }
};

// Middleware to verify staff/admin privileges (non-AGT or Admin or teamRole app)
const verifyStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const role = req.user.Role;
    const teamRole = req.user.teamRole;
    const clname = req.user.clname;

    const isAdminRole = role === 'Admin' || role === 'admin' || role === 'superadmin' || role === 'SuperAdmin';
    const isAppTeamRole = teamRole === 'app';
    const allowedClnames = ['SA', 'GA', 'MGA', 'RGA', 'SGA'];
    const isAllowedCl = allowedClnames.includes(String(clname || '').toUpperCase());

    if (isAdminRole || isAppTeamRole || isAllowedCl) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  } catch (error) {
    console.error('[Auth] Staff verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Permission verification failed' });
  }
};

module.exports = { verifyToken, verifyAdmin, verifyStaff };