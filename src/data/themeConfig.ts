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
    warm: string;
    glow: string;
  };
}

export const themeConfigs: Record<ThemeState['accentColor'], ThemeConfig> = {
  primary: {
    name: 'Re-Mixed Teal',
    colors: {
      primary: '#14b8a6',
      secondary: '#22c55e',
      background: '#0a0a0c',
      surface: '#16181d',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#2a2d34',
      warm: '#22c55e',
      glow: '#22d3ee',
    },
  },
  secondary: {
    name: 'Signal Green',
    colors: {
      primary: '#22c55e',
      secondary: '#14b8a6',
      background: '#0a0a0c',
      surface: '#16181d',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#2a2d34',
      warm: '#16a34a',
      glow: '#4ade80',
    },
  },
  green: {
    name: 'Mint Emerald',
    colors: {
      primary: '#10b981',
      secondary: '#0ea5a3',
      background: '#0a0a0c',
      surface: '#16181d',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#2a2d34',
      warm: '#0d9488',
      glow: '#34d399',
    },
  },
  purple: {
    name: 'Indigo Verified',
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      background: '#0a0a0c',
      surface: '#16181d',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#2a2d34',
      warm: '#818cf8',
      glow: '#a5b4fc',
    },
  },
};

const lightThemeConfigs: Record<ThemeState['accentColor'], ThemeConfig> = {
  primary: {
    name: 'Re-Mixed Teal',
    colors: {
      primary: '#14b8a6',
      secondary: '#22c55e',
      background: '#f2f3f5',
      surface: '#ffffff',
      text: '#111318',
      textSecondary: '#6b7280',
      border: '#111318',
      warm: '#22c55e',
      glow: '#22d3ee',
    },
  },
  secondary: {
    name: 'Signal Green',
    colors: {
      primary: '#22c55e',
      secondary: '#14b8a6',
      background: '#f2f3f5',
      surface: '#ffffff',
      text: '#111318',
      textSecondary: '#6b7280',
      border: '#111318',
      warm: '#16a34a',
      glow: '#4ade80',
    },
  },
  green: {
    name: 'Mint Emerald',
    colors: {
      primary: '#10b981',
      secondary: '#0ea5a3',
      background: '#f2f3f5',
      surface: '#ffffff',
      text: '#111318',
      textSecondary: '#6b7280',
      border: '#111318',
      warm: '#0d9488',
      glow: '#34d399',
    },
  },
  purple: {
    name: 'Indigo Verified',
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      background: '#f2f3f5',
      surface: '#ffffff',
      text: '#111318',
      textSecondary: '#6b7280',
      border: '#111318',
      warm: '#818cf8',
      glow: '#a5b4fc',
    },
  },
};

const getThemeConfig = (theme: ThemeState, isDark: boolean = true): ThemeConfig => {
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
