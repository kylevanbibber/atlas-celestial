import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import api from '../api';

// Create context
const TeamStyleContext = createContext();

// Provider component
export const TeamStyleProvider = ({ children }) => {
  const { user } = useAuth();
  const [teamStyles, setTeamStyles] = useState(null);
  const [teamName, setTeamName] = useState('Arias Organization');
  const [logoUrl, setLogoUrl] = useState(null);
  
  // Debug render cycles
  console.log('[TeamStyleProvider] Rendering with:', {
    userId: user?.userId,
    hasTeamStyles: !!user?.teamStyles
  });
  
  // Convert hex to RGB for CSS variables - This doesn't depend on any state, so define outside
  const hexToRgb = useCallback((hex) => {
    if (!hex) return '0, 123, 255';
    
    // Remove the hash
    hex = hex.replace('#', '');
    
    // Parse the hex values
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    
    return `${r}, ${g}, ${b}`;
  }, []);

  // Generate CSS custom properties from team styles - memoize this function
  const generateCSSVariables = useCallback((stylesData = teamStyles) => {
    if (!stylesData) return {
      '--font-family': "'Avenir Next LT Pro', 'Avenir Next', Avenir, 'Segoe UI', sans-serif",
      '--primary-color': '#007BFF',
      '--primary-color-rgb': '0, 123, 255',
      '--secondary-color': '#6C757D',
      '--accent-color': '#28A745'
    };
    
    // Handle font family specifically to ensure it's properly formatted with quotes
    const fontFamily = stylesData.custom_font 
      ? `${stylesData.custom_font}` 
      : "'Avenir Next LT Pro', 'Avenir Next', Avenir, 'Segoe UI', sans-serif";
    
    // Primary color in hex and RGB
    const primaryColor = stylesData.primary_color || '#007BFF';
    const primaryColorRgb = hexToRgb(primaryColor);
    
    return {
      '--primary-color': primaryColor,
      '--primary-color-rgb': primaryColorRgb,
      '--secondary-color': stylesData.secondary_color || '#6C757D',
      '--accent-color': stylesData.accent_color || '#28A745',
      '--font-family': fontFamily,
    };
  }, [hexToRgb]);
  
  // Function to refresh styles - called after saving team customization settings
  const refreshStyles = useCallback(async () => {
    if (!user?.userId) return;
    
    try {
      console.log('[TeamStyleProvider] Refreshing team styles');
      
      // Get the latest team settings from the API
      const teamType = user.clname === 'RGA' ? 'RGA' : 
                      user.clname === 'MGA' ? 'MGA' : 
                      user.clname === 'SGA' ? 'SGA' : 'Admin';
      
      const response = await api.get(`/custom/team/${teamType}/${user.userId}`);
      
      if (response.data.success && response.data.settings) {
        console.log('[TeamStyleProvider] Refreshed team styles successfully', response.data.settings);
        setTeamStyles(response.data.settings);
        setTeamName(response.data.settings.team_name || 'Arias Organization');
        setLogoUrl(response.data.settings.logo_url || null);
        
        // Apply the updated styles immediately
        const rootElement = document.documentElement;
        const updatedStyles = generateCSSVariables(response.data.settings);
        Object.entries(updatedStyles).forEach(([property, value]) => {
          rootElement.style.setProperty(property, value);
        });
      }
    } catch (error) {
      console.error('[TeamStyleProvider] Error refreshing team styles:', error);
    }
  }, [user?.userId, user?.clname, generateCSSVariables]);
  
  // Update styles when user changes
  useEffect(() => {
    if (user?.teamStyles) {
      console.log('[TeamStyleProvider] Setting team styles from user object');
      setTeamStyles(user.teamStyles);
      setTeamName(user.teamStyles.team_name || 'Arias Organization');
      setLogoUrl(user.teamStyles.logo_url || null);
    } else {
      console.log('[TeamStyleProvider] No team styles in user, using defaults');
      setTeamStyles(null);
      setTeamName('Arias Organization');
      setLogoUrl(null);
    }
  }, [user?.teamStyles]);

  // Memoize styles to prevent unnecessary re-renders
  const styles = useMemo(() => generateCSSVariables(teamStyles), [generateCSSVariables, teamStyles]);
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    loading: false, // Always false since we're not loading
    styles,
    logoUrl,
    teamName,
    teamStyles,
    refreshStyles
  }), [styles, logoUrl, teamName, teamStyles, refreshStyles]);
  
  return (
    <TeamStyleContext.Provider value={contextValue}>
      {children}
    </TeamStyleContext.Provider>
  );
};

// Custom hook for using the context
export const useTeamStyles = () => {
  const context = useContext(TeamStyleContext);
  if (context === undefined) {
    throw new Error('useTeamStyles must be used within a TeamStyleProvider');
  }
  return context;
};

export default TeamStyleContext; 