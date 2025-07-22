// src/api.js
import axios from "axios";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://r3-team-8cdaafc12c80.herokuapp.com/api"  // Production URL
    : "http://localhost:5001/api"; // Local development URL

console.log(`[API] Initializing with baseURL: ${API_URL}`);

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
    
    // Ensure credentials are included for all requests
    config.withCredentials = true;
    
    console.log(`[API] 🚀 Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`, {
      params: config.params,
      hasToken: !!config.headers.Authorization,
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
    console.log(`[API] ✅ Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      statusText: response.statusText,
      dataSize: JSON.stringify(response.data).length,
    });
    return response;
  },
  (error) => {
    // Log errors for debugging (remove in production if sensitive data might be logged)
    console.error('[API] ❌ Error Response:', {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
    });
    
    // You could add global error handling here
    // For example, redirecting to error page for 500 errors
    
    return Promise.reject(error);
  }
);

export default api;
