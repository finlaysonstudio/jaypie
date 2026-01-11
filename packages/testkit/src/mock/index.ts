// Import all mocks
import * as aws from "./aws";
import * as core from "./core";
import * as datadog from "./datadog";
import * as dynamodb from "./dynamodb";
import * as express from "./express";
import * as kit from "./kit";
import * as lambda from "./lambda";
import * as llm from "./llm";
import * as logger from "./logger";
import * as mongoose from "./mongoose";
import * as textract from "./textract";
import * as vocabulary from "./vocabulary";

// Re-export all mocks
export * from "./aws";
export * from "./core";
export * from "./datadog";
export * from "./dynamodb";
export * from "./express";
export * from "./kit";
export * from "./lambda";
export * from "./llm";
export * from "./logger";
export * from "./mongoose";
export * from "./textract";
export * from "./vocabulary";

// Export default object with all mocks
const mock: Record<string, any> = {
  // AWS module
  ...aws,

  // Core module
  ...core,

  // Datadog module
  ...datadog,

  // DynamoDB module
  ...dynamodb,

  // Express module
  ...express,

  // Kit module
  ...kit,

  // Lambda module
  ...lambda,

  // LLM module
  ...llm,

  // Logger module
  ...logger,

  // Mongoose module
  ...mongoose,

  // Textract module
  ...textract,

  // Vocabulary module
  ...vocabulary,
};

export default mock;
