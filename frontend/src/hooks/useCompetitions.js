import { useState, useEffect, useCallback } from 'react';
import api from '../api';

// Custom hook for managing competitions
export const useCompetitions = (options = {}) => {
  const {
    autoFetch = true,
    activeOnly = false,
    userCompetitions = false,
    status = null,
    type = null
  } = options;

  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch competitions list
  const fetchCompetitions = useCallback(async (customFilters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      // Apply filters
      const filters = { 
        active_only: activeOnly, 
        user_competitions: userCompetitions,
        status,
        type,
        ...customFilters 
      };

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.append(key, value);
        }
      });

      const response = await api.get(`/competitions?${params.toString()}`);
      setCompetitions(response.data || []);
      
      return response.data;
    } catch (err) {
      console.error('Error fetching competitions:', err);
      setError(err.response?.data?.error || 'Failed to fetch competitions');
      return [];
    } finally {
      setLoading(false);
    }
  }, [activeOnly, userCompetitions, status, type]);

  // Fetch single competition with details
  const fetchCompetition = useCallback(async (competitionId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/competitions/${competitionId}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching competition:', err);
      setError(err.response?.data?.error || 'Failed to fetch competition');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Join a competition
  const joinCompetition = useCallback(async (competitionId) => {
    try {
      setLoading(true);
      setError(null);

      await api.post(`/competitions/${competitionId}/join`);
      
      // Refresh competitions list
      await fetchCompetitions();
      
      return { success: true };
    } catch (err) {
      console.error('Error joining competition:', err);
      const errorMessage = err.response?.data?.error || 'Failed to join competition';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchCompetitions]);

  // Leave a competition
  const leaveCompetition = useCallback(async (competitionId) => {
    try {
      setLoading(true);
      setError(null);

      await api.delete(`/competitions/${competitionId}/leave`);
      
      // Refresh competitions list
      await fetchCompetitions();
      
      return { success: true };
    } catch (err) {
      console.error('Error leaving competition:', err);
      const errorMessage = err.response?.data?.error || 'Failed to leave competition';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchCompetitions]);

  // Get competition leaderboard
  const fetchLeaderboard = useCallback(async (competitionId, limit = 50) => {
    try {
      const response = await api.get(`/competitions/${competitionId}/leaderboard?limit=${limit}`);
      return response.data || [];
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      return [];
    }
  }, []);

  // Update progress (for admin use)
  const updateProgress = useCallback(async (competitionId, userId, progressValue, progressDate) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/competitions/${competitionId}/update-progress`, {
        user_id: userId,
        progress_value: progressValue,
        progress_date: progressDate,
        data_source: 'manual'
      });
      
      return { success: true, data: response.data };
    } catch (err) {
      console.error('Error updating progress:', err);
      const errorMessage = err.response?.data?.error || 'Failed to update progress';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new competition (for admin use)
  const createCompetition = useCallback(async (competitionData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/competitions', competitionData);
      
      // Refresh competitions list
      await fetchCompetitions();
      
      return { success: true, data: response.data };
    } catch (err) {
      console.error('Error creating competition:', err);
      const errorMessage = err.response?.data?.error || 'Failed to create competition';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchCompetitions]);

  // Update competition (for admin use)
  const updateCompetition = useCallback(async (competitionId, updateData) => {
    try {
      setLoading(true);
      setError(null);

      await api.put(`/competitions/${competitionId}`, updateData);
      
      // Refresh competitions list
      await fetchCompetitions();
      
      return { success: true };
    } catch (err) {
      console.error('Error updating competition:', err);
      const errorMessage = err.response?.data?.error || 'Failed to update competition';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchCompetitions]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchCompetitions();
    }
  }, [autoFetch, fetchCompetitions]);

  return {
    // Data
    competitions,
    loading,
    error,
    
    // Actions
    fetchCompetitions,
    fetchCompetition,
    joinCompetition,
    leaveCompetition,
    fetchLeaderboard,
    updateProgress,
    createCompetition,
    updateCompetition,
    
    // Utilities
    refetch: fetchCompetitions,
    clearError: () => setError(null)
  };
};

// Hook specifically for user's active competitions (commonly used for banners)
export const useUserActiveCompetitions = (userId) => {
  return useCompetitions({
    autoFetch: true,
    activeOnly: true,
    userCompetitions: true
  });
};

// Hook for competition management (admin)
export const useCompetitionManagement = () => {
  return useCompetitions({
    autoFetch: false // Admin typically fetches on demand
  });
};

export default useCompetitions;
