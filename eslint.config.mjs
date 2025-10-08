import js from "@eslint/js"
import globals from "globals"
import json from "@eslint/json"
import { defineConfig } from "eslint/config"

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 8,
      globals: Object.assign({}, globals.browser, globals.node, {
        AndroidFullScreen: false,
        cordova: false,
        process: false,
        find: "off",
        alert: "off",
      }),
    },
    rules: {
      "no-undef": 2,
      "no-use-before-define": [2, "nofunc"],
      "no-unused-vars": 1,
      "no-bitwise": 1,
      "no-duplicate-imports": "error",
      "no-const-assign": "error",
      "no-console": "off",
    },
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    extends: ["json/recommended"],
  },
])
