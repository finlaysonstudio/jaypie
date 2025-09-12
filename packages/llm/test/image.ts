/* eslint-disable no-console */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import {
  Llm,
  LlmInputContentImage,
  LlmInputContentText,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../src/index.js";
import * as fs from "fs";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const REQUEST = "Extract the text from the image.";
const IMAGE_FILE_PATH = join(__dirname, "fixtures/page.png");
const base64Image = fs.readFileSync(IMAGE_FILE_PATH, { encoding: "base64" });

async function main(provider: string) {
  try {
    const model = new Llm(provider as any);
    console.log(`\n============ Provider: "${provider}"`);

    const textContent: LlmInputContentText = {
      type: LlmMessageType.InputText,
      text: REQUEST,
    };
    const imageContent: LlmInputContentImage = {
      type: LlmMessageType.InputImage,
      image_url: `data:image/jpeg;base64,${base64Image}`,
    };
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [textContent, imageContent],
    };

    const result = await model.operate([inputMessage], {
      user: process?.env?.APP_USER || "[client] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for provider ${provider}:`, result.error);
      return false;
    } else {
      console.log(`Result for provider ${provider}:`, result.content);

      // Assertions
      if (!result.content || typeof result.content !== "string") {
        console.error(`Error: No content returned for provider ${provider}`);
        return false;
      }

      const contentLower = result.content.toLowerCase();
      const requiredStrings = [
        "mock page",
        "this page intentionally blank",
        "mit license",
      ];

      const missingStrings = requiredStrings.filter(
        (str) => !contentLower.includes(str),
      );

      if (missingStrings.length > 0) {
        console.error(
          `Error: Missing required strings for provider ${provider}:`,
          missingStrings,
        );
        return false;
      }

      console.log(`✅ All assertions passed for provider ${provider}`);
      return true;
    }
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function runAllProviders() {
  const providers = process.env.APP_PROVIDER
    ? process.env.APP_PROVIDER.split(",").map((p) => p.trim())
    : [];

  if (providers.length === 0) {
    console.error(
      "💀 No providers specified in APP_PROVIDER environment variable",
    );
    process.exit(1);
  }

  let hasError = false;
  console.log(REQUEST);
  for (const provider of providers) {
    const success = await main(provider);
    if (!success) {
      console.error(`❌ Failed assertions for provider "${provider}"`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error("\n💀 Exiting with failed assertions");
    process.exit(1);
  } else {
    console.log("\n🎉 All assertions passed");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllProviders();
}
