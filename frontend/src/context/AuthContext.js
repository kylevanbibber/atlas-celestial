// src/context/AuthContext.js
/*
 * Enhanced JWT Authentication System
 * ----------------------------------
 * 
 * Backend Integration Requirements:
 * 
 * 1. JWT Token Requirements:
 *    - Include 'userId' in the JWT token payload
 *    - Ensure token has appropriate expiration (exp claim)
 *    - Example payload: { userId: "123", email: "user@example.com", exp: 1234567890 }
 * 
 * 2. Login Endpoint (/auth/newlogin):
 *    - Return a JWT token with the userId in the payload
 *    - Include userId in the response body for backward compatibility
 * 
 * 3. Profile Endpoint (/auth/profile):
 *    - Accept userId from:
 *      a. Request params (for GET)
 *      b. Request body (for PUT/POST)
 *      c. Extract from the JWT token if not explicitly provided
 *    - Return user data including: userId, email, name, clname, profpic
 * 
 * 4. Permissions:
 *    - Primary permissions are now based on 'clname'
 *    - Common clname values: 'admin', 'manager', 'agent', 'mga'
 */

import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import api from "../api";
import { dashboardAllowedAgentTypes } from "./permissionsConfig";
import { loadTeamCustomization, applyTeamStyling, resetTeamStyling } from "../utils/themeManager";

// Create the auth context
export const AuthContext = createContext();

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext);

// Token storage key
const TOKEN_KEY = 'auth_token';

/**
 * Helper function to safely decode a JWT token
 * @param {string} token - The JWT token to decode
 * @returns {object|null} - The decoded token payload or null if invalid
 */
const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    const decoded = jwtDecode(token);
    
    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null; // Token has expired
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Get the stored auth token from localStorage
 * @returns {string|null} - The stored token or null
 */
const getStoredToken = () => {
  const primaryToken = localStorage.getItem(TOKEN_KEY);
  
  // If no primary token, check if we have a Discord OAuth backup
  if (!primaryToken) {
    const discordBackup = localStorage.getItem('discord_auth_backup');
    const discordTimestamp = localStorage.getItem('discord_oauth_timestamp');
    
    // Only use backup if it's recent (within last 10 minutes)
    if (discordBackup && discordTimestamp) {
      const timestamp = parseInt(discordTimestamp);
      const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
      
      if (timestamp > tenMinutesAgo) {
        console.log('[AuthContext] 🔄 Restoring auth token from Discord OAuth backup');
        
        // Restore the primary token from backup
        localStorage.setItem(TOKEN_KEY, discordBackup);
        
        // Clean up backup tokens
        localStorage.removeItem('discord_auth_backup');
        localStorage.removeItem('discord_oauth_timestamp');
        
        return discordBackup;
      } else {
        // Clean up expired backup
        localStorage.removeItem('discord_auth_backup');
        localStorage.removeItem('discord_oauth_timestamp');
      }
    }
  }
  
  return primaryToken;
};

/**
 * Set the auth token in localStorage
 * @param {string} token - The token to store
 */
const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

/**
 * Check if the user has dashboard access based on role
 * @param {object} user - The user object
 * @returns {boolean} - Whether the user has dashboard access
 */
const hasDashboardAccess = (user) => {
  if (!user) return false;
  const role = user.permissions;
  const clname = user.clname;
  // If either role property is one of the allowed roles, grant access
  return (
    dashboardAllowedAgentTypes.includes(role) ||
    dashboardAllowedAgentTypes.includes(clname)
  );
};

/**
 * Main Auth Provider component
 */
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminUser, setOriginalAdminUser] = useState(null);
  const [impersonatedUser, setImpersonatedUser] = useState(null);

  // Initialize window impersonation state
  useEffect(() => {
    window.__IMPERSONATION_STATE__ = {
      isImpersonating: isImpersonating,
      impersonatedUserId: impersonatedUser?.userId || null
    };
  }, [isImpersonating, impersonatedUser]);

  /**
   * Get user ID from token
   * @param {string} tokenToUse - The JWT token
   * @returns {string|null} - The user ID or null if not found
   */
  const getUserIdFromToken = useCallback((tokenToUse) => {
    if (!tokenToUse) return null;
    const decoded = decodeToken(tokenToUse);
    return decoded?.userId || decoded?.sub || null;
  }, []);

  /**
   * Logout handler - removes token and user data
   */
  const logout = useCallback((preserveIntendedPath = true) => {
    console.log('[AuthContext] 🚪 Logging out user', { preserveIntendedPath });
    
    // Clear token from state and storage
    setToken(null);
    setUser(null);
    setStoredToken(null);
    
    // Clear impersonation state
    setIsImpersonating(false);
    setOriginalAdminUser(null);
    setImpersonatedUser(null);
    
    // Clear error state from previous session issues
    setError(null);
    
    // Optional: Call logout endpoint if your API requires it
    try {
      api.post('/auth/logout').catch(() => {
        // Still proceed with client-side logout regardless
      });
    } catch (err) {
      // Continue with logout regardless of errors
    }
    
    // If this is a manual logout (not auto-logout), clear the intended path
    if (!preserveIntendedPath) {
      localStorage.removeItem('intendedPath');
      console.log('[AuthContext] 🗑️ Cleared intended path for manual logout');
    }
    
    // Reset any team customizations when logging out
    try {
      if (typeof window !== 'undefined' && window.__RESET_TEAM_STYLING__) {
        window.__RESET_TEAM_STYLING__();
      }
    } catch (err) {
      // Non-critical error, continue with logout
    }
    
    // Clean up hierarchy cache and any pending data
    try {
      if (typeof window !== 'undefined') {
        // Clear any pending hierarchy data
        if (window.__PENDING_HIERARCHY__) {
          delete window.__PENDING_HIERARCHY__;
        }
        // Clear cached hierarchy data
        sessionStorage.removeItem('user_hierarchy_cache');
      }
    } catch (err) {
      // Non-critical error, continue with logout
    }
  }, []);

  // Configure API interceptor to add the auth token to requests
  useEffect(() => {
    // Request interceptor
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        // List of endpoints that don't require authentication
        const publicEndpoints = [
          '/auth/login',
          '/auth/newlogin',
          '/auth/register',
          '/auth/forgot-password',
          '/auth/reset-password',
          '/onboarding/auth/start',
          '/onboarding/auth/login',
          '/onboarding/auth/set-password',
          '/onboarding/auth/forgot',
          '/onboarding/auth/reset',
          '/recruitment/',
          '/client-sign/',
          '/agent-sign/',
          '/document-signing'
        ];
        
        // Check if this specific API endpoint is public (doesn't require auth)
        const isPublicEndpoint = publicEndpoints.some(endpoint => config.url?.includes(endpoint));
        
        // Legacy check for auth endpoints
        const isAuthEndpoint = config.url?.includes('/auth/login') || 
                                 config.url?.includes('/auth/newlogin') ||
                                 config.url?.includes('/auth/register');
        
        // Onboarding context: permit requests without agent token and tag with pipeline id
        const onboardingPipelineId = typeof window !== 'undefined' ? localStorage.getItem('onboardingPipelineId') : null;
        const isOnboardingContext = Boolean(onboardingPipelineId);
        const isOnboardingPublic = config.url?.startsWith('/onboarding/');
        const isOnboardingAllowedEndpoint =
          isOnboardingPublic ||
          config.url?.startsWith('/recruitment/recruits/') ||
          config.url?.startsWith('/recruitment/stages') ||
          config.url?.startsWith('/pipeline-attachments/');
        if (isOnboardingContext) {
          // Tag requests so backend can authorize via pipeline id
          config.headers['X-Onboarding-Pipeline-Id'] = onboardingPipelineId;
        }

        // Token is now being added in api.js interceptor
        // if (token && !isAuthEndpoint) {
        //   config.headers.Authorization = `Bearer ${token}`;
        
        // Prefer impersonated userId when active
        const impersonationState = typeof window !== 'undefined' ? window.__IMPERSONATION_STATE__ : null;
        const impersonatedUserId = impersonationState?.isImpersonating ? impersonationState.impersonatedUserId : null;

        // Add/override userId for all non-auth requests
        if ((token || impersonatedUserId) && !isAuthEndpoint && !(isOnboardingContext && isOnboardingAllowedEndpoint)) {
          const tokenUserId = token ? getUserIdFromToken(token) : null;
          const effectiveUserId = impersonatedUserId || tokenUserId;

          if (effectiveUserId) {
            const newConfig = { ...config };

            // Check if this is a release management endpoint that should preserve its own userId
            const isReleaseManagementEndpoint = config.url?.includes('/release/pass-user') || 
                                              config.url?.includes('/release/fail-user') ||
                                              config.url?.includes('/release/delete-user') ||
                                              config.url?.includes('/release/toggle-hide') ||
                                              config.url?.includes('/release/schedule-release') ||
                                              config.url?.includes('/release/second-pack') ||
                                              config.url?.includes('/release/update-progress');
                                              
            // Check if this is a licensing endpoint that should preserve its own userId
            const isLicensingEndpoint = config.url?.includes('/licenses');
            
            // Check if this is an auth endpoint that should preserve its own userId (like toggleActive)
            const isAuthEndpointWithTargetUser = config.url?.includes('/auth/toggleActive') || 
                                                config.url?.includes('/auth/setManagerInactive');

            // Treat all release endpoints as preserve-when-body-has-userId
            const isAnyReleaseEndpoint = config.url?.startsWith('/release/');

            // Preserve target user for admin user management utilities (send account info/reset password)
            const isAdminUsersTargetEndpoint = config.url?.includes('/admin/users/send-account-info') ||
                                               config.url?.includes('/admin/users/reset-password');

            if (config.method === 'get' || config.method === 'delete') {
              const isReleaseGet = config.url?.startsWith('/release/');
              const hasUserIdParam = newConfig.params && Object.prototype.hasOwnProperty.call(newConfig.params, 'userId');
              // Do not inject userId into release endpoints GETs
              if (!isReleaseGet && !hasUserIdParam) {
                newConfig.params = { userId: effectiveUserId, ...newConfig.params };
              }
            } else if (config.headers['Content-Type']?.includes('application/json')) {
              // For release, licensing, and auth endpoints with target users, don't override userId if it already exists in the data
              const shouldPreserveBodyUserId = (isReleaseManagementEndpoint || isLicensingEndpoint || isAnyReleaseEndpoint || isAuthEndpointWithTargetUser || isAdminUsersTargetEndpoint) && config.data && Object.prototype.hasOwnProperty.call(config.data, 'userId');
              if (shouldPreserveBodyUserId) {
                // Preserve the original userId for these endpoints
                const endpointType = isLicensingEndpoint ? 'licensing' : isAuthEndpointWithTargetUser ? 'auth' : 'release';
                console.log(`🔧 [AUTH CONTEXT] Preserving original userId for ${endpointType} endpoint: ${config.url}`, {
                  originalUserId: config.data.userId,
                  wouldBeOverriddenWith: effectiveUserId,
                  endpoint: config.url
                });
                newConfig.data = { ...newConfig.data }; // Keep original data unchanged
              } else {
                // For all other endpoints, add/override userId as normal
                newConfig.data = { ...newConfig.data, userId: effectiveUserId };
              }
            }

            return newConfig;
          }
        } else if (!token && !isAuthEndpoint && !isPublicEndpoint && !(isOnboardingContext && isOnboardingAllowedEndpoint)) {
          // Cancel requests that need auth but don't have a token
          console.warn('[AuthContext] 🚫 Blocking API request without token:', config.url);
          return Promise.reject(new Error('No authentication token available'));
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token related errors
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Handle 401 Unauthorized errors (expired token)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Force logout on auth errors
          if (error.response?.data?.message?.includes('token')) {
            console.log('[AuthContext] Token error detected, forcing logout');
            logout();
          }
        }
        
        return Promise.reject(error);
      }
    );

    // Clean up interceptors when component unmounts
    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [token, getUserIdFromToken, logout]);

  // Listen for token expiration events from the API layer
  useEffect(() => {
    const handleTokenExpired = (event) => {
      console.log('[AuthContext] 🔒 Token expiration event received:', event.detail);
      
      // Force logout when token expires
      logout();
      
      // Optional: Show a user-friendly message
      setError('Your session has expired. Please log in again.');
    };

    // Add event listener for token expiration
    window.addEventListener('auth:token-expired', handleTokenExpired);

    // Cleanup event listener
    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
  }, [logout]);

  // Periodic token validation check
  useEffect(() => {
    let tokenCheckInterval;

    if (token && user) {
      // Check token validity every 5 minutes
      tokenCheckInterval = setInterval(() => {
        const decodedToken = decodeToken(token);
        
        if (!decodedToken) {
          console.log('[AuthContext] ⏰ Periodic check: Token is invalid or expired, logging out');
          
          // Save current page before auto-logout
          const currentPath = window.location.pathname + window.location.search + window.location.hash;
          const isCurrentlyOnAuthPage = ['/login', '/register', '/adminlogin'].includes(window.location.pathname);
          
          if (!isCurrentlyOnAuthPage && currentPath !== '/') {
            localStorage.setItem('intendedPath', currentPath);
            console.log(`[AuthContext] 💾 Saved current page for restoration: ${currentPath}`);
          }
          
          // Show user-friendly message and logout
          setError('Your session has expired. Please log in again.');
          logout();
        } else {
          // Check if token will expire in the next 5 minutes (300 seconds)
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = decodedToken.exp - now;
          
          if (timeUntilExpiry <= 300 && timeUntilExpiry > 0) {
            console.log(`[AuthContext] ⚠️ Token will expire in ${timeUntilExpiry} seconds`);
            setError('Your session will expire soon. Please save your work.');
          }
        }
      }, 5 * 60 * 1000); // Check every 5 minutes
    }

    // Cleanup interval on unmount or when token changes
    return () => {
      if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
      }
    };
  }, [token, user, logout]);

  // Parse token and load user data whenever token changes
  useEffect(() => {
    const loadUserFromToken = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!token) {
          setUser(null);
          setLoading(false);
          // Reset any team customizations when logging out
          resetTeamStyling();
          return;
        }
        
        // Decode the token to get user info
        const decodedToken = decodeToken(token);
        
        if (!decodedToken) {
          // Token is invalid or expired
          setToken(null);
          setUser(null);
          setStoredToken(null);
          setLoading(false);
          return;
        }
        
        // Extract userId from token
        const userId = decodedToken.userId || decodedToken.sub;
        
        if (!userId) {
          // Invalid token - logout and clear
          setToken(null);
          setUser(null);
          setStoredToken(null);
          setLoading(false);
          return;
        }
        
        // Load team customization settings
        const teamSettings = await loadTeamCustomization(userId);
        if (teamSettings) {
          // Apply team customization to the application
          applyTeamStyling(teamSettings);
        } else {
          // Reset to default styling if no team settings found
          resetTeamStyling();
        }

        // Preload hierarchy data in the background (for token-based auth)
        try {
          console.log('[AuthContext] 🔄 Preloading hierarchy data for returning user...');
          const hierarchyResp = await api.post('/auth/searchByUserId', { userId });
          
          if (hierarchyResp.data?.success) {
            const hierarchy = Array.isArray(hierarchyResp.data.data) ? hierarchyResp.data.data : [];
            
            // We'll get user data from the profile API call below, so let's wait for it
            // and then cache the hierarchy data after we have the complete user info
            window.__PENDING_HIERARCHY__ = {
              hierarchy: hierarchy,
              userId: userId,
              timestamp: Date.now()
            };
            
            console.log(`[AuthContext] 📋 Hierarchy data fetched, will cache after profile load`);
          }
        } catch (hierarchyErr) {
          console.warn('[AuthContext] ⚠️ Background hierarchy preload failed for token auth:', hierarchyErr);
        }
        
        // Try to load full profile from API
        try {
          // Pass userId in params
          const response = await api.get('/auth/profile', { params: { userId } });
          
          // Create complete user object with profile data
          const userData = {
            ...response.data,
            userId: userId,
            email: response.data.email || decodedToken.email || '',
            name: response.data.name || decodedToken.name || '',
            clname: response.data.clname || '',
            phone: response.data.phone || '',
            profilePicture: response.data.profpic || response.data.profilePicture || '',
            lagnname: response.data.agnName || response.data.lagnname || '',
            Role: response.data.Role || '',
            permissions: response.data.Role || response.data.permissions || '',
            teamRole: response.data.teamRole || decodedToken.teamRole || '',
            // Add team styles to user object
            teamStyles: teamSettings
          };
          
          // Add computed permission for dashboard access
          userData.canViewDashboard = hasDashboardAccess(userData);
          
          // Cache pending hierarchy data if available
          if (typeof window !== 'undefined' && window.__PENDING_HIERARCHY__) {
            try {
              const pendingHierarchy = window.__PENDING_HIERARCHY__;
              const userLagnname = userData.lagnname || userData.name || '';
              
              // Prepare hierarchy data structure
              const hierarchyInfo = {
                raw: pendingHierarchy.hierarchy,
                teamIds: pendingHierarchy.hierarchy.map(u => u.id).filter(Boolean),
                teamNames: pendingHierarchy.hierarchy.map(u => u.lagnname).filter(Boolean),
                allIds: [pendingHierarchy.userId, ...pendingHierarchy.hierarchy.map(u => u.id).filter(Boolean)],
                allNames: [userLagnname, ...pendingHierarchy.hierarchy.map(u => u.lagnname).filter(Boolean)].filter(Boolean),
                lastFetched: pendingHierarchy.timestamp
              };

              // Cache the hierarchy data
              const cacheObject = {
                userId: pendingHierarchy.userId,
                timestamp: pendingHierarchy.timestamp,
                data: hierarchyInfo
              };
              
              sessionStorage.setItem('user_hierarchy_cache', JSON.stringify(cacheObject));
              
              console.log(`[AuthContext] ✅ Cached preloaded hierarchy data for returning user ${userLagnname}:`, {
                teamCount: hierarchyInfo.teamIds.length,
                totalAccessible: hierarchyInfo.allIds.length,
                fromTokenAuth: true
              });
              
              // Clean up
              delete window.__PENDING_HIERARCHY__;
            } catch (cacheErr) {
              console.warn('[AuthContext] ⚠️ Failed to cache preloaded hierarchy:', cacheErr);
              // Clean up anyway
              delete window.__PENDING_HIERARCHY__;
            }
          }
          
          setUser(userData);

          // After successful user load, submit any pending resident license created during register
          try {
            const pending = localStorage.getItem('pending_resident_license');
            if (pending) {
              const payload = JSON.parse(pending);
              if (payload && payload.userId) {
                await api.post('/licenses', payload);
                localStorage.removeItem('pending_resident_license');
              }
            }
          } catch (e) {
            console.warn('[AuthContext] Failed to submit pending resident license:', e);
          }
        } catch (error) {
          console.error('[AuthContext] Failed to load user profile:', error);
          
          // Check if this is an authentication failure
          if (error.response?.status === 401) {
            // Try Discord OAuth backup recovery before giving up
            const discordBackup = localStorage.getItem('discord_auth_backup');
            const discordTimestamp = localStorage.getItem('discord_oauth_timestamp');
            
            if (discordBackup && discordTimestamp && discordBackup !== token) {
              const timestamp = parseInt(discordTimestamp);
              const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
              
              if (timestamp > fiveMinutesAgo) {
                console.warn('[AuthContext] 🔄 Primary token failed, attempting Discord backup recovery');
                
                // Replace current token with backup
                setToken(discordBackup);
                setStoredToken(discordBackup);
                
                // Clean up backup
                localStorage.removeItem('discord_auth_backup');
                localStorage.removeItem('discord_oauth_timestamp');
                
                // Let the new token be processed in the next effect cycle
                setLoading(false);
                return;
              }
            }
            
            console.warn('[AuthContext] Token authentication failed, logging out');
            // Token is invalid, clear authentication
            setToken(null);
            setUser(null);
            setStoredToken(null);
            setLoading(false);
            return;
          }
          
          // For non-auth errors, create basic user data from token
          const basicUserData = {
            userId: userId,
            email: decodedToken.email || '',
            name: decodedToken.name || '',
            clname: decodedToken.clname || '',
            profilePicture: decodedToken.profpic || '',
            lagnname: decodedToken.agnName || decodedToken.lagnname || '',
            Role: decodedToken.Role || '',
            permissions: decodedToken.Role || decodedToken.permissions || '',
            teamRole: decodedToken.teamRole || '',
            // Add team styles to basic user data too
            teamStyles: teamSettings
          };
          
          // Add computed permission for dashboard access
          basicUserData.canViewDashboard = hasDashboardAccess(basicUserData);
          
          // Cache pending hierarchy data if available (even with basic user data)
          if (typeof window !== 'undefined' && window.__PENDING_HIERARCHY__) {
            try {
              const pendingHierarchy = window.__PENDING_HIERARCHY__;
              const userLagnname = basicUserData.lagnname || basicUserData.name || '';
              
              // Prepare hierarchy data structure
              const hierarchyInfo = {
                raw: pendingHierarchy.hierarchy,
                teamIds: pendingHierarchy.hierarchy.map(u => u.id).filter(Boolean),
                teamNames: pendingHierarchy.hierarchy.map(u => u.lagnname).filter(Boolean),
                allIds: [pendingHierarchy.userId, ...pendingHierarchy.hierarchy.map(u => u.id).filter(Boolean)],
                allNames: [userLagnname, ...pendingHierarchy.hierarchy.map(u => u.lagnname).filter(Boolean)].filter(Boolean),
                lastFetched: pendingHierarchy.timestamp
              };

              // Cache the hierarchy data
              const cacheObject = {
                userId: pendingHierarchy.userId,
                timestamp: pendingHierarchy.timestamp,
                data: hierarchyInfo
              };
              
              sessionStorage.setItem('user_hierarchy_cache', JSON.stringify(cacheObject));
              
              console.log(`[AuthContext] ✅ Cached hierarchy data for basic user ${userLagnname} (profile API failed)`);
              
              // Clean up
              delete window.__PENDING_HIERARCHY__;
            } catch (cacheErr) {
              console.warn('[AuthContext] ⚠️ Failed to cache hierarchy for basic user:', cacheErr);
              delete window.__PENDING_HIERARCHY__;
            }
          }
          
          console.warn('[AuthContext] Using basic user data from token due to profile API error');
          setUser(basicUserData);
        }
      } catch (err) {
        setError('Authentication error');
        setUser(null);
        setToken(null);
        setStoredToken(null);
        // Reset styling on errors
        resetTeamStyling();
        
        // Clean up any pending hierarchy data
        if (typeof window !== 'undefined' && window.__PENDING_HIERARCHY__) {
          delete window.__PENDING_HIERARCHY__;
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadUserFromToken();
  }, [token]);

  /**
   * Login handler - authenticates user and stores token
   */
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the /auth/newlogin endpoint as per the original implementation
      const response = await api.post('/auth/newlogin', credentials);
      const data = response.data;
      
      // Check for successful login based on the original response format
      if (data.success && data.message === 'Login successful') {
        // Store token from the response
        const newToken = data.token;
        if (!newToken) {
          throw new Error('No token received from server');
        }
        
        // Store token - this is the only thing we store in localStorage
        setToken(newToken);
        setStoredToken(newToken);
        
        // Get userId from token
        const userId = getUserIdFromToken(newToken);
        
        // Load and apply team customization settings
        try {
          const teamSettings = await loadTeamCustomization(userId);
          if (teamSettings) {
            applyTeamStyling(teamSettings);
          }
        } catch (err) {
          // Continue with login even if customization fails
        }

        // Preload hierarchy data in the background for better UX
        try {
          console.log('[AuthContext] 🔄 Preloading hierarchy data in background...');
          const hierarchyResp = await api.post('/auth/searchByUserId', { userId });
          
          if (hierarchyResp.data?.success) {
            const hierarchy = Array.isArray(hierarchyResp.data.data) ? hierarchyResp.data.data : [];
            
            // Get user data for complete hierarchy info
            const profileResp = await api.get('/auth/profile', { params: { userId } });
            const userLagnname = profileResp.data?.agnName || profileResp.data?.lagnname || '';
            
            // Prepare hierarchy data structure
            const hierarchyInfo = {
              raw: hierarchy,
              teamIds: hierarchy.map(u => u.id).filter(Boolean),
              teamNames: hierarchy.map(u => u.lagnname).filter(Boolean),
              allIds: [userId, ...hierarchy.map(u => u.id).filter(Boolean)],
              allNames: [userLagnname, ...hierarchy.map(u => u.lagnname).filter(Boolean)].filter(Boolean),
              lastFetched: Date.now()
            };

            // Cache the hierarchy data for immediate use by components
            const cacheObject = {
              userId: userId,
              timestamp: Date.now(),
              data: hierarchyInfo
            };
            
            sessionStorage.setItem('user_hierarchy_cache', JSON.stringify(cacheObject));
            
            console.log(`[AuthContext] ✅ Preloaded and cached hierarchy data for ${userLagnname}:`, {
              teamCount: hierarchyInfo.teamIds.length,
              totalAccessible: hierarchyInfo.allIds.length,
              preloadSuccess: true
            });
          } else {
            console.warn('[AuthContext] ⚠️ Hierarchy preload unsuccessful, will fetch on-demand');
          }
        } catch (hierarchyErr) {
          // Non-critical error - hierarchy will be fetched on-demand by components
          console.warn('[AuthContext] ⚠️ Hierarchy preload failed, will fetch on-demand:', hierarchyErr);
        }
        
        // Check if there's a saved page to redirect to after login
        const intendedPath = localStorage.getItem('intendedPath');
        if (intendedPath) {
          console.log(`[AuthContext] 📍 Found intended path for restoration: ${intendedPath}`);
        }
        
        return { 
          success: true,
          intendedPath: intendedPath // Pass this to the login component for navigation
        };
      } else if (data.success && data.message === 'Please complete account setup') {
        // Handle the case where the user needs to complete their account setup
        return { 
          success: false, 
          needsSetup: true,
          registerData: {
            id: data.id,
            lagnname: data.lagnname,
            esid: data.esid,
            email: data.email,
            phone: data.phone,
            screenName: data.screenName,
          }
        };
      } else {
        // Login failed with a message from the server
        setError(data.message || 'Login failed');
        return { success: false, message: data.message };
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      return { success: false, message: 'Login failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [getUserIdFromToken]);

  /**
   * Start impersonating a user (admin only)
   * Note: Admin permission check is handled by the backend and component-level checks
   */
  const startImpersonation = useCallback(async (targetUserId) => {
    try {
      setLoading(true);
      setError(null);
      
      // Store original admin user if not already impersonating
      const currentAdminUser = !isImpersonating ? user : originalAdminUser;
      if (!isImpersonating) {
        setOriginalAdminUser(user);
      }
      
      // Get target user data from backend (backend validates admin permissions)
      const response = await api.post('/admin/impersonateUser', {
        targetUserId
      });
      
      if (response.data.success) {
        const targetUserData = response.data.targetUserData;
        
        // 📊 DETAILED IMPERSONATION LOGGING
        console.group('🎭 [IMPERSONATION] User Switching Details');
        
        console.log('🔐 [ADMIN USER] Original Admin Details:');
        console.table({
          'User ID': currentAdminUser?.userId || 'N/A',
          'Name (lagnname)': currentAdminUser?.lagnname || currentAdminUser?.name || 'N/A',
          'Role': currentAdminUser?.Role || 'N/A',
          'Team Role': currentAdminUser?.teamRole || 'N/A',
          'Class Name': currentAdminUser?.clname || 'N/A',
          'Email': currentAdminUser?.email || 'N/A',
          'Phone': currentAdminUser?.phone || 'N/A',
          'Profile Pic': currentAdminUser?.profpic ? 'Yes' : 'No',
          'ESID': currentAdminUser?.esid || 'N/A',
          'MGA': currentAdminUser?.mga || 'N/A'
        });
        
        console.log('👤 [TARGET USER] Impersonation Target Details:');
        console.table({
          'User ID': targetUserData?.userId || 'N/A',
          'Name (lagnname)': targetUserData?.lagnname || targetUserData?.name || 'N/A',
          'Role': targetUserData?.Role || 'N/A',
          'Team Role': targetUserData?.teamRole || 'N/A',
          'Class Name': targetUserData?.clname || 'N/A',
          'Email': targetUserData?.email || 'N/A',
          'Phone': targetUserData?.phone || 'N/A',
          'Profile Pic': targetUserData?.profpic ? 'Yes' : 'No',
          'Header Pic': targetUserData?.headerPic || targetUserData?.header_pic ? 'Yes' : 'No',
          'Screen Name': targetUserData?.screenName || 'N/A',
          'ESID': targetUserData?.esid || 'N/A',
          'MGA': targetUserData?.mga || 'N/A',
          'Agent Number': targetUserData?.agtnum || 'N/A',
          'Bio': targetUserData?.bio ? 'Has bio' : 'No bio'
        });
        
        console.log('🔄 [CONTEXT] Impersonation Context:');
        console.log({
          timestamp: new Date().toISOString(),
          adminUserId: currentAdminUser?.userId,
          targetUserId: targetUserData?.userId,
          wasAlreadyImpersonating: isImpersonating,
          impersonationChain: isImpersonating ? 
            `${currentAdminUser?.lagnname} → (previous) → ${targetUserData?.lagnname}` : 
            `${currentAdminUser?.lagnname} → ${targetUserData?.lagnname}`
        });
        
        console.groupEnd();
        
        // Set impersonation state
        setIsImpersonating(true);
        setImpersonatedUser(targetUserData);
        
        // Update current user to the target user while preserving admin context
        setUser({
          ...targetUserData,
          // Keep some admin context for identification
          _isImpersonatedView: true,
          _originalAdminId: currentAdminUser?.userId
        });
        
        // Expose impersonation state to window for API interceptor
        window.__IMPERSONATION_STATE__ = {
          isImpersonating: true,
          impersonatedUserId: targetUserData.userId
        };
        
        try {
          // Clear activity-related caches so views refetch under impersonation
          if (api?.clearActivityCaches) {
            api.clearActivityCaches();
          }
        } catch (e) {}
        
        return { success: true };
      } else {
        throw new Error(response.data.message || 'Impersonation failed');
      }
    } catch (err) {
      console.error('🎭 [IMPERSONATION] ❌ Failed to start impersonation:', err);
      setError(err.response?.data?.message || err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, isImpersonating, originalAdminUser]);

  /**
   * Stop impersonation and return to admin view
   */
  const stopImpersonation = useCallback(() => {
    if (!isImpersonating || !originalAdminUser) {
      return;
    }
    
    // 📊 DETAILED STOP IMPERSONATION LOGGING
    console.group('🎭 [IMPERSONATION] Stop Impersonation Details');
    
    console.log('🔚 [ENDING] Stopping impersonation session:');
    console.table({
      'Current Impersonated User ID': user?.userId || 'N/A',
      'Current Impersonated Name': user?.lagnname || user?.name || 'N/A',
      'Current Impersonated Role': user?.Role || 'N/A',
      'Current Impersonated Class': user?.clname || 'N/A',
      'Session Duration': 'Unknown', // We could track this in the future
      'Timestamp': new Date().toISOString()
    });
    
    console.log('🔙 [RETURNING TO] Original Admin User:');
    console.table({
      'Admin User ID': originalAdminUser?.userId || 'N/A',
      'Admin Name (lagnname)': originalAdminUser?.lagnname || originalAdminUser?.name || 'N/A',
      'Admin Role': originalAdminUser?.Role || 'N/A',
      'Admin Team Role': originalAdminUser?.teamRole || 'N/A',
      'Admin Class Name': originalAdminUser?.clname || 'N/A',
      'Admin Email': originalAdminUser?.email || 'N/A',
      'Admin Phone': originalAdminUser?.phone || 'N/A',
      'Admin Profile Pic': originalAdminUser?.profpic ? 'Yes' : 'No',
      'Admin ESID': originalAdminUser?.esid || 'N/A'
    });
    
    console.log('✅ [SUCCESS] Impersonation session ended successfully');
    console.groupEnd();
    
    // Restore original admin user
    setUser(originalAdminUser);
    setIsImpersonating(false);
    setImpersonatedUser(null);
    setOriginalAdminUser(null);
    setError(null);
    
    // Clear impersonation state from window
    window.__IMPERSONATION_STATE__ = {
      isImpersonating: false,
      impersonatedUserId: null
    };
    try {
      if (api?.clearActivityCaches) {
        api.clearActivityCaches();
      }
    } catch (e) {}
  }, [isImpersonating, originalAdminUser, user]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get userId from token
      const userId = getUserIdFromToken(token);
      
      if (!userId) {
        setError('Authentication error');
        return false;
      }
      
      const dataToUpdate = {
        ...userData,
        userId
      };
      
      const response = await api.put('/auth/profile', dataToUpdate);
      
      // Check if server returned a new token (e.g. after email change)
      if (response.data.token) {
        setToken(response.data.token);
        setStoredToken(response.data.token);
      }
      
      // Update user data in state
      if (response.data.user) {
        // If the response contains a user object (the proper structure)
        setUser(prev => {
          const updatedUser = {
          ...prev,
          ...response.data.user,
            // Map screen_name to preferredName for frontend consistency
            preferredName: response.data.user.screen_name,
          // Ensure all naming conventions for header images are included
          headerPic: response.data.user.header_pic || response.data.user.headerPic || response.data.headerPic,
          profileBanner: response.data.user.header_pic || response.data.user.headerPic || response.data.headerPic,
          header_pic: response.data.user.header_pic || response.data.user.headerPic || response.data.headerPic
          };
          
          return updatedUser;
        });
      } else if (response.data.headerPic) {
        // Special case for header image updates that might return headerPic directly
        setUser(prev => ({
          ...prev,
          headerPic: response.data.headerPic,
          profileBanner: response.data.headerPic, 
          header_pic: response.data.headerPic
        }));
      } else {
        // Fallback for other data formats
        setUser(prev => ({ ...prev, ...response.data }));
      }
      
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, getUserIdFromToken]);

  /**
   * Update profile picture using a separate endpoint
   */
  const updateProfilePicture = useCallback(async (imageFile) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get userId from token
      const userId = getUserIdFromToken(token);
      
      if (!userId) {
        setError('Authentication error');
        return { success: false, message: 'Authentication error' };
      }
      
      // If imageFile is null, remove the profile picture
      if (imageFile === null) {
        const response = await api.post('/auth/remove-profile-picture', { userId });
        
        // Update token if a new one is returned
        if (response.data.token) {
          setToken(response.data.token);
          setStoredToken(response.data.token);
        }
        
        // Update user state
        setUser(prev => ({ 
          ...prev, 
          profilePicture: null,
          profpic: null
        }));
        
        return { 
          success: true, 
          message: 'Profile picture removed successfully'
        };
      }
      
      // Create form data to send the image
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('userId', userId);
      
      // Add error handling for large files
      if (imageFile.size > 8 * 1024 * 1024) {
        setError('Image file is too large (max 8MB)');
        setLoading(false);
        return { success: false, message: 'Image file is too large (max 8MB)' };
      }
      
      const response = await api.post('/auth/upload-profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        // Add timeout to prevent hanging requests
        timeout: 30000
      });
      
      // Update token if a new one is returned
      if (response.data.token) {
        setToken(response.data.token);
        setStoredToken(response.data.token);
      }
      
      // Update user data in state with new profile picture
      setUser(prev => ({ 
        ...prev, 
        profilePicture: response.data.profpic || response.data.filePath,
        profpic: response.data.profpic || response.data.filePath
      }));
      
      return { 
        success: true, 
        profilePicture: response.data.profpic || response.data.filePath,
        message: 'Profile picture updated successfully'
      };
    } catch (err) {
      let errorMessage = 'Failed to update profile picture';
      
      // More descriptive error messages based on error type
      if (err.response) {
        if (err.response.status === 413) {
          errorMessage = 'Image file is too large for the server to process';
        } else if (err.response.status === 429) {
          errorMessage = 'Too many requests. Please try again later';
        } else if (err.response.data && err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'Server did not respond. Please check your connection';
      }
      
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [token, getUserIdFromToken, setToken]);

  /**
   * Remove header image using a dedicated endpoint
   */
  const removeHeaderImage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get userId from token
      const userId = getUserIdFromToken(token);
      
      if (!userId) {
        setError('Authentication error');
        return { success: false, message: 'Authentication error' };
      }
      
      const response = await api.post('/auth/remove-header-image', { userId });
      
      // Update user state
      setUser(prev => ({ 
        ...prev, 
        headerPic: null,
        profileBanner: null,
        header_pic: null
      }));
      
      return { 
        success: true, 
        message: 'Header image removed successfully'
      };
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove header image');
      return { success: false, message: 'Failed to remove header image' };
    } finally {
      setLoading(false);
    }
  }, [token, getUserIdFromToken]);

  /**
   * Check if user has a specific permission based on both clname and Role fields
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    
    // If impersonating, check admin permissions for impersonation-related actions
    if (isImpersonating && permission === 'admin') {
      return originalAdminUser?.Role === 'Admin' || originalAdminUser?.permissions === 'Admin';
    }
    
    // Get both the agent type (clname) and role (Role) from the user
    const agentType = user.clname || '';
    const role = user.Role || user.permissions || '';
    
    // Allow 'admin' permission check to be fast-tracked for debugging
    if (permission === 'admin' && user.Role === 'Admin') {
      return true;
    }
    
    // If no agent type, role, or permission provided, deny access
    if ((!agentType && !role) || !permission) return false;
    
    // Import permission configurations
    const { 
      AGENT_TYPES, 
      ROLES,
      PERMISSIONS, 
      AGENT_TYPE_PERMISSIONS, 
      ROLE_PERMISSIONS,
      adminRoles
    } = require('./permissionsConfig');
    
    // Admin role always has all permissions
    if (role === ROLES.ADMIN || adminRoles.includes(role)) {
      return true;
    }
    
    // Special check for admin permission (used for admin routes)
    if (permission === PERMISSIONS.ADMIN) {
      return role === ROLES.ADMIN || adminRoles.includes(role);
    }
    
    // Check permissions from agent type (clname)
    const hasAgentTypePermission = AGENT_TYPE_PERMISSIONS[agentType]?.includes(permission);
    
    // Check permissions from role (Role)
    const hasRolePermission = ROLE_PERMISSIONS[role]?.includes(permission);
    
    // If either the agent type or role grants the permission, allow access
    if (hasAgentTypePermission || hasRolePermission) {
      return true;
    }
    
    // Legacy checks for backward compatibility
    switch (permission) {
      case 'view_dashboard':
        return dashboardAllowedAgentTypes.includes(agentType) || 
               ROLE_PERMISSIONS[role]?.includes(PERMISSIONS.VIEW_DASHBOARD) ||
               user.canViewDashboard;
        
      case 'view_refs':
        return ['AGT', 'SA', 'GA', 'MGA', 'RGA', 'SGA'].includes(agentType) || 
               (user.permissions && user.permissions.includes('refs'));
      
      case 'admin':
        return role === ROLES.ADMIN || adminRoles.includes(role);
        
      default:
        return false;
    }
  }, [user, isImpersonating, originalAdminUser]);

  /**
   * Get the current user's ID from the token
   * This is a utility function to make it easy to get the userId anywhere in the app
   */
  const getUserId = useCallback(() => {
    return getUserIdFromToken(token);
  }, [token]);

  // The auth context value that will be provided
  const contextValue = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    isImpersonating,
    impersonatedUser,
    originalAdminUser,
    login,
    logout,
    updateProfile,
    updateProfilePicture,
    removeHeaderImage,
    hasPermission,
    getUserId,
    startImpersonation,
    stopImpersonation
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
