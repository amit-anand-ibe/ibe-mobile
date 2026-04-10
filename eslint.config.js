const js = require("@eslint/js");
const react = require("eslint-plugin-react");
const babelParser = require("@babel/eslint-parser");

module.exports = [
  // Ignore specific files/folders globally
  {
    ignores: [
      "**/.expo/**",
      "**/__tests__/**",
      "**/*.test.js",
      "**/*.test.jsx",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
  },

  // Base ESLint rules
  js.configs.recommended,

  // React and project-specific rules
  {
    plugins: {
      react,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"],
        },
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        JSX: true,
        console: true,
        URLSearchParams: true,
        fetch: true,
        setTimeout: true,
        clearTimeout: true,
        FileReader: true,
        FormData: true,
        Intl: true,
      },
    },
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "no-unused-vars": ["warn", { "varsIgnorePattern": "^React$" }],
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Override for test/mocks
  {
    files: [
      "**/__tests__/**/*.js",
      "**/__mocks__/**/*.js",
      "**/test*.js",
      "**/setupTests.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"],
        },
        ecmaFeatures: { jsx: true },
      },
      globals: {
        jest: true,
        describe: true,
        it: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        require: true,
        console: true,
        URLSearchParams: true,
        fetch: true,
      },
    },
  },
];

//  npm install --save-dev eslint prettier husky lint-staged
// npm install eslint-plugin-react --save-dev
// npm install --save-dev @babel/eslint-parser @babel/preset-react