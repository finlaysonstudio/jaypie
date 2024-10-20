# Jaypie ESLint 🐦‍⬛🧹

Linting rules for Jaypie projects

## 🎯 Goals

Jaypie ecosystem coding style, Prettier, and bespoke rules found to improve development

## 📋 Usage

### Installation

```bash
npm install --save-dev @jaypie/eslint
```

### Configuration

#### Jaypie Alone

```javascript
// eslint.config.js
export { default as default } from "@jaypie/eslint";
```

#### Jaypie with Other configs

Jaypie's configuration is a flat array that can be spread into another configuration.

```javascript
import jaypie from "@jaypie/eslint";
export default [
  ...jaypie
  // More configuration
];
```

## 🛣️ Roadmap

### Wishlist 🌠

* Vue
* CommonJS
* eslint-plugin-import-x

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
| 10/19/2024 |   1.0.0 | Initial version ported from `eslint-config-jaypie` |

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio
