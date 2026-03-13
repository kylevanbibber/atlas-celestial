import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// Helper function to parse date from various formats
const parseDate = (dateString) => {
  if (!dateString) return null;
  
  // Try standard Date parsing first
  let date = new Date(dateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    // Try to parse MM/DD/YYYY format
    const parts = dateString.split(/[\/\-]/);
    if (parts.length === 3) {
      // Try different date formats (MM/DD/YYYY or YYYY-MM-DD)
      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        // MM/DD/YYYY format
        date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      }
    }
  }
  
  return isNaN(date.getTime()) ? null : date;
};

// Hook to check license status and return warning status
const useLicenseStatus = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasWarning, setHasWarning] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState(null);
  
  // Function to manually trigger a refresh
  const refreshStatus = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  useEffect(() => {
    const checkLicenses = async () => {
      if (!user?.userId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch licenses from the API
        const response = await api.get(`/licenses/${user.userId}`);
        const licenses = response.data.licenses || [];
        
        // Determine if user has at least one license
        const hasAtLeastOneLicense = Array.isArray(licenses) && licenses.length > 0;

        // Check for expired or soon-to-expire licenses (keep behavior if desired)
        const currentDate = new Date();
        const oneMonthLater = new Date(currentDate);
        oneMonthLater.setMonth(currentDate.getMonth() + 1);
        
        const hasExpiringLicense = licenses.some(license => {
          if (!license.expiry_date) return false;
          
          const expiryDate = parseDate(license.expiry_date);
          if (!expiryDate) return false;
          
          const isExpiring = expiryDate <= oneMonthLater;
          if (isExpiring) {
          }
          return isExpiring;
        });
        
        // Show warning only if no licenses at all (aligns with onboarding requirement)
        // If you still want expiring warnings, use: const shouldWarn = !hasAtLeastOneLicense || hasExpiringLicense;
        const shouldWarn = !hasAtLeastOneLicense;
        setHasWarning(shouldWarn);
      } catch (error) {
        console.error('[useLicenseStatus] Error checking license status:', error);
        setError(error);
        setHasWarning(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkLicenses();
  }, [user, refreshTrigger]); // Add refreshTrigger to dependencies
  
  return { hasWarning, loading, refreshStatus, error };
};

export default useLicenseStatus; 