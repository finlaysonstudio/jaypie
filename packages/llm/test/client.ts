import { config } from "dotenv";
import { Llm, tools } from "../src/index.js";

config();

const EXPECTED = {
  TOOL: "roll",
  PARAMS: {
    number: 5,
    sides: 6,
  },
};

const INSTRUCTIONS =
  "Provide crisp, punchy answers. Be direct and to the point. Avoid flowery language.";
const QUESTION = "Roll five six-sided dice";

async function main(provider: string) {
  try {
    const model = new Llm(provider as any);
    console.log(`\n============ Provider: "${provider}"`);

    let toolCalled = false;
    let correctParams = false;

    const result = await model.operate(QUESTION, {
      format: {
        values: String, // TODO: Array
        total: Number,
      },
      hooks: {
        beforeEachTool: (tool) => {
          console.log(tool);
          if (tool.toolName === EXPECTED.TOOL) {
            toolCalled = true;
            // Verify the tool received correct parameters
            const args = JSON.parse(tool.args);
            if (
              args?.number === EXPECTED.PARAMS.number &&
              args?.sides === EXPECTED.PARAMS.sides
            ) {
              correctParams = true;
            }
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
      if (!toolCalled) {
        console.error(
          `Error: ${EXPECTED.TOOL} tool was not called for provider ${provider}`,
        );
        return false;
      }

      // Verify correct parameters were passed
      if (!correctParams) {
        console.error(
          `Error: Incorrect parameters passed to ${EXPECTED.TOOL} tool for provider ${provider}`,
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

      if (typeof content.values !== "string" || !content.values) {
        console.error(
          `Error: values missing or not a string for provider ${provider}`,
        );
        return false;
      }

      if (typeof content.total !== "number") {
        console.error(
          `Error: total is missing or not a number for provider ${provider}`,
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
