const jwt = require('jsonwebtoken');
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

  // Allow bypass for development/testing with userId parameter
  if (!token && process.env.NODE_ENV !== 'production' && req.query.userId) {
    console.log('Development mode: Using userId query parameter instead of token');
    req.userId = req.query.userId;
    return next();
  }

  if (!token) {
    console.log('No token provided. Headers:', Object.keys(req.headers));
    return res.status(403).send({ auth: false, message: 'No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, decoded) => {
    if (err) {
      console.error("[verifyToken] Error verifying token:", err);
      return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    }
    
    // Check for impersonation header
    const impersonatedUserId = req.headers['x-impersonated-user-id'];
    
    if (impersonatedUserId) {
      // Use impersonated user ID but keep original admin info for authorization
      req.userId = impersonatedUserId;
      req.user = {
        userId: impersonatedUserId,
        lagnname: decoded.lagnname, // Keep admin info for auth purposes
        clname: decoded.clname,
        Role: decoded.Role,
        _isImpersonating: true,
        _originalAdminId: decoded.id || decoded.userId
      };
      console.log(`[Auth] Impersonation detected: Admin ${decoded.id || decoded.userId} accessing as user ${impersonatedUserId}`);
    } else {
      // Normal user access
      req.userId = decoded.id || decoded.userId;
      req.user = {
        userId: decoded.id || decoded.userId,
        lagnname: decoded.lagnname,
        clname: decoded.clname,
        Role: decoded.Role
      };
    }
    
    next();
  });
}

module.exports = verifyToken;
