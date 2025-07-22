const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    // Safely access cookies to avoid "Cannot read properties of undefined"
    let token = req?.cookies?.auth_token;
    
    // Log token retrieval attempt
    console.log('[Auth] Attempting to get token:', { 
      hasCookies: !!req.cookies,
      hasAuthHeader: !!req.headers.authorization,
      tokenFromCookie: !!token
    });
    
    if (!token && req.headers.authorization) {
      // Extract from Authorization: Bearer <token>
      token = req.headers.authorization.split(' ')[1];
      console.log('[Auth] Using token from Authorization header');
    }
    
    if (!token) {
      console.log('[Auth] No token provided in request');
      return res.status(401).json({ success: false, message: 'No authentication token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[Auth] Token decoded:', { userId: decoded.userId, role: decoded.Role });
    
    // Check if token is valid in the database
    const tokenCheck = await query(
      "SELECT * FROM user_tokens WHERE userId = ? AND userToken = ? AND valid = 'y'",
      [decoded.userId, token]
    );
    
    if (tokenCheck.length === 0) {
      console.log('[Auth] Token not found in database or marked invalid');
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    
    // Set user info to request
    req.user = decoded;
    
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
      console.log('[Auth] Admin verification failed: No user in request');
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    
    // Log the user information for debugging
    console.log('[Auth] Checking admin rights for user:', {
      userId: req.user.userId,
      role: req.user.Role || 'not set',
      clname: req.user.clname || 'not set'
    });
    
    // Check if the user has admin permission - note 'Admin' is case-sensitive
    // Also check for 'admin' in lowercase for backward compatibility
    if (req.user.Role === 'Admin' || 
        req.user.Role === 'admin' || 
        req.user.Role === 'superadmin' || 
        req.user.Role === 'SuperAdmin') {
      console.log('[Auth] Admin access granted');
      next();
    } else {
      console.log('[Auth] Admin access denied, role is:', req.user.Role);
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
  } catch (error) {
    console.error('[Auth] Admin verification error:', error.message);
    return res.status(500).json({ success: false, message: 'Admin verification failed' });
  }
};

module.exports = { verifyToken, verifyAdmin }; 