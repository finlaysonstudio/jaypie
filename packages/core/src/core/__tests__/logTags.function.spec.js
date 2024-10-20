// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import logTags from "../logTags.function.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("LogTags Function", () => {
  it("Works", () => {
    const response = logTags();
    expect(typeof response).toBe("object");
    expect(response).not.toBeUndefined();
    expect(response).toBeObject();
  });
  it("Returns the tags I pass it", () => {
    const tags = {
      project: "world",
    };
    const response = logTags(tags);
    expect(response).toMatchObject(tags);
  });
  describe("Features", () => {
    // Commit
    it("Includes a commit tag", () => {
      process.env.PROJECT_COMMIT = "abcd1234";
      const response = logTags();
      expect(response.commit).toBeString();
    });
    // Environment
    it("Includes an environment tag", () => {
      process.env.PROJECT_ENV = "dev";
      const response = logTags();
      expect(response.env).toBeString();
    });
    // Project
    it("Includes a project tag", () => {
      process.env.PROJECT_KEY = "the-project";
      const response = logTags();
      expect(response.project).toBeString();
    });
    // Service
    it("Includes a service tag", () => {
      process.env.PROJECT_SERVICE = "the-service";
      const response = logTags();
      expect(response.service).toBeString();
    });
    // Sponsor
    it("Includes a sponsor tag", () => {
      process.env.PROJECT_SPONSOR = "the-sponsor";
      const response = logTags();
      expect(response.sponsor).toBeString();
    });
    // Version
    it("Includes a version tag", () => {
      process.env.PROJECT_VERSION = "0.0.1";
      const response = logTags();
      expect(response.version).toBeString();
    });
  });
});
