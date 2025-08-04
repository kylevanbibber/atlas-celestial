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
  return localStorage.getItem(TOKEN_KEY);
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

  // Configure API interceptor to add the auth token to requests
  useEffect(() => {
    // Request interceptor
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        // Skip auth endpoints since they don't need a token
        const isAuthEndpoint = config.url?.includes('/auth/login') || 
                             config.url?.includes('/auth/newlogin') ||
                             config.url?.includes('/auth/register');

        // Token is now being added in api.js interceptor
        // if (token && !isAuthEndpoint) {
        //   config.headers.Authorization = `Bearer ${token}`;
          
        // Add userId to request if needed and not already present
        if (token && !isAuthEndpoint && !config.params?.userId && !config.data?.userId) {
          const userId = getUserIdFromToken(token);
          if (userId) {
            // Clone the config to avoid mutating the original
            const newConfig = { ...config };
            
            // Add userId to params for GET requests
            if (config.method === 'get' || config.method === 'delete') {
              newConfig.params = { ...newConfig.params, userId };
            } 
            // Add userId to body for POST/PUT/PATCH requests if it's JSON
            else if (config.headers['Content-Type']?.includes('application/json')) {
              newConfig.data = { ...newConfig.data, userId };
            }
            
            return newConfig;
          }
        } else if (!token && !isAuthEndpoint) {
          // Cancel requests that need auth but don't have a token
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
  }, [token, getUserIdFromToken]);

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
          
          setUser(userData);
        } catch (error) {
          // If profile fetch fails, create basic user data from token
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
          
          setUser(basicUserData);
        }
      } catch (err) {
        setError('Authentication error');
        setUser(null);
        setToken(null);
        setStoredToken(null);
        // Reset styling on errors
        resetTeamStyling();
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
        
        return { success: true };
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
   * Logout handler - removes token and user data
   */
  const logout = useCallback(() => {
    // Clear token from state and storage
    setToken(null);
    setUser(null);
    setStoredToken(null);
    
    // Clear impersonation state
    setIsImpersonating(false);
    setOriginalAdminUser(null);
    setImpersonatedUser(null);
    
    // Optional: Call logout endpoint if your API requires it
    try {
      api.post('/auth/logout').catch(() => {
        // Still proceed with client-side logout regardless
      });
    } catch (err) {
      // Continue with logout regardless of errors
    }
  }, []);

  /**
   * Start impersonating a user (admin only)
   * Note: Admin permission check is handled by the backend and component-level checks
   */
  const startImpersonation = useCallback(async (targetUserId) => {
    try {
      setLoading(true);
      setError(null);
      
      // Store original admin user if not already impersonating
      if (!isImpersonating) {
        setOriginalAdminUser(user);
      }
      
      // Get target user data from backend (backend validates admin permissions)
      const response = await api.post('/admin/impersonateUser', {
        targetUserId
      });
      
      if (response.data.success) {
        const targetUserData = response.data.targetUserData;
        
        // Set impersonation state
        setIsImpersonating(true);
        setImpersonatedUser(targetUserData);
        
        // Update current user to the target user while preserving admin context
        setUser({
          ...targetUserData,
          // Keep some admin context for identification
          _isImpersonatedView: true,
          _originalAdminId: originalAdminUser?.userId || user?.userId
        });
        
        return { success: true };
      } else {
        throw new Error(response.data.message || 'Impersonation failed');
      }
    } catch (err) {
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
    
    // Restore original admin user
    setUser(originalAdminUser);
    setIsImpersonating(false);
    setImpersonatedUser(null);
    setOriginalAdminUser(null);
    setError(null);
  }, [isImpersonating, originalAdminUser]);

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
