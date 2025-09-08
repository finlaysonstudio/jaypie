import { config } from "dotenv";
import { Llm, tools } from "../src/index.js";

config();

const INSTRUCTIONS =
  "Provide crisp, punchy answers. Be direct and to the point. Avoid flowery language.";
const QUESTION = "What is the weather in Aruba?";

async function main(provider: string) {
  try {
    const model = new Llm(provider as any);
    console.log(`\n============ Provider: "${provider}"`);

    let weatherToolCalled = false;

    const result = await model.operate(QUESTION, {
      format: {
        location: String,
        temperature: Number,
        description: String,
      },
      hooks: {
        beforeEachTool: (tool) => {
          console.log(tool);
          if (tool.toolName === "weather") {
            weatherToolCalled = true;
          }
        },
        onUnrecoverableModelError: (error) => {
          console.log(error);
        },
      },
      tools,
      instructions: INSTRUCTIONS,
      user: process?.env?.APP_USER || "[client] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for provider ${provider}:`, result.error);
      return false;
    } else {
      console.log(`Result for provider ${provider}:`, result.content);

      // Verify weather tool was called
      if (!weatherToolCalled) {
        console.error(
          `Error: weather tool was not called for provider ${provider}`,
        );
        return false;
      }

      // Verify result contains expected fields
      const content = result.content;
      if (!content || typeof content !== "object") {
        console.error(
          `Error: result content is not an object for provider ${provider}`,
        );
        return false;
      }

      if (typeof content.location !== "string" || !content.location) {
        console.error(
          `Error: location is missing or not a string for provider ${provider}`,
        );
        return false;
      }

      if (typeof content.temperature !== "number") {
        console.error(
          `Error: temperature is missing or not a number for provider ${provider}`,
        );
        return false;
      }

      if (typeof content.description !== "string" || !content.description) {
        console.error(
          `Error: description is missing or not a string for provider ${provider}`,
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
  console.log(QUESTION);
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
