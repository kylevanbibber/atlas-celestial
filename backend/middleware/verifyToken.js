const jwt = require('jsonwebtoken');
const { query: dbQuery } = require('../db');
require('dotenv').config();

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, ...rest] = cookie.split('=');
    cookies[name.trim()] = rest.join('=').trim();
    return cookies;
  }, {});
}

function verifyToken(req, res, next) {
  // Check multiple sources for the token
  let token = req.headers['x-access-token'] || 
              (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  // Check query param 'token' if not found in headers
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }
  
  // Check cookies if token not found in headers
  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.authToken || cookies.auth_token;
  }

  // Allow bypass for development/testing with userId parameter (query or route param)
  if (!token && process.env.NODE_ENV !== 'production') {
    const devUserId = (req.query && req.query.userId) || (req.params && req.params.userId);
    if (devUserId) {
      req.userId = devUserId;
      req.user = { userId: devUserId };
      return next();
    }
  }

  if (!token) {
    return res.status(403).send({ auth: false, message: 'No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', async (err, decoded) => {
    if (err) {
      console.error("[verifyToken] Error verifying token:", err);
      return res.status(401).send({ auth: false, message: 'Failed to authenticate token.' });
    }
    
    // Check for impersonation header
    const impersonatedUserId = req.headers['x-impersonated-user-id'];
    
    if (impersonatedUserId) {
      // Try to fetch impersonated user's data using the promise-based query
      const getUserQuery = `SELECT id, lagnname, clname, Role FROM activeusers WHERE id = ? AND Active = 'y' LIMIT 1`;
      
      try {
        console.log(`[verifyToken] Fetching impersonated user data for ID ${impersonatedUserId}`);
        const userResults = await dbQuery(getUserQuery, [impersonatedUserId]);
        
        if (!userResults || userResults.length === 0) {
          console.warn(`[verifyToken] No user found for impersonation ID ${impersonatedUserId}`);
          req.userId = impersonatedUserId;
          req.user = {
            userId: impersonatedUserId,
            id: impersonatedUserId,
            lagnname: decoded.lagnname,
            clname: decoded.clname,
            Role: decoded.Role,
            _isImpersonating: true,
            _originalAdminId: decoded.id || decoded.userId,
            _fallbackAuth: true,
            _fallbackReason: 'User not found'
          };
          return next();
        }
        
        const impersonatedUser = userResults[0];
        console.log(`[verifyToken] ✅ Successfully fetched impersonated user: ${impersonatedUser.lagnname} (${impersonatedUser.clname})`);
        
        // Set request context with impersonated user's actual data
        req.userId = impersonatedUserId;
        req.user = {
          userId: impersonatedUserId,
          id: impersonatedUserId,
          lagnname: impersonatedUser.lagnname,
          clname: impersonatedUser.clname,
          Role: impersonatedUser.Role,
          _isImpersonating: true,
          _originalAdminId: decoded.id || decoded.userId,
          _originalAdminName: decoded.lagnname
        };
        
        next();
      } catch (dbError) {
        console.error(`[verifyToken] ❌ DB error during impersonation lookup for user ${impersonatedUserId}:`, dbError.message);
        // Fallback to using userId only
        req.userId = impersonatedUserId;
        req.user = {
          userId: impersonatedUserId,
          id: impersonatedUserId,
          lagnname: decoded.lagnname,
          clname: decoded.clname,
          Role: decoded.Role,
          _isImpersonating: true,
          _originalAdminId: decoded.id || decoded.userId,
          _fallbackAuth: true,
          _fallbackReason: dbError.message
        };
        next();
      }
    } else {
      // Normal user access
      req.userId = decoded.id || decoded.userId;
      req.user = {
        userId: decoded.id || decoded.userId,
        lagnname: decoded.lagnname,
        clname: decoded.clname,
        Role: decoded.Role
      };
      next();
    }
  });
}

module.exports = verifyToken;
