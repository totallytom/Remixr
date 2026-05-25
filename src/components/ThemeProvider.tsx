import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { applyTheme } from '../data/themeConfig';
import { storage, STORAGE_KEYS } from '../platform/storage';

interface ThemeProviderProps {
  children: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, setTheme } = useStore();

  useEffect(() => {
    const load = async () => {
      const raw = await storage.get(STORAGE_KEYS.THEME);
      if (raw) {
        try {
          const parsedTheme = JSON.parse(raw);
          setTheme(parsedTheme);
          applyTheme(parsedTheme);
        } catch (error) {
          console.error('Failed to parse saved theme:', error);
          await storage.remove(STORAGE_KEYS.THEME);
          applyTheme(theme);
        }
      } else {
        applyTheme(theme);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    storage.setJSON(STORAGE_KEYS.THEME, theme);
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