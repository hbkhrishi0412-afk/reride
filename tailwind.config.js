/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Reride-Inspired Theme - Vibrant & Professional
        'reride': {
          // Primary Blue (Main Brand Color)
          'orange': '#2563EB',
          'orange-hover': '#3B82F6',
          'orange-light': 'rgba(37, 99, 235, 0.1)',
          'orange-dark': '#1D4ED8',
          
          // Secondary Blue (Trust & Info)
          'blue': '#1E88E5',
          'blue-hover': '#42A5F5',
          'blue-light': 'rgba(30, 136, 229, 0.1)',
          'blue-dark': '#1976D2',
          
          // Neutral Colors - Clean & Modern
          'white': '#FFFFFF',
          'off-white': '#FAFAFA',
          'light-gray': '#F5F5F5',
          'gray': '#E0E0E0',
          'medium-gray': '#9E9E9E',
          'dark-gray': '#616161',
          
          // Text Colors - High Contrast
          'text': {
            DEFAULT: '#2C2C2C',
            dark: '#1A1A1A',
            medium: '#616161',
            light: '#9E9E9E',
          },
          
          // Status Colors
          'success': '#4CAF50',
          'warning': '#FFC107',
          'error': '#F44336',
          'info': '#1E88E5',
        },
        
        // Backward compatibility aliases
        'brand': {
          'orange': '#2563EB',
          'orange-hover': '#3B82F6',
          'orange-light': 'rgba(37, 99, 235, 0.1)',
          'white': '#FFFFFF',
          'text': {
            DEFAULT: '#2C2C2C',
            dark: '#1A1A1A',
          },
          'gray': {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#E0E0E0',
            300: '#BDBDBD',
            400: '#9E9E9E',
            500: '#757575',
            600: '#616161',
            700: '#424242',
            800: '#2C2C2C',
            900: '#1A1A1A',
          },
        },
      },
      backgroundImage: {
        'gradient-orange': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
        'gradient-hero': 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
        'gradient-subtle': 'linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)',
        'gradient-primary': 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
      },
      boxShadow: {
        'reride': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'reride-md': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'reride-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'orange': '0 4px 20px rgba(37, 99, 235, 0.3)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      borderRadius: {
        'reride-sm': '6px',
        'reride-md': '8px',
        'reride-lg': '12px',
        'reride-xl': '16px',
        'brand-sm': '6px',
        'brand-md': '8px',
        'brand-lg': '12px',
      },
      fontFamily: {
        sans: ['Nunito Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
