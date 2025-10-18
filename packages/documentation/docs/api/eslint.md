# @jaypie/eslint

Shared ESLint configuration for Jaypie projects.

## Overview

`@jaypie/eslint` provides a shared ESLint configuration for consistent code style across Jaypie projects.

## Installation

```bash
npm install --save-dev @jaypie/eslint
```

## Usage

Add to your `eslint.config.mjs`:

```javascript
import jaypie from "@jaypie/eslint";

export default [
  ...jaypie,
  // Your custom rules
];
```

## Features

- Modern ESLint flat config format
- TypeScript support
- Import/export validation
- Prettier integration

## Related Packages

- [@jaypie/testkit](./testkit) - Testing utilities
