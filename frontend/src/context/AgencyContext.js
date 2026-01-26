import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const AgencyContext = createContext();

export const useAgency = () => {
  const context = useContext(AgencyContext);
  if (!context) {
    throw new Error('useAgency must be used within an AgencyProvider');
  }
  return context;
};

export const AgencyProvider = ({ children }) => {
  const { user } = useAuth();
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [userAgencies, setUserAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMultipleAgencies, setHasMultipleAgencies] = useState(false);
  const [allowedPages, setAllowedPages] = useState([]);

  // Fetch user's agencies when user changes
  useEffect(() => {
    if (user?.userId) {
      fetchUserAgencies();
      fetchSelectedAgency();
    } else {
      setSelectedAgency(null);
      setUserAgencies([]);
      setLoading(false);
    }
  }, [user?.userId]);

  const fetchUserAgencies = async () => {
    if (!user?.userId) {
      return;
    }
    try {
      const response = await api.get(`/sgas/user/${user.userId}/agencies`);
      if (response.data.success) {
        const agencies = response.data.data || [];
        console.log('[AgencyContext] Fetched user agencies:', agencies);
        setUserAgencies(agencies);
        setHasMultipleAgencies(agencies.length > 1);
        
        // Set allowed pages from the first (primary) agency
        if (agencies.length > 0 && agencies[0].allowed_pages) {
          console.log('[AgencyContext] Setting allowed pages:', {
            agencyName: agencies[0].display_name || agencies[0].rept_name,
            agencyId: agencies[0].id,
            allowed_pages: agencies[0].allowed_pages
          });
          setAllowedPages(agencies[0].allowed_pages);
        } else {
          console.log('[AgencyContext] No allowed_pages found in agencies');
        }
      }
    } catch (error) {
      console.error('[AgencyContext] Error fetching user agencies:', error);
      console.error('[AgencyContext] Error details:', error.response?.data);
      // If error or no agencies, try to get the default
      try {
        const defaultResponse = await api.get('/sgas/default/get');
        if (defaultResponse.data.success) {
          setUserAgencies([defaultResponse.data.data]);
          setHasMultipleAgencies(false);
        }
      } catch (defaultError) {
        console.error('[AgencyContext] Error fetching default agency:', defaultError);
        setUserAgencies([]);
      }
    }
  };

  const fetchSelectedAgency = async () => {
    if (!user?.userId) return;

    try {
      setLoading(true);
      const response = await api.get(`/sgas/user/${user.userId}/selected`);
      if (response.data.success) {
        const agency = response.data.data;
        console.log('[AgencyContext] Fetched selected agency:', agency);
        setSelectedAgency(agency);
        
        // Update allowed pages based on selected agency
        if (agency.allowed_pages) {
          console.log('[AgencyContext] Setting allowed pages from selected agency:', {
            agencyName: agency.display_name || agency.rept_name,
            agencyId: agency.id,
            allowed_pages: agency.allowed_pages
          });
          setAllowedPages(agency.allowed_pages);
        } else {
          console.log('[AgencyContext] No allowed_pages in selected agency:', {
            agencyName: agency.display_name || agency.rept_name,
            agencyId: agency.id
          });
        }
      }
    } catch (error) {
      console.error('Error fetching selected agency:', error);
      // Try to get default agency as fallback
      try {
        const defaultResponse = await api.get('/sgas/default/get');
        if (defaultResponse.data.success) {
          setSelectedAgency(defaultResponse.data.data);
        }
      } catch (defaultError) {
        console.error('Error fetching default agency:', defaultError);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchAgency = async (sgaId) => {
    if (!user?.userId) return;

    try {
      const response = await api.post(`/sgas/user/${user.userId}/selected`, {
        sgaId
      });

      if (response.data.success) {
        setSelectedAgency(response.data.data);
        
        // Refresh the page to reload data with new agency
        window.location.reload();
        
        return { success: true, data: response.data.data };
      }
    } catch (error) {
      console.error('Error switching agency:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Error switching agency' 
      };
    }
  };

  const hasPageAccess = (pageKey) => {
    console.log('[AgencyContext] Checking page access:', { 
      pageKey, 
      currentAgency: selectedAgency?.display_name || selectedAgency?.rept_name,
      agencyId: selectedAgency?.id,
      allowedPages, 
      loading 
    });
    if (!pageKey) return true;
    if (loading) return true; // Allow access while loading
    if (allowedPages.length === 0) return false; // If no permissions loaded, deny access
    const hasAccess = allowedPages.includes(pageKey);
    console.log('[AgencyContext] Page access result:', { 
      pageKey, 
      currentAgency: selectedAgency?.display_name || selectedAgency?.rept_name,
      hasAccess 
    });
    return hasAccess;
  };

  const value = {
    selectedAgency,
    userAgencies,
    hasMultipleAgencies,
    loading,
    allowedPages,
    hasPageAccess,
    switchAgency,
    refreshAgencies: fetchUserAgencies,
    refreshSelected: fetchSelectedAgency
  };

  return (
    <AgencyContext.Provider value={value}>
      {children}
    </AgencyContext.Provider>
  );
};

export default AgencyContext;



