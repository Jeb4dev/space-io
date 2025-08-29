/* @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unused-imports", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  parserOptions: {
    project: ["./packages/*/tsconfig.json"]
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "unused-imports/no-unused-imports": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "import/order": ["warn", { "newlines-between": "always" }]
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: ["packages/*/tsconfig.json"]
      }
    }
  }
};
