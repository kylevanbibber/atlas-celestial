import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const EmbeddedContext = createContext();

export const useEmbedded = () => {
  const context = useContext(EmbeddedContext);
  if (!context) {
    throw new Error('useEmbedded must be used within an EmbeddedProvider');
  }
  return context;
};

export const EmbeddedProvider = ({ children }) => {
  const [searchParams] = useSearchParams();
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [embedMode, setEmbedMode] = useState('iframe'); // 'iframe' or 'popup'

  useEffect(() => {
    // Check for embedded/standalone mode via query parameters
    const embedded = searchParams.get('embedded') === 'true' || 
                     searchParams.get('standalone') === 'true';
    const mode = searchParams.get('mode') || 'iframe';
    
    setIsEmbedded(embedded);
    setEmbedMode(mode);

    // If embedded, add a class to body for styling
    if (embedded) {
      document.body.classList.add('embedded-mode');
      document.body.classList.add(`embedded-${mode}`);
    } else {
      document.body.classList.remove('embedded-mode');
      document.body.classList.remove('embedded-iframe');
      document.body.classList.remove('embedded-popup');
    }
  }, [searchParams]);

  const value = {
    isEmbedded,
    embedMode,
  };

  return (
    <EmbeddedContext.Provider value={value}>
      {children}
    </EmbeddedContext.Provider>
  );
};

export default EmbeddedContext;

