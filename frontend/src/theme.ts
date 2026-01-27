export const theme = {
  colors: {
    // Primary Colors (Teal/Cyan)
    primary: {
      50: '#f0f9fb',
      100: '#e0f2f7',
      200: '#b3dfe9',
      300: '#80ccd9',
      400: '#4db8c9',
      500: '#269b9f', // Main primary
      600: '#1d8589',
      700: '#156273',
      800: '#0f4a57',
      900: '#08323c',
    },
    // Secondary Colors (Teal accent)
    secondary: {
      50: '#f0f8f7',
      100: '#d9f0ef',
      200: '#b3dfe9',
      300: '#80ccd9',
      400: '#4db8c9',
      500: '#2db3a0', // Main secondary
      600: '#219989',
      700: '#157972',
      800: '#0c5a5b',
      900: '#033c3c',
    },
    // Success (Green)
    success: {
      50: '#f0f9f4',
      100: '#e0f2e5',
      200: '#b3dfc9',
      300: '#80ccad',
      400: '#4db891',
      500: '#2ba876', // Main success
      600: '#209365',
      700: '#157e54',
      800: '#0c6943',
      900: '#035432',
    },
    // Warning (Orange/Amber)
    warning: {
      50: '#fffbf0',
      100: '#fff7e0',
      200: '#ffeeb3',
      300: '#ffe580',
      400: '#ffdc4d',
      500: '#ffd700', // Main warning
      600: '#ffb700',
      700: '#ff9700',
      800: '#ff7700',
      900: '#ff5700',
    },
    // Destructive (Red)
    destructive: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444', // Main destructive
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
    // Neutral/Gray
    neutral: {
      50: '#f8fafb',
      100: '#f0f4f8',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    // Background & Surface
    background: '#f8fafb',
    surface: '#ffffff',
    border: '#e2e8f0',
    input: '#f1f5f9',
    muted: '#f0f4f8',
    mutedForeground: '#64748b',
    foreground: '#1e293b',
    ring: '#269b9f',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  typography: {
    fontFamily: {
      sans: 'system-ui, -apple-system, sans-serif',
      mono: 'Menlo, Monaco, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
      '4xl': '2.5rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: '1.2',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    glow: '0 0 30px rgba(38, 155, 159, 0.15)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #269b9f 0%, #2db3a0 100%)',
    surface: 'linear-gradient(180deg, #f8fafb 0%, #f0f4f8 100%)',
  },
  borderRadius: {
    none: '0',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export type Theme = typeof theme;
