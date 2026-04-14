import { ThemeState } from '../store/useStore';

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
    warm: string;
    glow: string;
  };
}

export const themeConfigs: Record<ThemeState['accentColor'], ThemeConfig> = {
  primary: {
    name: 'Cozy Orange',
    colors: {
      primary: '#ff8c42',
      secondary: '#ff6b6b',
      background: '#2d1b1b',
      surface: '#3d2b2b',
      text: '#f4e4d6',
      textSecondary: '#c4a484',
      border: '#5d4a4a',
      accent: '#ff8c42',
      warm: '#ff8c42',
      glow: '#ffa366',
    },
  },
  secondary: {
    name: 'Warm Pink',
    colors: {
      primary: '#ff6b9d',
      secondary: '#ff8c42',
      background: '#2b1b2b',
      surface: '#3b2b3b',
      text: '#f4e4d6',
      textSecondary: '#c4a484',
      border: '#5d4a5d',
      accent: '#ff6b9d',
      warm: '#ff6b9d',
      glow: '#ff8db8',
    },
  },
  green: {
    name: 'Forest Green',
    colors: {
      primary: '#7fb069',
      secondary: '#ff8c42',
      background: '#1b2b1b',
      surface: '#2b3b2b',
      text: '#f4e4d6',
      textSecondary: '#c4a484',
      border: '#4a5d4a',
      accent: '#7fb069',
      warm: '#7fb069',
      glow: '#8fc079',
    },
  },
  purple: {
    name: 'Lavender Dream',
    colors: {
      primary: '#b8a9c9',
      secondary: '#ff8c42',
      background: '#2b1b2b',
      surface: '#3b2b3b',
      text: '#f4e4d6',
      textSecondary: '#c4a484',
      border: '#5d4a5d',
      accent: '#b8a9c9',
      warm: '#b8a9c9',
      glow: '#c8b9d9',
    },
  },
};

export const lightThemeConfigs: Record<ThemeState['accentColor'], ThemeConfig> = {
  primary: {
    name: 'Cozy Orange',
    colors: {
      primary: '#ff8c42',
      secondary: '#ff6b6b',
      background: '#fdf6e3',
      surface: '#f5e6d3',
      text: '#2d1b1b',
      textSecondary: '#5d4a4a',
      border: '#d4c4b4',
      accent: '#ff8c42',
      warm: '#ff8c42',
      glow: '#ffa366',
    },
  },
  secondary: {
    name: 'Warm Pink',
    colors: {
      primary: '#ff6b9d',
      secondary: '#ff8c42',
      background: '#fdf6f3',
      surface: '#f5e6f3',
      text: '#2b1b2b',
      textSecondary: '#5d4a5d',
      border: '#d4c4d4',
      accent: '#ff6b9d',
      warm: '#ff6b9d',
      glow: '#ff8db8',
    },
  },
  green: {
    name: 'Forest Green',
    colors: {
      primary: '#7fb069',
      secondary: '#ff8c42',
      background: '#f3fdf6',
      surface: '#e6f5e6',
      text: '#1b2b1b',
      textSecondary: '#4a5d4a',
      border: '#c4d4c4',
      accent: '#7fb069',
      warm: '#7fb069',
      glow: '#8fc079',
    },
  },
  purple: {
    name: 'Lavender Dream',
    colors: {
      primary: '#b8a9c9',
      secondary: '#ff8c42',
      background: '#f6f3fd',
      surface: '#e6e3f5',
      text: '#2b1b2b',
      textSecondary: '#5d4a5d',
      border: '#d4c4d4',
      accent: '#b8a9c9',
      warm: '#b8a9c9',
      glow: '#c8b9d9',
    },
  },
};

export const getThemeConfig = (theme: ThemeState, isDark: boolean = true): ThemeConfig => {
  const configs = isDark ? themeConfigs : lightThemeConfigs;
  return configs[theme.accentColor];
};

export const applyTheme = (theme: ThemeState) => {
  const isDark = theme.type === 'dark' || (theme.type === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const config = getThemeConfig(theme, isDark);
  
  const root = document.documentElement;
  
  // Apply CSS custom properties
  root.style.setProperty('--color-primary', config.colors.primary);
  root.style.setProperty('--color-secondary', theme.customSecondaryColor || config.colors.secondary);
  root.style.setProperty('--color-background', config.colors.background);
  root.style.setProperty('--color-surface', config.colors.surface);
  root.style.setProperty('--color-text', config.colors.text);
  root.style.setProperty('--color-text-secondary', config.colors.textSecondary);
  root.style.setProperty('--color-border', config.colors.border);
  root.style.setProperty('--color-accent', config.colors.accent);
  root.style.setProperty('--color-warm', config.colors.warm);
  root.style.setProperty('--color-glow', config.colors.glow);
  
  // Generate and set Tailwind color shades for primary
  const primaryColor = config.colors.primary;
  const primaryShades = generateColorShades(primaryColor);
  Object.entries(primaryShades).forEach(([shade, color]) => {
    root.style.setProperty(`--color-primary-${shade}`, color);
  });
  
  // Generate and set Tailwind color shades for secondary
  const secondaryColor = theme.customSecondaryColor || config.colors.secondary;
  const secondaryShades = generateColorShades(secondaryColor);
  Object.entries(secondaryShades).forEach(([shade, color]) => {
    root.style.setProperty(`--color-secondary-${shade}`, color);
  });
  
  // Generate and set Tailwind color shades for dark theme colors
  const darkShades = generateColorShades('#1e293b'); // Base dark color
  Object.entries(darkShades).forEach(([shade, color]) => {
    root.style.setProperty(`--color-dark-${shade}`, color);
  });
  
  // Apply theme class to body
  document.body.className = isDark ? 'dark pixel-theme cozy' : 'light pixel-theme cozy';
};

// Helper function to generate color shades
const generateColorShades = (baseColor: string) => {
  const shades: Record<string, string> = {};
  
  // Convert hex to RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Generate shades (50-900)
  const shadeValues = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  shadeValues.forEach((shade) => {
    let factor;
    if (shade <= 500) {
      factor = 1 - (500 - shade) / 500;
    } else {
      factor = 1 + (shade - 500) / 500;
    }
    
    const newR = Math.round(Math.min(255, Math.max(0, r * factor)));
    const newG = Math.round(Math.min(255, Math.max(0, g * factor)));
    const newB = Math.round(Math.min(255, Math.max(0, b * factor)));
    
    shades[shade] = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  });
  
  return shades;
}; 