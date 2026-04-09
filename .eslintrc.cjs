module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    'react',
    'react-hooks',
    '@typescript-eslint',
    'jsx-a11y',
    'security',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // React rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react-hooks/rules-of-hooks': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // Security rules (object-injection is extremely noisy on dynamic maps / config keys)
    'security/detect-object-injection': 'off',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'warn',
    
    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-unused-vars': 'off', // Use TypeScript version instead
    'no-empty': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-useless-escape': 'off',
    'object-shorthand': 'warn',
    'prefer-arrow-callback': 'error',
    
    // Naming conventions — off by default (large legacy codebase; re-enable gradually if desired)
    '@typescript-eslint/naming-convention': 'off',
    
    // Accessibility
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/aria-role': 'off',
    'jsx-a11y/img-redundant-alt': 'off',
    'jsx-a11y/media-has-caption': 'off',
    'jsx-a11y/no-autofocus': 'off',
    'jsx-a11y/no-noninteractive-tabindex': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'no-case-declarations': 'off',
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    'App-backup.tsx',
    'App-simple.tsx',
    'CustomerLogin.tsx',
    'Login.tsx',
    '*.config.js',
    '*.config.ts',
    'dev-api-server*.js',
    'playwright-report',
    'test-results',
    'android/**',
    'app/**',
    'scripts/**',
    'verify-production-setup.js',
    'seed*.js',
    '.cursor/**',
  ],
  overrides: [
    {
      files: [
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'e2e/**/*.ts',
        'e2e/**/*.tsx',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'no-console': 'off',
        'prefer-const': 'off',
        'object-shorthand': 'off',
        'no-useless-escape': 'off',
        'jsx-a11y/aria-role': 'off',
        'security/detect-non-literal-fs-filename': 'off',
        'react-hooks/rules-of-hooks': 'off',
      },
    },
    {
      files: ['api/main.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'prefer-const': 'off',
        'object-shorthand': 'off',
        'no-case-declarations': 'off',
        'no-useless-escape': 'off',
      },
    },
  ],
};

