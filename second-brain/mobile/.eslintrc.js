// i18n guard: every user-visible literal string in JSX must be wrapped in t().
// Install: `npm i -D eslint eslint-plugin-i18next` (added to package.json devDependencies).
// Run: `npx eslint app components services`.

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["i18next"],
  extends: ["plugin:i18next/recommended"],
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "locales/**",
    "__tests__/**",
    "__mocks__/**",
    "jest.setup.js",
    "*.config.js",
    "plugins/**",
    "ios/**",
    "android/**",
  ],
  rules: {
    "i18next/no-literal-string": [
      "error",
      {
        markupOnly: true,
        ignoreAttribute: [
          "testID",
          "accessibilityRole",
          "accessibilityHint",
          "accessibilityLabel",
          "accessibilityState",
          "accessibilityValue",
          "style",
          "source",
          "key",
        ],
      },
    ],
  },
};
