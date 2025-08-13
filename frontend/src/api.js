// src/api.js
import axios from "axios";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://atlas-celest-backend-3bb2fea96236.herokuapp.com/api"  // Production URL  
    : "http://localhost:5001/api"; // Local development URL

console.log(`[API] Initializing with baseURL: ${API_URL}`);

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
    
    console.log(`[API] 🚀 Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
      params: config.params,
      hasToken: !!config.headers.Authorization,
      hasImpersonation: !!config.headers['X-Impersonated-User-Id'],
      withCredentials: config.withCredentials
    });
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
    
    console.log(`[API] ✅ Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      statusText: response.statusText,
      dataSize: JSON.stringify(response.data).length,
      rateLimitRemaining: rateLimitState.remaining,
    });
    return response;
  },
  async (error) => {
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
      console.log(`[API] 📦 Cache hit for ${url}`);
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
    console.log(`[API] 🗑️ Cache cleared${urlPattern ? ` for pattern: ${urlPattern}` : ''}`);
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
