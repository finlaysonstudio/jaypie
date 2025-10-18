// Import all mocks
import * as aws from "./aws";
import * as core from "./core";
import * as datadog from "./datadog";
import * as express from "./express";
import * as kit from "./kit";
import * as lambda from "./lambda";
import * as llm from "./llm";
import * as logger from "./logger";
import * as mongoose from "./mongoose";
import * as textract from "./textract";

// Re-export all mocks
export * from "./aws";
export * from "./core";
export * from "./datadog";
export * from "./express";
export * from "./kit";
export * from "./lambda";
export * from "./llm";
export * from "./logger";
export * from "./mongoose";
export * from "./textract";

// Export default object with all mocks
const mock: Record<string, any> = {
  // AWS module
  ...aws,

  // Core module
  ...core,

  // Datadog module
  ...datadog,

  // Express module
  ...express,

  ...kit,

  // Lambda module
  ...lambda,

  // LLM module
  ...llm,

  ...logger,

  // Mongoose module (now empty)
  ...mongoose,

  // Textract module
  ...textract,
};

export default mock;
