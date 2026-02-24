/* eslint-disable no-console */
import { config } from "dotenv";
import { Llm } from "../src/index.js";

config();

function getProviderAndModel(): { provider?: string; model?: string } {
  const appModel = process.env.APP_MODEL;
  const appProvider = process.env.APP_PROVIDER;

  // If APP_MODEL is set, use it (provider will be inferred by Llm)
  if (appModel) {
    return { model: appModel };
  }

  // If APP_PROVIDER is set, determine the model
  if (appProvider) {
    let model: string | undefined;

    // For openrouter, check OPENROUTER_MODEL
    if (appProvider === "openrouter") {
      model = process.env.OPENROUTER_MODEL;
    }

    return { provider: appProvider, model };
  }

  // Default fallback
  return { provider: "gpt-5" };
}

async function main(provider?: string, model?: string) {
  try {
    console.log(
      `Provider: ${provider || "(inferred)"}, Model: ${model || "(default)"}`,
    );

    const llm = new Llm(provider, { model });
    const result = await llm.operate("Tell me a joke about a {{subject}}", {
      data: {
        subject: "pirate",
        rating: "PG",
        style: "Shakespearean",
      },
      instructions: "Keep all content rated {{rating}}",
      system: "You are a {{style}} comedian. Make your jokes terse and punchy.",
    });
    console.log(result.content);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function run() {
  const { provider, model } = getProviderAndModel();

  // Support comma-separated providers (e.g., APP_PROVIDER=anthropic,google,openai)
  const providers = provider?.includes(",")
    ? provider.split(",").map((p) => p.trim())
    : [provider];

  let hasError = false;
  for (const p of providers) {
    const success = await main(p, model);
    if (!success) {
      console.error(`\n❌ Failed for provider "${p}"`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error("\n💀 Exiting with failure");
    process.exit(1);
  } else {
    console.log("\n🎉 Success");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
