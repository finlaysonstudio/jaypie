import { config } from "dotenv";
import { Llm, tools } from "../src/index.js";

config();

const model = new Llm(process.env.APP_PROVIDER as any);

const INSTRUCTIONS =
  "Provide crisp, punchy answers. Be direct and to the point. Avoid flowery language.";

async function main() {
  try {
    const result = await model.operate(
      "Imagine you are on vacation and check the weather",
      {
        format: {
          location: String,
          temperature: Number,
          description: String,
        },
        hooks: {
          beforeEachTool: (tool) => {
            console.log(tool);
          },
        },
        tools,
        instructions: INSTRUCTIONS,
        user: process?.env?.APP_USER || "[client] Jaypie User",
      },
    );
    if (result.error) {
      console.error(result.error);
    } else {
      console.log(result.content);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
