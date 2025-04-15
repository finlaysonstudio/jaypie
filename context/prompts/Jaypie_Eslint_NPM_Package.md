# Jaypie Eslint 🐦‍⬛🧹

Linting rules for Jaypie project coding style, Prettier, and bespoke rules.

## 🎯 Goals

* Opinionated "umbrella" config for common projects using Jaypie
* Strengthen rules that prevent mistakes
* Loosen rules that slow down development
* Use warn for things that will not break (console, prettier)

Tries to "just work" but sometimes conflicts with opinionated project linters like nuxt.

## 🔋 Capabilities

* `@eslint/js` recommended
* `eslint-plugin-import-x` recommended
* Ignore cdk, dist
* Language options; assume module
* Custom rules
* CommonJS for .cjs
* Ignore Nuxt
* Prettier
* TypeScript for .ts
* Tests
* Prettier-Vue for .vue

## 💿 Installation

```sh
npm install --save-dev @jaypie/eslint
```

## 📋 Usage

```javascript
// eslint.config.js
export { default as default } from "@jaypie/eslint";
```

### With Nuxt

```javascript
// @ts-check
import jaypie from "@jaypie/eslint/nuxt";
import { withNuxt } from "./.nuxt/eslint.config.mjs";

export default withNuxt(...jaypie, {
  languageOptions: {
    globals: {
      defineNuxtConfig: "readonly",
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
});
```

### In CommonJS

```javascript
export { default as default } from "@jaypie/commonjs";
```

### Other Configs

```javascript
import jaypie from "@jaypie/eslint";
export default [
  ...jaypie
  // More configuration
];
```
