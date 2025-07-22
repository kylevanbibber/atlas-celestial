import React, { createContext, useContext } from 'react';
import useLicenseStatus from '../hooks/useLicenseStatus';

// Create context
const LicenseWarningContext = createContext(null);

// Provider component
export const LicenseWarningProvider = ({ children }) => {
  const licenseStatus = useLicenseStatus();
  
  return (
    <LicenseWarningContext.Provider value={licenseStatus}>
      {children}
    </LicenseWarningContext.Provider>
  );
};

// Hook to use the license warning context
export const useLicenseWarning = () => {
  const context = useContext(LicenseWarningContext);
  if (context === null) {
    throw new Error('useLicenseWarning must be used within a LicenseWarningProvider');
  }
  return context;
}; 