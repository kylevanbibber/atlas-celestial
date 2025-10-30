// src/api.js
import axios from "axios";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://atlas-celest-backend-3bb2fea96236.herokuapp.com/api"  // Production URL  
    : "http://localhost:5001/api"; // Local development URL


// Simple cache for frequently accessed data
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limit tracking
const rateLimitState = {
  remaining: 50,
  reset: Date.now() + 60000, // Default 1 minute window
  lastRequest: 0
};

// Helper function to check if cache is valid
const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

// Helper function to get cache key
const getCacheKey = (url, params = {}) => {
  return `${url}?${JSON.stringify(params)}`;
};

// Helper function to delay requests to respect rate limits
const delayIfNeeded = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - rateLimitState.lastRequest;
  
  // Add minimum delay between requests (100ms)
  if (timeSinceLastRequest < 100) {
    await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
  }
  
  rateLimitState.lastRequest = Date.now();
};

const api = axios.create({
  baseURL: API_URL,
  headers: { 
    "Content-Type": "application/json",
  },
  withCredentials: true, // This ensures cookies are sent with cross-origin requests
});

// Add auth token to all requests
api.interceptors.request.use(
  (config) => {
    // Debug logging for release management endpoints
    if (config.url?.includes('fail-user') || config.url?.includes('pass-user')) {

    }
    
    // Get token from localStorage
    const token = localStorage.getItem('auth_token');
    
    // If token exists, add it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Check for impersonation state from AuthContext
    // We'll get this from window to avoid circular dependencies
    const impersonationData = window.__IMPERSONATION_STATE__;
    if (impersonationData && impersonationData.isImpersonating && impersonationData.impersonatedUserId) {
      config.headers['X-Impersonated-User-Id'] = impersonationData.impersonatedUserId;
    }
    
    // Ensure credentials are included for all requests
    config.withCredentials = true;
    
    // Add delay to respect rate limits
    config.metadata = { startTime: Date.now() };
    

    

    // Track timing and goals-specific logging
    config.metadata = { startTime: Date.now(), url: config.url };
    if (config.url?.startsWith('/goals')) {
      console.log('[API] 🚀 Request →', {
        url: config.url,
        method: config.method?.toUpperCase(),
        hasAuth: !!config.headers.Authorization,
      });
    }
    
    
    return config;
  },
  (error) => {
    console.error(`[API] ❌ Request Error:`, error.message);
    return Promise.reject(error);
  }
);

// Error response handler for centralized error handling
api.interceptors.response.use(
  (response) => {
    // Update rate limit state from headers
    if (response.headers['x-ratelimit-remaining']) {
      rateLimitState.remaining = parseInt(response.headers['x-ratelimit-remaining']);
    }
    if (response.headers['x-ratelimit-reset']) {
      rateLimitState.reset = parseInt(response.headers['x-ratelimit-reset']) * 1000;
    }
    
 
    // Per-request timing log for goals
    if (response.config?.metadata?.startTime && response.config?.url?.startsWith('/goals')) {
      const ms = Date.now() - response.config.metadata.startTime;
      console.log('[API] ✅ Response ←', { url: response.config.url, status: response.status, ms });
    }
    return response;
  },
  async (error) => {
    // Per-request timing log for goals on error
    if (error.config?.metadata?.startTime && error.config?.url?.startsWith('/goals')) {
      const ms = Date.now() - error.config.metadata.startTime;
      console.warn('[API] ❌ Error ←', { url: error.config.url, status: error.response?.status, ms });
    }
    // Handle authentication errors (401 Unauthorized)
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      
      // Skip auto-logout for login/register endpoints to avoid infinite loops
      const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || 
                            originalRequest?.url?.includes('/auth/newlogin') ||
                            originalRequest?.url?.includes('/auth/register');
      
      // Skip auto-logout for Discord-specific token expiration
      const isDiscordEndpoint = originalRequest?.url?.includes('/discord/');
      const isDiscordTokenError = error.response?.data?.error?.includes?.('Discord token') || 
                                  error.response?.data?.message?.includes?.('Discord token') ||
                                  error.response?.data?.error === 'Discord token expired';
      
      if (isDiscordEndpoint && isDiscordTokenError) {
        console.warn('[API] 🔒 Discord token expired - NOT triggering main auth logout');
        
        // Return the error without triggering logout - let Discord components handle it
        const discordError = new Error('Discord authentication failed');
        discordError.type = 'DISCORD_AUTH_FAILED';
        discordError.originalError = error;
        return Promise.reject(discordError);
      }
      
      if (!isAuthEndpoint && !originalRequest._authRetried) {
        originalRequest._authRetried = true;
        
        console.warn('[API] 🔒 Authentication failed - token likely expired, triggering auto-logout');
        
        // Save current page before logout for restoration after re-login
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        
        // Only save path if it's not already an auth page
        const isCurrentlyOnAuthPage = ['/login', '/register', '/adminlogin'].includes(window.location.pathname);
        if (!isCurrentlyOnAuthPage && currentPath !== '/') {
          localStorage.setItem('intendedPath', currentPath);
        }
        
        // Trigger logout by dispatching a custom event that AuthContext can listen to
        window.dispatchEvent(new CustomEvent('auth:token-expired', {
          detail: { 
            error: error.response?.data,
            url: originalRequest?.url,
            currentPath 
          }
        }));
        
        // Clear the auth token immediately
        localStorage.removeItem('auth_token');
        
        // Return a rejected promise with a specific error type
        const authError = new Error('Authentication token expired');
        authError.type = 'AUTH_EXPIRED';
        authError.originalError = error;
        return Promise.reject(authError);
      }
    }
    
    // Handle rate limiting
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
      
      console.warn(`[API] ⚠️ Rate limited. Waiting ${waitTime}ms before retry...`);
      
      // Wait for the specified time
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry the original request
      const originalRequest = error.config;
      return api.request(originalRequest);
    }
    
    // Log errors for debugging (remove in production if sensitive data might be logged)
    console.error('[API] ❌ Error Response:', {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
    });
    
    return Promise.reject(error);
  }
);

// Enhanced API with caching and rate limit handling
const enhancedApi = {
  ...api,
  
  // Cached GET request
  async getCached(url, params = {}, options = {}) {
    const cacheKey = getCacheKey(url, params);
    const cached = cache.get(cacheKey);
    
    if (cached && isCacheValid(cached.timestamp) && !options.forceRefresh) {
      return cached.data;
    }
    
    await delayIfNeeded();
    const response = await api.get(url, { params });
    
    // Cache successful responses
    if (response.status === 200) {
      cache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });
    }
    
    return response;
  },
  
  // Batch operations helper
  async batchRequests(requests, delayBetweenRequests = 250) {
    const results = [];
    
    for (let i = 0; i < requests.length; i++) {
      try {
        await delayIfNeeded();
        const result = await requests[i]();
        results.push({ success: true, data: result, index: i });
      } catch (error) {
        results.push({ success: false, error, index: i });
      }
      
      // Add delay between requests if not the last one
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }
    
    return results;
  },
  
  // Clear cache for specific URL pattern
  clearCache(urlPattern = null) {
    if (urlPattern) {
      for (const [key] of cache) {
        if (key.includes(urlPattern)) {
          cache.delete(key);
        }
      }
    } else {
      cache.clear();
    }
  },
  
  // Convenience to clear activity-related caches after impersonation switch
  clearActivityCaches() {
    this.clearCache('/dailyActivity');
    this.clearCache('/alp/weekly');
    this.clearCache('/discord/sales');
    this.clearCache('/auth/userHierarchy');
    this.clearCache('/auth/searchByUserId');
  },
  
  // Get rate limit status
  getRateLimitStatus() {
    return {
      ...rateLimitState,
      isLimited: rateLimitState.remaining <= 0,
      timeUntilReset: Math.max(0, rateLimitState.reset - Date.now())
    };
  }
};

export default enhancedApi;
