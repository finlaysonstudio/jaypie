---
description: setup for commander-based CLI packages
---

# Jaypie Commander CLI Package

Create a CLI subpackage with commander.js for command-line applications

## Goal

* TypeScript CLI application with command-line interface
* Commander.js integration for argument parsing
* Standard Jaypie project structure and npm workspace integration
* Version support and hello command implementation

## Guidelines

* Follow Jaypie_Init_Project_Subpackage conventions for monorepo setup
* Package name follows "@parent-namespace/cli" or "parent-repo-cli" based on top-level package.json naming
* Use commander.js for CLI functionality
* Include executable script configuration
* Default package name: `packages/cli`
* Default script name: `run`

## Process

1. Follow Jaypie_Init_Project_Subpackage to create basic subpackage structure

2. Install commander.js and dotenv:
   ```bash
   npm --workspace ./packages/cli install commander dotenv
   npm --workspace ./packages/cli install --save-dev @types/node
   ```

3. Create CLI entry point `src/index.ts`:
   ```typescript
   import dotenv from 'dotenv';
   import { Command } from 'commander';
   import { version } from '../package.json';
   import { registerCommands } from './commands/index.js';

   dotenv.config();

   const program = new Command();

   program
     .version(version)
     .description('CLI application');

   registerCommands(program);

   program.parse();
   ```

4. Create command registrar `src/commands/index.ts`:
   ```typescript
   import { Command } from "commander";
   import { helloCommand } from "./hello.js";

   export function registerCommands(program: Command): Command {
     helloCommand(program);
     
     return program;
   }
   ```

5. Create example command `src/commands/hello.ts`:
   ```typescript
   import { Command } from "commander";

   export function helloCommand(program: Command): Command {
     program
       .command("hello")
       .description("Say hello to the specified name")
       .argument('[name]', 'name to greet', 'World')
       .argument('[salutation]', 'greeting word', 'Hello')
       .action((name: string, salutation: string) => {
         console.log(`${salutation}, ${name}!`);
       });
       
     return program;
   }
   ```

6. Create test file `src/commands/hello.spec.ts`:
   ```typescript
   import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
   import { Command } from 'commander';
   import { helloCommand } from './hello.js';

   describe('helloCommand', () => {
     let consoleSpy: any;

     beforeEach(() => {
       consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
     });

     afterEach(() => {
       consoleSpy.mockRestore();
     });

     it('should register hello command', () => {
       const program = new Command();
       helloCommand(program);
       
       const command = program.commands.find(cmd => cmd.name() === 'hello');
       expect(command).toBeDefined();
       expect(command?.description()).toBe('Say hello to the specified name');
     });

     it('should use default values with no arguments', () => {
       const program = new Command();
       helloCommand(program);
       
       program.parse(['node', 'test', 'hello']);
       
       expect(consoleSpy).toHaveBeenCalledWith('Hello, World!');
     });

     it('should use custom name with one argument', () => {
       const program = new Command();
       helloCommand(program);
       
       program.parse(['node', 'test', 'hello', 'Alice']);
       
       expect(consoleSpy).toHaveBeenCalledWith('Hello, Alice!');
     });

     it('should use custom name and salutation with two arguments', () => {
       const program = new Command();
       helloCommand(program);
       
       program.parse(['node', 'test', 'hello', 'Bob', 'Hi']);
       
       expect(consoleSpy).toHaveBeenCalledWith('Hi, Bob!');
     });
   });
   ```

7. Create executable script `bin/run`:
   ```bash
   #!/usr/bin/env node
   require('../dist/index.js');
   ```

8. Update package.json configuration:
   * Add `"bin": { "run": "./bin/run" }`
   * Add `"scripts": { "start": "node ./bin/run" }`
   * Include `"resolveJsonModule": true` in tsconfig.json compilerOptions

9. Create bin directory and make script executable:
   ```bash
   mkdir packages/cli/bin
   chmod +x packages/cli/bin/run
   ```

10. Build and test:
    ```bash
    npm run build --workspace packages/cli
    npm start --workspace packages/cli -- hello "Mr. Bond" Goodbye
    ```

## Context

context/prompts/Jaypie_Init_Project_Subpackage.md
context/prompts/Jaypie_Project_Structure.md