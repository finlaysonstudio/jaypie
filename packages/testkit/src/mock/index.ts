// Import all mocks
import * as aws from "./aws";
import * as core from "./core";
import * as datadog from "./datadog";
import * as express from "./express";
import * as lambda from "./lambda";
import * as llm from "./llm";
import * as mongoose from "./mongoose";
import * as textract from "./textract";
import { createMockFunction, createAutoMocks, createDeepMock } from "./utils";
import * as setup from "./setup";

// Re-export utilities
export { createMockFunction, createAutoMocks, createDeepMock };

// Re-export all mocks
export * from "./aws";
export * from "./core";
export * from "./datadog";
export * from "./express";
export * from "./lambda";
export * from "./llm";
export * from "./mongoose";
export * from "./textract";
export * from "./setup";

// Export default object with all mocks
export default {
  // Utilities
  createMockFunction,
  createAutoMocks,
  createDeepMock,
  
  // AWS module
  ...aws,
  
  // Core module
  ...core,
  
  // Datadog module
  ...datadog,
  
  // Express module
  ...express,
  
  // Lambda module
  ...lambda,
  
  // LLM module  
  ...llm,
  
  // Mongoose module (now empty)
  ...mongoose,
  
  // Textract module
  ...textract,
  
  // Setup module
  ...setup,
};
