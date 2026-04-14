import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { applyTheme } from '../data/themeConfig';

interface ThemeProviderProps {
  children: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, setTheme } = useStore();

  useEffect(() => {
    // Load saved theme on mount
    const savedTheme = localStorage.getItem('remix-theme');
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        setTheme(parsedTheme);
        applyTheme(parsedTheme);
      } catch (error) {
        console.error('Failed to parse saved theme:', error);
        localStorage.removeItem('remix-theme');
        applyTheme(theme);
      }
    } else {
      // Apply default theme
      applyTheme(theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Save theme changes
    localStorage.setItem('remix-theme', JSON.stringify(theme));
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes when auto mode is enabled
  useEffect(() => {
    if (theme.type === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyTheme(theme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return <>{children}</>;
};

export default ThemeProvider; 