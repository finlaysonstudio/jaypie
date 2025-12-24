import { describe, expect, it } from "vitest";

// Subject - main entry exports core + aws + datadog + express + lambda
import {
  // Core
  JAYPIE,
  PROJECT,
  uuid,
  // AWS
  getSecret,
  sendMessage,
  // Datadog
  DATADOG,
  submitMetric,
  // Express
  EXPRESS,
  expressHandler,
  cors,
  // Lambda
  lambdaHandler,
} from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  describe("Core exports", () => {
    it("Exports constants", () => {
      expect(JAYPIE).not.toBeUndefined();
      expect(PROJECT).not.toBeUndefined();
      expect(PROJECT.SPONSOR).not.toBeUndefined();
      expect(PROJECT.SPONSOR.JAYPIE).toBeString();
    });
    it("Exports functions from @jaypie/kit", () => {
      expect(uuid).toBeFunction();
    });
  });

  describe("AWS exports", () => {
    it("Exports AWS functions", () => {
      expect(getSecret).toBeFunction();
      expect(sendMessage).toBeFunction();
    });
  });

  describe("Datadog exports", () => {
    it("Exports Datadog constant and functions", () => {
      expect(DATADOG).toBeDefined();
      expect(submitMetric).toBeFunction();
    });
  });

  describe("Express exports", () => {
    it("Exports Express constant and functions", () => {
      expect(EXPRESS).toBeDefined();
      expect(expressHandler).toBeFunction();
      expect(cors).toBeFunction();
    });
  });

  describe("Lambda exports", () => {
    it("Exports Lambda functions", () => {
      expect(lambdaHandler).toBeFunction();
    });
  });
});
