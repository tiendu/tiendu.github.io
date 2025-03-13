// eslint.config.mjs
import prettier from "eslint-plugin-prettier";
import babelParser from "@babel/eslint-parser";
import astroParser from "astro-eslint-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...compat.extends(
    "eslint:recommended",
    "plugin:astro/recommended",
    "plugin:prettier/recommended"
  ),
  {
    plugins: {
      prettier,
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false, // Disable Babel config file check
      },
    },
  },
  {
    files: ["**/*.astro"],
    languageOptions: {
      parser: astroParser,
      ecmaVersion: 5,
      sourceType: "script",
      parserOptions: {
        parser: "@babel/eslint-parser",
        extraFileExtensions: [".astro"],
        requireConfigFile: false, // Also disable here for Astro files
      },
    },
  }
];

