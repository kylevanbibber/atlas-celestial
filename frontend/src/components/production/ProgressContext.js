import React, { createContext, useContext, useState, useEffect } from "react";

// Create a context
const ProgressContext = createContext();

// Create a provider component
export const ProgressProvider = ({ children }) => {
    const [progress, setProgress] = useState(0);
  
    useEffect(() => {
      console.log("Progress updated in context:", progress);
    }, [progress]);
  
    return (
      <ProgressContext.Provider value={{ progress, setProgress }}>
        {children}
      </ProgressContext.Provider>
    );
  };

// Custom hook for accessing progress context easily
export const useProgress = () => useContext(ProgressContext); 