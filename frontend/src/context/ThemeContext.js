import React, { createContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Check localStorage or use 'light' as default
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('atlasTheme');
    return savedTheme || 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('atlasTheme', theme);
    
    // Apply theme to body
    document.body.setAttribute('data-theme', theme);
    
    // Add/remove dark class for Tailwind
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext; 