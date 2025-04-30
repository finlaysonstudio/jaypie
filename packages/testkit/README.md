# Jaypie Testkit 🐦‍⬛🫒

Test utilities built for Jaypie

## 📋 Usage

### Installation

```bash
npm install --save-dev @jaypie/testkit
```

### Matchers

This package includes custom Jaypie matchers and all matchers from [jest-extended](https://github.com/jest-community/jest-extended).

```typescript
// In your test setup file
import { expect } from 'vitest'; // or Jest
import { matchers } from '@jaypie/testkit';

// Extend with all matchers (includes jest-extended)
expect.extend(matchers);
```

### TypeScript Support

The package includes types for all matchers. You don't need to install `@types/jest-extended` separately.

```typescript
// In your test file
import '@jaypie/testkit'; // Imports types automatically

// Now you can use both Jaypie matchers and jest-extended matchers
expect(myObject).toBeObject();  // jest-extended matcher
expect(myClass).toBeClass();    // Jaypie matcher
```

### Example

See [Jaypie](https://github.com/finlaysonstudio/jaypie) for more usage examples.

## 🌠 Wishlist

* matcher toBeHttpStatus
* matcher toBeJaypieAny
* matcher toBeJaypieData
* matcher toBeJaypieDataObject
* matcher toBeJaypieDataArray
* ...@knowdev/jest

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
|  4/28/2025 |  (next) | Include jest-extended matchers and types |
|  9/15/2024 |  1.0.29 | All errors exported as mocks |
|  9/14/2024 |  1.0.28 | Matchers `toThrowBadGatewayError`, `toThrowGatewayTimeoutError`, `toThrowUnavailableError` |
|  9/13/2024 |  1.0.27 | Matcher `toBeCalledAboveTrace` |
|  7/16/2024 |  1.0.21 | Export Jaypie mock as default |
|  3/20/2024 |   1.0.2 | Export `LOG`   |
|  3/16/2024 |   1.0.0 | Artists ship   |
|  3/15/2024 |   0.1.0 | Initial deploy |
|  3/15/2024 |   0.0.1 | Initial commit |

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio
