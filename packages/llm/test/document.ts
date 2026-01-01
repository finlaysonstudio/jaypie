/* eslint-disable no-console */
import { config } from "dotenv";
import * as fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  Llm,
  LlmInputContentFile,
  LlmInputContentImage,
  LlmInputContentText,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../src/index.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

//
//
// Constants
//

const REQUEST_IMAGE = "Extract the text from the image.";
const REQUEST_PDF = "Extract the text from this PDF document.";

const IMAGE_FILE_PATH = join(__dirname, "fixtures/page.png");
const PDF_FILE_PATH = join(__dirname, "fixtures/page.pdf");

const REQUIRED_STRINGS = [
  "mock page",
  "this page intentionally blank",
  "mit license",
];

// Models to test for each provider
const MODELS = {
  openai: "gpt-5",
  anthropic: "claude-opus-4-1",
  gemini: "gemini-2.5-pro",
} as const;

//
//
// Helpers
//

function validateContent(content: string, provider: string): boolean {
  const contentLower = content.toLowerCase();
  const missingStrings = REQUIRED_STRINGS.filter(
    (str) => !contentLower.includes(str),
  );

  if (missingStrings.length > 0) {
    console.error(
      `Error: Missing required strings for provider ${provider}:`,
      missingStrings,
    );
    console.error(`Content received: ${content}`);
    return false;
  }

  return true;
}

//
//
// Image Tests
//

async function testImageOpenAI(): Promise<boolean> {
  const provider = "openai";
  const model = MODELS.openai;

  try {
    console.log(`\n============ Image Test: ${provider} (${model})`);

    const base64Image = fs.readFileSync(IMAGE_FILE_PATH, { encoding: "base64" });
    const llm = new Llm(provider, { model });

    const textContent: LlmInputContentText = {
      type: LlmMessageType.InputText,
      text: REQUEST_IMAGE,
    };
    const imageContent: LlmInputContentImage = {
      type: LlmMessageType.InputImage,
      image_url: `data:image/png;base64,${base64Image}`,
    };
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [textContent, imageContent],
    };

    const result = await llm.operate(inputMessage, {
      user: process?.env?.APP_USER || "[document] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    if (!result.content || typeof result.content !== "string") {
      console.error(`Error: No content returned for ${provider}`);
      return false;
    }

    console.log(`Result for ${provider}:`, result.content);

    if (validateContent(result.content, provider)) {
      console.log(`✅ Image test passed for ${provider}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

async function testImageAnthropic(): Promise<boolean> {
  const provider = "anthropic";
  const model = MODELS.anthropic;

  try {
    console.log(`\n============ Image Test: ${provider} (${model})`);

    const base64Image = fs.readFileSync(IMAGE_FILE_PATH, { encoding: "base64" });
    const llm = new Llm(provider, { model });

    // Anthropic uses a different format for images
    // They expect: { type: "image", source: { type: "base64", media_type: "image/png", data: "..." } }
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [
        {
          type: "image" as any,
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64Image,
          },
        },
        {
          type: "text" as any,
          text: REQUEST_IMAGE,
        },
      ] as any,
    };

    const result = await llm.operate(inputMessage, {
      user: process?.env?.APP_USER || "[document] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    if (!result.content || typeof result.content !== "string") {
      console.error(`Error: No content returned for ${provider}`);
      return false;
    }

    console.log(`Result for ${provider}:`, result.content);

    if (validateContent(result.content, provider)) {
      console.log(`✅ Image test passed for ${provider}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

async function testImageGemini(): Promise<boolean> {
  const provider = "gemini";
  const model = MODELS.gemini;

  try {
    console.log(`\n============ Image Test: ${provider} (${model})`);

    const base64Image = fs.readFileSync(IMAGE_FILE_PATH, { encoding: "base64" });
    const llm = new Llm(provider, { model });

    // Gemini now supports the standardized format (adapter converts it)
    const textContent: LlmInputContentText = {
      type: LlmMessageType.InputText,
      text: REQUEST_IMAGE,
    };
    const imageContent: LlmInputContentImage = {
      type: LlmMessageType.InputImage,
      image_url: `data:image/png;base64,${base64Image}`,
    };
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [textContent, imageContent],
    };

    const result = await llm.operate(inputMessage, {
      user: process?.env?.APP_USER || "[document] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    if (!result.content || typeof result.content !== "string") {
      console.error(`Error: No content returned for ${provider}`);
      return false;
    }

    console.log(`Result for ${provider}:`, result.content);

    if (validateContent(result.content, provider)) {
      console.log(`✅ Image test passed for ${provider}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

//
//
// PDF Tests
//

async function testPdfOpenAI(): Promise<boolean> {
  const provider = "openai";
  const model = MODELS.openai;

  try {
    console.log(`\n============ PDF Test: ${provider} (${model})`);

    const base64Pdf = fs.readFileSync(PDF_FILE_PATH, { encoding: "base64" });
    const llm = new Llm(provider, { model });

    const textContent: LlmInputContentText = {
      type: LlmMessageType.InputText,
      text: REQUEST_PDF,
    };
    const fileContent: LlmInputContentFile = {
      type: LlmMessageType.InputFile,
      filename: "page.pdf",
      file_data: `data:application/pdf;base64,${base64Pdf}`,
    };
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [textContent, fileContent],
    };

    const result = await llm.operate(inputMessage, {
      user: process?.env?.APP_USER || "[document] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    if (!result.content || typeof result.content !== "string") {
      console.error(`Error: No content returned for ${provider}`);
      return false;
    }

    console.log(`Result for ${provider}:`, result.content);

    if (validateContent(result.content, provider)) {
      console.log(`✅ PDF test passed for ${provider}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

async function testPdfAnthropic(): Promise<boolean> {
  const provider = "anthropic";
  const model = MODELS.anthropic;

  try {
    console.log(`\n============ PDF Test: ${provider} (${model})`);

    const base64Pdf = fs.readFileSync(PDF_FILE_PATH, { encoding: "base64" });
    const llm = new Llm(provider, { model });

    // Anthropic supports PDF via document type
    // https://docs.anthropic.com/en/docs/build-with-claude/pdf-support
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [
        {
          type: "document" as any,
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Pdf,
          },
        },
        {
          type: "text" as any,
          text: REQUEST_PDF,
        },
      ] as any,
    };

    const result = await llm.operate(inputMessage, {
      user: process?.env?.APP_USER || "[document] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    if (!result.content || typeof result.content !== "string") {
      console.error(`Error: No content returned for ${provider}`);
      return false;
    }

    console.log(`Result for ${provider}:`, result.content);

    if (validateContent(result.content, provider)) {
      console.log(`✅ PDF test passed for ${provider}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

async function testPdfGemini(): Promise<boolean> {
  const provider = "gemini";
  const model = MODELS.gemini;

  try {
    console.log(`\n============ PDF Test: ${provider} (${model})`);

    const base64Pdf = fs.readFileSync(PDF_FILE_PATH, { encoding: "base64" });
    const llm = new Llm(provider, { model });

    // Try using the standard format
    const textContent: LlmInputContentText = {
      type: LlmMessageType.InputText,
      text: REQUEST_PDF,
    };
    const fileContent: LlmInputContentFile = {
      type: LlmMessageType.InputFile,
      filename: "page.pdf",
      file_data: `data:application/pdf;base64,${base64Pdf}`,
    };
    const inputMessage: LlmInputMessage = {
      role: LlmMessageRole.User,
      content: [textContent, fileContent],
    };

    const result = await llm.operate(inputMessage, {
      user: process?.env?.APP_USER || "[document] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    if (!result.content || typeof result.content !== "string") {
      console.error(`Error: No content returned for ${provider}`);
      return false;
    }

    console.log(`Result for ${provider}:`, result.content);

    if (validateContent(result.content, provider)) {
      console.log(`✅ PDF test passed for ${provider}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

//
//
// Test Runners
//

async function runImageTests(): Promise<{ passed: number; failed: number }> {
  console.log("\n\n========================================");
  console.log("       IMAGE TESTS");
  console.log("========================================");

  const results = {
    passed: 0,
    failed: 0,
  };

  const providers = process.env.APP_PROVIDER
    ? process.env.APP_PROVIDER.split(",").map((p) => p.trim())
    : [];

  if (providers.length === 0) {
    console.log("No providers specified, running all image tests...");
    // Run all by default
    const tests = [testImageOpenAI, testImageAnthropic, testImageGemini];
    for (const test of tests) {
      const success = await test();
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  } else {
    for (const provider of providers) {
      let success = false;
      switch (provider.toLowerCase()) {
        case "openai":
          success = await testImageOpenAI();
          break;
        case "anthropic":
          success = await testImageAnthropic();
          break;
        case "gemini":
          success = await testImageGemini();
          break;
        default:
          console.error(`Unknown provider: ${provider}`);
          results.failed++;
          continue;
      }
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  }

  return results;
}

async function runPdfTests(): Promise<{ passed: number; failed: number }> {
  console.log("\n\n========================================");
  console.log("       PDF TESTS");
  console.log("========================================");

  const results = {
    passed: 0,
    failed: 0,
  };

  const providers = process.env.APP_PROVIDER
    ? process.env.APP_PROVIDER.split(",").map((p) => p.trim())
    : [];

  if (providers.length === 0) {
    console.log("No providers specified, running all PDF tests...");
    // Run all by default
    const tests = [testPdfOpenAI, testPdfAnthropic, testPdfGemini];
    for (const test of tests) {
      const success = await test();
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  } else {
    for (const provider of providers) {
      let success = false;
      switch (provider.toLowerCase()) {
        case "openai":
          success = await testPdfOpenAI();
          break;
        case "anthropic":
          success = await testPdfAnthropic();
          break;
        case "gemini":
          success = await testPdfGemini();
          break;
        default:
          console.error(`Unknown provider: ${provider}`);
          results.failed++;
          continue;
      }
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  }

  return results;
}

async function main() {
  const testType = process.env.TEST_TYPE?.toLowerCase() || "all";

  let imageResults = { passed: 0, failed: 0 };
  let pdfResults = { passed: 0, failed: 0 };

  if (testType === "image" || testType === "all") {
    imageResults = await runImageTests();
  }

  if (testType === "pdf" || testType === "all") {
    pdfResults = await runPdfTests();
  }

  console.log("\n\n========================================");
  console.log("       SUMMARY");
  console.log("========================================");

  const totalPassed = imageResults.passed + pdfResults.passed;
  const totalFailed = imageResults.failed + pdfResults.failed;

  if (testType === "image" || testType === "all") {
    console.log(
      `Image Tests: ${imageResults.passed} passed, ${imageResults.failed} failed`,
    );
  }
  if (testType === "pdf" || testType === "all") {
    console.log(
      `PDF Tests: ${pdfResults.passed} passed, ${pdfResults.failed} failed`,
    );
  }
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);

  if (totalFailed > 0) {
    console.error("\n💀 Exiting with failed tests");
    process.exit(1);
  } else if (totalPassed > 0) {
    console.log("\n🎉 All tests passed");
  } else {
    console.log("\n⚠️ No tests ran");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
