// Import the api client
import api from '../api.js';

// Export the api client for use by other components
export { api };

// Add scheduled notifications endpoints
export const createScheduledNotification = async (notificationData) => {
  return await api.post('/notifications/scheduled', notificationData);
};

export const getScheduledNotifications = async (filters = {}) => {
  // Convert filters object to query params
  const queryParams = new URLSearchParams();
  
  if (filters.is_sent !== undefined) {
    queryParams.append('is_sent', filters.is_sent);
  }
  
  if (filters.is_paused !== undefined) {
    queryParams.append('is_paused', filters.is_paused);
  }
  
  if (filters.target_group) {
    queryParams.append('target_group', filters.target_group);
  }
  
  if (filters.type) {
    queryParams.append('type', filters.type);
  }
  
  if (filters.before) {
    queryParams.append('before', filters.before);
  }
  
  if (filters.after) {
    queryParams.append('after', filters.after);
  }
  
  if (filters.order_by) {
    queryParams.append('order_by', filters.order_by);
  }
  
  if (filters.order_direction) {
    queryParams.append('order_direction', filters.order_direction);
  }
  
  if (filters.limit) {
    queryParams.append('limit', filters.limit);
  }
  
  if (filters.offset) {
    queryParams.append('offset', filters.offset);
  }

  const queryString = queryParams.toString();
  const url = `/notifications/scheduled${queryString ? `?${queryString}` : ''}`;
  
  return await api.get(url);
};

export const getScheduledNotificationById = async (id) => {
  return await api.get(`/notifications/scheduled/${id}`);
};

export const updateScheduledNotification = async (id, updateData) => {
  return await api.put(`/notifications/scheduled/${id}`, updateData);
};

export const deleteScheduledNotification = async (id) => {
  return await api.delete(`/notifications/scheduled/${id}`);
};

export const toggleScheduledNotificationStatus = async (id, isPaused) => {
  return await api.patch(`/notifications/scheduled/${id}/status`, { is_paused: isPaused });
}; 