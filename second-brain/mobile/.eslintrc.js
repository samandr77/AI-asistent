// i18n guard: every user-visible literal string in JSX must be wrapped in t().
// Install: `npm i -D eslint eslint-plugin-i18next eslint-plugin-react-hooks`.
// Run: `npx eslint --ext .ts,.tsx app components services`.

module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["i18next", "react-hooks"],
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
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
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
        // Pure-symbol / single-emoji / glyph strings used as decoration —
        // these don't need translation. The rule still flags any string with
        // letters, digits, or whitespace.
        ignore: [
          "^[\\p{Emoji}\\p{S}\\p{P}\\p{N}\\s\\-:·\\/×•+=\\.…|]+$",
          "^[A-Z0-9_]+$", // constants like "OK"
          "^Email$", // standard term, identical across RU/EN
          "^https?://", // URLs
        ],
      },
    ],
  },
};
