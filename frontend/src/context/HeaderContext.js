import React, { createContext, useContext, useState } from 'react';

const HeaderContext = createContext({
  headerContent: null,
  setHeaderContent: () => {},
});

export const HeaderProvider = ({ children }) => {
  const [headerContent, setHeaderContent] = useState(null);

  return (
    <HeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
};

export default HeaderContext;
