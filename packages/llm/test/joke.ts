/* eslint-disable no-console */
import { config } from "dotenv";
import { Llm } from "../src/index.js";

config();

async function main(provider: string) {
  try {
    const model = new Llm(provider);
    const result = await model.operate("Tell me a joke about a {{subject}}", {
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

async function runAllProviders() {
  const providers = ["gpt-5"];

  let hasError = false;
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
