# Start TypeScript Project 🚀

You will assist setting up a new TypeScript project for the user

## 🎯 Goal

* Modern TypeScript
* NPM workspaces within ./packages/
* ESLint and Prettier
* Vite to bundle TypeScript
* Vitest

## 📋 Suggested Process

### Clarify

1. Start by clarifying with the user:

* What is the name of the top-level package? (suggest one from the folder name)
* What is the name of the first package's folder? (suggest cli)
* What is the name of the first package? (suggest a logical mashup of top-level and first package; "my-project" and "cli" would be "my-project-cli", but "@orgproject/monorepo" might be "@orgproject/cli")
* Make note of any answers in your output file is available

### Setup 🏗️

2. **Initialize the project structure**:
   ```bash
   # Create the project directory if it doesn't exist
   mkdir -p packages/<package-folder>
   ```

3. **Initialize the root package.json**:
   ```bash
   # Initialize the root package.json with workspaces
   npm init -y
   ```

4. **Configure workspaces in root package.json**:
   - Add `"workspaces": ["packages/*"]` to package.json
   - Set `"private": true` to prevent accidental publishing

5. **Initialize the first package**:
   ```bash
   cd packages/<package-folder>
   npm init -y
   ```

### Install 💿

6. **Install TypeScript and core dependencies**:
   ```bash
   # Return to root directory
   cd ../..
   
   # Install TypeScript and type definitions
   npm install -D typescript @types/node
   
   # Install Vite for bundling
   npm install -D vite@latest
   
   # Install Vitest for testing
   npm install -D vitest@latest
   
   # Install ESLint 9 and Prettier
   npm install -D eslint@9 prettier@latest eslint-config-prettier@latest
   npm install -D @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest
   npm install -D eslint-plugin-prettier@latest
   ```

### ⚙️ Configure

7. **Create TypeScript configuration**:
   ```bash
   # Generate root tsconfig.json
   npx tsc --init
   ```

8. **Configure TypeScript for monorepo**:
   ```bash
   # Update root tsconfig.json to be the base configuration
   cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "rootDir": "."
  },
  "exclude": ["node_modules", "dist"]
}
EOF

   # Create package-specific tsconfig.json that extends the root
   cat > packages/<package-folder>/tsconfig.json << EOF
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF
   ```

9. **Set up ESLint and Prettier**:
   ```bash
   # Create ESLint config with Prettier integration using flat config
   echo 'import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierPlugin.configs.recommended.rules,
      "prettier/prettier": ["error", {
        "semi": true,
        "singleQuote": true,
        "tabWidth": 2,
        "trailingComma": "es5"
      }]
    }
  },
  prettierConfig
);' > eslint.config.js
   ```

10. **Create Vite configuration**:
   ```bash
   # Create vite.config.ts
   touch vite.config.ts
   ```

11. **Set up package scripts**:
   ```bash
   # Update root package.json scripts
   cat > package.json << EOF
{
  "name": "your-project-name",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
  }
}
EOF

   # Update package-specific package.json scripts
   cat > packages/<package-folder>/package.json << EOF
{
  "name": "your-package-name",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  }
}
EOF
   ```

   Note: Replace `your-project-name` and `your-package-name` with the actual names.

### Initialize 🚀

12. **Create initial source files**:
    ```bash
    mkdir -p packages/<package-folder>/src
    touch packages/<package-folder>/src/index.ts
    ```

13. **Create test files**:
    ```bash
    mkdir -p packages/<package-folder>/tests
    touch packages/<package-folder>/tests/index.test.ts
    ```

14. **Install all dependencies**:
    After setting up the project structure, install all dependencies with:
    ```bash
    npm install
    ```

### Test 🧪

15. **Run build**:
    Ensure the packages build
    ```bash
    npm run build
    ```

16. **Run lint**:
    Ensure the packages lint
    ```bash
    npm run lint
    ```

16. **Run tests**:
    Ensure the tests pass
    ```bash
    npm run test
    ```
