# Initialize a "Context as Code" Repository Pattern ⏺️

Context as Code treats prompts used in AI-driven development as first-class artifacts stored in the repository.

The main loop is write a new code generation prompt, run the prompt, and iterate by refining the prompt until it achieves the correct result on the first shot ("no second turns").

## ⌨️ Commands

This command can be run to initialize the current repository.
Agents setting up the repository (reading these instructions) should not run this command:

```sh
aider --message-file context/prompts/Init_Context_as_Code.md
```

## 🎯 Goal

* Script `new-changelog.ts` to initialize new changelog entries
* NPM commands `bin:changelog` and `new:change`

## ✔️ Guidelines

* Context will reside in the root of the repo at `/context`
* Do not overwrite anything that exists

## 💿 Setup

1. Create a script, `context/bin/new-changelog.ts`
```typescript
#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * Script to create a new changelog file with a timestamp and formatted message
 */
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

/**
 * Creates a filesystem-friendly version of a message
 * @param message The original message
 * @returns Lowercase, whitespace-to-underscore version of the message
 */
function formatMessageForFilename(message: string): string {
  return message.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Generates a timestamp string in the format yyyy_mm_dd_hhmm_ssmmm
 * @returns Formatted timestamp string
 */
function generateTimestamp(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return `${year}_${month}_${day}_${hours}${minutes}_${seconds}${milliseconds}`;
}

/**
 * Prompts the user for input
 * @param question The question to ask
 * @returns Promise that resolves with the user's input
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Main function to create a new changelog file
 */
async function main(): Promise<void> {
  try {
    // Get all arguments after the script name and join them as a single message
    let message = process.argv.slice(2).join(" ");

    // If no message was provided, prompt the user for one
    if (!message) {
      message = await promptUser("Message for changelog? ");

      if (!message) {
        console.error("Error: A message is required");
        process.exit(1);
      }
    }

    const timestamp = generateTimestamp();
    const formattedMessage = formatMessageForFilename(message);
    const filename = `context/changelog/${timestamp}_${formattedMessage}.md`;

    // Create the file with the original message as a heading
    const content = `# ${message}\n`;

    // Ensure the directory exists
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filename, content);

    console.log(`Created changelog file: ${filename}`);
  } catch (error) {
    console.error("Error creating changelog file:", error);
    process.exit(1);
  }
}

main();
```

2. Make the script executable.

3. Add `"bin:changelog": "tsx context/bin/new-changelog.ts",` to `package.json`

4. Add `"new:change": "npm run bin:changelog",` to `package.json`

This script accepts message text to use as the title of the entry.
If no message is present it will prompt for a message.
Wrapping the message in quotes is recommended but not required.

```sh
npm run new:change
npm run new:change "Init Context as Code"
```
